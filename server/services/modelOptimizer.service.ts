import { MLBAnalysisData } from './mlbAnalyzer.service.js';
import { fetchTrendingKeywordsFromML, fetchCompetitorKeywordsFromML } from './seoOptimizer.service.js';

export interface ModelKeywordStrategy {
    keyword: string;
    relevance: 'alta' | 'media' | 'baixa';
    type: 'trend' | 'characteristic' | 'search_behavior' | 'emotional' | 'purchase' | 'photographic';
    search_volume: number;
    competition_level: 'baixa' | 'media' | 'alta';
    ranking_boost: number; // 1-10
    ctr_potential: number; // 1-10
    conversion_impact: number; // 1-10
    usage_recommendation: string;
    combinations: string[];
}

export interface ModelOptimizationResult {
    current_model: string | null;
    current_score: number;
    strategic_keywords: ModelKeywordStrategy[];
    optimized_models: Array<{
        model: string;
        score: number;
        strategy: string;
        keywords_used: string[];
        expected_boost: number;
        reasoning: string;
    }>;
    category_insights: {
        category_id: string;
        category_name: string;
        trending_terms: string[];
        high_conversion_words: string[];
        seasonal_keywords: string[];
        competitor_analysis: string[];
    };
    advanced_strategies: Array<{
        strategy_name: string;
        description: string;
        keywords: string[];
        difficulty: 'facil' | 'medio' | 'avancado';
        expected_impact: number;
        implementation_notes: string[];
    }>;
}

/**
 * Serviço especializado em otimização avançada do campo MODELO
 */
export class ModelOptimizerService {
    
    /**
     * Gera análise completa e estratégias para o campo modelo
     */
    async generateModelStrategy(productData: MLBAnalysisData): Promise<ModelOptimizationResult> {
        const currentModel = this.getCurrentModel(productData);
        const currentScore = this.scoreCurrentModel(currentModel, productData);
        
        // Gerar até 100 palavras estratégicas
        const strategicKeywords = await this.generateStrategicKeywords(productData);
        
        // Gerar modelos otimizados
        const optimizedModels = this.generateOptimizedModels(strategicKeywords, productData);
        
        // Insights da categoria
        const categoryInsights = await this.getCategoryInsights(productData.category_id);
        
        // Estratégias avançadas
        const advancedStrategies = this.generateAdvancedStrategies(productData, strategicKeywords);
        
        return {
            current_model: currentModel,
            current_score: currentScore,
            strategic_keywords: strategicKeywords,
            optimized_models: optimizedModels,
            category_insights: categoryInsights,
            advanced_strategies: advancedStrategies
        };
    }
    
