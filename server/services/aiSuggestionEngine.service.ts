import { MLBAnalysisResult } from "./mlbAnalyzer.service.js";

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
    roi_score: number; // 0-100
    quick_apply: boolean; // Pode ser aplicado automaticamente
}

export interface AIOpportunityAnalysis {
    overall_opportunity_score: number; // 0-100
    total_suggestions: number;
    high_impact_count: number;
    quick_wins_available: number;
    competitive_gap_score: number;
    seo_optimization_potential: number;
    sales_optimization_potential: number;
    estimated_total_boost: number;
    suggestions: AISuggestion[];
}

export class AISuggestionEngine {
    
    /**
     * Análise principal de oportunidades baseada em IA
     */
    analyzeOptimizationOpportunities(analysisData: MLBAnalysisResult): AIOpportunityAnalysis {
        const suggestions: AISuggestion[] = [];
        
        // Análises SEO
        suggestions.push(...this.generateSEOSuggestions(analysisData));
        
        // Análises de Vendas
        suggestions.push(...this.generateSalesSuggestions(analysisData));
        
        // Análises Competitivas
        suggestions.push(...this.generateCompetitiveSuggestions(analysisData));
        
        // Análises Técnicas
        suggestions.push(...this.generateTechnicalSuggestions(analysisData));
        
        // Priorizar por ROI
        const prioritizedSuggestions = this.prioritizeSuggestionsByROI(suggestions);
        
        // Calcular métricas do resumo
        const opportunityAnalysis = this.calculateOpportunityMetrics(prioritizedSuggestions, analysisData);
        
        return {
            ...opportunityAnalysis,
            suggestions: prioritizedSuggestions
        };
    }

    /**
     * Gera sugestões de SEO
     */
    private generateSEOSuggestions(analysis: MLBAnalysisResult): AISuggestion[] {
        const suggestions: AISuggestion[] = [];
        const titleOpt = analysis.title_optimization;
        const keywords = analysis.keyword_analysis;
        const currentScore = analysis.quality_score.breakdown.title_seo;

        // Título com baixo score SEO
        if (currentScore < 70) {
            const bestTitle = titleOpt.suggested_titles[0];
            if (bestTitle && bestTitle.score > titleOpt.current_score) {
                suggestions.push({
                    id: 'title-optimization',
                    type: 'seo',
                    category: 'Título',
                    title: 'Otimizar título para SEO',
                    description: `Usar título otimizado com score ${bestTitle.score} (+${bestTitle.score - titleOpt.current_score} pontos)`,
                    impact: bestTitle.score - titleOpt.current_score > 20 ? 'high' : 'medium',
                    difficulty: 'easy',
                    estimated_score_boost: bestTitle.score - titleOpt.current_score,
                    action_data: {
                        field: 'title',
                        current_value: titleOpt.current_title,
                        suggested_value: bestTitle.title
                    },
                    reasoning: bestTitle.reasoning,
                    roi_score: Math.min(95, bestTitle.score - titleOpt.current_score + 50),
                    quick_apply: true
                });
            }
        }

        // Keywords em falta
        if (keywords.missing_keywords.length > 0) {
            const topMissing = keywords.missing_keywords.slice(0, 3);
            suggestions.push({
                id: 'missing-keywords',
                type: 'seo',
                category: 'Keywords',
                title: 'Adicionar keywords importantes',
                description: `${topMissing.length} keywords estratégicas em falta: ${topMissing.join(', ')}`,
                impact: 'high',
                difficulty: 'medium',
                estimated_score_boost: Math.min(25, topMissing.length * 8),
                action_data: {
                    field: 'keywords',
                    suggested_value: topMissing.join(', ')
                },
                reasoning: 'Keywords presentes em concorrentes top mas ausentes no seu anúncio',
                roi_score: 80,
                quick_apply: false
            });
        }

        // Densidade de keywords baixa
        if (keywords.keyword_density < 5) {
            suggestions.push({
                id: 'keyword-density',
                type: 'seo',
                category: 'Densidade',
                title: 'Melhorar densidade de keywords',
                description: `Densidade atual: ${keywords.keyword_density.toFixed(1)}% (ideal: 5-8%)`,
                impact: 'medium',
                difficulty: 'easy',
                estimated_score_boost: 15,
                reasoning: 'Baixa densidade reduz relevância nos resultados de busca',
                roi_score: 65,
                quick_apply: false
            });
        }

        return suggestions;
    }

