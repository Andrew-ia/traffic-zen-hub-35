import OpenAI from 'openai';
import type { MLBAnalysisResult } from '../../services/mlbAnalyzer.service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AIAnalysisRequest {
  mlbId: string;
  analysisData: MLBAnalysisResult;
  workspaceId: string;
}

export interface AISuggestion {
  id: string;
  type: 'seo' | 'sales' | 'competitive' | 'technical';
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  estimated_score_boost: number;
  estimated_conversion_boost?: number;
  action_data?: {
    field: string;
    current_value?: string;
    suggested_value?: string;
    attribute_id?: string;
  };
  reasoning: string;
  competitor_insight?: string;
  roi_score: number;
  quick_apply: boolean;
}

export interface AIAnalysisResponse {
  success: boolean;
  overall_opportunity_score: number;
  total_suggestions: number;
  high_impact_count: number;
  quick_wins_available: number;
  competitive_gap_score: number;
  seo_optimization_potential: number;
  sales_optimization_potential: number;
  estimated_total_boost: number;
  suggestions: AISuggestion[];
  ai_insights: string;
  processing_time_ms: number;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mlbId, analysisData, workspaceId }: AIAnalysisRequest = req.body;

  if (!mlbId || !analysisData || !workspaceId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const startTime = Date.now();

  try {
    console.log(`[AI Analysis] Iniciando análise IA para ${mlbId}`);

    // Preparar dados para o GPT-4
    const productSummary = {
      mlb_id: mlbId,
      title: analysisData.product_data.title,
      current_description: analysisData.product_data.description || analysisData.product_data.plain_text || '(descrição não disponível)',
      price: analysisData.product_data.price,
      category: analysisData.product_data.category_id,
      status: analysisData.product_data.status,
      sold_quantity: analysisData.product_data.sold_quantity,
      available_quantity: analysisData.product_data.available_quantity,
      condition: analysisData.product_data.condition,
      listing_type_id: analysisData.product_data.listing_type_id,
      current_score: analysisData.quality_score.overall_score,
      score_breakdown: analysisData.quality_score.breakdown,
      title_optimization: analysisData.title_optimization,
      keyword_analysis: analysisData.keyword_analysis,
      technical_analysis: analysisData.technical_analysis,
      image_analysis: analysisData.image_analysis,
      model_optimization: analysisData.model_optimization,
      seo_description: analysisData.seo_description,
      shipping_info: {
        free_shipping: analysisData.product_data.shipping?.free_shipping || false,
        mode: analysisData.product_data.shipping?.mode || 'not_specified'
      },
      competitive_analysis: {
        competitors_count: analysisData.competitive_analysis?.top_competitors?.length || 0,
        price_position: analysisData.competitive_analysis?.price_analysis?.price_position,
        market_average: analysisData.competitive_analysis?.price_analysis?.market_average,
        top_competitors_sample: analysisData.competitive_analysis?.top_competitors?.slice(0, 3)?.map(comp => ({
          title: comp.title,
          price: comp.price,
          sold_quantity: comp.sold_quantity,
          free_shipping: comp.shipping?.free_shipping
        })) || []
      },
      attributes: analysisData.product_data.attributes?.map(attr => ({
        id: attr.id,
        name: attr.name,
        current_value: attr.value_name || attr.value_id
      })) || [],
      pictures_count: analysisData.product_data.pictures?.length || 0,
      // Enviar todas as URLs de imagens para análise visual completa
      pictures_urls: analysisData.product_data.pictures?.map(pic => pic.secure_url || pic.url) || []
    };

    // Prompt especializado para análise profissional de anúncios ML
    const aiPrompt = `
Você é um especialista sênior em Mercado Livre com foco em SEO de marketplace, conversão e compliance.

Sua tarefa:
Analisar o anúncio COMPLETO abaixo (incluindo TÍTULO, DESCRIÇÃO ATUAL, ATRIBUTOS, PREÇO, IMAGENS) e devolver uma versão PROFISSIONAL, CORRETA e OTIMIZADA, respeitando:
- Regras do Mercado Livre
- Boas práticas de SEO interno
- Veracidade técnica
- Alta conversão comercial
- Prevenção contra bloqueios por infração

DADOS COMPLETOS DO ANÚNCIO ATUAL:
- TÍTULO: ${productSummary.title}
- DESCRIÇÃO ATUAL: ${productSummary.current_description}
- PREÇO: R$ ${productSummary.price}
- VENDIDOS: ${productSummary.sold_quantity}
- STATUS: ${productSummary.status}
- FRETE GRÁTIS: ${productSummary.shipping_info.free_shipping ? 'SIM' : 'NÃO'}
- IMAGENS: ${productSummary.pictures_count} fotos
- ATRIBUTOS TÉCNICOS REAIS: ${productSummary.attributes.map((attr: any) => `${attr.id}: ${attr.current_value}`).join(', ')}

⛔ PROIBIDO - ALERTA CRÍTICO DE COMPLIANCE:
- NUNCA contradiga os ATRIBUTOS TÉCNICOS REAIS fornecidos
- SE o atributo COLOR diz "Dourado", NUNCA sugira "Prateado" ou "Prata"
- SE o atributo MATERIAL diz "Folheado a ouro", NUNCA sugira "Prata" ou "Cobre"
- NÃO INVENTE características que não estão nos atributos acima
- NÃO adicione materiais, pedras, composições ou detalhes técnicos que NÃO existem nos ATRIBUTOS TÉCNICOS REAIS
- NÃO suponha características baseado apenas no título ou nas imagens - USE OS ATRIBUTOS
- NÃO use "prata", "ouro", "pedras", "brilhantes" SE NÃO estiver nos atributos
- NÃO invente marca, certificação ou composição inexistente
- NÃO use "hipoalergênico" sem validação técnica
- NÃO use "genérico" no TÍTULO
- NÃO insira palavras-chave enganosas
- NÃO use frases sem comprovação
- ⚠️ ATENÇÃO: Se sugerir cor ou material ERRADO, o vendedor será BANIDO do Mercado Livre!

✅ OBRIGATÓRIO - REGRAS DE OURO:
1. SEMPRE verificar os ATRIBUTOS TÉCNICOS REAIS antes de qualquer sugestão
2. Se COLOR="Dourado" → suas sugestões DEVEM usar "dourado", NUNCA "prata/prateado"
3. Se MATERIAL="Folheado a ouro" → suas sugestões DEVEM usar este material exato
4. Use APENAS os dados dos ATRIBUTOS TÉCNICOS REAIS fornecidos acima
5. Se um atributo não existe, NÃO mencione ele nas sugestões
6. Se a descrição atual está vazia, sugira uma descrição baseada APENAS no título e atributos REAIS
7. Corrigir título, descrição, modelo baseado nos dados REAIS (não nas imagens)
8. Manter SEO sem cometer irregularidades
9. Focar em clareza, busca e conversão
10. Se não houver informação técnica suficiente, sugira "completar atributos" ao invés de inventar

EXEMPLO DE ANÁLISE CORRETA:
Produto: "Anel Feminino Dourado"
Atributos: COLOR=Dourado, MATERIAL=Folheado a ouro
✅ Sugestão CORRETA de descrição: "Anel feminino folheado a ouro, acabamento dourado..."
❌ Sugestão ERRADA: "Anel prateado de prata..." (CONTRADIZ os atributos!)

EXEMPLO 2:
Produto: "Anel Prateado"
Atributos: COLOR=Prateado, MATERIAL=Prata
✅ Sugestão CORRETA: "Anel de prata com acabamento prateado..."
❌ Sugestão ERRADA: "Anel dourado folheado a ouro..." (CONTRADIZ os atributos!)

ANALISE OS DADOS ACIMA e responda APENAS EM JSON no formato:
{
  "overall_opportunity_score": number (0-100),
  "ai_insights": "análise geral profissional em português",
  "critical_errors": ["lista de erros críticos encontrados"],
  "suggestions": [
    {
      "id": "titulo-otimizado",
      "type": "seo",
      "category": "✅ TÍTULO CORRIGIDO",
      "title": "Título SEO otimizado e compliance",
      "description": "Título de até 60 caracteres, SEO real, sem infringir regras ML",
      "impact": "high",
      "difficulty": "easy",
      "estimated_score_boost": number,
      "action_data": {
        "field": "title",
        "current_value": "título atual",
        "suggested_value": "título corrigido profissional"
      },
      "reasoning": "explicação técnica da correção",
      "roi_score": number (0-100),
      "quick_apply": true
    },
    {
      "id": "modelo-corrigido",
      "type": "technical",
      "category": "✅ CAMPO MODELO CORRIGIDO",
      "title": "Modelo técnico otimizado",
      "description": "Campo modelo com informações técnicas validadas",
      "impact": "medium",
      "difficulty": "easy",
      "estimated_score_boost": number,
      "action_data": {
        "field": "model",
        "current_value": "modelo atual",
        "suggested_value": "modelo corrigido técnico"
      },
      "reasoning": "justificativa técnica",
      "roi_score": number,
      "quick_apply": true
    },
    {
      "id": "descricao-conversao",
      "type": "sales",
      "category": "✅ DESCRIÇÃO REESCRITA",
      "title": "Descrição para conversão",
      "description": "Descrição profissional focada em conversão e SEO",
      "impact": "high",
      "difficulty": "easy",
      "estimated_score_boost": number,
      "estimated_conversion_boost": number,
      "action_data": {
        "field": "description",
        "current_value": "descrição atual",
        "suggested_value": "descrição profissional completa"
      },
      "reasoning": "estratégia de conversão aplicada",
      "roi_score": number,
      "quick_apply": true
    },
    {
      "id": "atributos-tecnicos",
      "type": "technical", 
      "category": "✅ ATRIBUTOS TÉCNICOS",
      "title": "Atributos técnicos ideais",
      "description": "Correção e completude dos atributos técnicos",
      "impact": "medium",
      "difficulty": "easy",
      "estimated_score_boost": number,
      "action_data": {
        "field": "attributes", 
        "current_value": "lista dos atributos atuais (como string)",
        "suggested_value": "lista dos atributos corrigidos (como string)"
      },
      "reasoning": "importância técnica dos atributos",
      "roi_score": number,
      "quick_apply": true
    },
    {
      "id": "estrategia-preco",
      "type": "competitive",
      "category": "✅ PREÇO - OPINIÃO TÉCNICA",
      "title": "Análise técnica de preço",
      "description": "Opinião sobre impacto do preço na conversão",
      "impact": "medium",
      "difficulty": "medium",
      "estimated_conversion_boost": number,
      "reasoning": "análise técnica de precificação",
      "roi_score": number,
      "quick_apply": false
    },
    {
      "id": "frete-estrategia",
      "type": "sales",
      "category": "✅ FRETE - ESTRATÉGIA IDEAL", 
      "title": "Estratégia ideal de frete",
      "description": "Recomendação profissional para frete",
      "impact": "high",
      "difficulty": "medium",
      "estimated_conversion_boost": number,
      "reasoning": "impacto do frete na decisão de compra",
      "roi_score": number,
      "quick_apply": false
    }
  ],
  "final_score": "Nota de 0 a 10 do anúncio após otimizações",
  "advanced_tips": ["sugestões avançadas opcionais"]
}

SEJA RIGOROSO, TÉCNICO E PROFISSIONAL. NÃO INVENTE CARACTERÍSTICAS.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em otimização de anúncios do Mercado Livre. Responda SEMPRE em JSON válido."
        },
        {
          role: "user", 
          content: aiPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 3000
    });

    const aiResponse = completion.choices[0].message.content;
    
    if (!aiResponse) {
      throw new Error('Resposta vazia do GPT-4');
    }

    // Parse da resposta JSON (limpar markdown se necessário)
    let aiAnalysis;
    try {
      // Limpar possível markdown ```json
      let cleanResponse = aiResponse.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/\s*```$/, '');
      }
      if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      aiAnalysis = JSON.parse(cleanResponse);
    } catch (parseError) {
      console.error('Erro ao parsear resposta do GPT-4:', aiResponse);
      throw new Error('Resposta inválida do GPT-4');
    }

    // Calcular métricas derivadas
    const suggestions = aiAnalysis.suggestions || [];
    const highImpactCount = suggestions.filter((s: AISuggestion) => s.impact === 'high').length;
    const quickWinsCount = suggestions.filter((s: AISuggestion) => s.quick_apply).length;
    const totalBoost = suggestions.reduce((sum: number, s: AISuggestion) => sum + (s.estimated_score_boost || 0), 0);

    const response: AIAnalysisResponse = {
      success: true,
      overall_opportunity_score: aiAnalysis.overall_opportunity_score || 50,
      total_suggestions: suggestions.length,
      high_impact_count: highImpactCount,
      quick_wins_available: quickWinsCount,
      competitive_gap_score: Math.max(0, 90 - analysisData.quality_score.overall_score),
      seo_optimization_potential: Math.max(0, 95 - analysisData.quality_score.overall_score),
      sales_optimization_potential: Math.min(50, suggestions.filter((s: AISuggestion) => s.type === 'sales').length * 10),
      estimated_total_boost: totalBoost,
      suggestions: suggestions,
      ai_insights: aiAnalysis.ai_insights || 'Análise concluída com sucesso',
      processing_time_ms: Date.now() - startTime
    };

    console.log(`[AI Analysis] Análise IA concluída para ${mlbId} em ${response.processing_time_ms}ms - ${suggestions.length} sugestões geradas`);

    res.status(200).json(response);

  } catch (error: any) {
    console.error(`[AI Analysis] Erro na análise IA para ${mlbId}:`, error);

    // Tratamento específico de erros da OpenAI
    let errorMessage = 'Erro na análise IA';
    let errorDetails = error.message;
    let errorCode = 'UNKNOWN_ERROR';
    let statusCode = 500;

    // Erro de autenticação / API Key inválida
    if (error.status === 401 || error.message?.includes('API key')) {
      errorMessage = 'Chave de API OpenAI inválida ou ausente';
      errorDetails = 'Configure a variável de ambiente OPENAI_API_KEY com uma chave válida';
      errorCode = 'INVALID_API_KEY';
      statusCode = 401;
    }
    // Erro de quota / sem créditos
    else if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('insufficient_quota')) {
      errorMessage = 'Créditos da OpenAI esgotados';
      errorDetails = 'Sua conta OpenAI não tem créditos suficientes. Adicione créditos em https://platform.openai.com/account/billing';
      errorCode = 'INSUFFICIENT_QUOTA';
      statusCode = 429;
    }
    // Erro de rate limit
    else if (error.message?.includes('rate_limit')) {
      errorMessage = 'Limite de requisições excedido';
      errorDetails = 'Aguarde alguns segundos antes de tentar novamente';
      errorCode = 'RATE_LIMIT';
      statusCode = 429;
    }
    // Erro de timeout
    else if (error.message?.includes('timeout')) {
      errorMessage = 'Timeout na análise IA';
      errorDetails = 'A análise demorou muito tempo. Tente novamente com um produto mais simples';
      errorCode = 'TIMEOUT';
      statusCode = 504;
    }
    // Erro de modelo não encontrado
    else if (error.status === 404 || error.message?.includes('model_not_found')) {
      errorMessage = 'Modelo GPT-4 não disponível';
      errorDetails = 'Sua conta OpenAI não tem acesso ao GPT-4o. Verifique suas permissões';
      errorCode = 'MODEL_NOT_FOUND';
      statusCode = 404;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: errorDetails,
      error_code: errorCode,
      suggestions: [],
      processing_time_ms: Date.now() - startTime,
      actions: getErrorActions(errorCode)
    });
  }
}

// Função auxiliar para sugerir ações baseado no tipo de erro
function getErrorActions(errorCode: string): string[] {
  switch (errorCode) {
    case 'INVALID_API_KEY':
      return [
        'Verifique se a variável OPENAI_API_KEY está configurada',
        'Obtenha uma nova chave em https://platform.openai.com/api-keys',
        'Reinicie o servidor após configurar a chave'
      ];
    case 'INSUFFICIENT_QUOTA':
      return [
        'Adicione créditos em https://platform.openai.com/account/billing',
        'Verifique seu uso atual em https://platform.openai.com/usage',
        'Configure um limite de gastos adequado'
      ];
    case 'RATE_LIMIT':
      return [
        'Aguarde 30-60 segundos antes de tentar novamente',
        'Considere atualizar seu plano OpenAI para limites maiores'
      ];
    case 'TIMEOUT':
      return [
        'Tente novamente em alguns instantes',
        'Verifique sua conexão com a internet'
      ];
    case 'MODEL_NOT_FOUND':
      return [
        'Verifique se sua conta tem acesso ao GPT-4',
        'Considere atualizar para um plano que inclui GPT-4',
        'Contate o suporte da OpenAI'
      ];
    default:
      return [
        'Verifique sua conexão com a internet',
        'Tente novamente em alguns instantes',
        'Contate o suporte se o problema persistir'
      ];
  }
}