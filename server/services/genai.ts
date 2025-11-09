import { config as dotenvConfig } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
dotenvConfig();

type GenAIResult = {
  title: string;
  description: string;
  recommendation?: string | null;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  insight_type?: 'warning' | 'opportunity' | 'recommendation' | 'alert' | 'info';
  source?: 'llm' | 'fallback';
};

function getGeminiApiKey(): string {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
}

function getGeminiClient(): GoogleGenerativeAI | null {
  const key = getGeminiApiKey();
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

function buildLLMPrompt(prompt: string, context: Record<string, any>): string {
  const ctx = JSON.stringify(context ?? {}, null, 2);
  return [
    'Você é um analista de performance de marketing digital.',
    'Gere um insight objetivo e acionável com base no PROMPT e no CONTEXTO.',
    'Responda estritamente em JSON válido com o seguinte schema:',
    '{',
    '  "title": string,',
    '  "description": string,',
    '  "recommendation": string | null,',
    '  "severity": "low" | "medium" | "high" | "critical",',
    '  "insight_type": "warning" | "opportunity" | "recommendation" | "alert" | "info"',
    '}',
    '',
    'PROMPT:',
    prompt,
    '',
    'CONTEXTO (JSON):',
    ctx,
  ].join('\n');
}

function safeJsonExtract(text: string): any | null {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  const cleanJson = (input: string): string => {
    let out = input.trim();
    // Remover cercas de código e linguagem
    out = out.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    // Normalizar aspas “ ” ‘ ’
    out = out.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    // Remover vírgulas finais antes de } ]
    out = out.replace(/,(\s*[}\]])/g, '$1');
    // Chaves não citadas simples => citar
    out = out.replace(/([\s{,])(\w+)\s*:/g, (_m, pre, key) => `${pre}"${key}":`);
    // Valores com aspas simples => converter para aspas duplas
    out = out.replace(/:\s*'([^']*)'/g, ': "$1"');
    return out;
  };

  // 1) Tentar parse direto
  const direct = tryParse(text.trim());
  if (direct) return direct;

  // 2) Extrair bloco cercado por ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    const raw = fenced[1].trim();
    const parsed = tryParse(raw) || tryParse(cleanJson(raw));
    if (parsed) return parsed;
  }

  // 3) Procurar primeiro bloco {...}
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    const blob = objMatch[0];
    const parsed = tryParse(blob) || tryParse(cleanJson(blob));
    if (parsed) return parsed;
  }

  // 4) Último recurso: normalizar tudo e tentar
  const normalized = cleanJson(text);
  return tryParse(normalized);
}

function salvageFromText(text: string, prompt: string): GenAIResult {
  const raw = (text || '').trim();
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Title heurística: primeira linha curta ou linha com tom de insight
  const firstLine = lines[0] || '';
  const title = (firstLine.length > 0 && firstLine.length <= 140)
    ? firstLine.replace(/^[-•\s]+/, '')
    : `Insight: ${(firstLine || prompt).slice(0, 100)}...`;

  // Description: usa resto do texto; se vazio, resume o prompt
  const body = lines.slice(1).join('\n');
  let description = body.length >= 10 ? body : `${raw || ''}`.trim();
  if (!description) {
    description = `Resumo do prompt: ${prompt.trim()}`;
  }

  // Recommendation: extrair bloco após labels comuns
  let recommendation: string | null = null;
  const recMatch = raw.match(/(?:recomenda\w*|sugest\w*|ação\s*proposta)[:-]\s*([\s\S]{10,})/i);
  if (recMatch) {
    recommendation = recMatch[1].trim().split(/\n\n/)[0].trim();
  }

  // Severidade e tipo por palavras-chave
  const isCritical = /\burgente\b|\bcrítico\b|\bcrise\b|\bgrave\b/i.test(raw);
  const isWarning = /\balerta\b|\batenção\b|\bqueda\b|\brisco\b/i.test(raw);
  const isOpportunity = /\boportunidade\b|\bescala\b|\bmelhorar\b|\botimizar\b/i.test(raw);
  const isRecommendation = /\brecomenda\w*\b|\bsugest\w*\b/i.test(raw);

  const severity: GenAIResult['severity'] = isCritical ? 'high' : 'medium';
  const insight_type: GenAIResult['insight_type'] = isRecommendation
    ? 'recommendation'
    : isWarning
      ? 'warning'
      : isOpportunity
        ? 'opportunity'
        : 'info';

  return {
    title,
    description,
    recommendation,
    severity,
    insight_type,
    source: 'llm',
  };
}

