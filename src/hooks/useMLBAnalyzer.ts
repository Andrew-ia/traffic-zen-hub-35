import { useState } from 'react';
import { useWorkspace } from './useWorkspace';

export interface MLBAnalysisResult {
    success: boolean;
    mlb_id: string;
    analyzed_at: string;
    product_data: {
        id: string;
        title: string;
        price: number;
        category_id: string;
        status: string;
        sold_quantity: number;
        available_quantity: number;
        permalink: string;
        thumbnail: string;
        attributes?: Array<{
            id: string;
            value_id?: string;
            value_name: string;
        }>;
        pictures?: Array<{
            id: string;
            url?: string;
            secure_url?: string;
            size?: string;
            max_size?: string;
            quality?: string;
        }>;
    };
    quality_score: {
        overall_score: number;
        breakdown: {
            title_seo: number;
            technical_sheet: number;
            images_quality: number;
            keywords_density: number;
            model_optimization: number;
            description_quality: number;
            category_relevance: number;
            pricing_strategy: number;
            shipping_optimization: number;
            variations_usage: number;
        };
        alerts: Array<{
            type: 'warning' | 'error' | 'info' | 'success';
            message: string;
            priority: 'high' | 'medium' | 'low';
            action?: string;
        }>;
        suggestions: Array<{
            category: string;
            title: string;
            description: string;
            impact: 'high' | 'medium' | 'low';
            difficulty: 'easy' | 'medium' | 'hard';
        }>;
    };
    model_optimization?: {
        current_model?: string;
        current_score?: number;
        strategic_keywords?: string[];
        optimized_models?: Array<{ model: string; score: number }>;
        category_insights?: {
            category_name: string;
            trending_terms: string[];
            high_conversion_words: string[];
            seasonal_keywords: string[];
        };
    };
    technical_sheet_analysis?: any; // Definir tipo mais específico se possível
    keyword_analysis: {
        primary_keywords: string[];
        secondary_keywords: string[];
        long_tail_keywords: string[];
        missing_keywords: string[];
        keyword_density: number;
        trending_keywords: string[];
        competitor_keywords: string[];
        recommended_for_title: string[];
        recommended_for_model: string[];
        recommended_for_attributes: string[];
        recommended_for_description: string[];
    };
    title_optimization: {
        current_title: string;
        current_score: number;
        weaknesses: string[];
        suggested_titles: Array<{
            title: string;
            score: number;
            reasoning: string;
            keywords_added: string[];
            keywords_removed: string[];
        }>;
        best_practices: string[];
    };
    seo_description: {
        optimized_description: string;
        structure: {
            title_section: string;
            bullet_points: string[];
            technical_specs: string;
            benefits: string[];
            usage_info: string;
            warranty_info: string;
            warranty_time?: string;
            faq_section: string[];
        };
        seo_keywords: string[];
        readability_score: number;
        call_to_action: string;
    };
    technical_analysis: {
        total_attributes: number;
        filled_attributes: number;
        missing_important: string[];
        completion_percentage: number;
    };
    image_analysis: {
        total_images: number;
        has_video: boolean;
        high_quality_images: number;
        has_variations_images: boolean;
    };
    competitive_analysis: {
        total_competitors_analyzed: number;
        market_position: 'leader' | 'strong' | 'average' | 'weak';
        competitive_score: number;
        top_competitors: Array<{
            id: string;
            title: string;
            price: number;
            sold_quantity: number;
            permalink: string;
            thumbnail: string;
            seller: {
                id: string;
                nickname: string;
                reputation_level: string;
                transactions: number;
            };
            listing_type: string;
            shipping: {
                free_shipping: boolean;
                mode: string;
            };
            attributes: Array<{ id: string; value_name: string }>;
            score: { overall: number };
        }>;
        price_analysis: {
            current_price: number;
            market_average: number;
            cheapest_competitor: number;
            most_expensive: number;
            price_position: 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest';
            optimal_price_range: { min: number; max: number; recommended: number };
        };
        feature_comparison: {
            current_features: string[];
            competitor_features: { [feature: string]: number };
            missing_features: Array<{ feature: string; competitor_count: number; importance_score: number }>;
            unique_advantages: string[];
            category_standards: string[];
        };
        competitive_gaps: Array<{ type: string; severity: string; description: string }>;
        opportunities: Array<{ type: string; priority: 'high' | 'medium' | 'low'; description: string; expected_impact: number }>;
        threats: Array<{ competitor_id: string; threat_level: 'high' | 'medium' | 'low' }>;
        market_insights: {
            category_trends: string[];
            consumer_preferences: string[];
            seasonal_patterns: string[];
            growth_opportunities: string[];
        };
        category_top_products?: Array<{
            id: string;
            title: string;
            price: number;
            sold_quantity: number;
            permalink: string;
            thumbnail: string;
            seller: {
                id: string;
                nickname: string;
                reputation_level: string;
                transactions: number;
            };
            shipping: {
                free_shipping: boolean;
                mode: string;
            };
        }>;
    };
    organic_delivery_prediction: {
        ranking_potential: number;
        relevance_index: number;
        optimization_level: string;
        estimated_visibility: string;
    };
    recommendations: {
        priority_actions: Array<any>;
        quick_wins: Array<any>;
        advanced_optimizations: Array<any>;
    };
}

