import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  getTopCampaigns,
  getUnderperformingCampaigns,
  getMetricsSummary,
  comparePlatforms,
  getPerformanceByObjective,
  getMetricsTrend,
  getCampaignDetails,
} from '../tools/dataQueries';

// Initialize Gemini client lazily to ensure env vars are loaded
let genAI: GoogleGenerativeAI | null = null;

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

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `Você é um assistente de IA especializado em análise de tráfego pago e marketing digital. Você tem acesso direto ao banco de dados Supabase com campanhas de Meta Ads, Google Ads e Instagram.

Sua função é ajudar o usuário a:
- Analisar performance de campanhas específicas
- Identificar oportunidades de otimização
- Responder perguntas sobre métricas
- Fornecer recomendações estratégicas baseadas em dados REAIS

IMPORTANTE:
1. Quando o usuário mencionar uma campanha específica (ex: "campanha de leads whatsapp 23/10"), os dados dessa campanha serão automaticamente buscados no banco de dados e fornecidos a você.
2. SEMPRE use os dados fornecidos na seção "Dados Relevantes" quando disponíveis.
3. NUNCA invente dados ou peça ao usuário para fornecer informações que você já tem acesso.
4. Se os dados não foram fornecidos, significa que a campanha não foi encontrada - nesse caso, informe ao usuário.
5. Analise os dados de forma clara e objetiva, fornecendo insights acionáveis.

Sempre responda em português (pt-BR).
Use formatação markdown para melhor legibilidade.
Seja direto, claro e focado em ação.`;

export interface ToolCall {
  name: string;
  params: any;
}

/**
 * Detect if user query needs data and which tool to use
 */
function detectDataNeed(userMessage: string): ToolCall | null {
  const message = userMessage.toLowerCase();

  // Top campaigns
  if (
    message.includes('melhor') && (message.includes('campanha') || message.includes('performan')) ||
    message.includes('top') && message.includes('campanha')
  ) {
    const days = extractDays(message);
    return { name: 'getTopCampaigns', params: { days, limit: 10 } };
  }

  // Underperforming campaigns
  if (
    message.includes('pior') || message.includes('baixo desempenho') ||
    message.includes('underperform') || message.includes('ctr baixo')
  ) {
    const days = extractDays(message);
    return { name: 'getUnderperformingCampaigns', params: { days } };
  }

  // Summary/Overview
  if (
    message.includes('resumo') || message.includes('overview') ||
    message.includes('total') && message.includes('gasto') ||
    message.includes('quanto gast')
  ) {
    const days = extractDays(message);
    return { name: 'getMetricsSummary', params: { days } };
  }

  // Platform comparison
  if (
    message.includes('comparar') && message.includes('plataforma') ||
    message.includes('meta vs google') || message.includes('google vs meta') ||
    message.includes('facebook vs google')
  ) {
    const days = extractDays(message);
    return { name: 'comparePlatforms', params: { days } };
  }

  // Performance by objective
  if (
    message.includes('objetivo') && message.includes('performance') ||
    message.includes('por objetivo')
  ) {
    const days = extractDays(message);
    return { name: 'getPerformanceByObjective', params: { days } };
  }

  // Trends
  if (
    message.includes('tendência') || message.includes('trend') ||
    message.includes('evolução') || message.includes('ao longo do tempo')
  ) {
    const days = extractDays(message);
    const metric = extractMetric(message);
    return { name: 'getMetricsTrend', params: { days, metric } };
  }

  // Specific campaign analysis - detect when asking about ANY aspect of a campaign
  if (message.includes('campanha')) {
    // Check if user is asking about a specific campaign (not generic questions)
    const hasSpecificCampaignIndicator =
      message.includes('da campanha') ||
      message.includes('do campanha') ||
      message.includes('campanha de') ||
      message.includes('campanha do') ||
      message.includes('campanha da') ||
      /campanha\s+[a-zA-Z0-9]/.test(message);

    if (hasSpecificCampaignIndicator) {
      const campaignName = extractCampaignName(userMessage);
      if (campaignName) {
        const days = extractDays(message);
        return { name: 'getCampaignDetails', params: { campaignName, days } };
      }
    }
  }

  return null;
}

/**
 * Extract days from user message
 */
function extractDays(message: string): number {
  if (message.includes('hoje') || message.includes('today')) return 1;
  if (message.includes('ontem') || message.includes('yesterday')) return 1;
  if (message.includes('semana') || message.includes('week')) return 7;
  if (message.includes('mês') || message.includes('month')) return 30;
  if (message.includes('últimos 3 dias')) return 3;
  if (message.includes('últimos 14 dias')) return 14;
  if (message.includes('últimos 30 dias')) return 30;
  if (message.includes('últimos 60 dias')) return 60;
  if (message.includes('últimos 90 dias')) return 90;

  // Try to extract number
  const match = message.match(/(\d+)\s*(dia|day)/i);
  if (match) {
    return parseInt(match[1]);
  }

  return 7; // default
}

