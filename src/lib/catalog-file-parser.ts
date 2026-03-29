import * as XLSX from 'xlsx';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ParsedCatalogRow = {
  supplierSku?: string | null;
  productName: string;
  costPrice: number;
  categoryHint?: string | null;
  rawPayload?: Record<string, unknown>;
};

export type CatalogParseMode = 'spreadsheet' | 'pdf_text' | 'pdf_ocr';

export type ParsedCatalogFileResult = {
  rows: ParsedCatalogRow[];
  mode: CatalogParseMode;
  ocrUsed: boolean;
};

export type CatalogParseProgress = {
  message: string;
  progress?: number;
  usingOcr?: boolean;
};

type PdfTextChunk = {
  text: string;
  x: number;
  y: number;
  width: number;
};

type PdfLine = {
  pageNumber: number;
  lineIndex: number;
  text: string;
};

type ParseCatalogFileOptions = {
  enableOcrFallback?: boolean;
  onProgress?: (progress: CatalogParseProgress) => void;
};

const PDF_ROW_Y_TOLERANCE = 3;
const PDF_NAME_BUFFER_LIMIT = 2;
const PDF_OCR_RENDER_SCALE = 2;
const PDF_PRICE_PATTERN = /(?:R\$\s*)?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2}|\.\d{2})|\d+(?:,\d{2}|\.\d{2})/g;
const PDF_IGNORED_LINE_PATTERNS = [
  /^p[aá]gina\b/i,
  /^page\b/i,
  /cat[aá]logo/i,
  /whatsapp/i,
  /instagram/i,
  /facebook/i,
  /tiktok/i,
  /www\./i,
  /@/i,
  /cnpj/i,
  /pedido m[ií]nimo/i,
  /formas? de pagamento/i,
  /pix/i,
  /transfer[êe]ncia/i,
  /consulte/i,
  /sujeito a altera[cç][aã]o/i,
  /v[aá]lido at[eé]/i,
];

const normalizeHeader = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const parseMoney = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const detectColumns = (headers: string[]) => {
  const normalized = headers.map((header) => ({ original: header, normalized: normalizeHeader(header) }));

  const pick = (patterns: string[]) =>
    normalized.find((entry) => patterns.some((pattern) => entry.normalized.includes(pattern)))?.original || null;

  return {
    sku: pick(['sku', 'codigo', 'codigobarras', 'referencia', 'ref']),
    name: pick(['produto', 'descricao', 'descricaoproduto', 'nome', 'item']),
    cost: pick(['custo', 'preco', 'precofornecedor', 'valor', 'compra', 'atacado']),
    category: pick(['categoria', 'grupo', 'departamento', 'segmento']),
  };
};

function getFileExtension(fileName: string) {
  return fileName.toLowerCase().split('.').pop() || '';
}

function getCatalogSourceTypeFromExtension(extension: string) {
  if (extension === 'csv') return 'csv';
  if (extension === 'pdf') return 'pdf';
  return 'spreadsheet';
}

function reportParseProgress(
  onProgress: ParseCatalogFileOptions['onProgress'],
  message: string,
  options?: { progress?: number; usingOcr?: boolean },
) {
  onProgress?.({
    message,
    progress: options?.progress,
    usingOcr: options?.usingOcr,
  });
}

function normalizePdfLine(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([([])\s+/g, '$1')
    .trim();
}

function hasPdfPrice(line: string) {
  return /(?:R\$\s*)?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2}|\.\d{2})|\d+(?:,\d{2}|\.\d{2})/.test(line);
}

