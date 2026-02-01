import OpenAI from 'openai';
import type { MLBAnalysisResult } from '../../services/mlbAnalyzer.service.js';

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getAttrValue = (
  attrs: Array<{ id: string; value_name?: string; value_id?: string }> = [],
  ids: string[],
): string | undefined => {
  const targets = ids.map((id) => id.toLowerCase());
  const found = attrs.find((attr) => targets.includes(String(attr.id || "").toLowerCase()));
  return found?.value_name || found?.value_id;
};

const buildBasicDescription = (analysisData: MLBAnalysisResult): string => {
  const attrs = analysisData.product_data.attributes || [];
  const blocks: string[] = [];
  const title = analysisData.product_data.title || "";

  if (title) {
    blocks.push(`Produto: ${title}`);
  }

  const labeledAttrs: Array<{ label: string; value?: string }> = [
    { label: "Marca", value: getAttrValue(attrs, ["BRAND", "MARCA"]) },
    { label: "Modelo", value: getAttrValue(attrs, ["MODEL", "MODELO"]) },
    { label: "Material", value: getAttrValue(attrs, ["MATERIAL"]) },
    { label: "Cor", value: getAttrValue(attrs, ["COLOR", "MAIN_COLOR", "COR"]) },
    { label: "Tamanho", value: getAttrValue(attrs, ["SIZE", "TAMANHO"]) },
    { label: "Gênero", value: getAttrValue(attrs, ["GENDER", "GENERO"]) },
    { label: "Condição", value: analysisData.product_data.condition },
  ].filter((item) => item.value);

  if (labeledAttrs.length > 0) {
    blocks.push("Características:");
    labeledAttrs.forEach((item) => {
      blocks.push(`• ${item.label}: ${item.value}`);
    });
  }

  return blocks.join("\n");
};

const buildFallbackInsights = (analysisData: MLBAnalysisResult): string => {
  const breakdown = analysisData.quality_score?.breakdown || {};
  const titleScore = Number(breakdown.title_seo || 0);
  const descScore = Number(breakdown.description_quality || 0);
  const imagesScore = Number(breakdown.images_quality || 0);
  const modelScore = Number(breakdown.model_optimization || 0);
  const missingAttrs = analysisData.technical_analysis?.missing_important || [];
  const missingKeywords = analysisData.keyword_analysis?.missing_keywords || [];
  const images = analysisData.image_analysis?.total_images || 0;
  const hasVideo = analysisData.image_analysis?.has_video || false;
  const priceAnalysis = analysisData.competitive_analysis?.price_analysis;

  const parts: string[] = [];
  if (titleScore && titleScore < 75) parts.push(`Título com score ${titleScore}/100 pode ganhar relevância com ajustes de SEO.`);
  if (descScore && descScore < 70) parts.push(`Descrição fraca (${descScore}/100) — estruturar melhora confiança e conversão.`);
  if (modelScore && modelScore < 70) parts.push(`Campo modelo abaixo do ideal (${modelScore}/100) — refinar melhora ranking.`);
  if (imagesScore && imagesScore < 60) {
    parts.push(`Imagens insuficientes (${images})${!hasVideo ? " e sem vídeo" : ""}.`);
  }
  if (missingAttrs.length > 0) parts.push(`Atributos críticos faltando: ${missingAttrs.slice(0, 4).join(", ")}.`);
  if (missingKeywords.length > 0) parts.push(`Keywords estratégicas faltando: ${missingKeywords.slice(0, 4).join(", ")}.`);
  if (priceAnalysis?.market_average && priceAnalysis.current_price) {
    parts.push(`Preço atual R$ ${priceAnalysis.current_price} vs média R$ ${priceAnalysis.market_average.toFixed(2)}.`);
  }

  if (parts.length === 0) return "Análise concluída. Não há alertas críticos imediatos, mas vale monitorar desempenho e manter dados completos.";
  return parts.join(" ");
};

