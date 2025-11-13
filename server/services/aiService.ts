import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import {
  getTopCampaigns,
  getUnderperformingCampaigns,
  getMetricsSummary,
  comparePlatforms,
  getPerformanceByObjective,
  getMetricsTrend,
  getCampaignDetails,
} from '../tools/dataQueries.js';

// Initialize Gemini client lazily to ensure env vars are loaded
let genAI: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

type AIProvider = 'gemini' | 'openai';

function resolveAIProvider(): AIProvider {
  const configured = (process.env.AI_PROVIDER || '').toLowerCase();
  if (configured === 'openai' || configured === 'gemini') {
    return configured as AIProvider;
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  return 'gemini';
}

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
}

const SYSTEM_PROMPT = `Você é um assistente de IA especializado em análise de tráfego pago e marketing digital. Você tem acesso direto ao banco de dados Supabase com campanhas de Meta Ads, Google Ads e Instagram.

Sua função é ajudar o usuário a:
- Analisar performance de campanhas específicas
- Analisar criativos (copies, títulos, descrições, formatos)
- Identificar oportunidades de otimização
- Comparar performance entre diferentes criativos
- Responder perguntas sobre métricas
- Fornecer recomendações estratégicas baseadas em dados REAIS

IMPORTANTE:
1. Quando o usuário mencionar uma campanha específica (ex: "campanha de leads whatsapp 23/10"), os dados dessa campanha serão automaticamente buscados no banco de dados e fornecidos a você.
2. Os dados incluem TUDO: métricas da campanha, copies de cada criativo, performance individual de cada anúncio, variações de copy, etc.
3. SEMPRE use os dados fornecidos na seção "Dados Relevantes" quando disponíveis.
4. NUNCA invente dados ou peça ao usuário para fornecer informações que você já tem acesso.
5. Se os dados não foram fornecidos, significa que a campanha não foi encontrada - nesse caso, informe ao usuário.
6. Analise os dados de forma clara e objetiva, fornecendo insights acionáveis.
7. Ao analisar criativos, compare performance entre eles e identifique padrões de sucesso.
8. SEMPRE se refira aos criativos pelo NOME DO ANÚNCIO (ad_name), NUNCA use "Criativo 1", "Criativo 2", etc. O usuário precisa identificar facilmente qual anúncio você está analisando.
9. ATENÇÃO AOS TIPOS DE CONVERSÃO: Cada campanha tem um objetivo específico e as "conversões" se referem a esse objetivo:
   - OUTCOME_LEADS = Leads (mensagens WhatsApp, formulários, etc.)
   - OUTCOME_SALES = Vendas/Compras
   - OUTCOME_TRAFFIC = Cliques no link
   - OUTCOME_ENGAGEMENT = Engajamento (curtidas, comentários)
   Quando mencionar conversões, SEMPRE especifique o tipo (ex: "52 leads pelo WhatsApp" ao invés de apenas "52 conversões").
10. **CONTEXTO DE CONVERSA**: Quando o usuário fizer uma pergunta de acompanhamento (ex: "qual periodo analisado", "qual foi o gasto", "quantos leads"), você deve se referir aos dados da ÚLTIMA análise que você forneceu. NUNCA peça ao usuário para especificar novamente qual campanha quando você já analisou uma campanha recentemente na conversa.

REGRAS DA ATUALIZAÇÃO ANDROMEDA DO META ADS:
Suas análises e recomendações DEVEM seguir estritamente as melhores práticas da Atualização Andromeda:

**Estrutura de Campanhas Simplificada:**
- EVITE criar múltiplos conjuntos de anúncios (ad sets) para o mesmo objetivo
- RECOMENDE consolidar públicos em um único conjunto de anúncios sempre que possível
- O algoritmo Andromeda prefere MENOS segmentação e MAIS liberdade para otimizar
- Use Advantage+ audience (públicos amplos) ao invés de públicos extremamente segmentados

**Otimização de Criativos:**
- PRIORIZE volume e diversidade de criativos ao invés de segmentação de público
- RECOMENDE no mínimo 3-5 criativos diferentes por campanha
- Criativos devem ter variações significativas (não apenas mudanças cosméticas)
- O algoritmo aprende RÁPIDO - criativos com baixa performance podem ser pausados em 2-3 dias

**Machine Learning e Volume de Dados:**
- O algoritmo precisa de VOLUME para aprender (mínimo 50 conversões por semana)
- EVITE fazer mudanças frequentes que resetem o aprendizado
- NUNCA recomende pausar/ativar campanhas constantemente
- Deixe o algoritmo trabalhar por pelo menos 3-7 dias antes de otimizar

**Orçamento e Bid Strategy:**
- RECOMENDE orçamentos no nível da campanha (CBO - Campaign Budget Optimization)
- Evite orçamentos muito baixos que limitam o aprendizado (mínimo R$50-100/dia)
- Use Lowest Cost (custo mais baixo) como estratégia padrão
- Apenas sugira Cost Cap ou Bid Cap para anunciantes avançados

**Recomendações de Otimização:**
Ao analisar campanhas, foque em:
1. Quantidade e qualidade dos criativos (principal fator de sucesso)
2. Orçamento suficiente para gerar volume de dados
3. Tempo de aprendizado respeitado (não fazer mudanças precipitadas)
4. Simplificação da estrutura (menos ad sets, mais criativos)
5. Públicos amplos ao invés de micro-segmentação

**O QUE EVITAR:**
- ❌ Sugerir criação de múltiplos ad sets para testar públicos
- ❌ Recomendar pausar criativos muito rapidamente (dar tempo ao algoritmo)
- ❌ Sugerir segmentações muito específicas ou interesses ultra-nichados
- ❌ Recomendar mudanças frequentes de orçamento ou estratégia de lance

Sempre responda em português (pt-BR).
Use formatação markdown para melhor legibilidade.
Seja direto, claro e focado em ação.`;

