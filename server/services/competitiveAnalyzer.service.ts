import { MLBAnalysisData } from './mlbAnalyzer.service.js';
import axios from 'axios';

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

export interface CompetitorProduct {
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
    attributes: Array<{
        id: string;
        value_name: string;
    }>;
    score: {
        ranking_factors: number;
        price_competitiveness: number;
        feature_completeness: number;
        overall: number;
    };
}

export interface CompetitiveGap {
    type: 'price' | 'feature' | 'positioning' | 'content' | 'ranking_factor';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    competitor_advantage: string;
    impact_on_ranking: number; // 1-10
    difficulty_to_fix: 'easy' | 'medium' | 'hard';
    recommendations: string[];
    potential_traffic_gain: number; // percentage
}

export interface PriceAnalysis {
    current_price: number;
    market_average: number;
    cheapest_competitor: number;
    most_expensive: number;
    price_position: 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest';
    optimal_price_range: {
        min: number;
        max: number;
        recommended: number;
    };
    price_elasticity_insights: {
        price_sensitive_category: boolean;
        sweet_spot: number;
        conversion_impact: string;
    };
}

export interface FeatureComparison {
    current_features: string[];
    competitor_features: { [feature: string]: number }; // feature -> count of competitors with it
    missing_features: Array<{
        feature: string;
        competitor_count: number;
        importance_score: number;
        implementation_difficulty: 'easy' | 'medium' | 'hard';
    }>;
    unique_advantages: string[];
    category_standards: string[];
}

export interface RankingFactorsAnalysis {
    current_score: number;
    top_competitor_score: number;
    gap_analysis: Array<{
        factor: string;
        current_value: number;
        competitor_average: number;
        impact_weight: number;
        improvement_potential: number;
    }>;
    quick_wins: Array<{
        factor: string;
        current_gap: number;
        effort_required: string;
        expected_boost: number;
    }>;
}

export interface CategoryTopProduct {
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
}

export interface CompetitiveAnalysisResult {
    total_competitors_analyzed: number;
    market_position: 'leader' | 'strong' | 'average' | 'weak';
    competitive_score: number; // 0-100
    top_competitors: CompetitorProduct[];
    price_analysis: PriceAnalysis;
    feature_comparison: FeatureComparison;
    ranking_factors: RankingFactorsAnalysis;
    competitive_gaps: CompetitiveGap[];
    opportunities: Array<{
        type: 'price_optimization' | 'feature_enhancement' | 'content_improvement' | 'positioning';
        priority: 'high' | 'medium' | 'low';
        description: string;
        expected_impact: number;
        implementation_steps: string[];
        timeline: string;
    }>;
    threats: Array<{
        competitor_id: string;
        threat_level: 'high' | 'medium' | 'low';
        advantages: string[];
        risk_description: string;
        mitigation_strategies: string[];
    }>;
    market_insights: {
        category_trends: string[];
        consumer_preferences: string[];
        seasonal_patterns: string[];
        growth_opportunities: string[];
    };
    category_top_products?: CategoryTopProduct[];
}

/**
 * Serviço especializado em análise competitiva
 */
export class CompetitiveAnalyzerService {
    
    /**
     * Executa análise competitiva completa
     */
    async analyzeCompetition(productData: MLBAnalysisData, accessToken?: string): Promise<CompetitiveAnalysisResult> {
        // 1. Identificar concorrentes
        const competitors = await this.findCompetitors(productData, accessToken);
        
        // 2. Análise de preços
        const priceAnalysis = this.analyzePrices(productData, competitors);
        
        // 3. Comparação de características
        const featureComparison = this.compareFeatures(productData, competitors);
        
        // 4. Análise de fatores de ranking
        const rankingFactors = this.analyzeRankingFactors(productData, competitors);
        
        // 5. Identificar gaps competitivos
        const competitiveGaps = this.identifyCompetitiveGaps(productData, competitors, priceAnalysis, featureComparison);
        
        // 6. Gerar oportunidades e ameaças
        const opportunities = this.identifyOpportunities(competitiveGaps, priceAnalysis, featureComparison);
        const threats = this.assessThreats(competitors, productData);
        
        // 7. Insights de mercado
        const marketInsights = await this.generateMarketInsights(productData.category_id, competitors);
        
        // 8. Top 10 produtos da categoria
        const categoryTopProducts = await this.getCategoryTopProducts(productData.category_id, accessToken);
        
        const competitiveScore = this.calculateCompetitiveScore(productData, competitors, priceAnalysis, featureComparison);
        const marketPosition = this.determineMarketPosition(competitiveScore, competitors.length);
        
        return {
            total_competitors_analyzed: competitors.length,
            market_position: marketPosition,
            competitive_score: competitiveScore,
            top_competitors: competitors.slice(0, 5),
            price_analysis: priceAnalysis,
            feature_comparison: featureComparison,
            ranking_factors: rankingFactors,
            competitive_gaps: competitiveGaps,
            opportunities: opportunities,
            threats: threats,
            market_insights: marketInsights,
            category_top_products: categoryTopProducts
        };
    }