    /**
     * Gera sugestões de vendas
     */
    private generateSalesSuggestions(analysis: MLBAnalysisResult): AISuggestion[] {
        const suggestions: AISuggestion[] = [];
        const competitive = analysis.competitive_analysis;
        const productData = analysis.product_data;

        // Análise de preço competitivo
        if (competitive.price_analysis) {
            const pricePos = competitive.price_analysis.price_position;
            const currentPrice = competitive.price_analysis.current_price;
            const optimalRange = competitive.price_analysis.optimal_price_range;

            if (pricePos === 'highest' || pricePos === 'above_average') {
                suggestions.push({
                    id: 'price-optimization',
                    type: 'sales',
                    category: 'Preço',
                    title: 'Otimizar preço para mais vendas',
                    description: `Preço atual R$ ${currentPrice} está alto. Range ótimo: R$ ${optimalRange.min}-${optimalRange.max}`,
                    impact: 'high',
                    difficulty: 'easy',
                    estimated_score_boost: 0,
                    estimated_conversion_boost: 25,
                    action_data: {
                        field: 'price',
                        current_value: currentPrice.toString(),
                        suggested_value: optimalRange.recommended.toString()
                    },
                    reasoning: 'Preço competitivo aumenta conversão e posicionamento',
                    roi_score: 85,
                    quick_apply: false
                });
            }
        }

        // Frete grátis
        if (!productData.shipping?.free_shipping) {
            const competitorsWithFreeShipping = competitive.top_competitors?.filter(c => c.shipping.free_shipping).length || 0;
            const totalCompetitors = competitive.top_competitors?.length || 1;
            const freeShippingPercentage = (competitorsWithFreeShipping / totalCompetitors) * 100;

            if (freeShippingPercentage > 60) {
                suggestions.push({
                    id: 'free-shipping',
                    type: 'sales',
                    category: 'Envio',
                    title: 'Ativar frete grátis',
                    description: `${freeShippingPercentage.toFixed(0)}% dos concorrentes oferecem frete grátis`,
                    impact: 'high',
                    difficulty: 'medium',
                    estimated_score_boost: 10,
                    estimated_conversion_boost: 35,
                    reasoning: 'Frete grátis é decisivo para conversão no ML',
                    competitor_insight: `${competitorsWithFreeShipping}/${totalCompetitors} concorrentes têm frete grátis`,
                    roi_score: 90,
                    quick_apply: false
                });
            }
        }

        // Quantidade de imagens
        const imageCount = analysis.image_analysis.total_images;
        const avgCompetitorImages = this.calculateAverageCompetitorImages(competitive);
        
        if (imageCount < avgCompetitorImages - 2) {
            suggestions.push({
                id: 'add-images',
                type: 'sales',
                category: 'Imagens',
                title: 'Adicionar mais imagens',
                description: `Você tem ${imageCount} imagens, concorrentes têm em média ${avgCompetitorImages.toFixed(0)}`,
                impact: 'medium',
                difficulty: 'medium',
                estimated_score_boost: 8,
                estimated_conversion_boost: 15,
                reasoning: 'Mais imagens aumentam confiança e reduzem dúvidas do comprador',
                roi_score: 70,
                quick_apply: false
            });
        }

        return suggestions;
    }