function isIgnoredPdfLine(line: string) {
  if (!line) return true;
  if (!/[a-zA-Z]/.test(line)) return true;
  return PDF_IGNORED_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function normalizeCatalogTitle(value: string) {
  return normalizePdfLine(
    String(value || '')
      .replace(/\bC[ÓO]D\.?\s*[:-]?\s*[A-Z0-9./-]+\b/gi, ' ')
      .replace(/\bTAM\.?\s*[:-]?\s*[^|]+/gi, ' ')
      .replace(/\bOURO\b/gi, ' ')
      .replace(/\bR[ÓO]DIO\b/gi, ' ')
      .replace(/\bPRATA\b/gi, ' ')
      .replace(/[|]+/g, ' ')
      .replace(/\s{2,}/g, ' '),
  );
}

function isSectionHeading(line: string) {
  if (!line || isIgnoredPdfLine(line)) return false;
  if (hasPdfPrice(line)) return false;
  if (/\bC[ÓO]D\b/i.test(line) || /\bTAM\b/i.test(line)) return false;
  const normalized = normalizeCatalogTitle(line);
  if (!normalized) return false;
  const alphaCount = (normalized.match(/[a-zA-Z]/g) || []).length;
  return alphaCount >= 4 && normalized.length <= 60;
}

function isNameFragment(line: string) {
  if (!line || isIgnoredPdfLine(line)) return false;
  if (hasPdfPrice(line)) return false;
  const alphaCount = (line.match(/[a-zA-Z]/g) || []).length;
  return alphaCount >= 4;
}

function extractSkuCandidate(line: string) {
  const explicitCode = line.match(/\bC[ÓO]D\.?\s*[:-]?\s*([A-Z0-9./-]{3,})/i);
  if (explicitCode?.[1]) return explicitCode[1];
  const match = line.match(/^([A-Z0-9][A-Z0-9._/-]{2,24})\b/i);
  if (!match) return null;
  const candidate = match[1];
  if (/^\d+(?:[.,]\d+)?$/.test(candidate)) return null;
  return candidate;
}

function joinPdfChunks(chunks: PdfTextChunk[]) {
  const ordered = [...chunks].sort((a, b) => a.x - b.x);
  let result = '';
  let previousRight = 0;

  for (const chunk of ordered) {
    if (!result) {
      result = chunk.text;
      previousRight = chunk.x + chunk.width;
      continue;
    }

    const gap = chunk.x - previousRight;
    const separator = gap > 1.5 ? ' ' : '';
    result += `${separator}${chunk.text}`;
    previousRight = chunk.x + chunk.width;
  }

  return normalizePdfLine(result);
}

function buildPdfRow(
  line: string,
  pageNumber: number,
  lineIndex: number,
  carriedNameParts: string[],
  currentSectionTitle: string | null,
) {
  const matches = Array.from(line.matchAll(PDF_PRICE_PATTERN));
  if (!matches.length) return null;

  const priceToken = matches[matches.length - 1]?.[0] || '';
  const costPrice = parseMoney(priceToken);
  if (costPrice <= 0) return null;

  const supplierSku = extractSkuCandidate(line);
  const indexMatch = line.match(/^\s*(\d{1,3})\s*-/);
  const itemIndex = indexMatch?.[1] || null;
  let productName = normalizeCatalogTitle(
    line
      .replace(priceToken, ' ')
      .replace(/\bC[ÓO]D\.?\s*[:-]?\s*[A-Z0-9./-]+\b/gi, ' ')
      .replace(/\bTAM\.?\s*[:-]?\s*[^|]+/gi, ' ')
      .replace(/^\s*\d{1,3}\s*-\s*/g, ' ')
      .replace(/\b\d{1,3}\b/g, ' '),
  );

  if (carriedNameParts.length) {
    productName = normalizeCatalogTitle(`${carriedNameParts.join(' ')} ${productName}`);
  }

  if (!productName && currentSectionTitle) {
    productName = itemIndex ? `${currentSectionTitle} ${itemIndex}` : currentSectionTitle;
  } else if (currentSectionTitle && itemIndex && !productName.toLowerCase().includes(currentSectionTitle.toLowerCase())) {
    productName = `${currentSectionTitle} ${itemIndex}`;
  }

  const alphaCount = (productName.match(/[a-zA-Z]/g) || []).length;
  if (alphaCount < 4) return null;

  return {
    supplierSku,
    productName,
    costPrice,
    categoryHint: null,
    rawPayload: {
      source: 'pdf',
      pageNumber,
      lineIndex,
      extractedLine: line,
    },
  } satisfies ParsedCatalogRow;
}

async function parseSpreadsheetCatalogFile(file: File): Promise<ParsedCatalogRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Nao foi possivel encontrar uma aba valida no arquivo.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (!rows.length) {
    throw new Error('O arquivo esta vazio ou sem linhas validas.');
  }

  const headers = Object.keys(rows[0] || {});
  const columns = detectColumns(headers);
  const fallbackNameKey = headers[0] || null;

  const parsed = rows
    .map((row) => {
      const productName = String(
        (columns.name && row[columns.name]) ||
        (fallbackNameKey && row[fallbackNameKey]) ||
        '',
      ).trim();

      const costRaw = columns.cost ? row[columns.cost] : '';
      const costPrice = parseMoney(costRaw);

      if (!productName) return null;

      return {
        supplierSku: columns.sku ? String(row[columns.sku] || '').trim() || null : null,
        productName,
        costPrice,
        categoryHint: columns.category ? String(row[columns.category] || '').trim() || null : null,
        rawPayload: row,
      } satisfies ParsedCatalogRow;
    })
    .filter((row): row is ParsedCatalogRow => Boolean(row));

  if (!parsed.length) {
    throw new Error('Nenhum produto valido foi encontrado no arquivo.');
  }

  return parsed;
}

