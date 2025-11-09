#!/usr/bin/env node
/**
 * prepare-import.cjs
 *
 * Objetivo: Sanitizar um CSV de tarefas, remover quebras de linha internas,
 * extrair "Parent: <nome>" da descrição e mover para uma coluna dedicada `parent`.
 * Gera um novo CSV com cabeçalho padronizado:
 * name,description,status,due_date,start_date,tags,parent
 *
 * Uso:
 *   node scripts/clickup/prepare-import.cjs --src <arquivo_origem.csv> --dst <arquivo_destino.csv>
 *
 * Exemplo:
 *   node scripts/clickup/prepare-import.cjs \
 *     --src scripts/clickup/vermezzo-notes-full.csv \
 *     --dst scripts/clickup/vermezzo-notes-parent.csv
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--src') out.src = args[++i];
    else if (a === '--dst') out.dst = args[++i];
    else if (a.startsWith('--src=')) out.src = a.split('=')[1];
    else if (a.startsWith('--dst=')) out.dst = a.split('=')[1];
  }
  return out;
}

function ensureFileExists(p) {
  if (!p) throw new Error('Parâmetro ausente: --src <arquivo.csv>');
  if (!fs.existsSync(p)) {
    throw new Error(`Arquivo de origem não encontrado: ${p}`);
  }
}

function readFileNormalized(p) {
  const raw = fs.readFileSync(p, 'utf8');
  // Normaliza quebras e remove BOM se houver
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

// Une linhas até que a contagem de aspas seja par (registro completo)
function splitRecordsPreservingQuotedNewlines(text) {
  const lines = text.split('\n');
  const records = [];
  let buf = '';
  let quoteCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (buf.length > 0) buf += '\n' + line; else buf = line;
    // Conta aspas na linha acumulada
    quoteCount = (buf.match(/\"/g) || []).length;
    if (quoteCount % 2 === 0) {
      records.push(buf);
      buf = '';
      quoteCount = 0;
    }
  }
  if (buf.length > 0) records.push(buf);
  return records.filter(r => r.trim().length > 0);
}

// Parser CSV simples que respeita aspas
function parseCsvRow(row) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') { // aspas escapada ""
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function csvEscapeField(val) {
  if (val == null) val = '';
  const needsQuote = /[",\n]/.test(val);
  let out = String(val).replace(/"/g, '""');
  return needsQuote ? '"' + out + '"' : out;
}

function stringifyCsv(rows, headerOrder) {
  const header = headerOrder.map(csvEscapeField).join(',');
  const body = rows.map(r => headerOrder.map(k => csvEscapeField(r[k])).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

function extractParentFromDescription(desc) {
  if (!desc) return { description: desc || '', parent: '' };
  const regex = /Parent:\s*([^\n\r]+)/i;
  const m = desc.match(regex);
  if (m) {
    const parent = m[1].trim();
    const cleaned = desc.replace(regex, '').replace(/\s+$/,'').trim();
    return { description: cleaned, parent };
  }
  return { description: desc, parent: '' };
}

function main() {
  const { src, dst } = parseArgs();
  ensureFileExists(src);
  const outPath = dst || path.join(path.dirname(src), 'vermezzo-notes-parent.csv');

  const normalized = readFileNormalized(src);
  const records = splitRecordsPreservingQuotedNewlines(normalized);
  if (records.length === 0) throw new Error('CSV de origem está vazio.');

  const headerFields = parseCsvRow(records[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const cols = parseCsvRow(records[i]);
    const obj = {};
    for (let j = 0; j < headerFields.length; j++) {
      obj[headerFields[j]] = cols[j] != null ? cols[j] : '';
    }
    const { description, parent } = extractParentFromDescription(obj.description);
    obj.description = description;
    obj.parent = obj.parent || parent; // preserva parent já existente ou usa extraído
    // Evita auto-parent: quando o parent tem o mesmo nome da tarefa
    const norm = s => (s || '').trim().toLowerCase();
    if (norm(obj.parent) === norm(obj.name)) {
      obj.parent = '';
    }
    rows.push(obj);
  }

  // Padroniza colunas finais
  const headerOrder = ['name', 'description', 'status', 'due_date', 'start_date', 'tags', 'parent'];
  const shaped = rows.map(r => ({
    name: r.name || '',
    description: r.description || '',
    status: r.status || '',
    due_date: r.due_date || '',
    start_date: r.start_date || '',
    tags: r.tags || '',
    parent: r.parent || ''
  }));

  const output = stringifyCsv(shaped, headerOrder);
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`✅ Arquivo gerado: ${outPath}`);
  console.log(`Registros: ${shaped.length}`);
}

try {
  main();
} catch (err) {
  console.error('Erro ao preparar CSV:', err.message);
  process.exit(1);
}