    /**
     * Gera sugestões competitivas
     */
    private generateCompetitiveSuggestions(analysis: MLBAnalysisResult): AISuggestion[] {
        const suggestions: AISuggestion[] = [];
        const competitive = analysis.competitive_analysis;

        // Analisar gaps competitivos
        if (competitive.competitive_gaps) {
            competitive.competitive_gaps.slice(0, 2).forEach((gap, index) => {
                suggestions.push({
                    id: `competitive-gap-${index}`,
                    type: 'competitive',
                    category: 'Gap Competitivo',
                    title: `Fechar gap: ${gap.type}`,
                    description: gap.description,
                    impact: gap.severity === 'high' ? 'high' : 'medium',
                    difficulty: 'medium',
                    estimated_score_boost: gap.severity === 'high' ? 15 : 8,
                    reasoning: 'Oportunidade de diferenciação competitiva',
                    roi_score: gap.severity === 'high' ? 75 : 60,
                    quick_apply: false
                });
            });
        }

        // Recursos únicos dos concorrentes
        if (competitive.feature_comparison?.missing_features) {
            const topMissingFeatures = competitive.feature_comparison.missing_features
                .sort((a, b) => b.importance_score - a.importance_score)
                .slice(0, 2);

            topMissingFeatures.forEach((feature, index) => {
                suggestions.push({
                    id: `missing-feature-${index}`,
                    type: 'competitive',
                    category: 'Recurso',
                    title: `Implementar: ${feature.feature}`,
                    description: `${feature.competitor_count} concorrentes têm este recurso`,
                    impact: feature.importance_score > 7 ? 'high' : 'medium',
                    difficulty: 'hard',
                    estimated_score_boost: Math.min(20, feature.importance_score * 2),
                    competitor_insight: `Presente em ${feature.competitor_count} concorrentes principais`,
                    reasoning: 'Recurso valorizado pelos compradores da categoria',
                    roi_score: feature.importance_score * 8,
                    quick_apply: false
                });
            });
        }

        return suggestions;
    }

    /**
     * Gera sugestões técnicas
     */
    private generateTechnicalSuggestions(analysis: MLBAnalysisResult): AISuggestion[] {
        const suggestions: AISuggestion[] = [];
        const technical = analysis.technical_analysis;
        const productData = analysis.product_data;

        // Atributos importantes em falta
        if (technical.missing_important.length > 0) {
            technical.missing_important.slice(0, 3).forEach(attrName => {
                suggestions.push({
                    id: `missing-attr-${attrName}`,
                    type: 'technical',
                    category: 'Atributo',
                    title: `Preencher atributo: ${attrName}`,
                    description: `Atributo importante não preenchido`,
                    impact: 'medium',
                    difficulty: 'easy',
                    estimated_score_boost: 12,
                    action_data: {
                        field: 'attributes',
                        attribute_id: attrName,
                        current_value: '',
                        suggested_value: this.suggestAttributeValue(attrName, analysis)
                    },
                    reasoning: 'Atributos completos melhoram relevância e confiança',
                    roi_score: 65,
                    quick_apply: true
                });
            });
        }

        // Modelo em branco ou genérico
        const modelAttr = productData.attributes?.find(a => a.id === 'MODEL');
        const currentModel = modelAttr?.value_name || '';
        
        if (!currentModel || currentModel.toLowerCase().includes('genéric') || currentModel.length < 5) {
            const suggestedModel = analysis.model_optimization?.optimized_models?.[0]?.model;
            if (suggestedModel) {
                suggestions.push({
                    id: 'model-optimization',
                    type: 'technical',
                    category: 'Modelo',
                    title: 'Otimizar campo modelo',
                    description: 'Usar modelo estratégico com keywords relevantes',
                    impact: 'medium',
                    difficulty: 'easy',
                    estimated_score_boost: 10,
                    action_data: {
                        field: 'model',
                        current_value: currentModel,
                        suggested_value: suggestedModel
                    },
                    reasoning: 'Campo modelo bem otimizado melhora SEO interno do ML',
                    roi_score: 70,
                    quick_apply: true
                });
            }
        }

        // Descrição com baixa qualidade
        const descScore = analysis.quality_score.breakdown.description_quality;
        if (descScore < 70) {
            suggestions.push({
                id: 'description-optimization',
                type: 'technical',
                category: 'Descrição',
                title: 'Melhorar descrição SEO',
                description: `Score atual: ${descScore}/100. Usar estrutura otimizada`,
                impact: 'high',
                difficulty: 'easy',
                estimated_score_boost: Math.min(30, 100 - descScore),
                action_data: {
                    field: 'description',
                    current_value: '',
                    suggested_value: analysis.seo_description.optimized_description
                },
                reasoning: 'Descrição estruturada aumenta conversão e SEO',
                roi_score: 85,
                quick_apply: true
            });
        }

        return suggestions;
    }