async function extractPdfLines(file: File, onProgress?: ParseCatalogFileOptions['onProgress']) {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const lines: PdfLine[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    reportParseProgress(onProgress, `Lendo texto da pagina ${pageNumber} de ${pdf.numPages}...`, {
      progress: (pageNumber - 1) / Math.max(pdf.numPages, 1),
    });
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = (textContent.items || []) as Array<{ str?: string; transform?: number[]; width?: number }>;
    const rows: Array<{ y: number; chunks: PdfTextChunk[] }> = [];

    for (const item of items) {
      const text = String(item?.str || '').trim();
      if (!text) continue;
      const transform = Array.isArray(item?.transform) ? item.transform : [];
      const x = Number(transform[4] || 0);
      const y = Number(transform[5] || 0);
      const width = Number(item?.width || 0);

      let row = rows.find((entry) => Math.abs(entry.y - y) <= PDF_ROW_Y_TOLERANCE);
      if (!row) {
        row = { y, chunks: [] };
        rows.push(row);
      }
      row.chunks.push({ text, x, y, width });
    }

    const pageLines = rows
      .sort((a, b) => b.y - a.y)
      .map((row, index) => ({
        pageNumber,
        lineIndex: index + 1,
        text: joinPdfChunks(row.chunks),
      }))
      .filter((row) => row.text);

    lines.push(...pageLines);
  }

  return lines;
}

function parsePdfLinesToCatalogRows(pdfLines: PdfLine[], source: 'pdf' | 'pdf_ocr') {
  const parsedRows: ParsedCatalogRow[] = [];
  let nameBuffer: string[] = [];
  let currentSectionTitle: string | null = null;

  for (const line of pdfLines) {
    const normalizedLine = normalizePdfLine(line.text);
    if (!normalizedLine || isIgnoredPdfLine(normalizedLine)) {
      continue;
    }

    if (isSectionHeading(normalizedLine)) {
      currentSectionTitle = normalizeCatalogTitle(normalizedLine);
      nameBuffer = [];
      continue;
    }

    const row = buildPdfRow(normalizedLine, line.pageNumber, line.lineIndex, nameBuffer, currentSectionTitle);
    if (row) {
      row.rawPayload = {
        ...row.rawPayload,
        source,
      };
      parsedRows.push(row);
      nameBuffer = [];
      continue;
    }

    if (isNameFragment(normalizedLine)) {
      nameBuffer.push(normalizedLine);
      if (nameBuffer.length > PDF_NAME_BUFFER_LIMIT) {
        nameBuffer = nameBuffer.slice(-PDF_NAME_BUFFER_LIMIT);
      }
    } else {
      nameBuffer = [];
    }
  }

  return parsedRows;
}

