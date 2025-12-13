import type { Request, Response } from 'express';
import dotenv from 'dotenv';
// Garante carregamento do .env.local mesmo se o servidor não tiver feito isso ainda
dotenv.config({ path: '.env.local' });

type SuggestBody = {
  productName?: string;
  productType?: string;
  brand?: string;
  materials?: string;
  colors?: string;
  design?: string;
  sizes?: string;
  fit?: string;
  usageContext?: string;
  differentials?: string[] | string;
  kit?: string[] | string;
  care?: string[] | string;
  shipping?: string[] | string;
  keywords?: string[] | string;
};

const normalizeList = (value?: string[] | string): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

export async function generateMLDescription(req: Request, res: Response) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no backend' });
    }

    const body = (req.body || {}) as SuggestBody;
    const {
      productName = '',
      productType = 'acessório',
      brand = '',
      materials = '',
      colors = '',
      design = '',
      sizes = '',
      fit = '',
      usageContext = '',
      differentials = [],
      kit = [],
      care = [],
      shipping = [],
      keywords = [],
    } = body;

    const diffList = normalizeList(differentials);
    const kitList = normalizeList(kit);
    const careList = normalizeList(care);
    const shippingList = normalizeList(shipping);
    const keywordList = normalizeList(keywords);

    const messages = [
      {
        role: 'system' as const,
        content:
          'Você é um copywriter especialista em Mercado Livre. Gere uma descrição enxuta, 100% em português do Brasil, pronta para colar no campo de descrição. Respeite políticas: nada de links, contato, @, garantia inexistente ou promessas exageradas. Retorne APENAS um JSON válido com os campos solicitados.',
      },
      {
        role: 'user' as const,
        content: `Dados de entrada:
- Produto: ${productName || 'não informado'}
- Categoria: ${productType}
- Marca: ${brand || 'Outros'}
- Material: ${materials || 'não informado'}
- Cor/Acabamento: ${colors || 'não informado'}
- Formato/Design: ${design || 'não informado'}
- Tamanhos/Medidas: ${sizes || 'não informado'}
- Ajuste/Conforto: ${fit || 'não informado'}
- Uso/Ocasião: ${usageContext || 'não informado'}
- Diferenciais (lista): ${diffList.join('; ') || 'não informado'}
- Acompanha: ${kitList.join('; ') || 'não informado'}
- Cuidados: ${careList.join('; ') || 'não informado'}
- Envio: ${shippingList.join('; ') || 'não informado'}
- Palavras-chave: ${keywordList.join('; ') || 'não informado'}

Monte sugestões equilibradas, com foco em reduzir devoluções: deixe medidas claras e destaque material/banho.`
      },
    ];

    const pick = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const val = obj?.[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') return val;
      }
      return undefined;
    };

    const preferList = (primary: string[] | string | undefined, fallback: string[] | string) => {
      const primaryList = normalizeList(primary);
      if (primaryList.length > 0) return primaryList;
      return normalizeList(fallback);
    };

    const buildSuggestion = (parsed: any) => ({
      productName: pick(parsed, ['productName', 'titulo', 'title', 'nome']) || productName,
      brand: pick(parsed, ['brand', 'marca']) || brand || 'Outros',
      materials: pick(parsed, ['materials', 'material']) || materials,
      colors: pick(parsed, ['colors', 'cor', 'acabamento']) || colors,
      design: pick(parsed, ['design', 'formato']) || design,
      sizes: pick(parsed, ['sizes', 'medidas', 'tamanhos']) || sizes,
      fit: pick(parsed, ['fit', 'ajuste', 'conforto']) || fit,
      usageContext: pick(parsed, ['usageContext', 'uso', 'ocasiao']) || usageContext,
      differentials: preferList(pick(parsed, ['differentials', 'diferenciais', 'highlights']), diffList),
      kit: preferList(pick(parsed, ['kit', 'conteudo', 'acompanhamentos']), kitList),
      care: preferList(pick(parsed, ['care', 'cuidados']), careList),
      shipping: preferList(pick(parsed, ['shipping', 'envio', 'logistica']), shippingList),
      keywords: preferList(pick(parsed, ['keywords', 'tags', 'palavrasChave']), keywordList),
    });

    // Apenas Gemini (free tier) via chamada HTTP direta
    const prompt = `${messages[0].content}\n\n${messages[1].content}\n\nResponda apenas em JSON com os campos: productName, brand, materials, colors, design, sizes, fit, usageContext, differentials (array), kit (array), care (array), shipping (array), keywords (array).`;

    const models = [
      'gemini-1.5-flash-002',
      'gemini-1.5-flash',
      'gemini-pro',
    ];

    let raw: string | null = null;
    let lastError: any = null;

    for (const model of models) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          lastError = { status: resp.status, txt };
          if (resp.status === 404) continue; // tenta próximo modelo
          throw new Error(txt || `Erro ${resp.status}`);
        }

        const json = await resp.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        raw = text || '{}';
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (!raw) {
      console.error('Gemini falhou para todos os modelos.', lastError);
      return res.status(500).json({
        error: 'Não foi possível gerar a descrição (Gemini)',
        details: lastError,
      });
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error('Erro ao parsear resposta da Gemini:', err, raw);
      return res.status(500).json({ error: 'Falha ao interpretar resposta da IA', details: raw });
    }

    return res.json({
      suggestion: buildSuggestion(parsed),
      raw,
    });
  } catch (error: any) {
    console.error('Erro ao gerar descrição com IA:', error?.response?.data || error?.message || error);
    return res.status(500).json({
      error: 'Não foi possível gerar a descrição',
      details: error?.response?.data || error?.message,
    });
  }
}