    /**
     * Prioriza sugestões por ROI
     */
    private prioritizeSuggestionsByROI(suggestions: AISuggestion[]): AISuggestion[] {
        return suggestions.sort((a, b) => {
            // Priorizar por: ROI score, impacto, facilidade
            const aScore = a.roi_score + (a.impact === 'high' ? 20 : a.impact === 'medium' ? 10 : 0) + 
                          (a.difficulty === 'easy' ? 10 : a.difficulty === 'medium' ? 5 : 0);
            const bScore = b.roi_score + (b.impact === 'high' ? 20 : b.impact === 'medium' ? 10 : 0) + 
                          (b.difficulty === 'easy' ? 10 : b.difficulty === 'medium' ? 5 : 0);
            return bScore - aScore;
        });
    }

    /**
     * Calcula métricas do resumo de oportunidades
     */
    private calculateOpportunityMetrics(suggestions: AISuggestion[], analysis: MLBAnalysisResult): Omit<AIOpportunityAnalysis, 'suggestions'> {
        const highImpactCount = suggestions.filter(s => s.impact === 'high').length;
        const quickWinsCount = suggestions.filter(s => s.quick_apply && s.difficulty === 'easy').length;
        const avgROI = suggestions.reduce((sum, s) => sum + s.roi_score, 0) / suggestions.length || 0;
        
        // Score competitivo baseado na posição atual
        const competitiveScore = analysis.competitive_analysis.competitive_score || 50;
        const competitiveGap = Math.max(0, 100 - competitiveScore);
        
        // Potencial SEO
        const currentSeoScore = analysis.quality_score.overall_score;
        const seoPotential = Math.max(0, 95 - currentSeoScore);
        
        // Potencial de vendas baseado em gaps competitivos
        const salesPotential = Math.min(40, competitiveGap * 0.6);
        
        // Score total de oportunidade
        const overallOpportunityScore = Math.min(100, 
            (avgROI * 0.4) + 
            (highImpactCount * 8) + 
            (quickWinsCount * 5) + 
            (seoPotential * 0.3)
        );

        return {
            overall_opportunity_score: Math.round(overallOpportunityScore),
            total_suggestions: suggestions.length,
            high_impact_count: highImpactCount,
            quick_wins_available: quickWinsCount,
            competitive_gap_score: Math.round(competitiveGap),
            seo_optimization_potential: Math.round(seoPotential),
            sales_optimization_potential: Math.round(salesPotential),
            estimated_total_boost: Math.round(suggestions.reduce((sum, s) => sum + s.estimated_score_boost, 0))
        };
    }

    /**
     * Sugere valor para atributo específico
     */
    private suggestAttributeValue(attributeName: string, analysis: MLBAnalysisResult): string {
        const competitors = analysis.competitive_analysis.top_competitors || [];
        
        // Buscar valores mais comuns entre concorrentes
        const values: string[] = [];
        competitors.forEach(comp => {
            const attr = comp.attributes?.find(a => a.id === attributeName);
            if (attr?.value_name) {
                values.push(attr.value_name);
            }
        });

        if (values.length > 0) {
            // Retornar valor mais comum
            const frequency: { [key: string]: number } = {};
            values.forEach(val => frequency[val] = (frequency[val] || 0) + 1);
            const mostCommon = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
            return mostCommon[0];
        }

        // Fallback para valores padrão
        const defaults: { [key: string]: string } = {
            'BRAND': 'Não informado',
            'COLOR': 'Variado',
            'SIZE': 'Único',
            'MATERIAL': 'Não especificado',
            'WEIGHT': 'Não informado'
        };

        return defaults[attributeName] || 'A definir';
    }

    /**
     * Calcula média de imagens dos concorrentes
     */
    private calculateAverageCompetitorImages(competitive: any): number {
        const competitors = competitive.top_competitors || [];
        if (competitors.length === 0) return 8; // Default
        
        // Assumir que concorrentes têm 6-10 imagens em média
        return 8; // Placeholder - em implementação real, buscar dos dados dos concorrentes
    }
}

export const aiSuggestionEngine = new AISuggestionEngine();