async function extractPdfLinesWithOcr(file: File, onProgress?: ParseCatalogFileOptions['onProgress']) {
  reportParseProgress(onProgress, 'Convertendo PDF escaneado com OCR...', {
    progress: 0,
    usingOcr: true,
  });

  const [{ createWorker, OEM, PSM }, data] = await Promise.all([
    import('tesseract.js'),
    file.arrayBuffer(),
  ]);
  const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
  const worker = await createWorker(['por', 'eng'], OEM.DEFAULT, {
    logger: (event) => {
      if (event.status !== 'recognizing text') return;
      reportParseProgress(onProgress, 'Convertendo PDF escaneado com OCR...', {
        progress: event.progress,
        usingOcr: true,
      });
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
    });

    const lines: PdfLine[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      reportParseProgress(onProgress, `Aplicando OCR na pagina ${pageNumber} de ${pdf.numPages}...`, {
        progress: (pageNumber - 1) / Math.max(pdf.numPages, 1),
        usingOcr: true,
      });

      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_OCR_RENDER_SCALE });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Nao foi possivel preparar o canvas para OCR.');
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      const recognized = await worker.recognize(canvas, { rotateAuto: true });
      const recognizedText = String(recognized?.data?.text || '');
      const pageLines = recognizedText
        .split('\n')
        .map((line) => normalizePdfLine(line))
        .filter(Boolean)
        .map((text, index) => ({
          pageNumber,
          lineIndex: index + 1,
          text,
        }));

      lines.push(...pageLines);
    }

    return lines;
  } finally {
    await worker.terminate();
  }
}

async function parsePdfCatalogFile(
  file: File,
  options?: ParseCatalogFileOptions,
): Promise<ParsedCatalogFileResult> {
  const enableOcrFallback = options?.enableOcrFallback ?? false;

  reportParseProgress(options?.onProgress, 'Lendo texto do PDF...', { progress: 0 });
  const pdfLines = await extractPdfLines(file, options?.onProgress);
  const parsedRows = parsePdfLinesToCatalogRows(pdfLines, 'pdf');

  if (parsedRows.length) {
    return {
      rows: parsedRows,
      mode: 'pdf_text',
      ocrUsed: false,
    };
  }

  if (!enableOcrFallback) {
    if (!pdfLines.length) {
      throw new Error('Nao foi encontrado texto selecionavel no PDF. Ative a conversao automatica para PDF escaneado ou envie XLSX/CSV.');
    }
    throw new Error('Nao foi possivel identificar itens com nome e preco no PDF. Ative a conversao automatica para PDF escaneado ou envie XLSX/CSV.');
  }

  const ocrLines = await extractPdfLinesWithOcr(file, options?.onProgress);
  const ocrRows = parsePdfLinesToCatalogRows(ocrLines, 'pdf_ocr');

  if (!ocrRows.length) {
    throw new Error('Nao foi possivel converter o PDF escaneado automaticamente. Se puder, envie o catalogo em XLSX ou CSV.');
  }

  return {
    rows: ocrRows,
    mode: 'pdf_ocr',
    ocrUsed: true,
  };
}

export function getCatalogSourceType(fileName: string) {
  return getCatalogSourceTypeFromExtension(getFileExtension(fileName));
}

export async function parseCatalogFile(
  file: File,
  options?: ParseCatalogFileOptions,
): Promise<ParsedCatalogFileResult> {
  const extension = getFileExtension(file.name);
  if (extension === 'pdf') {
    return parsePdfCatalogFile(file, options);
  }
  if (['xlsx', 'xls', 'csv'].includes(extension)) {
    reportParseProgress(options?.onProgress, 'Lendo planilha do catalogo...', { progress: 0 });
    return {
      rows: await parseSpreadsheetCatalogFile(file),
      mode: 'spreadsheet',
      ocrUsed: false,
    };
  }
  throw new Error('Use um arquivo XLSX, XLS, CSV ou PDF textual para importar o catalogo.');
}