const buildBaselineSuggestions = (analysisData: MLBAnalysisResult): AISuggestion[] => {
  const breakdown = analysisData.quality_score?.breakdown || {};
  const titleScore = Number(breakdown.title_seo || 0);
  const descScore = Number(breakdown.description_quality || 0);
  const techScore = Number(breakdown.technical_sheet || 0);
  const imagesScore = Number(breakdown.images_quality || 0);
  const modelScore = Number(breakdown.model_optimization || 0);
  const keywordsScore = Number(breakdown.keywords_density || 0);

  const suggestions: AISuggestion[] = [];
  const attrs = analysisData.product_data.attributes || [];

  const suggestedTitles = analysisData.title_optimization?.suggested_titles || [];
  const bestTitle = suggestedTitles.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const currentTitle = analysisData.title_optimization?.current_title || analysisData.product_data.title || "";
  if (bestTitle?.title && bestTitle.title !== currentTitle) {
    const boost = clamp(Math.round((bestTitle.score || 0) - titleScore), 6, 22);
    suggestions.push({
      id: "titulo-otimizado",
      type: "seo",
      category: "Título",
      title: "Otimizar título com SEO e compliance",
      description: `Score atual: ${titleScore}/100. Sugestão baseada em termos com maior relevância.`,
      impact: titleScore < 55 ? "high" : "medium",
      difficulty: "easy",
      estimated_score_boost: boost,
      action_data: {
        field: "title",
        current_value: currentTitle,
        suggested_value: bestTitle.title,
      },
      reasoning: bestTitle.reasoning || "Título otimizado com palavras-chave relevantes sem extrapolar atributos.",
      roi_score: clamp(70 + Math.floor(boost / 2), 60, 95),
      quick_apply: true,
    });
  }

  if (descScore < 70) {
    const optimized = analysisData.seo_description?.optimized_description || buildBasicDescription(analysisData);
    const boost = clamp(Math.round(90 - descScore), 8, 30);
    suggestions.push({
      id: "descricao-conversao",
      type: "sales",
      category: "Descrição",
      title: "Descrição estruturada para conversão",
      description: `Score atual: ${descScore}/100. Estrutura clara reduz dúvidas e aumenta conversão.`,
      impact: "high",
      difficulty: "easy",
      estimated_score_boost: boost,
      estimated_conversion_boost: clamp(20 + Math.floor(boost / 2), 15, 40),
      action_data: {
        field: "description",
        current_value: analysisData.product_data.description || analysisData.product_data.plain_text || "",
        suggested_value: optimized,
      },
      reasoning: "Descrição baseada nos atributos existentes, sem inventar características.",
      roi_score: clamp(80 + Math.floor(boost / 2), 70, 98),
      quick_apply: true,
    });
  }

  const optimizedModels = analysisData.model_optimization?.optimized_models || [];
  const bestModel = optimizedModels.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const currentModel = analysisData.model_optimization?.current_model || getAttrValue(attrs, ["MODEL", "MODELO"]);
  if (bestModel?.model && bestModel.model !== currentModel && modelScore < 75) {
    const boost = clamp(Math.round((bestModel.score || 0) - modelScore), 5, 15);
    suggestions.push({
      id: "modelo-otimizado",
      type: "technical",
      category: "Modelo",
      title: "Refinar campo modelo",
      description: `Score atual: ${modelScore}/100. Modelo claro melhora busca interna.`,
      impact: modelScore < 55 ? "high" : "medium",
      difficulty: "easy",
      estimated_score_boost: boost,
      action_data: {
        field: "model",
        current_value: currentModel || "",
        suggested_value: bestModel.model,
      },
      reasoning: "Modelo sugerido a partir de padrões competitivos do ML.",
      roi_score: clamp(65 + Math.floor(boost / 2), 60, 90),
      quick_apply: true,
    });
  }

  const missingImportant = analysisData.technical_analysis?.missing_important || [];
  if (missingImportant.length > 0) {
    const boost = clamp(missingImportant.length * 4, 6, 20);
    suggestions.push({
      id: "atributos-tecnicos",
      type: "technical",
      category: "Atributos",
      title: "Completar atributos técnicos obrigatórios",
      description: `${missingImportant.length} atributos críticos faltando podem reduzir ranking.`,
      impact: "medium",
      difficulty: "easy",
      estimated_score_boost: boost,
      action_data: {
        field: "attributes",
        current_value: attrs.map((a) => `${a.id}:${a.value_name || a.value_id}`).join(", "),
        suggested_value: `Preencher: ${missingImportant.join(", ")}`,
      },
      reasoning: "Atributos completos aumentam relevância nos filtros do ML.",
      roi_score: clamp(60 + missingImportant.length * 2, 60, 90),
      quick_apply: true,
    });
  }

  const missingKeywords = analysisData.keyword_analysis?.missing_keywords || [];
  if (missingKeywords.length > 0 && keywordsScore < 75) {
    const boost = clamp(missingKeywords.length * 3, 6, 18);
    suggestions.push({
      id: "keywords-estrategicas",
      type: "seo",
      category: "Keywords",
      title: "Adicionar keywords estratégicas",
      description: `Keywords ausentes: ${missingKeywords.slice(0, 4).join(", ")}.`,
      impact: "high",
      difficulty: "medium",
      estimated_score_boost: boost,
      action_data: {
        field: "description",
        suggested_value: `Incluir termos de busca: ${missingKeywords.slice(0, 6).join(", ")}`,
      },
      reasoning: "Palavras-chave presentes em concorrentes top elevam visibilidade.",
      competitor_insight: `${missingKeywords.length} termos ausentes em relação a concorrentes.`,
      roi_score: clamp(70 + Math.floor(boost / 2), 65, 92),
      quick_apply: false,
    });
  }

  const imagesCount = analysisData.image_analysis?.total_images || 0;
  const hasVideo = analysisData.image_analysis?.has_video || false;
  if (imagesScore < 65 || imagesCount < 6 || !hasVideo) {
    const boost = clamp((6 - imagesCount) * 3 + (!hasVideo ? 6 : 0), 6, 20);
    suggestions.push({
      id: "imagens-melhorar",
      type: "sales",
      category: "Imagens",
      title: "Melhorar quantidade/qualidade de imagens",
      description: `Atualmente ${imagesCount} imagens${!hasVideo ? " e sem vídeo" : ""}.`,
      impact: imagesCount < 3 ? "high" : "medium",
      difficulty: "medium",
      estimated_score_boost: boost,
      estimated_conversion_boost: clamp(10 + Math.floor(boost / 2), 10, 30),
      reasoning: "Mais imagens e vídeo aumentam confiança e conversão.",
      roi_score: clamp(65 + Math.floor(boost / 2), 60, 90),
      quick_apply: false,
    });
  }

  const priceAnalysis = analysisData.competitive_analysis?.price_analysis;
  if (priceAnalysis?.market_average && priceAnalysis.current_price) {
    const position = priceAnalysis.price_position;
    if (position === "above_average" || position === "highest") {
      suggestions.push({
        id: "preco-estrategia",
        type: "competitive",
        category: "Preço",
        title: "Revisar preço vs mercado",
        description: `Preço atual acima da média (R$ ${priceAnalysis.market_average.toFixed(2)}).`,
        impact: "medium",
        difficulty: "medium",
        estimated_score_boost: 8,
        estimated_conversion_boost: 12,
        reasoning: `Faixa recomendada: R$ ${priceAnalysis.optimal_price_range.min.toFixed(2)} – R$ ${priceAnalysis.optimal_price_range.max.toFixed(2)}.`,
        roi_score: 70,
        quick_apply: false,
      });
    }
  }

  if (analysisData.product_data.shipping && analysisData.product_data.shipping.free_shipping === false) {
    suggestions.push({
      id: "frete-estrategia",
      type: "sales",
      category: "Frete",
      title: "Avaliar frete grátis",
      description: "Frete grátis costuma elevar conversão e ranking.",
      impact: "high",
      difficulty: "medium",
      estimated_score_boost: 8,
      estimated_conversion_boost: 15,
      reasoning: "Ofertas com frete grátis têm maior taxa de clique e conversão.",
      roi_score: 85,
      quick_apply: false,
    });
  }

  const missingTechnical = analysisData.technical_analysis?.completion_percentage;
  if (missingTechnical !== undefined && missingTechnical < 70 && techScore < 70) {
    suggestions.push({
      id: "ficha-tecnica",
      type: "technical",
      category: "Ficha técnica",
      title: "Completar ficha técnica",
      description: `Apenas ${Math.round(missingTechnical)}% dos atributos preenchidos.`,
      impact: "medium",
      difficulty: "easy",
      estimated_score_boost: 10,
      reasoning: "Ficha técnica completa melhora rankeamento e reduz devoluções.",
      roi_score: 72,
      quick_apply: true,
    });
  }

  return suggestions;
};

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

    const productSummary = {
      title: analysisData.product_data.title,
      current_description: analysisData.product_data.description || analysisData.product_data.plain_text || "(descrição não disponível)",
      price: analysisData.product_data.price,
      status: analysisData.product_data.status,
      sold_quantity: analysisData.product_data.sold_quantity,
      score: analysisData.quality_score.overall_score,
      breakdown: analysisData.quality_score.breakdown,
      missing_attributes: analysisData.technical_analysis?.missing_important || [],
      images: analysisData.image_analysis?.total_images || 0,
      has_video: analysisData.image_analysis?.has_video || false,
      price_analysis: analysisData.competitive_analysis?.price_analysis,
      keywords_missing: analysisData.keyword_analysis?.missing_keywords || [],
      free_shipping: analysisData.product_data.shipping?.free_shipping || false,
    };

    const baselineSuggestions = buildBaselineSuggestions(analysisData);
    const fallbackInsights = buildFallbackInsights(analysisData);

    let aiInsights = fallbackInsights;

    if (process.env.OPENAI_API_KEY) {
      const aiPrompt = `
Você é um especialista em Mercado Livre. Gere uma análise curta, objetiva e profissional.
Use apenas os dados abaixo e NÃO invente nada.

Dados:
- Título: ${productSummary.title}
- Descrição atual: ${productSummary.current_description}
- Score geral: ${productSummary.score}
- Score (título/descrição): ${productSummary.breakdown?.title_seo ?? "N/D"} / ${productSummary.breakdown?.description_quality ?? "N/D"}
- Imagens: ${productSummary.images} (vídeo: ${productSummary.has_video ? "sim" : "não"})
- Atributos faltantes: ${productSummary.missing_attributes.length ? productSummary.missing_attributes.join(", ") : "nenhum"}
- Keywords faltando: ${productSummary.keywords_missing.length ? productSummary.keywords_missing.join(", ") : "nenhuma"}
- Preço: R$ ${productSummary.price} (posição: ${productSummary.price_analysis?.price_position ?? "N/D"})
- Frete grátis: ${productSummary.free_shipping ? "sim" : "não"}

Responda APENAS em JSON:
{ "ai_insights": "texto em português (3 a 6 frases curtas)" }
`;

      try {
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
          temperature: 0.2,
          max_tokens: 800
        });

        const aiResponse = completion.choices[0].message.content;
        if (aiResponse) {
          let cleanResponse = aiResponse.trim();
          if (cleanResponse.startsWith("```json")) {
            cleanResponse = cleanResponse.replace(/```json\s*/, "").replace(/\s*```$/, "");
          }
          if (cleanResponse.startsWith("```")) {
            cleanResponse = cleanResponse.replace(/```\s*/, "").replace(/\s*```$/, "");
          }
          const parsed = JSON.parse(cleanResponse);
          if (typeof parsed?.ai_insights === "string" && parsed.ai_insights.trim()) {
            aiInsights = parsed.ai_insights.trim();
          }
        }
      } catch (aiError: any) {
        console.warn("[AI Analysis] Falha ao gerar insights via OpenAI. Usando fallback.", aiError?.message || aiError);
      }
    }

    const highImpactCount = baselineSuggestions.filter((s) => s.impact === "high").length;
    const quickWinsCount = baselineSuggestions.filter((s) => s.quick_apply).length;
    const totalBoost = baselineSuggestions.reduce((sum, s) => sum + (s.estimated_score_boost || 0), 0);
    const avgROI = baselineSuggestions.reduce((sum, s) => sum + (s.roi_score || 0), 0) / (baselineSuggestions.length || 1);
    const baseScore = analysisData.quality_score.overall_score || 60;
    const overallOpportunity = clamp(
      Math.round((100 - baseScore) * 0.6 + avgROI * 0.4 + baselineSuggestions.length * 2),
      10,
      95
    );

    const response: AIAnalysisResponse = {
      success: true,
      overall_opportunity_score: overallOpportunity,
      total_suggestions: baselineSuggestions.length,
      high_impact_count: highImpactCount,
      quick_wins_available: quickWinsCount,
      competitive_gap_score: Math.max(0, 90 - baseScore),
      seo_optimization_potential: Math.max(0, 95 - baseScore),
      sales_optimization_potential: Math.min(50, baselineSuggestions.filter((s) => s.type === "sales").length * 10),
      estimated_total_boost: totalBoost,
      suggestions: baselineSuggestions,
      ai_insights: aiInsights,
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