export interface ToolCall {
  name: string;
  params: any;
}

interface ConversationContext {
  tool?: string;
  campaignName?: string;
  campaignId?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  days?: number;
  metric?: string;
}

interface DetectedToolCall extends ToolCall {
  context?: ConversationContext;
}

type DateRange = {
  startDate: string;
  endDate: string;
};

interface ParsedDateToken {
  iso: string;
  hasYear: boolean;
}

const FOLLOW_UP_KEYWORDS = [
  'periodo',
  'período',
  'gasto',
  'gastos',
  'lead',
  'leads',
  'resultado',
  'resultados',
  'detalhe',
  'detalhar',
  'detalhes',
  'explica',
  'explicar',
  'insight',
  'insights',
  'conversao',
  'conversão',
  'metricas',
  'métricas',
  'continuar',
  'continua',
  'seguinte',
  'agora',
  'mais',
  'qual',
  'quantos',
  'quantas',
  'mostrar',
];

const DATE_KEYWORDS = [
  'periodo',
  'período',
  'data',
  'datas',
  'dia',
  'dias',
  'semana',
  'mes',
  'mês',
  'hoje',
  'ontem',
  'ate',
  'até',
  'de ',
];

const MONTH_MAP: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  março: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function normalizeMessage(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getLastAssistantContext(history: AIMessage[]): ConversationContext | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry.role === 'assistant' && entry.metadata?.context) {
      return entry.metadata.context as ConversationContext;
    }
  }

  return null;
}