/**
 * Prompt-based insight generation using Gemini when available, with deterministic fallback.
 */
export async function generateInsightFromPrompt(
  prompt: string,
  context: Record<string, any> = {}
): Promise<GenAIResult> {
  const client = getGeminiClient();

  if (client) {
    try {
      const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const llmPrompt = buildLLMPrompt(prompt, context);
      const result = await model.generateContent(llmPrompt);
      const text = result.response?.text?.() ?? '';
      if (process.env.NODE_ENV === 'development') {
        console.debug('LLM raw response (primeiros 400 chars):', text.slice(0, 400));
      }
      const parsed = safeJsonExtract(text);
      if (parsed && typeof parsed === 'object') {
        // Basic validation and normalization
        const title = String(parsed.title || 'Insight gerado pelo LLM');
        const description = String(
          parsed.description || `Resumo do prompt: ${prompt.trim()}`
        );
        const recommendation = parsed.recommendation != null ? String(parsed.recommendation) : null;
        const severity = typeof parsed.severity === 'string' && ['low', 'medium', 'high', 'critical'].includes(parsed.severity)
          ? (parsed.severity as GenAIResult['severity'])
          : 'medium';
        const insight_type = typeof parsed.insight_type === 'string' && ['warning', 'opportunity', 'recommendation', 'alert', 'info'].includes(parsed.insight_type)
          ? (parsed.insight_type as GenAIResult['insight_type'])
          : 'info';

        return { title, description, recommendation, severity, insight_type, source: 'llm' } as GenAIResult;
      }
      // Fall through to deterministic fallback if parse fails
      console.warn('LLM retornou formato inesperado, usando fallback determinístico.');
      // Em vez de resposta genérica, tentar extrair conteúdo do texto para título/descrição
      const salvaged = salvageFromText(text, prompt);
      if (salvaged.title && salvaged.description) {
        return salvaged;
      }
    } catch (e) {
      console.error('Erro ao gerar insight via LLM:', e);
      // Continue to fallback
    }
  }

  // Deterministic fallback
  const normalized = prompt.trim();
  const isCritical = /\burgente\b|\bcrítico\b|\bcrise\b/i.test(normalized);
  const isRecommendation = /\brecomend(a|ação)\b|\bsugest/i.test(normalized);
  const isWarning = /\balerta\b|\batenção\b|\bqueda\b/i.test(normalized);

  const severity: GenAIResult['severity'] = isCritical ? 'high' : 'medium';
  const insight_type: GenAIResult['insight_type'] = isRecommendation ? 'recommendation' : isWarning ? 'warning' : 'info';

  const hasHeadlines = /headline|título|titulo/i.test(normalized);
  const hasDescriptions = /descriç|description/i.test(normalized);
  const hasCTA = /cta|call\s*to\s*action|chamada\s*para\s*ação/i.test(normalized);

  const suggestions: string[] = [];
  if (hasHeadlines) {
    suggestions.push('- Teste 3 variações de título entre 30–60 caracteres.');
    suggestions.push('- Use benefício explícito no início (ex.: Economize, Ganhe, Descubra).');
  }
  if (hasDescriptions) {
    suggestions.push('- Mantenha a descrição clara e escaneável em 1–2 frases.');
    suggestions.push('- Inclua prova social ou diferenciais concretos (ex.: +5k clientes).');
  }
  if (hasCTA) {
    suggestions.push('- Compare CTAs com e sem verbos fortes (Comprar Agora vs. Saiba Mais).');
    suggestions.push('- Adapte o CTA ao estágio do funil (Descobrir, Considerar, Converter).');
  }
  const checklist = suggestions.length > 0 ? `\n\nChecklist:\n${suggestions.join('\n')}` : '';

  return {
    title: 'Insight gerado pelo prompt',
    description: `Prompt: ${normalized}\n\nResumo automático com base no contexto atual.${checklist}`,
    recommendation: isRecommendation ? 'Aplique as sugestões do prompt considerando as métricas atuais.' : null,
    severity,
    insight_type,
    source: 'fallback',
  };
}