    /**
     * Encontra produtos concorrentes
     */
    private async findCompetitors(productData: MLBAnalysisData, accessToken?: string): Promise<CompetitorProduct[]> {
        const terms = this.buildQueryTerms(productData);
        const headers = { 'User-Agent': 'TrafficPro-MLB-Analyzer/1.0' } as any;

        const collectedIds = new Set<string>();
        const competitors: CompetitorProduct[] = [];

        const allResults: any[] = [];
        try {
            for (let offset = 0; offset < 100; offset += 50) { // Reduzir para evitar rate limiting
                const resp = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
                    params: { category: productData.category_id, limit: 20, offset, sort: 'sold_quantity_desc' },
                    headers,
                    timeout: 10000
                });
                const results = Array.isArray(resp.data?.results) ? resp.data.results : [];
                for (const r of results) {
                    const id = String(r.id || '');
                    if (!id || id === productData.id) continue;
                    if (collectedIds.has(id)) continue;
                    collectedIds.add(id);
                    allResults.push(r);
                }
                if (collectedIds.size >= 20) break; // Reduzir quantidade para melhor performance
            }
        } catch (e) {
            console.warn('[Competitors] Erro na busca inicial:', e.message);
        }

        if (collectedIds.size < 30) {
            const brandModel = this.buildBrandModelQuery(productData) || terms.slice(0, 3).join(' ');
            try {
                const resp = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
                    params: { q: brandModel, limit: 100 },
                    headers
                });
                const results = Array.isArray(resp.data?.results) ? resp.data.results : [];
                for (const r of results) {
                    const id = String(r.id || '');
                    if (!id || id === productData.id) continue;
                    if (collectedIds.has(id)) continue;
                    collectedIds.add(id);
                }
            } catch (e) {
                void e;
            }
        }

        if (collectedIds.size < 30) {
            try {
                const resp = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
                    params: { q: terms.join(' '), category: productData.category_id, limit: 100 },
                    headers
                });
                const results = Array.isArray(resp.data?.results) ? resp.data.results : [];
                for (const r of results) {
                    const id = String(r.id || '');
                    if (!id || id === productData.id) continue;
                    if (collectedIds.has(id)) continue;
                    collectedIds.add(id);
                }
            } catch (e) {
                void e;
            }
        }

        // Mapear diretamente dos resultados da busca
        const baseCompetitors = allResults.slice(0, 15).map((r: any) => {
            const comp: CompetitorProduct = {
                id: String(r.id || ''),
                title: String(r.title || ''),
                price: Number(r.price || 0),
                sold_quantity: Number(r.sold_quantity || 0),
                permalink: String(r.permalink || ''),
                thumbnail: String(r.thumbnail || ''),
                seller: {
                    id: String(r?.seller?.id || ''),
                    nickname: String(r?.seller?.nickname || ''),
                    reputation_level: String(r?.seller?.seller_reputation?.level_id || 'unknown'),
                    transactions: Number(r?.seller?.seller_reputation?.transactions?.total || 0)
                },
                listing_type: String(r.listing_type_id || ''),
                shipping: {
                    free_shipping: Boolean(r?.shipping?.free_shipping),
                    mode: String(r?.shipping?.mode || '')
                },
                attributes: [],
                score: {
                    ranking_factors: 0,
                    price_competitiveness: 0,
                    feature_completeness: 0,
                    overall: 0
                }
            };
            comp.score.overall = this.calculateCompetitorScore(comp);
            return comp;
        });

        competitors.push(...baseCompetitors);

        // Log se poucos concorrentes encontrados
        if (competitors.length < 5) {
            console.log(`[Competitors] Poucos concorrentes encontrados: ${competitors.length}`);
        }

        // Enriquecer os 12 primeiros com atributos detalhados
        const enrichIds = competitors.slice(0, 12).map(c => c.id);
        for (const id of enrichIds) {
            try {
                const itemResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${id}`, { headers });
                const item = itemResp.data;
                const comp = competitors.find(c => c.id === id);
                if (comp) {
                    comp.attributes = (Array.isArray(item.attributes) ? item.attributes : []).map((a: any) => ({ id: a.id, value_name: a.value_name || '' }));
                    comp.shipping = {
                        free_shipping: Boolean(item.shipping?.free_shipping),
                        mode: String(item.shipping?.mode || comp.shipping.mode)
                    };
                    comp.price = Number(item.price || comp.price);
                    comp.sold_quantity = Number(item.sold_quantity || comp.sold_quantity);
                    comp.listing_type = String(item.listing_type_id || comp.listing_type);
                    comp.thumbnail = String(item.thumbnail || comp.thumbnail);
                    comp.permalink = String(item.permalink || comp.permalink);
                    comp.score.overall = this.calculateCompetitorScore(comp);
                }
            } catch (e) {
                void e;
            }
        }

        return competitors;
    }

    private buildQueryTerms(productData: MLBAnalysisData): string[] {
        const title = (productData.title || '').toLowerCase();
        const tokens = title.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
        const stop = new Set(['de','da','do','para','com','sem','em','na','no','e','o','a','um','uma']);
        const brand = (productData.attributes.find(a => a.id === 'BRAND')?.value_name || '').toLowerCase();
        const model = (productData.attributes.find(a => a.id === 'MODEL')?.value_name || '').toLowerCase();
        const base = tokens.filter(t => !stop.has(t)).slice(0, 6);
        if (brand) base.unshift(brand);
        if (model) base.unshift(model);
        return Array.from(new Set(base));
    }

    private buildBrandModelQuery(productData: MLBAnalysisData): string | null {
        const brand = productData.attributes.find(a => a.id === 'BRAND')?.value_name;
        const model = productData.attributes.find(a => a.id === 'MODEL')?.value_name;
        const parts = [brand, model].filter(Boolean);
        return parts.length ? parts.join(' ') : null;
    }

    /**
     * Analisa posicionamento de preços
     */
    private analyzePrices(productData: MLBAnalysisData, competitors: CompetitorProduct[]): PriceAnalysis {
        const prices = competitors.map(c => c.price);
        const currentPrice = productData.price;
        
        const marketAverage = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const cheapest = Math.min(...prices);
        const mostExpensive = Math.max(...prices);
        
        let position: PriceAnalysis['price_position'];
        if (currentPrice <= cheapest) position = 'lowest';
        else if (currentPrice <= marketAverage * 0.9) position = 'below_average';
        else if (currentPrice <= marketAverage * 1.1) position = 'average';
        else if (currentPrice <= mostExpensive) position = 'above_average';
        else position = 'highest';

        // Calcular faixa de preço otimizada
        const optimalMin = marketAverage * 0.85;
        const optimalMax = marketAverage * 1.15;
        const recommended = marketAverage * 0.95; // Ligeiramente abaixo da média para competitividade

        return {
            current_price: currentPrice,
            market_average: marketAverage,
            cheapest_competitor: cheapest,
            most_expensive: mostExpensive,
            price_position: position,
            optimal_price_range: {
                min: optimalMin,
                max: optimalMax,
                recommended: recommended
            },
            price_elasticity_insights: {
                price_sensitive_category: this.isPriceSensitiveCategory(productData.category_id),
                sweet_spot: recommended,
                conversion_impact: position === 'highest' ? 'negative' : position === 'lowest' ? 'positive' : 'neutral'
            }
        };
    }

    /**
     * Compara características e atributos
     */
    private compareFeatures(productData: MLBAnalysisData, competitors: CompetitorProduct[]): FeatureComparison {
        const currentFeatures = productData.attributes.map(attr => attr.id);
        
        // Contar features dos concorrentes
        const competitorFeatures: { [feature: string]: number } = {};
        competitors.forEach(competitor => {
            competitor.attributes.forEach(attr => {
                competitorFeatures[attr.id] = (competitorFeatures[attr.id] || 0) + 1;
            });
        });

        // Identificar features em falta
        const missingFeatures = Object.entries(competitorFeatures)
            .filter(([feature]) => !currentFeatures.includes(feature))
            .map(([feature, count]) => ({
                feature,
                competitor_count: count,
                importance_score: this.calculateFeatureImportance(feature, count, competitors.length),
                implementation_difficulty: this.getImplementationDifficulty(feature)
            }))
            .sort((a, b) => b.importance_score - a.importance_score);

        // Identificar vantagens únicas
        const uniqueAdvantages = currentFeatures.filter(feature => 
            !Object.keys(competitorFeatures).includes(feature)
        );

        // Padrões da categoria
        const categoryStandards = Object.entries(competitorFeatures)
            .filter(([, count]) => count >= competitors.length * 0.7) // 70% dos concorrentes têm
            .map(([feature]) => feature);

        return {
            current_features: currentFeatures,
            competitor_features: competitorFeatures,
            missing_features: missingFeatures,
            unique_advantages: uniqueAdvantages,
            category_standards: categoryStandards
        };
    }

    /**
     * Analisa fatores de ranking
     */
    private analyzeRankingFactors(productData: MLBAnalysisData, competitors: CompetitorProduct[]): RankingFactorsAnalysis {
        const factors = [
            {
                factor: 'Vendas Históricas',
                current_value: productData.sold_quantity,
                competitor_average: competitors.reduce((sum, c) => sum + c.sold_quantity, 0) / competitors.length,
                impact_weight: 9
            },
            {
                factor: 'Preço Competitivo',
                current_value: this.getPriceScore(productData.price, competitors),
                competitor_average: 70,
                impact_weight: 8
            },
            {
                factor: 'Frete Grátis',
                current_value: productData.shipping?.free_shipping ? 100 : 0,
                competitor_average: competitors.filter(c => c.shipping.free_shipping).length / competitors.length * 100,
                impact_weight: 7
            },
            {
                factor: 'Reputação do Vendedor',
                current_value: 75, // Simulado
                competitor_average: 78,
                impact_weight: 6
            }
        ];

        const currentScore = factors.reduce((sum, factor) => 
            sum + (factor.current_value * factor.impact_weight), 0
        ) / factors.reduce((sum, factor) => sum + factor.impact_weight, 0);

        const topCompetitorScore = Math.max(...competitors.map(c => c.score.overall));

        const quickWins = factors
            .filter(factor => factor.competitor_average > factor.current_value)
            .map(factor => ({
                factor: factor.factor,
                current_gap: factor.competitor_average - factor.current_value,
                effort_required: factor.factor === 'Preço Competitivo' ? 'médio' : 'fácil',
                expected_boost: (factor.competitor_average - factor.current_value) * factor.impact_weight / 10
            }))
            .sort((a, b) => b.expected_boost - a.expected_boost);

        return {
            current_score: currentScore,
            top_competitor_score: topCompetitorScore,
            gap_analysis: factors.map(factor => ({
                ...factor,
                improvement_potential: Math.max(0, factor.competitor_average - factor.current_value)
            })),
            quick_wins: quickWins
        };
    }

    /**
     * Identifica gaps competitivos
     */
    private identifyCompetitiveGaps(
        productData: MLBAnalysisData, 
        competitors: CompetitorProduct[],
        priceAnalysis: PriceAnalysis,
        featureComparison: FeatureComparison
    ): CompetitiveGap[] {
        const gaps: CompetitiveGap[] = [];

        // Gap de preço
        if (priceAnalysis.price_position === 'highest') {
            gaps.push({
                type: 'price',
                severity: 'critical',
                description: 'Preço muito acima dos concorrentes',
                competitor_advantage: `Concorrentes vendem até ${((productData.price - priceAnalysis.cheapest_competitor) / productData.price * 100).toFixed(0)}% mais barato`,
                impact_on_ranking: 9,
                difficulty_to_fix: 'medium',
                recommendations: [
                    'Reduzir preço para a faixa competitiva',
                    'Justificar preço premium com diferenciais',
                    'Criar promoções estratégicas'
                ],
                potential_traffic_gain: 35
            });
        }

        // Gaps de características
        featureComparison.missing_features.slice(0, 3).forEach(missing => {
            if (missing.importance_score > 7) {
                gaps.push({
                    type: 'feature',
                    severity: missing.importance_score > 8 ? 'high' : 'medium',
                    description: `Falta atributo importante: ${missing.feature}`,
                    competitor_advantage: `${missing.competitor_count} concorrentes têm este atributo`,
                    impact_on_ranking: missing.importance_score,
                    difficulty_to_fix: missing.implementation_difficulty,
                    recommendations: [
                        `Adicionar atributo ${missing.feature}`,
                        'Verificar especificações do produto',
                        'Atualizar ficha técnica no ML'
                    ],
                    potential_traffic_gain: missing.importance_score * 3
                });
            }
        });

        // Gap de vendas
        const avgSales = competitors.reduce((sum, c) => sum + c.sold_quantity, 0) / competitors.length;
        if (productData.sold_quantity < avgSales * 0.5) {
            gaps.push({
                type: 'ranking_factor',
                severity: 'high',
                description: 'Vendas muito abaixo da média dos concorrentes',
                competitor_advantage: `Concorrentes vendem em média ${avgSales.toFixed(0)} unidades vs ${productData.sold_quantity}`,
                impact_on_ranking: 8,
                difficulty_to_fix: 'hard',
                recommendations: [
                    'Implementar estratégia de preço inicial atrativo',
                    'Aumentar investimento em anúncios',
                    'Otimizar todas as outras variáveis de SEO'
                ],
                potential_traffic_gain: 50
            });
        }

        return gaps.sort((a, b) => b.impact_on_ranking - a.impact_on_ranking);
    }

    /**
     * Identifica oportunidades estratégicas
     */
    private identifyOpportunities(
        gaps: CompetitiveGap[],
        priceAnalysis: PriceAnalysis,
        featureComparison: FeatureComparison
    ): Array<any> {
        const opportunities = [];

        // Oportunidades baseadas em gaps
        gaps.forEach(gap => {
            if (gap.difficulty_to_fix === 'easy' && gap.impact_on_ranking >= 6) {
                opportunities.push({
                    type: gap.type === 'price' ? 'price_optimization' : 'feature_enhancement',
                    priority: gap.severity === 'critical' ? 'high' : 'medium',
                    description: gap.description,
                    expected_impact: gap.potential_traffic_gain,
                    implementation_steps: gap.recommendations,
                    timeline: gap.difficulty_to_fix === 'easy' ? '1-2 dias' : '1 semana'
                });
            }
        });

        // Oportunidade de vantagem única
        if (featureComparison.unique_advantages.length > 0) {
            opportunities.push({
                type: 'positioning',
                priority: 'high',
                description: 'Destacar vantagens únicas no título e descrição',
                expected_impact: 20,
                implementation_steps: [
                    'Destacar diferenciais únicos no título',
                    'Criar descrição focada nas vantagens exclusivas',
                    'Usar keywords que enfatizam os diferenciais'
                ],
                timeline: '2-3 dias'
            });
        }

        return opportunities.sort((a, b) => 
            (b.expected_impact * (b.priority === 'high' ? 2 : 1)) - 
            (a.expected_impact * (a.priority === 'high' ? 2 : 1))
        );
    }

    /**
     * Avalia ameaças competitivas
     */
    private assessThreats(competitors: CompetitorProduct[], productData: MLBAnalysisData): Array<any> {
        return competitors
            .filter(c => c.score.overall > 75)
            .map(competitor => ({
                competitor_id: competitor.id,
                threat_level: this.calculateThreatLevel(competitor, productData),
                advantages: this.identifyCompetitorAdvantages(competitor, productData),
                risk_description: this.generateRiskDescription(competitor, productData),
                mitigation_strategies: this.generateMitigationStrategies(competitor, productData)
            }))
            .sort((a, b) => 
                (b.threat_level === 'high' ? 3 : b.threat_level === 'medium' ? 2 : 1) -
                (a.threat_level === 'high' ? 3 : a.threat_level === 'medium' ? 2 : 1)
            );
    }

    /**
     * Gera insights de mercado
     */
    private async generateMarketInsights(categoryId: string, competitors: CompetitorProduct[]): Promise<any> {
        return {
            category_trends: this.getCategoryTrends(categoryId),
            consumer_preferences: this.analyzeConsumerPreferences(competitors),
            seasonal_patterns: this.getSeasonalPatterns(categoryId),
            growth_opportunities: this.identifyGrowthOpportunities(categoryId, competitors)
        };
    }

    // Métodos auxiliares
    private calculateCompetitorScore(competitor: CompetitorProduct): number {
        const salesScore = Math.min(100, competitor.sold_quantity / 10);
        const priceScore = competitor.price < 100 ? 100 : Math.max(0, 100 - (competitor.price / 100));
        const reputationScore = competitor.seller.reputation_level === 'gold' ? 100 : 
                               competitor.seller.reputation_level === 'silver' ? 75 : 50;
        
        return Math.round((salesScore + priceScore + reputationScore) / 3);
    }

    private calculateCompetitiveScore(
        productData: MLBAnalysisData, 
        competitors: CompetitorProduct[],
        priceAnalysis: PriceAnalysis,
        featureComparison: FeatureComparison
    ): number {
        let score = 50; // Base score

        // Price competitiveness
        if (priceAnalysis.price_position === 'below_average' || priceAnalysis.price_position === 'average') {
            score += 20;
        } else if (priceAnalysis.price_position === 'above_average') {
            score -= 10;
        } else if (priceAnalysis.price_position === 'highest') {
            score -= 20;
        }

        // Feature completeness
        const featureRatio = featureComparison.current_features.length / 
                           Math.max(1, Object.keys(featureComparison.competitor_features).length);
        score += Math.min(20, featureRatio * 20);

        // Unique advantages
        score += Math.min(10, featureComparison.unique_advantages.length * 5);

        return Math.max(0, Math.min(100, Math.round(score)));
    }

    private determineMarketPosition(score: number, competitorCount: number): CompetitiveAnalysisResult['market_position'] {
        if (score >= 80) return 'leader';
        if (score >= 65) return 'strong';
        if (score >= 45) return 'average';
        return 'weak';
    }

    private isPriceSensitiveCategory(categoryId: string): boolean {
        const sensitiveCategorias = ['MLB1051', 'MLB1000']; // Celulares, Eletrônicos
        return sensitiveCategorias.includes(categoryId);
    }

    private getPriceScore(currentPrice: number, competitors: CompetitorProduct[]): number {
        const prices = competitors.map(c => c.price);
        const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        
        if (currentPrice <= average * 0.9) return 100;
        if (currentPrice <= average * 1.1) return 80;
        if (currentPrice <= average * 1.3) return 60;
        return 40;
    }

    private calculateFeatureImportance(feature: string, count: number, total: number): number {
        const prevalenceScore = (count / total) * 10;
        const criticalFeatures = ['BRAND', 'MODEL', 'COLOR', 'WARRANTY_TIME'];
        const importance = criticalFeatures.includes(feature) ? 2 : 1;
        
        return Math.round(prevalenceScore * importance);
    }

    private getImplementationDifficulty(feature: string): 'easy' | 'medium' | 'hard' {
        const easyFeatures = ['COLOR', 'BRAND', 'MODEL'];
        const hardFeatures = ['WARRANTY_TIME', 'BATTERY_LIFE'];
        
        if (easyFeatures.includes(feature)) return 'easy';
        if (hardFeatures.includes(feature)) return 'hard';
        return 'medium';
    }

    private calculateThreatLevel(competitor: CompetitorProduct, productData: MLBAnalysisData): 'high' | 'medium' | 'low' {
        const priceThreat = competitor.price < productData.price;
        const salesThreat = competitor.sold_quantity > productData.sold_quantity * 1.5;
        const scoreThreat = competitor.score.overall > 80;
        
        const threats = [priceThreat, salesThreat, scoreThreat].filter(Boolean).length;
        
        if (threats >= 2) return 'high';
        if (threats === 1) return 'medium';
        return 'low';
    }

    private identifyCompetitorAdvantages(competitor: CompetitorProduct, productData: MLBAnalysisData): string[] {
        const advantages = [];
        
        if (competitor.price < productData.price) {
            advantages.push('Preço mais baixo');
        }
        
        if (competitor.sold_quantity > productData.sold_quantity) {
            advantages.push('Histórico de vendas superior');
        }
        
        if (competitor.shipping.free_shipping && !productData.shipping?.free_shipping) {
            advantages.push('Frete grátis');
        }
        
        if (competitor.attributes.length > productData.attributes.length) {
            advantages.push('Ficha técnica mais completa');
        }
        
        return advantages;
    }

    private generateRiskDescription(competitor: CompetitorProduct, productData: MLBAnalysisData): string {
        const advantages = this.identifyCompetitorAdvantages(competitor, productData);
        return `Concorrente com ${advantages.join(', ').toLowerCase()}. Pode capturar tráfego orgânico.`;
    }

    private generateMitigationStrategies(competitor: CompetitorProduct, productData: MLBAnalysisData): string[] {
        const strategies = [];
        const advantages = this.identifyCompetitorAdvantages(competitor, productData);
        
        advantages.forEach(advantage => {
            switch (advantage) {
                case 'Preço mais baixo':
                    strategies.push('Considerar redução de preço ou justificar valor premium');
                    break;
                case 'Histórico de vendas superior':
                    strategies.push('Focar em otimização SEO para aumentar visibilidade');
                    break;
                case 'Frete grátis':
                    strategies.push('Implementar frete grátis ou destacar outros diferenciais');
                    break;
                case 'Ficha técnica mais completa':
                    strategies.push('Completar atributos em falta na ficha técnica');
                    break;
            }
        });
        
        return strategies;
    }

    private getCategoryTrends(categoryId: string): string[] {
        const trends: { [key: string]: string[] } = {
            'MLB1432': ['Sustentabilidade', 'Minimalismo', 'Personalização'],
            'MLB1276': ['Cancelamento de ruído', 'Baixa latência', 'Longa duração de bateria'],
            'MLB1051': ['5G', 'Câmeras múltiplas', 'Carregamento rápido']
        };
        
        return trends[categoryId] || ['Qualidade premium', 'Entrega rápida', 'Garantia estendida'];
    }

    private analyzeConsumerPreferences(competitors: CompetitorProduct[]): string[] {
        const prefs: string[] = [];
        const count = Math.max(1, competitors.length);
        const freeShippingPct = competitors.filter(c => c.shipping.free_shipping).length / count;
        const avgPrice = competitors.reduce((s, c) => s + (c.price || 0), 0) / count;
        const medianSales = [...competitors].map(c => c.sold_quantity).sort((a, b) => a - b)[Math.floor(count / 2)] || 0;
        const withBrandAttr = competitors.filter(c => c.attributes.some(a => a.id === 'BRAND' && a.value_name)).length / count;

        if (freeShippingPct >= 0.6) prefs.push('Frete grátis');
        if (withBrandAttr >= 0.5) prefs.push('Produto original');
        if (medianSales >= 100) prefs.push('Alta confiança em anúncios com histórico');
        prefs.push('Preço competitivo');

        return prefs.slice(0, 4);
    }

    private getSeasonalPatterns(categoryId: string): string[] {
        const trends: { [key: string]: string[] } = {
            MLB1051: ['Black Friday', 'Natal', 'Volta às aulas'],
            MLB1276: ['Dia das Mães', 'Black Friday', 'Natal'],
            MLB1432: ['Dia dos Namorados', 'Natal', 'Black Friday']
        };
        return trends[categoryId] || ['Black Friday', 'Natal'];
    }

    private identifyGrowthOpportunities(categoryId: string, competitors: CompetitorProduct[]): string[] {
        const count = Math.max(1, competitors.length);
        const freeShippingPct = competitors.filter(c => c.shipping.free_shipping).length / count;
        const attrCounts: Record<string, number> = {};
        competitors.forEach(c => c.attributes.forEach(a => { attrCounts[a.id] = (attrCounts[a.id] || 0) + 1; }));
        const popularAttrs = Object.entries(attrCounts).filter(([, v]) => v >= count * 0.6).map(([k]) => k);

        const opps: string[] = [];
        if (freeShippingPct >= 0.6) opps.push('Testar frete grátis com preço ajustado');
        if (popularAttrs.includes('BRAND')) opps.push('Evidenciar marca e autenticidade');
        if (!popularAttrs.includes('WARRANTY_TIME')) opps.push('Oferecer garantia como diferencial');
        opps.push('Explorar termos long-tail no título');
        return opps.slice(0, 4);
    }

    /**
     * Busca os top 10 produtos mais vendidos da categoria usando estratégias alternativas
     */
    private async getCategoryTopProducts(categoryId: string, accessToken?: string): Promise<CategoryTopProduct[]> {
        try {
            const headers = { 'User-Agent': 'TrafficPro-MLB-Analyzer/1.0' } as any;
            
            // Estratégia 1: Buscar informações da categoria para entender melhor
            let categoryInfo;
            try {
                const categoryResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${categoryId}`, {
                    headers,
                    timeout: 5000
                });
                categoryInfo = categoryResponse.data;
                console.log(`[Category Top Products] Categoria: ${categoryInfo.name}`);
            } catch (e) {
                console.warn(`[Category Top Products] Erro ao buscar info da categoria:`, e.message);
            }

            const results: any[] = [];
            
            // Estratégia 2: Se temos accessToken, buscar produtos do usuário da mesma categoria primeiro
            if (accessToken) {
                try {
                    const userItemsResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/users/me/items/search`, {
                        headers: { ...headers, 'Authorization': `Bearer ${accessToken}` },
                        params: { limit: 50, sort: 'sold_quantity_desc' },
                        timeout: 8000
                    });
                    
                    const userItems = userItemsResponse.data?.results || [];
                    console.log(`[Category Top Products] Encontrados ${userItems.length} produtos do usuário`);
                    
                    // Filtrar apenas produtos da mesma categoria e buscar detalhes
                    for (const itemId of userItems.slice(0, 10)) {
                        try {
                            const itemResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${itemId}`, {
                                headers: { ...headers, 'Authorization': `Bearer ${accessToken}` },
                                timeout: 5000
                            });
                            
                            const item = itemResponse.data;
                            if (item.category_id === categoryId && item.sold_quantity > 0) {
                                results.push(item);
                            }
                        } catch (e) {
                            console.warn(`[Category Top Products] Erro ao buscar item ${itemId}:`, e.message);
                        }
                    }
                    
                    console.log(`[Category Top Products] Encontrados ${results.length} produtos do usuário na categoria ${categoryId}`);
                } catch (e) {
                    console.warn(`[Category Top Products] Erro ao buscar produtos do usuário:`, e.message);
                }
            }
            
            // Estratégia 3: Se ainda não temos produtos suficientes, usar busca por palavras-chave da categoria
            if (results.length < 5) {
                const searchTerms = this.getCategorySearchTerms(categoryId, categoryInfo?.name);
                
                for (const term of searchTerms.slice(0, 3)) {
                    try {
                        let searchResponse;
                        
                        // Tentar busca autenticada primeiro
                        if (accessToken) {
                            try {
                                searchResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
                                    headers: { ...headers, 'Authorization': `Bearer ${accessToken}` },
                                    params: { q: term, limit: 10, sort: 'sold_quantity_desc' },
                                    timeout: 8000
                                });
                            } catch (authError) {
                                console.warn(`[Category Top Products] Busca autenticada falhou para termo '${term}':`, authError.message);
                            }
                        }
                        
                        // Fallback para busca pública se a autenticada falhou
                        if (!searchResponse) {
                            try {
                                searchResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
                                    headers,
                                    params: { q: term, limit: 10, sort: 'sold_quantity_desc' },
                                    timeout: 8000
                                });
                            } catch (publicError) {
                                console.warn(`[Category Top Products] Busca pública falhou para termo '${term}':`, publicError.message);
                                continue;
                            }
                        }
                        
                        const searchResults = searchResponse?.data?.results || [];
                        
                        // Filtrar apenas produtos da categoria correta
                        const categoryProducts = searchResults.filter((product: any) => 
                            product.category_id === categoryId && 
                            product.sold_quantity && 
                            product.sold_quantity > 1
                        );
                        
                        results.push(...categoryProducts);
                        console.log(`[Category Top Products] Encontrados ${categoryProducts.length} produtos para termo '${term}'`);
                        
                        if (results.length >= 15) break; // Limitar para não fazer muitas requests
                        
                    } catch (error) {
                        console.warn(`[Category Top Products] Erro ao buscar termo '${term}':`, error.message);
                        continue;
                    }
                }
            }
            
            // Remover duplicatas e ordenar por vendas
            const uniqueProducts = new Map();
            results.forEach(product => {
                const id = String(product.id);
                if (!uniqueProducts.has(id) || uniqueProducts.get(id).sold_quantity < product.sold_quantity) {
                    uniqueProducts.set(id, product);
                }
            });
            
            const sortedProducts = Array.from(uniqueProducts.values())
                .filter(product => product.sold_quantity && product.sold_quantity > 0)
                .sort((a, b) => (b.sold_quantity || 0) - (a.sold_quantity || 0));

            // Se ainda não temos produtos suficientes, retornar lista vazia
            if (sortedProducts.length < 3) {
                console.log(`[Category Top Products] Poucos produtos encontrados (${sortedProducts.length}), retornando vazio`);
                return [];
            }

            // Mapear para o formato esperado e pegar apenas os top 10
            const topProducts: CategoryTopProduct[] = sortedProducts.slice(0, 10).map(product => ({
                id: String(product.id),
                title: String(product.title || ''),
                price: Number(product.price || 0),
                sold_quantity: Number(product.sold_quantity || 0),
                permalink: String(product.permalink || ''),
                thumbnail: String(product.thumbnail || product.secure_thumbnail || ''),
                seller: {
                    id: String(product.seller?.id || ''),
                    nickname: String(product.seller?.nickname || ''),
                    reputation_level: String(product.seller?.seller_reputation?.level_id || 'bronze'),
                    transactions: Number(product.seller?.seller_reputation?.transactions?.total || 0)
                },
                shipping: {
                    free_shipping: Boolean(product.shipping?.free_shipping || false),
                    mode: String(product.shipping?.mode || '')
                }
            }));

            console.log(`[Category Top Products] Sucesso: ${topProducts.length} produtos top na categoria ${categoryId}`);
            return topProducts;

        } catch (error) {
            console.error(`[Category Top Products] Erro geral ao buscar top produtos da categoria ${categoryId}:`, error);
            return [];
        }
    }

    /**
     * Gera termos de busca específicos para cada categoria
     */
    private getCategorySearchTerms(categoryId: string, categoryName?: string): string[] {
        const categoryTermsMap: { [key: string]: string[] } = {
            // Bolsas
            'MLB7022': ['bolsa feminina', 'carteira', 'necessaire', 'mochila'],
            // Celulares
            'MLB1051': ['smartphone', 'iphone', 'samsung', 'motorola'],
            // Notebooks
            'MLB1652': ['notebook', 'laptop', 'macbook', 'dell'],
            // Eletrodomésticos
            'MLB5726': ['geladeira', 'fogão', 'microondas', 'lavadora'],
            // Roupas Femininas
            'MLB1430': ['blusa', 'vestido', 'calça feminina', 'saia'],
            // Sapatos
            'MLB1276': ['tênis', 'sandália', 'sapato', 'bota'],
            // Casa e Decoração
            'MLB1367': ['decoração', 'móveis', 'quadros', 'almofadas'],
            // Beleza
            'MLB1246': ['maquiagem', 'perfume', 'creme', 'shampoo']
        };
        
        const specificTerms = categoryTermsMap[categoryId] || [];
        
        // Se temos o nome da categoria, usar também
        if (categoryName) {
            const categoryWords = categoryName.toLowerCase()
                .split(' ')
                .filter(word => word.length > 3 && !['para', 'com', 'sem', 'mais'].includes(word));
            specificTerms.unshift(...categoryWords);
        }
        
        // Fallback genérico se não encontramos termos específicos
        if (specificTerms.length === 0) {
            return ['produto', 'original', 'novo'];
        }
        
        return [...new Set(specificTerms)]; // Remove duplicatas
    }

}

export const competitiveAnalyzerService = new CompetitiveAnalyzerService();