function isFollowUpQuestion(message: string, normalized: string): boolean {
  if (message.trim().endsWith('?')) {
    return true;
  }

  return FOLLOW_UP_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function hasDateIndicator(normalized: string): boolean {
  return DATE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function extractDateRange(message: string): DateRange | undefined {
  const rangeRegex = /(?:de\s*)?([0-9]{1,2}[-/][0-9]{1,2}(?:[-/][0-9]{2,4})?|\d{1,2}\s*(?:de\s*)?(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))\s*(?:até|ate|a|-)\s*([0-9]{1,2}[-/][0-9]{1,2}(?:[-/][0-9]{2,4})?|\d{1,2}\s*(?:de\s*)?(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))/i;
  const rangeMatch = message.match(rangeRegex);

  if (rangeMatch) {
    const startToken = rangeMatch[1].trim();
    const endToken = rangeMatch[2].trim();
    const startParsed = parseDateToken(startToken);
    const endParsed = parseDateToken(endToken, startParsed?.iso);

    if (startParsed && endParsed) {
      let startDate = startParsed.iso;
      let endDate = endParsed.iso;

      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      if (startDateObj.getTime() > endDateObj.getTime()) {
        if (!startParsed.hasYear && !endParsed.hasYear) {
          endDateObj.setFullYear(endDateObj.getFullYear() + 1);
          endDate = toISODate(endDateObj);
        } else {
          const temp = startDate;
          startDate = endDate;
          endDate = temp;
        }
      }

      return { startDate, endDate };
    }
  }

  const singleRegex = /(dia\s+|no\s+dia\s+|em\s+)?([0-9]{1,2}[-/][0-9]{1,2}(?:[-/][0-9]{2,4})?|\d{1,2}\s*(?:de\s*)?(?:janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))/i;
  const singleMatch = message.match(singleRegex);

  if (singleMatch) {
    const token = singleMatch[2].trim();
    const parsed = parseDateToken(token);

    if (parsed) {
      return { startDate: parsed.iso, endDate: parsed.iso };
    }
  }

  return undefined;
}

function parseDateToken(token: string, referenceIso?: string): ParsedDateToken | null {
  const normalized = normalizeMessage(token);
  const numericMatch = normalized.match(/(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?/);

  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10) - 1;
    let hasYear = false;
    let year: number;

    if (numericMatch[3]) {
      year = parseInt(numericMatch[3], 10);
      if (year < 100) {
        year += 2000;
      }
      hasYear = true;
    } else if (referenceIso) {
      year = new Date(referenceIso).getUTCFullYear();
    } else {
      year = new Date().getUTCFullYear();
    }

    const date = new Date(Date.UTC(year, month, day));

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return { iso: toISODate(date), hasYear };
  }

  const textMatch = normalized.match(/(\d{1,2})\s*(?:de\s*)?(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/);

  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2];
    const month = MONTH_MAP[monthName];

    if (month === undefined) {
      return null;
    }

    let year = new Date().getUTCFullYear();
    let hasYear = false;
    const yearMatch = normalized.match(/(\d{4})/);

    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      hasYear = true;
    } else if (referenceIso) {
      year = new Date(referenceIso).getUTCFullYear();
    }

    const date = new Date(Date.UTC(year, month, day));

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return { iso: toISODate(date), hasYear };
  }

  return null;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateToPt(isoDate: string): string {
  const safeIso = isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00Z`;
  const date = new Date(safeIso);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

/**
 * Detect if user query needs data and which tool to use
 */
function detectDataNeed(userMessage: string, history: AIMessage[]): DetectedToolCall | null {
  const message = userMessage.toLowerCase();
  const normalized = normalizeMessage(userMessage);
  const lastContext = getLastAssistantContext(history);

  const explicitCampaignName = extractCampaignName(userMessage);
  const detectedDateRange = extractDateRange(userMessage);
  const daysFromMessage = detectedDateRange ? undefined : extractDays(message);
  const metricFromMessage = extractMetric(message);
  const followUp = isFollowUpQuestion(message, normalized);
  const mentionsDate = hasDateIndicator(normalized);

  // Top campaigns
  if (
    (normalized.includes('melhor') && (normalized.includes('campanha') || normalized.includes('performan'))) ||
    (normalized.includes('top') && normalized.includes('campanha'))
  ) {
    const periodDays = extractDays(message) ?? 7;
    return {
      name: 'getTopCampaigns',
      params: { days: periodDays, limit: 10 },
      context: { tool: 'getTopCampaigns', days: periodDays },
    };
  }

  // Underperforming campaigns
  if (
    normalized.includes('pior') ||
    normalized.includes('baixo desempenho') ||
    normalized.includes('underperform') ||
    normalized.includes('ctr baixo')
  ) {
    const periodDays = extractDays(message) ?? 7;
    return {
      name: 'getUnderperformingCampaigns',
      params: { days: periodDays },
      context: { tool: 'getUnderperformingCampaigns', days: periodDays },
    };
  }

  // Summary/Overview
  if (
    normalized.includes('resumo') ||
    normalized.includes('overview') ||
    (normalized.includes('total') && normalized.includes('gasto')) ||
    normalized.includes('quanto gast')
  ) {
    const periodDays = extractDays(message) ?? 7;
    return {
      name: 'getMetricsSummary',
      params: { days: periodDays },
      context: { tool: 'getMetricsSummary', days: periodDays },
    };
  }

  // Platform comparison
  if (
    (normalized.includes('comparar') && normalized.includes('plataforma')) ||
    normalized.includes('meta vs google') ||
    normalized.includes('google vs meta') ||
    normalized.includes('facebook vs google')
  ) {
    const periodDays = extractDays(message) ?? 7;
    return {
      name: 'comparePlatforms',
      params: { days: periodDays },
      context: { tool: 'comparePlatforms', days: periodDays },
    };
  }

  // Performance by objective
  if (
    (normalized.includes('objetivo') && normalized.includes('performance')) ||
    normalized.includes('por objetivo')
  ) {
    const periodDays = extractDays(message) ?? 7;
    return {
      name: 'getPerformanceByObjective',
      params: { days: periodDays },
      context: { tool: 'getPerformanceByObjective', days: periodDays },
    };
  }

  // Trends
  if (
    normalized.includes('tendencia') ||
    normalized.includes('tendência') ||
    normalized.includes('trend') ||
    normalized.includes('evolucao') ||
    normalized.includes('evolução') ||
    normalized.includes('ao longo do tempo')
  ) {
    const periodDays = extractDays(message) ?? 30;
    const metric = metricFromMessage ?? 'spend';
    return {
      name: 'getMetricsTrend',
      params: { days: periodDays, metric },
      context: { tool: 'getMetricsTrend', days: periodDays, metric },
    };
  }

  if (explicitCampaignName) {
    const params: Record<string, any> = { campaignName: explicitCampaignName };
    const context: ConversationContext = { tool: 'getCampaignDetails', campaignName: explicitCampaignName };

    if (detectedDateRange) {
      params.dateRange = detectedDateRange;
      context.dateRange = detectedDateRange;
    } else if (typeof daysFromMessage === 'number') {
      params.days = daysFromMessage;
      context.days = daysFromMessage;
    } else if (
      lastContext?.campaignName &&
      lastContext.campaignName.toLowerCase() === explicitCampaignName.toLowerCase()
    ) {
      if (lastContext.dateRange) {
        params.dateRange = lastContext.dateRange;
        context.dateRange = lastContext.dateRange;
      } else if (lastContext.days) {
        params.days = lastContext.days;
        context.days = lastContext.days;
      }
    }

    if (metricFromMessage) {
      context.metric = metricFromMessage;
    }

    return { name: 'getCampaignDetails', params, context };
  }

  if (lastContext?.campaignName && (normalized.includes('campanha') || followUp)) {
    const params: Record<string, any> = { campaignName: lastContext.campaignName };
    const context: ConversationContext = { tool: 'getCampaignDetails', campaignName: lastContext.campaignName };

    let rangeToUse = detectedDateRange;
    if (!rangeToUse && lastContext.dateRange) {
      rangeToUse = lastContext.dateRange;
    }

    if (rangeToUse) {
      params.dateRange = rangeToUse;
      context.dateRange = rangeToUse;
    } else {
      const daysToUse =
        typeof daysFromMessage === 'number'
          ? daysFromMessage
          : lastContext.days;

      if (typeof daysToUse === 'number') {
        params.days = daysToUse;
        context.days = daysToUse;
      }
    }

    if (metricFromMessage || lastContext.metric) {
      context.metric = metricFromMessage || lastContext.metric;
    }

    return { name: 'getCampaignDetails', params, context };
  }

  return null;
}

/**
 * Extract days from user message
 */
function extractDays(message: string, fallback?: number): number | undefined {
  if (message.includes('hoje') || message.includes('today')) return 1;
  if (message.includes('ontem') || message.includes('yesterday')) return 1;
  if (message.includes('semana') || message.includes('week')) return 7;
  if (message.includes('mês') || message.includes('mes') || message.includes('month')) return 30;
  if (message.includes('últimos 3 dias') || message.includes('ultimos 3 dias')) return 3;
  if (message.includes('últimos 14 dias') || message.includes('ultimos 14 dias')) return 14;
  if (message.includes('últimos 30 dias') || message.includes('ultimos 30 dias')) return 30;
  if (message.includes('últimos 60 dias') || message.includes('ultimos 60 dias')) return 60;
  if (message.includes('últimos 90 dias') || message.includes('ultimos 90 dias')) return 90;

  const match = message.match(/(\d+)\s*(dia|dias|day|days)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  return fallback;
}

/**
 * Extract metric name from user message
 */
function extractMetric(message: string, fallback?: string): string | undefined {
  if (message.includes('gasto') || message.includes('spend')) return 'spend';
  if (message.includes('clique') || message.includes('click')) return 'clicks';
  if (message.includes('conversão') || message.includes('conversao') || message.includes('conversion')) return 'conversions';
  if (message.includes('impressão') || message.includes('impressao') || message.includes('impression')) return 'impressions';
  if (message.includes('ctr')) return 'ctr';
  if (message.includes('cpc')) return 'cpc';
  if (message.includes('roas')) return 'roas';

  return fallback;
}

/**
 * Extract campaign name from user message
 */
function extractCampaignName(message: string): string {
  // Try to find text after "campanha" keyword
  const patterns = [
    // "da campanha de leads whatsapp 23/10"
    /da\s+campanha\s+(?:de\s+)?["']?([^"'?\n]+?)["']?(?:\s*\?|$)/i,
    // "do campanha leads whatsapp 23/10"
    /do\s+campanha\s+(?:de\s+)?["']?([^"'?\n]+?)["']?(?:\s*\?|$)/i,
    // "campanha de leads whatsapp 23/10"
    /campanha\s+de\s+["']?([^"'?\n]+?)["']?(?:\s*\?|$)/i,
    // "campanha leads whatsapp 23/10"
    /campanha\s+(?!da|de|do)["']?([a-zA-Z0-9][^"'?\n]+?)["']?(?:\s*\?|$)/i,
    // "analise a campanha whatsapp 23/10"
    /analis[ea]\s+(?:a\s+)?(?:campanha\s+)?(?:de\s+)?["']?([^"'?\n]+?)["']?(?:\s*\?|$)/i,
    // "detalhe da campanha whatsapp 23/10"
    /detalhe(?:s)?\s+(?:da\s+)?(?:campanha\s+)?(?:de\s+)?["']?([^"'?\n]+?)["']?(?:\s*\?|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let campaignName = match[1].trim();
      // Remove common trailing words that are not part of the campaign name
      campaignName = campaignName.replace(/\s+(copy|anúncio|performance|métricas|dados)$/i, '');
      return campaignName;
    }
  }

  return '';
}

/**
 * Execute tool call
 */
async function executeTool(tool: DetectedToolCall, workspaceId: string): Promise<any> {
  switch (tool.name) {
    case 'getTopCampaigns':
      return await getTopCampaigns(workspaceId, tool.params.days, tool.params.limit);

    case 'getUnderperformingCampaigns':
      return await getUnderperformingCampaigns(workspaceId, tool.params.days);

    case 'getMetricsSummary':
      return await getMetricsSummary(workspaceId, tool.params.days);

    case 'comparePlatforms':
      return await comparePlatforms(workspaceId, tool.params.days);

    case 'getPerformanceByObjective':
      return await getPerformanceByObjective(workspaceId, tool.params.days);

    case 'getMetricsTrend':
      return await getMetricsTrend(workspaceId, tool.params.days, tool.params.metric);

    case 'getCampaignDetails':
      return await getCampaignDetails(workspaceId, tool.params.campaignName, {
        days: tool.params.days,
        dateRange: tool.params.dateRange,
      });

    default:
      return null;
  }
}

/**
 * Format data context for AI
 */
function formatDataContext(toolName: string, data: any, context?: ConversationContext): string {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return 'Nenhum dado encontrado para este período.';
  }

  switch (toolName) {
    case 'getTopCampaigns':
      return `### Campanhas com Melhor Performance\n\n${data.map((c: any, i: number) =>
        `${i + 1}. **${c.name}**
   - Objetivo: ${c.objective}
   - Status: ${c.status}
   - Gasto: R$ ${parseFloat(c.spend || 0).toFixed(2)}
   - Cliques: ${parseInt(c.clicks || 0).toLocaleString('pt-BR')}
   - CTR: ${parseFloat(c.ctr || 0).toFixed(2)}%
   - CPC: R$ ${parseFloat(c.cpc || 0).toFixed(2)}
   - Conversões: ${parseInt(c.conversions || 0)}
   ${parseFloat(c.roas || 0) > 0 ? `- ROAS: ${parseFloat(c.roas).toFixed(2)}x` : ''}`
      ).join('\n\n')}`;

    case 'getUnderperformingCampaigns':
      return `### Campanhas com Baixo Desempenho\n\n${data.map((c: any, i: number) =>
        `${i + 1}. **${c.name}**
   - CTR: ${parseFloat(c.ctr || 0).toFixed(2)}% (abaixo da média)
   - Gasto: R$ ${parseFloat(c.spend || 0).toFixed(2)}
   - Impressões: ${parseInt(c.impressions || 0).toLocaleString('pt-BR')}
   - Cliques: ${parseInt(c.clicks || 0).toLocaleString('pt-BR')}`
      ).join('\n\n')}`;

    case 'getMetricsSummary':
      return `### Resumo de Performance\n\n- **Gasto Total**: R$ ${parseFloat(data.total_spend || 0).toFixed(2)}