    /**
     * Gera até 100 palavras estratégicas baseadas em IA e análise de mercado
     */
    private async generateStrategicKeywords(productData: MLBAnalysisData): Promise<ModelKeywordStrategy[]> {
        const keywords: ModelKeywordStrategy[] = [];
        const categoryId = productData.category_id;
        const brand = this.extractBrand(productData);
        const competitorList = await fetchCompetitorKeywordsFromML(categoryId, 30).catch(() => [] as string[]);
        const trendingLive = await fetchTrendingKeywordsFromML(categoryId, 30).catch(() => [] as string[]);

        const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

        const trendKeywords = trendingLive.length > 0 ? trendingLive : this.getTrendingKeywords(categoryId);
        trendKeywords.slice(0, 25).forEach((keyword, idx) => {
            const inCompetitors = competitorList.some(ck => normalize(ck) === normalize(keyword));
            const rankFactor = Math.max(1, 25 - idx);
            keywords.push({
                keyword,
                relevance: 'alta',
                type: 'trend',
                search_volume: 1000 + rankFactor * 200,
                competition_level: inCompetitors ? 'alta' : 'media',
                ranking_boost: Math.min(10, 6 + Math.ceil(rankFactor / 5)),
                ctr_potential: inCompetitors ? 8 : 7,
                conversion_impact: inCompetitors ? 7 : 6,
                usage_recommendation: 'Priorize termos em alta no início do modelo',
                combinations: this.generateCombinations(keyword, brand)
            });
        });

        const characteristicWords = this.getCharacteristicWords(productData);
        characteristicWords.slice(0, 20).forEach((keyword, idx) => {
            const rankFactor = Math.max(1, 20 - idx);
            keywords.push({
                keyword,
                relevance: 'alta',
                type: 'characteristic',
                search_volume: 500 + rankFactor * 100,
                competition_level: 'baixa',
                ranking_boost: Math.min(10, 7 + Math.ceil(rankFactor / 6)),
                ctr_potential: 6,
                conversion_impact: 8,
                usage_recommendation: 'Combine com atributos reais do produto',
                combinations: this.generateCombinations(keyword, brand)
            });
        });

        const searchBehaviorWords = this.getSearchBehaviorWords(categoryId);
        searchBehaviorWords.slice(0, 12).forEach((keyword, idx) => {
            const rankFactor = Math.max(1, 12 - idx);
            keywords.push({
                keyword,
                relevance: 'media',
                type: 'search_behavior',
                search_volume: 200 + rankFactor * 80,
                competition_level: 'media',
                ranking_boost: Math.min(9, 5 + Math.ceil(rankFactor / 4)),
                ctr_potential: 7,
                conversion_impact: 5,
                usage_recommendation: 'Capta intenção específica de compra',
                combinations: this.generateCombinations(keyword, brand)
            });
        });

        const emotionalWords = this.getEmotionalWords(categoryId);
        emotionalWords.slice(0, 12).forEach((keyword, idx) => {
            const rankFactor = Math.max(1, 12 - idx);
            keywords.push({
                keyword,
                relevance: 'media',
                type: 'emotional',
                search_volume: 100 + rankFactor * 50,
                competition_level: 'baixa',
                ranking_boost: Math.min(8, 4 + Math.ceil(rankFactor / 4)),
                ctr_potential: 8,
                conversion_impact: 7,
                usage_recommendation: 'Use com moderação para aumentar CTR',
                combinations: this.generateCombinations(keyword, brand)
            });
        });

        const purchaseWords = this.getPurchaseWords();
        purchaseWords.slice(0, 12).forEach((keyword) => {
            const inCompetitors = competitorList.some(ck => normalize(ck) === normalize(keyword));
            keywords.push({
                keyword,
                relevance: 'alta',
                type: 'purchase',
                search_volume: 1800,
                competition_level: inCompetitors ? 'alta' : 'media',
                ranking_boost: 8,
                ctr_potential: 9,
                conversion_impact: 9,
                usage_recommendation: 'Use para captar usuários prontos para comprar',
                combinations: this.generateCombinations(keyword, brand)
            });
        });

        const photographicWords = this.getPhotographicWords(categoryId);
        photographicWords.slice(0, 10).forEach((keyword, idx) => {
            const rankFactor = Math.max(1, 10 - idx);
            keywords.push({
                keyword,
                relevance: 'baixa',
                type: 'photographic',
                search_volume: 50 + rankFactor * 30,
                competition_level: 'baixa',
                ranking_boost: Math.min(7, 4 + Math.ceil(rankFactor / 5)),
                ctr_potential: 6,
                conversion_impact: 4,
                usage_recommendation: 'Complementa quando houver espaço',
                combinations: this.generateCombinations(keyword, brand)
            });
        });

        keywords.sort((a, b) => {
            const scoreA = a.ranking_boost * a.ctr_potential * a.conversion_impact;
            const scoreB = b.ranking_boost * b.ctr_potential * b.conversion_impact;
            return scoreB - scoreA;
        });

        return keywords.slice(0, 100);
    }
    