/**
 * Extract metric name from user message
 */
function extractMetric(message: string): string {
  if (message.includes('gasto') || message.includes('spend')) return 'spend';
  if (message.includes('clique') || message.includes('click')) return 'clicks';
  if (message.includes('conversão') || message.includes('conversion')) return 'conversions';
  if (message.includes('impressão') || message.includes('impression')) return 'impressions';
  if (message.includes('ctr')) return 'ctr';
  if (message.includes('cpc')) return 'cpc';
  if (message.includes('roas')) return 'roas';

  return 'spend'; // default
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
async function executeTool(tool: ToolCall, workspaceId: string): Promise<any> {
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
      return await getCampaignDetails(workspaceId, tool.params.campaignName, tool.params.days);

    default:
      return null;
  }
}

/**
 * Format data context for AI
 */
function formatDataContext(toolName: string, data: any): string {
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

    case 'getCampaignDetails':
      if (!data) {
        return 'Campanha não encontrada. Verifique o nome e tente novamente.';
      }

      let copiesSection = '';
      if (data.ad_copies && data.ad_copies.length > 0) {
        copiesSection = '\n\n### Copies dos Anúncios:\n\n';
        data.ad_copies.forEach((copy: any, i: number) => {
          copiesSection += `**Anúncio ${i + 1}: ${copy.ad_name}**\n`;
          copiesSection += `Tipo: ${copy.creative_type}\n\n`;

          if (copy.title) {
            copiesSection += `**Título**: ${copy.title}\n\n`;
          }

          if (copy.text_content) {
            copiesSection += `**Copy Principal**:\n${copy.text_content}\n\n`;
          }

          if (copy.bodies && copy.bodies.length > 0) {
            copiesSection += `**Variações de Copy** (${copy.bodies.length} versões):\n`;
            copy.bodies.forEach((body: string, idx: number) => {
              copiesSection += `${idx + 1}. ${body}\n`;
            });
            copiesSection += '\n';
          }

          if (copy.description) {
            copiesSection += `**Descrição**: ${copy.description}\n\n`;
          }

          copiesSection += '---\n\n';
        });
      }

      return `### Análise da Campanha: ${data.name}

**Informações Gerais:**
- **Status**: ${data.status}
- **Objetivo**: ${data.objective}

**Performance:**
- **Gasto Total**: R$ ${parseFloat(data.spend || 0).toFixed(2)}
- **Impressões**: ${parseInt(data.impressions || 0).toLocaleString('pt-BR')}
- **Cliques**: ${parseInt(data.clicks || 0).toLocaleString('pt-BR')}
- **CTR**: ${parseFloat(data.ctr || 0).toFixed(2)}%
- **CPC**: R$ ${parseFloat(data.cpc || 0).toFixed(2)}
- **Conversões**: ${parseInt(data.conversions || 0)}
${parseFloat(data.roas || 0) > 0 ? `- **ROAS**: ${parseFloat(data.roas).toFixed(2)}x` : ''}${copiesSection}`;

    default:
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Generate AI response using Google Gemini
 */
export async function generateAIResponse(
  userMessage: string,
  conversationHistory: AIMessage[],
  workspaceId: string
): Promise<{ content: string; dataContext?: string }> {
  try {
    // Detect if we need to fetch data
    const toolCall = detectDataNeed(userMessage);
    let dataContext = '';

    if (toolCall) {
      const data = await executeTool(toolCall, workspaceId);
      dataContext = formatDataContext(toolCall.name, data);
    }

    // Build conversation history for Gemini
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Build history in Gemini format
    const history = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Start chat with history
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    // Send message with system prompt and data context
    const fullMessage = dataContext
      ? `${SYSTEM_PROMPT}\n\n---\n\n${userMessage}\n\n### Dados Relevantes:\n${dataContext}`
      : `${SYSTEM_PROMPT}\n\n---\n\n${userMessage}`;

    const result = await chat.sendMessage(fullMessage);
    const response = await result.response;
    const content = response.text();

    return {
      content,
      dataContext: dataContext || undefined,
    };
  } catch (error) {
    console.error('AI Service Error:', error);
    if (error instanceof Error) {
      throw new Error(`Erro ao gerar resposta da IA: ${error.message}`);
    }
    throw new Error('Erro ao gerar resposta da IA');
  }
}