- **Impressões**: ${parseInt(data.total_impressions || 0).toLocaleString('pt-BR')}
- **Cliques**: ${parseInt(data.total_clicks || 0).toLocaleString('pt-BR')}
- **Conversões**: ${parseInt(data.total_conversions || 0).toLocaleString('pt-BR')}
- **CTR Médio**: ${parseFloat(data.avg_ctr || 0).toFixed(2)}%
- **CPC Médio**: R$ ${parseFloat(data.avg_cpc || 0).toFixed(2)}
${parseFloat(data.avg_roas || 0) > 0 ? `- **ROAS Médio**: ${parseFloat(data.avg_roas).toFixed(2)}x` : ''}`;

    case 'comparePlatforms':
      return `### Comparação entre Plataformas\n\n${data.map((p: any) =>
        `**${p.platform.toUpperCase()}**
- Gasto: R$ ${parseFloat(p.total_spend || 0).toFixed(2)}
- CTR: ${parseFloat(p.avg_ctr || 0).toFixed(2)}%
- CPC: R$ ${parseFloat(p.avg_cpc || 0).toFixed(2)}
- Conversões: ${parseInt(p.total_conversions || 0).toLocaleString('pt-BR')}
${parseFloat(p.avg_roas || 0) > 0 ? `- ROAS: ${parseFloat(p.avg_roas).toFixed(2)}x` : ''}`
      ).join('\n\n')}`;

    case 'getPerformanceByObjective':
      return `### Performance por Objetivo\n\n${data.map((obj: any) =>
        `**${obj.objective}** (${parseInt(obj.campaign_count || 0)} campanhas)
- Gasto: R$ ${parseFloat(obj.total_spend || 0).toFixed(2)}
- CTR: ${parseFloat(obj.avg_ctr || 0).toFixed(2)}%
- Conversões: ${parseInt(obj.total_conversions || 0).toLocaleString('pt-BR')}
${parseFloat(obj.avg_roas || 0) > 0 ? `- ROAS: ${parseFloat(obj.avg_roas).toFixed(2)}x` : ''}`
      ).join('\n\n')}`;

    case 'getCampaignDetails': {
      if (!data) {
        return 'Campanha não encontrada. Verifique o nome e tente novamente.';
      }

      let copiesSection = '';
      if (data.ad_copies && data.ad_copies.length > 0) {
        copiesSection = '\n\n### Análise de Criativos:\n\n';
        data.ad_copies.forEach((copy: any, i: number) => {
          // Lead with the ad name in a clear heading
          copiesSection += `#### ${copy.ad_name}\n\n`;
          copiesSection += `**Tipo:** ${copy.creative_type}`;
          if (copy.duration_seconds) {
            copiesSection += ` (${copy.duration_seconds}s)`;
          }
          if (copy.aspect_ratio) {
            copiesSection += ` | **Formato:** ${copy.aspect_ratio}`;
          }
          copiesSection += '\n\n';

          // Performance metrics
          if (copy.performance) {
            const perf = copy.performance;
            copiesSection += `**Performance**:\n`;
            copiesSection += `- Impressões: ${perf.impressions.toLocaleString('pt-BR')}\n`;
            copiesSection += `- Cliques: ${perf.clicks.toLocaleString('pt-BR')}\n`;
            copiesSection += `- CTR: ${perf.ctr.toFixed(2)}%\n`;
            copiesSection += `- Gasto: R$ ${perf.spend.toFixed(2)}\n\n`;
          }

          if (copy.title) {
            copiesSection += `**Título**: ${copy.title}\n\n`;
          }

          if (copy.text_content) {
            copiesSection += `**Copy Principal**:\n${copy.text_content}\n\n`;
          }

          if (copy.bodies && copy.bodies.length > 0 && copy.bodies.length > 1) {
            copiesSection += `**Variações de Copy** (${copy.bodies.length} versões):\n`;
            copy.bodies.slice(0, 3).forEach((body: string, idx: number) => {
              copiesSection += `${idx + 1}. ${body}\n`;
            });
            if (copy.bodies.length > 3) {
              copiesSection += `... e mais ${copy.bodies.length - 3} variações\n`;
            }
            copiesSection += '\n';
          }

          if (copy.description) {
            copiesSection += `**Descrição**: ${copy.description}\n\n`;
          }

          copiesSection += '---\n\n';
        });
      }

      // Map objective to conversion type description
      const objectiveMap: Record<string, string> = {
        'OUTCOME_LEADS': 'Leads (mensagens/formulários)',
        'OUTCOME_SALES': 'Vendas',
        'OUTCOME_TRAFFIC': 'Tráfego/Cliques',
        'OUTCOME_ENGAGEMENT': 'Engajamento',
        'OUTCOME_APP_PROMOTION': 'Instalações de App',
        'OUTCOME_AWARENESS': 'Reconhecimento de Marca'
      };

      const conversionType = objectiveMap[data.objective] || data.objective;

      const periodSource = context?.dateRange || (data.start_date && data.end_date
        ? { startDate: data.start_date, endDate: data.end_date }
        : null);

      const periodLine = periodSource
        ? `**Período analisado:** ${formatDateToPt(periodSource.startDate)} a ${formatDateToPt(periodSource.endDate)}\n\n`
        : '';

      // Build messaging metrics section for LEADS campaigns
      let messagingSection = '';
      if (data.messaging_metrics) {
        messagingSection = `
**Métricas de Mensagens Detalhadas:**
- **Conversas Iniciadas**: ${data.messaging_metrics.conversations_started}
- **Total de Conexões** (inclui continuadas): ${data.messaging_metrics.total_connections}
- **Primeiras Respostas**: ${data.messaging_metrics.first_replies}
`;
      }

      return `### Análise da Campanha: ${data.name}

${periodLine}**Informações Gerais:**
- **Status**: ${data.status}
- **Objetivo**: ${conversionType}

**Performance:**
- **Gasto Total**: R$ ${parseFloat(data.spend || 0).toFixed(2)}
- **Impressões**: ${parseInt(data.impressions || 0).toLocaleString('pt-BR')}
- **Cliques**: ${parseInt(data.clicks || 0).toLocaleString('pt-BR')}
- **CTR**: ${parseFloat(data.ctr || 0).toFixed(2)}%
- **CPC**: R$ ${parseFloat(data.cpc || 0).toFixed(2)}
- **Conversões (${conversionType})**: ${parseInt(data.conversions || 0)}
${parseFloat(data.roas || 0) > 0 ? `- **ROAS**: ${parseFloat(data.roas).toFixed(2)}x` : ''}
${messagingSection}${copiesSection}`;
    }
    default:
      return JSON.stringify(data, null, 2);
  }
}