export interface TitleOptimizationResult {
    success: boolean;
    title_analysis: {
        current_title: string;
        length: number;
        word_count: number;
        has_brand: boolean;
        has_numbers: boolean;
        has_special_chars: boolean;
        readability_score: number;
        seo_score: number;
    };
    suggestions: Array<{
        title: string;
        score: number;
        improvements: string[];
    }>;
    recommendations: string[];
}

export interface SEODescriptionResult {
    success: boolean;
    mlb_id: string;
    generated_description: {
        optimized_description: string;
        structure: any;
        seo_keywords: string[];
        readability_score: number;
        call_to_action: string;
    };
    style_applied: string;
    keywords_included: string[];
    estimated_seo_boost: string;
}

export function useMLBAnalyzer() {
    const { currentWorkspace } = useWorkspace();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [currentAnalysis, setCurrentAnalysis] = useState<MLBAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastAnalyzed, setLastAnalyzed] = useState<{
        mlbId: string;
        title: string;
        score: number;
        timestamp: string;
    } | null>(null);

    const analyzeProduct = async (mlbId: string): Promise<MLBAnalysisResult | null> => {
        if (!currentWorkspace?.id) {
            setError('Workspace não encontrado');
            return null;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await fetch('/api/integrations/mercadolivre/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mlbId: mlbId,
                    workspaceId: currentWorkspace.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                const serverMessage = errorData?.details || errorData?.error;
                console.error('Erro na análise MLB (server):', errorData);
                throw new Error(serverMessage || 'Falha na análise do produto');
            }

            const result: MLBAnalysisResult = await response.json();

            setCurrentAnalysis(result);
            setLastAnalyzed({
                mlbId: result.mlb_id,
                title: result.product_data.title,
                score: result.quality_score.overall_score,
                timestamp: result.analyzed_at
            });

            return result;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            setError(message);
            console.error('Erro na análise MLB:', error);
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    };

    const optimizeTitle = async (title: string, mlbId?: string): Promise<TitleOptimizationResult | null> => {
        if (!currentWorkspace?.id) {
            setError('Workspace não encontrado');
            return null;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await fetch('/api/integrations/mercadolivre/optimize-title', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    mlbId: mlbId,
                    workspaceId: currentWorkspace.id
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha na otimização do título');
            }

            const result: TitleOptimizationResult = await response.json();
            return result;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            setError(message);
            console.error('Erro na otimização de título:', error);
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generateDescription = async (mlbId: string, style: string = 'professional'): Promise<SEODescriptionResult | null> => {
        if (!currentWorkspace?.id) {
            setError('Workspace não encontrado');
            return null;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await fetch('/api/integrations/mercadolivre/generate-description', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mlbId: mlbId,
                    workspaceId: currentWorkspace.id,
                    style: style
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Falha na geração da descrição');
            }

            const result: SEODescriptionResult = await response.json();
            return result;

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            setError(message);
            console.error('Erro na geração de descrição:', error);
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    };

    const clearAnalysis = () => {
        setCurrentAnalysis(null);
        setError(null);
    };

    const clearError = () => {
        setError(null);
    };

    return {
        // Estado
        isAnalyzing,
        currentAnalysis,
        error,
        lastAnalyzed,

        // Métodos
        analyzeProduct,
        optimizeTitle,
        generateDescription,
        clearAnalysis,
        clearError,

        // Dados derivados
        hasAnalysis: !!currentAnalysis,
        qualityScore: currentAnalysis?.quality_score?.overall_score || 0,
        productTitle: currentAnalysis?.product_data?.title || '',
        productId: currentAnalysis?.mlb_id || '',
    };
}