    /**
     * Gera modelos otimizados usando as palavras estratégicas
     */
    private generateOptimizedModels(keywords: ModelKeywordStrategy[], productData: MLBAnalysisData): Array<any> {
        const brand = this.extractBrand(productData);
        const category = this.getCategoryName(productData.category_id);
        const color = this.extractColor(productData);
        const models: Array<any> = [];
        const sanitizeModel = (text: string): string => {
            const banned = new Set(['garantia','promoção','desconto','oportunidade','original','especial','premium','entrega','rápida','grátis','genérico','generico']);
            const tokens = text
                .toLowerCase()
                .split(/[^a-z0-9áéíóúãõâêîôûç]+/i)
                .filter(Boolean)
                .filter((t) => !banned.has(t));
            // Remover termos de cor contraditórios com a cor real do produto
            const normColor = (color || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const isPrata = /\bprata|prateado\b/.test(normColor);
            const isDourado = /\bdourado|ouro\b/.test(normColor);
            const filtered = tokens.filter((t) => {
                const tn = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (isPrata && (tn === 'dourado' || tn === 'ouro')) return false;
                if (isDourado && (tn === 'prateado' || tn === 'prata')) return false;
                return true;
            });
            const dedup: string[] = [];
            for (const t of filtered) { if (!dedup.includes(t)) dedup.push(t); }
            const trimmed = dedup.slice(0, 5); // modelo curto e objetivo
            return trimmed.join(' ').replace(/\s+/g, ' ').trim();
        };
        
        // Estratégia 1: Foco em Trending + Purchase
        const trendingKeywords = keywords.filter(k => k.type === 'trend' && k.relevance === 'alta').slice(0, 3);
        const purchaseKeywords = keywords.filter(k => k.type === 'purchase').slice(0, 2);
        
        if (trendingKeywords.length > 0) {
            const model1Raw = `${brand || category} ${trendingKeywords.map(k => k.keyword).join(' ')} ${purchaseKeywords[0]?.keyword || ''}`.trim();
            const model1 = sanitizeModel(model1Raw || `${brand || category}`);
            models.push({
                model: model1,
                score: this.calculateModelScore(model1, keywords),
                strategy: 'Foco em Tendências + Intenção de Compra',
                keywords_used: [...trendingKeywords.map(k => k.keyword), ...(purchaseKeywords[0] ? [purchaseKeywords[0].keyword] : [])],
                expected_boost: 25,
                reasoning: 'Combina palavras em alta com intenção de compra para máximo impacto'
            });
        }
        
        // Estratégia 2: Características + Emocional
        const characteristicKeywords = keywords.filter(k => k.type === 'characteristic').slice(0, 2);
        const emotionalKeywords = keywords.filter(k => k.type === 'emotional' && k.ctr_potential >= 7).slice(0, 2);
        
        if (characteristicKeywords.length > 0) {
            const model2Raw = `${characteristicKeywords.map(k => k.keyword).join(' ')} ${emotionalKeywords.map(k => k.keyword).join(' ')} ${brand || ''}`.trim();
            const model2 = sanitizeModel(model2Raw);
            models.push({
                model: model2,
                score: this.calculateModelScore(model2, keywords),
                strategy: 'Características + Apelo Emocional',
                keywords_used: [...characteristicKeywords.map(k => k.keyword), ...emotionalKeywords.map(k => k.keyword)],
                expected_boost: 20,
                reasoning: 'Destaca características únicas com apelo emocional para diferenciação'
            });
        }
        
        // Estratégia 3: Long-tail + Comportamento de Busca
        const searchBehaviorKeywords = keywords.filter(k => k.type === 'search_behavior').slice(0, 3);
        
        if (searchBehaviorKeywords.length > 0) {
            const model3Raw = `${searchBehaviorKeywords.map(k => k.keyword).join(' ')} ${brand || category}`.trim();
            const model3 = sanitizeModel(model3Raw);
            models.push({
                model: model3,
                score: this.calculateModelScore(model3, keywords),
                strategy: 'Long-tail + Comportamento de Busca',
                keywords_used: searchBehaviorKeywords.map(k => k.keyword),
                expected_boost: 18,
                reasoning: 'Captura buscas específicas com menor concorrência'
            });
        }
        
        // Estratégia 4: Mix Balanceado (uma de cada tipo)
        const balancedKeywords = [
            keywords.find(k => k.type === 'trend'),
            keywords.find(k => k.type === 'characteristic'),
            keywords.find(k => k.type === 'purchase'),
            keywords.find(k => k.type === 'emotional')
        ].filter(Boolean) as ModelKeywordStrategy[];
        
        if (balancedKeywords.length >= 3) {
            const model4Raw = `${balancedKeywords.map(k => k.keyword).join(' ')}`.trim();
            const model4 = sanitizeModel(model4Raw);
            models.push({
                model: model4,
                score: this.calculateModelScore(model4, keywords),
                strategy: 'Mix Balanceado',
                keywords_used: balancedKeywords.map(k => k.keyword),
                expected_boost: 22,
                reasoning: 'Combina diferentes tipos de keywords para cobertura ampla'
            });
        }
        
        // Estratégia 5: Alto CTR + Conversão
        const highCTRKeywords = keywords.filter(k => k.ctr_potential >= 8 && k.conversion_impact >= 7).slice(0, 4);
        
        if (highCTRKeywords.length >= 2) {
            const model5Raw = `${highCTRKeywords.map(k => k.keyword).join(' ')} ${brand || ''}`.trim();
            const model5 = sanitizeModel(model5Raw);
            models.push({
                model: model5,
                score: this.calculateModelScore(model5, keywords),
                strategy: 'Máximo CTR + Conversão',
                keywords_used: highCTRKeywords.map(k => k.keyword),
                expected_boost: 30,
                reasoning: 'Focado em máximo clique e conversão'
            });
        }
        
        return models.sort((a, b) => b.score - a.score).slice(0, 8);
    }

    private extractColor(productData: MLBAnalysisData): string | null {
        const colorAttr = productData.attributes.find(attr => attr.id === 'COLOR');
        return colorAttr?.value_name || null;
    }
    
    /**
     * Insights específicos da categoria
     */
    private async getCategoryInsights(categoryId: string): Promise<any> {
        const categoryMappings: { [key: string]: any } = {
            'MLB1432': {
                category_name: 'Joias e Bijuterias',
                trending_terms: ['delicado', 'minimalista', 'dourado', 'prateado', 'hipoalergênico', 'resistente'],
                high_conversion_words: ['original', 'garantia', 'certificado', 'antialérgico', 'banhado'],
                seasonal_keywords: ['presente', 'dia das mães', 'natal', 'aniversário', 'casamento'],
                competitor_analysis: ['folheado', 'aço inox', 'semi joia', 'atacado', 'conjunto']
            },
            'MLB1276': {
                category_name: 'Fones e Headphones',
                trending_terms: ['wireless', 'bluetooth', 'noise cancelling', 'gaming', 'esportivo'],
                high_conversion_words: ['original', 'garantia', 'entrega rápida', 'resistente água'],
                seasonal_keywords: ['black friday', 'volta às aulas', 'presente gamer'],
                competitor_analysis: ['sem fio', 'profissional', 'studio', 'bass', 'hifi']
            },
            'MLB1051': {
                category_name: 'Celulares e Smartphones', 
                trending_terms: ['5g', 'câmera', 'bateria', 'tela', 'memória', 'processador'],
                high_conversion_words: ['lacrado', 'garantia', 'nacional', 'dual sim'],
                seasonal_keywords: ['black friday', 'dia dos namorados', 'natal'],
                competitor_analysis: ['usado', 'seminovo', 'vitrine', 'desbloqueado']
            }
        };
        
        return categoryMappings[categoryId] || {
            category_name: 'Categoria',
            trending_terms: ['premium', 'qualidade', 'resistente', 'moderno'],
            high_conversion_words: ['original', 'garantia', 'entrega rápida'],
            seasonal_keywords: ['presente', 'promoção'],
            competitor_analysis: ['usado', 'similar', 'alternativa']
        };
    }
    
    /**
     * Estratégias avançadas baseadas em análise de mercado
     */
    private generateAdvancedStrategies(productData: MLBAnalysisData, keywords: ModelKeywordStrategy[]): Array<any> {
        return [
            {
                strategy_name: 'Dominância de Categoria',
                description: 'Use as 5 palavras mais relevantes da categoria para dominar buscas específicas',
                keywords: keywords.filter(k => k.relevance === 'alta').slice(0, 5).map(k => k.keyword),
                difficulty: 'medio',
                expected_impact: 8.5,
                implementation_notes: [
                    'Combine com marca para criar autoridade',
                    'Use no início do modelo',
                    'Monitore ranking nos próximos 15 dias'
                ]
            },
            {
                strategy_name: 'Long-tail Especializado',
                description: 'Capture nichos específicos com termos de baixa concorrência',
                keywords: keywords.filter(k => k.competition_level === 'baixa' && k.search_volume < 1000).slice(0, 8).map(k => k.keyword),
                difficulty: 'facil',
                expected_impact: 7.0,
                implementation_notes: [
                    'Ideal para produtos únicos',
                    'Baixa concorrência = mais fácil rankear',
                    'Combine 3-4 termos para especificidade'
                ]
            },
            {
                strategy_name: 'Tendência Sazonal',
                description: 'Aproveite tendências sazonais para boost temporário',
                keywords: ['presente', 'natal', 'dia das mães', 'black friday', 'liquidação'],
                difficulty: 'facil',
                expected_impact: 9.0,
                implementation_notes: [
                    'Atualize conforme época do ano',
                    'Monitore calendário comercial',
                    'Prepare variações antecipadamente'
                ]
            },
            {
                strategy_name: 'Emotional Trigger',
                description: 'Use gatilhos emocionais para aumentar CTR e conversão',
                keywords: keywords.filter(k => k.type === 'emotional' && k.ctr_potential >= 8).map(k => k.keyword),
                difficulty: 'medio',
                expected_impact: 8.0,
                implementation_notes: [
                    'Teste A/B diferentes emoções',
                    'Combine com benefícios racionais',
                    'Monitore taxa de clique'
                ]
            },
            {
                strategy_name: 'Competitor Killer',
                description: 'Use termos que seus concorrentes não estão usando',
                keywords: keywords.filter(k => k.competition_level === 'baixa' && k.ranking_boost >= 7).slice(0, 6).map(k => k.keyword),
                difficulty: 'avancado',
                expected_impact: 9.2,
                implementation_notes: [
                    'Análise de gap competitivo necessária',
                    'Use termos únicos do seu produto',
                    'Combine com USP forte'
                ]
            }
        ];
    }
    
    // Métodos auxiliares
    private getCurrentModel(productData: MLBAnalysisData): string | null {
        const modelAttr = productData.attributes.find(attr => attr.id === 'MODEL');
        return modelAttr?.value_name || null;
    }
    
    private scoreCurrentModel(model: string | null, productData: MLBAnalysisData): number {
        if (!model) return 0;
        
        let score = 20; // Base por ter modelo
        
        // Comprimento ideal
        if (model.length >= 10 && model.length <= 50) score += 20;
        
        // Palavras descritivas
        const descriptiveWords = ['premium', 'professional', 'deluxe', 'especial', 'original'];
        if (descriptiveWords.some(word => model.toLowerCase().includes(word))) score += 15;
        
        // Números/versões
        if (/\d/.test(model)) score += 10;
        
        // Brand presence
        const brand = this.extractBrand(productData);
        if (brand && model.toLowerCase().includes(brand.toLowerCase())) score += 15;
        
        // Trending keywords
        const trending = this.getTrendingKeywords(productData.category_id);
        const hastrending = trending.some(keyword => model.toLowerCase().includes(keyword.toLowerCase()));
        if (hastrending) score += 20;
        
        return Math.min(100, score);
    }
    
    private calculateModelScore(model: string, keywords: ModelKeywordStrategy[]): number {
        let score = 50; // Base
        const modelLower = model.toLowerCase();
        
        // Check keywords presence and add their impact
        keywords.forEach(keyword => {
            if (modelLower.includes(keyword.keyword.toLowerCase())) {
                score += (keyword.ranking_boost + keyword.ctr_potential + keyword.conversion_impact) / 3;
            }
        });
        
        // Length bonus
        if (model.length >= 15 && model.length <= 45) score += 10;
        
        return Math.min(100, Math.round(score));
    }
    
    private extractBrand(productData: MLBAnalysisData): string | null {
        const brandAttr = productData.attributes.find(attr => attr.id === 'BRAND');
        const raw = brandAttr?.value_name || null;
        if (!raw) return null;
        const norm = raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        const genericSet = new Set([
            'generico',
            'generica',
            'generic',
            'sem marca',
            'sem-marca',
            'no brand',
            'marca propria',
            'marcapropria',
            'marca generica',
            'sem nome'
        ]);
        if (genericSet.has(norm)) return null;
        return raw;
    }
    
    private getCategoryName(categoryId: string): string {
        const mappings: { [key: string]: string } = {
            'MLB1432': 'Brinco',
            'MLB1276': 'Fone',
            'MLB1051': 'Celular'
        };
        return mappings[categoryId] || 'Produto';
    }
    
    private getTrendingKeywords(categoryId: string): string[] {
        const trending: { [key: string]: string[] } = {
            'MLB1432': ['delicado', 'minimalista', 'dourado', 'prateado', 'elegante', 'moderno', 'casual', 'festivo'],
            'MLB1276': ['wireless', 'bluetooth', 'gamer', 'profissional', 'bass', 'hifi', 'noise cancelling'],
            'MLB1051': ['5g', 'dual sim', 'câmera', 'tela grande', 'bateria longa', 'processador']
        };
        return trending[categoryId] || ['premium', 'qualidade', 'moderno'];
    }
    
    private getCharacteristicWords(productData: MLBAnalysisData): string[] {
        const attributes = productData.attributes || [];
        const words: string[] = [];
        
        // Extract from attributes
        attributes.forEach(attr => {
            if (['COLOR', 'MATERIAL', 'SIZE', 'STYLE'].includes(attr.id) && attr.value_name) {
                words.push(attr.value_name.toLowerCase());
            }
        });
        
        // Add category-specific characteristics
        const categoryCharacteristics: { [key: string]: string[] } = {
            'MLB1432': ['hipoalergênico', 'resistente', 'banhado', 'antialérgico', 'durável'],
            'MLB1276': ['confortável', 'ergonômico', 'dobrável', 'ajustável', 'portátil'],
            'MLB1051': ['resistente água', 'tela HD', 'dual chip', 'desbloqueado', 'nacional']
        };
        
        return [...words, ...(categoryCharacteristics[productData.category_id] || [])].slice(0, 20);
    }
    
    private getSearchBehaviorWords(categoryId: string): string[] {
        const behaviors: { [key: string]: string[] } = {
            'MLB1432': ['para presente', 'dia a dia', 'festa', 'trabalho', 'casual', 'noite'],
            'MLB1276': ['para celular', 'pc gamer', 'estudio', 'exercício', 'viagem', 'trabalho'],
            'MLB1051': ['para idoso', 'básico', 'intermediário', 'profissional', 'estudante']
        };
        return behaviors[categoryId] || ['uso diário', 'profissional', 'pessoal'];
    }
    
    private getEmotionalWords(categoryId: string): string[] {
        const emotional: { [key: string]: string[] } = {
            'MLB1432': ['encantador', 'sofisticado', 'charmoso', 'único', 'especial', 'lindo'],
            'MLB1276': ['incrível', 'fantástico', 'surpreendente', 'perfeito', 'extraordinário'],
            'MLB1051': ['revolucionário', 'impressionante', 'avançado', 'inteligente', 'poderoso']
        };
        return emotional[categoryId] || ['incrível', 'especial', 'único', 'perfeito'];
    }
    
    private getPurchaseWords(): string[] {
        return [
            'original', 'garantia', 'lacrado', 'novo', 'promoção', 
            'desconto', 'oferta', 'liquidação', 'oportunidade', 
            'limitado', 'exclusivo', 'entrega rápida'
        ];
    }
    
    private getPhotographicWords(categoryId: string): string[] {
        const photographic: { [key: string]: string[] } = {
            'MLB1432': ['brilhante', 'reflexo', 'acabamento', 'textura', 'polido'],
            'MLB1276': ['design', 'formato', 'visual', 'aparência', 'estilo'],
            'MLB1051': ['design', 'aparência', 'visual', 'acabamento', 'estética']
        };
        return photographic[categoryId] || ['visual', 'design', 'aparência'];
    }
    
    private generateCombinations(keyword: string, brand: string | null): string[] {
        const combinations = [keyword];
        
        if (brand) {
            combinations.push(`${brand} ${keyword}`);
            combinations.push(`${keyword} ${brand}`);
        }
        
        combinations.push(`${keyword} premium`);
        combinations.push(`${keyword} original`);
        
        return combinations.slice(0, 5);
    }
}

export const modelOptimizerService = new ModelOptimizerService();