async function generateWithGemini(
  conversationHistory: AIMessage[],
  userMessage: string,
  dataContext?: string
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp' });

  const history = conversationHistory.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });

  const fullMessage = dataContext
    ? `${SYSTEM_PROMPT}\n\n---\n\n${userMessage}\n\n### Dados Relevantes:\n${dataContext}`
    : `${SYSTEM_PROMPT}\n\n---\n\n${userMessage}`;

  const result = await chat.sendMessage(fullMessage);
  const response = await result.response;
  return response.text();
}

async function generateWithOpenAI(
  conversationHistory: AIMessage[],
  userMessage: string,
  dataContext?: string
): Promise<string> {
  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
  ];

  const finalUserMessage = dataContext
    ? `${userMessage}\n\n### Dados Relevantes:\n${dataContext}`
    : userMessage;

  messages.push({ role: 'user', content: finalUserMessage });

  const completion = await openai.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI retornou resposta vazia');
  }
  return content;
}

function buildMessageMetadata(
  toolCall: DetectedToolCall | null,
  data: any,
  dataContext: string
): Record<string, any> | undefined {
  const trimmedContext = dataContext?.trim();
  const metadata: Record<string, any> = {};

  if (trimmedContext) {
    metadata.dataContext = trimmedContext;
  }

  if (toolCall) {
    const context: ConversationContext = {
      tool: toolCall.name,
      ...(toolCall.context ?? {}),
    };

    if (toolCall.name === 'getCampaignDetails' && data) {
      if (data.id) {
        context.campaignId = data.id;
      }
      if (data.name) {
        context.campaignName = data.name;
      }
      if (data.start_date && data.end_date) {
        context.dateRange = {
          startDate: data.start_date,
          endDate: data.end_date,
        };
      }
    }

    metadata.context = context;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Generate AI response using Google Gemini
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: AIMessage[],
  workspaceId: string
): Promise<{ content: string; dataContext?: string; metadata?: Record<string, any> }> {
  try {
    // Detect if we need to fetch data
    const toolCall = detectDataNeed(userMessage, conversationHistory);
    let dataContext = '';
    let fetchedData: any = null;

    // Log for debugging
    console.log('🤖 AI Service - User Message:', userMessage);
    console.log('🔧 Tool detected:', toolCall ? toolCall.name : 'none');

    if (toolCall) {
      console.log('📊 Executing tool:', toolCall.name, 'with params:', toolCall.params);
      fetchedData = await executeTool(toolCall, workspaceId);
      dataContext = formatDataContext(toolCall.name, fetchedData, toolCall.context);
      console.log('✅ Data fetched, context length:', dataContext.length);
    }

    const metadata = buildMessageMetadata(toolCall, fetchedData, dataContext);
    const provider = resolveAIProvider();

    const content = provider === 'openai'
      ? await generateWithOpenAI(conversationHistory, userMessage, dataContext || undefined)
      : await generateWithGemini(conversationHistory, userMessage, dataContext || undefined);

    return {
      content,
      dataContext: dataContext || undefined,
      metadata,
    };
  } catch (error) {
    console.error('AI Service Error:', error);
    if (error instanceof Error) {
      throw new Error(`Erro ao gerar resposta da IA: ${error.message}`);
    }
    throw new Error('Erro ao gerar resposta da IA');
  }
}
