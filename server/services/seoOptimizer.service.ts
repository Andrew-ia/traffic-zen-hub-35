import { MLBAnalysisData, KeywordAnalysis, TitleOptimization } from './mlbAnalyzer.service';
import axios from 'axios';

const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const TRENDING_CACHE = new Map<string, { data: string[]; ts: number }>();
const COMPETITOR_CACHE = new Map<string, { data: string[]; ts: number }>();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

export interface SEOTitleSuggestion {
    title: string;
    score: number;
    reasoning: string;
    keywords_added: string[];
    keywords_removed: string[];
    length: number;
    seo_factors: {
        keyword_density: number;
        readability: number;
        ctr_potential: number;
        brand_presence: boolean;
        special_chars: boolean;
    };
}

export interface SEODescriptionData {
    optimized_description: string;
    structure: {
        title_section: string;
        bullet_points: string[];
        technical_specs: string;
        benefits: string[];
        usage_info: string;
        warranty_info: string;
        faq_section: string[];
    };
    seo_keywords: string[];
    readability_score: number;
    call_to_action: string;
}

/**
 * Serviço especializado em otimização SEO para Mercado Livre
 */
export class SEOOptimizerService {
    
    /**
     * Analisa palavras-chave do produto
     */
    analyzeKeywords(productData: MLBAnalysisData): KeywordAnalysis {
        const title = productData.title.toLowerCase();
        const description = productData.descriptions?.[0]?.plain_text?.toLowerCase() || '';
        const categoryId = productData.category_id;
        
        // Extrair palavras-chave primárias (categoria + atributos importantes)
        const primary_keywords = this.extractPrimaryKeywords(productData);
        
        // Extrair palavras-chave secundárias (do título e atributos)
        const secondary_keywords = this.extractSecondaryKeywords(productData);
        
        // Extrair long-tail keywords
        const long_tail_keywords = this.extractLongTailKeywords(productData);
        
        // Identificar palavras-chave em falta
        const missing_keywords = this.identifyMissingKeywords(productData);
        
        // Calcular densidade de palavras-chave
        const keyword_density = this.calculateKeywordDensity(productData);
        
        // Identificar palavras-chave em tendência
        const trending_keywords = this.getTrendingKeywords(categoryId);
        
        // Analisar competidores (simulado por enquanto)
        const competitor_keywords = this.getCompetitorKeywords(categoryId);
        
        // Gerar recomendações por seção
        const recommendations = this.generateKeywordRecommendations(productData);
        
        return {
            primary_keywords,
            secondary_keywords,
            long_tail_keywords,
            missing_keywords,
            keyword_density,
            trending_keywords,
            competitor_keywords,
            recommended_for_title: recommendations.title,
            recommended_for_model: recommendations.model,
            recommended_for_attributes: recommendations.attributes,
            recommended_for_description: recommendations.description
        };
    }
    
    /**
     * Otimiza título do produto
     */
    optimizeTitle(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): TitleOptimization {
        const current_title = productData.title;
        const current_score = this.scoreTitleSEO(current_title, productData);
        
        // Identificar fraquezas do título atual
        const weaknesses = this.identifyTitleWeaknesses(current_title, productData);
        
        // Gerar sugestões de título otimizado
        const suggested_titles = this.generateTitleSuggestions(productData, keywordAnalysis);
        
        // Melhores práticas
        const best_practices = this.getTitleBestPractices();
        
        return {
            current_title,
            current_score,
            weaknesses,
            suggested_titles,
            best_practices
        };
    }
    
    /**
     * Gera descrição SEO otimizada
     */
    generateSEODescription(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): SEODescriptionData {
        const brand = this.getBrand(productData);
        const model = this.getModel(productData);
        const category = this.getCategoryName(productData.category_id);
        
        // Construir seções da descrição
        const title_section = this.generateTitleSection(productData, brand, model);
        const bullet_points = this.generateBulletPoints(productData, keywordAnalysis);
        const technical_specs = this.generateTechnicalSpecs(productData);
        const benefits = this.generateBenefits(productData, keywordAnalysis);
        const usage_info = this.generateUsageInfo(productData);
        const warranty_info = this.generateWarrantyInfo(productData);
        const faq_section = this.generateFAQSection(productData);
        
        // Montar descrição completa
        const optimized_description = this.assembleDescription({
            title_section,
            bullet_points,
            technical_specs,
            benefits,
            usage_info,
            warranty_info,
            faq_section
        });
        
        // Calcular métricas
        const readability_score = this.calculateReadabilityScore(optimized_description);
        const call_to_action = this.generateCallToAction(productData);
        
        return {
            optimized_description,
            structure: {
                title_section,
                bullet_points,
                technical_specs,
                benefits,
                usage_info,
                warranty_info,
                faq_section
            },
            seo_keywords: keywordAnalysis.primary_keywords.concat(keywordAnalysis.secondary_keywords),
            readability_score,
            call_to_action
        };
    }
    
    /**
     * Extrai palavras-chave primárias
     */
    private extractPrimaryKeywords(productData: MLBAnalysisData): string[] {
        const keywords: string[] = [];
        
        // Categoria principal
        const categoryKeyword = this.getCategoryKeyword(productData.category_id);
        if (categoryKeyword) keywords.push(categoryKeyword);
        
        // Marca
        const brand = this.getBrand(productData);
        if (brand) keywords.push(brand.toLowerCase());
        
        // Palavras principais do título
        const titleWords = productData.title.toLowerCase().split(' ')
            .filter(word => word.length > 3)
            .slice(0, 3);
        keywords.push(...titleWords);
        
        return [...new Set(keywords)]; // Remove duplicatas
    }
    
    /**
     * Extrai palavras-chave secundárias
     */
    private extractSecondaryKeywords(productData: MLBAnalysisData): string[] {
        const keywords: string[] = [];
        
        // Atributos importantes
        const attributes = productData.attributes || [];
        attributes.forEach(attr => {
            if (['COLOR', 'SIZE', 'MATERIAL', 'STYLE'].includes(attr.id) && attr.value_name) {
                keywords.push(attr.value_name.toLowerCase());
            }
        });
        
        // Palavras do modelo
        const model = this.getModel(productData);
        if (model) {
            const modelWords = model.toLowerCase().split(' ').filter(word => word.length > 2);
            keywords.push(...modelWords);
        }
        
        // Tags do produto
        if (productData.tags) {
            keywords.push(...productData.tags.map(tag => tag.toLowerCase()));
        }
        
        return [...new Set(keywords)];
    }
    
    /**
     * Extrai long-tail keywords
     */
    private extractLongTailKeywords(productData: MLBAnalysisData): string[] {
        const keywords: string[] = [];
        
        // Combinações de atributos
        const brand = this.getBrand(productData);
        const color = this.getAttribute(productData, 'COLOR');
        const size = this.getAttribute(productData, 'SIZE');
        const category = this.getCategoryKeyword(productData.category_id);
        
        if (brand && color && category) {
            keywords.push(`${category} ${brand} ${color}`.toLowerCase());
        }
        
        if (brand && size && category) {
            keywords.push(`${category} ${brand} ${size}`.toLowerCase());
        }
        
        // Frases do título
        const titlePhrases = this.extractPhrases(productData.title, 3);
        keywords.push(...titlePhrases);
        
        return [...new Set(keywords)];
    }
    
    /**
     * Identifica palavras-chave em falta
     */
    private identifyMissingKeywords(productData: MLBAnalysisData): string[] {
        const missing: string[] = [];
        const title = productData.title.toLowerCase();
        const description = productData.descriptions?.[0]?.plain_text?.toLowerCase() || '';
        
        // Keywords que deveriam estar presentes
        const shouldHave = this.getExpectedKeywords(productData.category_id);
        
        shouldHave.forEach(keyword => {
            if (!title.includes(keyword) && !description.includes(keyword)) {
                missing.push(keyword);
            }
        });
        
        // Atributos não mencionados
        const attributes = productData.attributes || [];
        attributes.forEach(attr => {
            if (['BRAND', 'MODEL', 'COLOR'].includes(attr.id) && attr.value_name) {
                const attrValue = attr.value_name.toLowerCase();
                if (!title.includes(attrValue)) {
                    missing.push(attrValue);
                }
            }
        });
        
        return [...new Set(missing)];
    }
    
    /**
     * Calcula densidade de palavras-chave
     */
    private calculateKeywordDensity(productData: MLBAnalysisData): number {
        const title = productData.title.toLowerCase();
        const description = productData.descriptions?.[0]?.plain_text?.toLowerCase() || '';
        const allText = `${title} ${description}`;
        
        const totalWords = allText.split(' ').length;
        const categoryKeywords = this.getExpectedKeywords(productData.category_id);
        
        let keywordCount = 0;
        categoryKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
            const matches = allText.match(regex);
            keywordCount += matches ? matches.length : 0;
        });
        
        return totalWords > 0 ? (keywordCount / totalWords) * 100 : 0;
    }
    
    /**
     * Obtém palavras-chave em tendência
     */
    private getTrendingKeywords(categoryId: string): string[] {
        // Em produção, isso viria de uma API de tendências
        const trendingByCategory: { [key: string]: string[] } = {
            'MLB1276': ['bluetooth', 'wireless', 'noise cancelling', 'gaming'],
            'MLB1051': ['5g', 'triple camera', 'fast charging', 'android'],
            'MLB1432': ['dourado', 'prateado', 'hipoalergênico', 'delicado'],
            // ... mais categorias
        };
        
        return trendingByCategory[categoryId] || [];
    }
    
    /**
     * Obtém palavras-chave de competidores
     */
    private getCompetitorKeywords(categoryId: string): string[] {
        const cached = COMPETITOR_CACHE.get(categoryId);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            return cached.data;
        }
        return ['premium', 'original', 'garantia', 'entrega rapida'];
    }
    
    /**
     * Gera recomendações de palavras-chave por seção
     */
    private generateKeywordRecommendations(productData: MLBAnalysisData) {
        const brand = this.getBrand(productData);
        const category = this.getCategoryKeyword(productData.category_id);
        const trending = this.getTrendingKeywords(productData.category_id);
        
        return {
            title: [category, brand, ...trending.slice(0, 2)].filter(Boolean),
            model: trending.concat(['premium', 'original', 'qualidade']),
            attributes: ['cor', 'tamanho', 'material', 'marca'],
            description: ['garantia', 'entrega', 'qualidade', 'durabilidade', ...trending]
        };
    }
    
    /**
     * Gera sugestões de título otimizado
     */
    private generateTitleSuggestions(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): SEOTitleSuggestion[] {
        const suggestions: SEOTitleSuggestion[] = [];
        const brand = this.getBrand(productData);
        const model = this.getModel(productData);
        const category = this.getCategoryKeyword(productData.category_id);
        const color = this.getAttribute(productData, 'COLOR');
        const size = this.getAttribute(productData, 'SIZE');
        
        // Estratégia 1: Categoria + Marca + Modelo + Diferencial
        if (category && brand) {
            const title1 = `${category} ${brand} ${model || ''} ${color || ''} ${keywordAnalysis.trending_keywords[0] || ''}`.trim();
            suggestions.push(this.evaluateTitle(title1, productData, keywordAnalysis));
        }
        
        // Estratégia 2: Foco em benefícios
        if (category) {
            const benefits = keywordAnalysis.trending_keywords.slice(0, 2).join(' ');
            const title2 = `${category} ${benefits} ${brand} ${color || size || ''}`.trim();
            suggestions.push(this.evaluateTitle(title2, productData, keywordAnalysis));
        }
        
        // Estratégia 3: Long-tail otimizado
        if (keywordAnalysis.long_tail_keywords.length > 0) {
            const longTail = keywordAnalysis.long_tail_keywords[0];
            const title3 = `${longTail} ${brand} Original`.trim();
            suggestions.push(this.evaluateTitle(title3, productData, keywordAnalysis));
        }
        
        // Estratégia 4: Otimização do título atual
        const currentOptimized = this.optimizeCurrentTitle(productData.title, keywordAnalysis);
        suggestions.push(this.evaluateTitle(currentOptimized, productData, keywordAnalysis));
        
        return suggestions.sort((a, b) => b.score - a.score);
    }
    
    /**
     * Avalia um título e retorna score + análise
     */
    private evaluateTitle(title: string, productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): SEOTitleSuggestion {
        const score = this.scoreTitleSEO(title, productData);
        const keywords_added: string[] = [];
        const keywords_removed: string[] = [];
        
        // Comparar com título original
        const originalWords = productData.title.toLowerCase().split(' ');
        const newWords = title.toLowerCase().split(' ');
        
        newWords.forEach(word => {
            if (!originalWords.includes(word) && word.length > 2) {
                keywords_added.push(word);
            }
        });
        
        originalWords.forEach(word => {
            if (!newWords.includes(word) && word.length > 2) {
                keywords_removed.push(word);
            }
        });
        
        return {
            title,
            score,
            reasoning: this.generateTitleReasoning(title, score),
            keywords_added,
            keywords_removed,
            length: title.length,
            seo_factors: {
                keyword_density: this.calculateTitleKeywordDensity(title, keywordAnalysis),
                readability: this.calculateTitleReadability(title),
                ctr_potential: this.calculateCTRPotential(title),
                brand_presence: title.toLowerCase().includes(this.getBrand(productData)?.toLowerCase() || ''),
                special_chars: /[!@#$%^&*()_+\-=\\{}|;':",.<>?~`]/.test(title)
            }
        };
    }
    
    // Métodos auxiliares
    private scoreTitleSEO(title: string, productData: MLBAnalysisData): number {
        let score = 0;
        const length = title.length;
        if (length >= 20 && length <= 60) score += 25;
        else if (length >= 15 && length <= 80) score += 15;
        else score += 5;

        const categoryKeywords = this.getCategoryKeyword(productData.category_id) ? [this.getCategoryKeyword(productData.category_id) as string] : [];
        if (categoryKeywords.some(keyword => title.toLowerCase().includes(keyword.toLowerCase()))) score += 20;

        const importantAttributes = ['BRAND', 'MODEL', 'COLOR', 'SIZE', 'MATERIAL']
            .map(id => {
                const a = productData.attributes.find(attr => attr.id === id);
                return a?.value_name || '';
            })
            .filter(Boolean);
        const attributesInTitle = importantAttributes.filter(attr => title.toLowerCase().includes(attr.toLowerCase()));
        score += Math.min(15, attributesInTitle.length * 5);

        if (title.includes(' - ') || title.includes(' | ')) score += 10;
        if (/\d/.test(title)) score += 5;
        if (title.includes('"') || title.includes('pol')) score += 5;

        if (title.toUpperCase() === title) score -= 20;
        if (title.includes('!!!') || title.includes('***')) score -= 10;
        if (title.length > 100) score -= 15;

        return Math.max(0, Math.min(100, score));
    }
    
    private identifyTitleWeaknesses(title: string, productData: MLBAnalysisData): string[] {
        const weaknesses = [];
        
        if (title.length > 60) weaknesses.push('Título muito longo');
        if (title.length < 20) weaknesses.push('Título muito curto');
        if (title.toUpperCase() === title) weaknesses.push('Excesso de maiúsculas');
        if (!this.getBrand(productData) || !title.toLowerCase().includes(this.getBrand(productData)?.toLowerCase() || '')) {
            weaknesses.push('Marca ausente no título');
        }
        
        return weaknesses;
    }
    
    private getTitleBestPractices(): string[] {
        return [
            'Use 20-60 caracteres para melhor visibilidade',
            'Inclua marca e modelo quando relevante',
            'Adicione palavras-chave da categoria',
            'Evite excesso de maiúsculas',
            'Use números para especificações',
            'Inclua cor ou tamanho quando importante',
            'Evite caracteres especiais desnecessários'
        ];
    }
    
    // Métodos auxiliares para extrair informações do produto
    private getBrand(productData: MLBAnalysisData): string | null {
        const brandAttr = productData.attributes.find(attr => attr.id === 'BRAND');
        return brandAttr?.value_name || null;
    }
    
    private getModel(productData: MLBAnalysisData): string | null {
        const modelAttr = productData.attributes.find(attr => attr.id === 'MODEL');
        return modelAttr?.value_name || null;
    }
    
    private getAttribute(productData: MLBAnalysisData, attributeId: string): string | null {
        const attr = productData.attributes.find(attr => attr.id === attributeId);
        return attr?.value_name || null;
    }
    
    private getCategoryKeyword(categoryId: string): string | null {
        const categoryMappings: { [key: string]: string } = {
            'MLB1276': 'Fone',
            'MLB1051': 'Celular',
            'MLB1432': 'Brinco',
            'MLB1652': 'Notebook'
        };
        return categoryMappings[categoryId] || null;
    }
    
    private getCategoryName(categoryId: string): string {
        return this.getCategoryKeyword(categoryId) || 'Produto';
    }
    
    private getExpectedKeywords(categoryId: string): string[] {
        const keywordsByCategory: { [key: string]: string[] } = {
            'MLB1276': ['fone', 'audio', 'som', 'música'],
            'MLB1051': ['celular', 'smartphone', 'telefone'],
            'MLB1432': ['brinco', 'joia', 'acessório']
        };
        return keywordsByCategory[categoryId] || [];
    }
    
    private extractPhrases(text: string, minWords: number): string[] {
        const words = text.toLowerCase().split(' ');
        const phrases = [];
        
        for (let i = 0; i <= words.length - minWords; i++) {
            const phrase = words.slice(i, i + minWords).join(' ');
            phrases.push(phrase);
        }
        
        return phrases;
    }
    
    // Métodos para geração de descrição
    private generateTitleSection(productData: MLBAnalysisData, brand: string | null, model: string | null): string {
        const category = this.getCategoryName(productData.category_id);
        return `🔥 ${category} ${brand || ''} ${model || ''} - Original com Garantia`.trim();
    }
    
    private generateBulletPoints(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): string[] {
        const points = [];
        
        const brand = this.getBrand(productData);
        if (brand) points.push(`✅ Marca: ${brand}`);
        
        const color = this.getAttribute(productData, 'COLOR');
        if (color) points.push(`🎨 Cor: ${color}`);
        
        points.push('📦 Entrega rápida');
        points.push('🛡️ Produto original');
        points.push('🚚 Frete grátis');
        
        return points;
    }
    
    private generateTechnicalSpecs(productData: MLBAnalysisData): string {
        const specs = [];
        const attributes = productData.attributes || [];
        
        attributes.forEach(attr => {
            if (['DIMENSIONS', 'WEIGHT', 'MATERIAL'].includes(attr.id) && attr.value_name) {
                specs.push(`${attr.name}: ${attr.value_name}`);
            }
        });
        
        return specs.length > 0 ? `\n📋 Especificações Técnicas:\n${specs.join('\n')}` : '';
    }
    
    private generateBenefits(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): string[] {
        return [
            'Qualidade superior',
            'Durabilidade garantida',
            'Design moderno',
            'Fácil de usar'
        ];
    }
    
    private generateUsageInfo(productData: MLBAnalysisData): string {
        return '\n💡 Ideal para uso diário, presente ou coleção.';
    }
    
    private generateWarrantyInfo(productData: MLBAnalysisData): string {
        return '\n🛡️ Garantia: 30 dias conforme Código de Defesa do Consumidor.';
    }
    
    private generateFAQSection(productData: MLBAnalysisData): string[] {
        return [
            '❓ É original? Sim, produto 100% original.',
            '❓ Tem garantia? Sim, 30 dias de garantia.',
            '❓ Como é a entrega? Rápida e segura via Mercado Envios.'
        ];
    }
    
    private assembleDescription(structure: any): string {
        return [
            structure.title_section,
            '',
            structure.bullet_points.join('\n'),
            structure.technical_specs,
            '',
            '🌟 Benefícios:',
            structure.benefits.map((b: string) => `• ${b}`).join('\n'),
            structure.usage_info,
            structure.warranty_info,
            '',
            '❓ Dúvidas Frequentes:',
            structure.faq_section.join('\n')
        ].filter(Boolean).join('\n');
    }
    
    private calculateReadabilityScore(text: string): number {
        // Implementação básica de legibilidade
        const sentences = text.split(/[.!?]+/).length;
        const words = text.split(' ').length;
        const avgWordsPerSentence = words / sentences;
        
        // Score baseado na simplicidade
        if (avgWordsPerSentence < 15) return 90;
        if (avgWordsPerSentence < 20) return 75;
        return 60;
    }
    
    private generateCallToAction(productData: MLBAnalysisData): string {
        return '🛒 Clique em COMPRAR AGORA e garante já o seu!';
    }
    
    private optimizeCurrentTitle(title: string, keywordAnalysis: KeywordAnalysis): string {
        // Implementação básica de otimização do título atual
        let optimized = title;
        
        // Adicionar palavra-chave se não existe
        if (keywordAnalysis.missing_keywords.length > 0) {
            optimized = `${optimized} ${keywordAnalysis.missing_keywords[0]}`;
        }
        
        // Limitar comprimento
        if (optimized.length > 60) {
            optimized = optimized.substring(0, 57) + '...';
        }
        
        return optimized;
    }
    
    private generateTitleReasoning(title: string, score: number): string {
        if (score >= 80) return 'Título bem otimizado com boa estrutura SEO';
        if (score >= 60) return 'Título aceitável, mas pode ser melhorado';
        return 'Título precisa de otimização significativa';
    }
    
    private calculateTitleKeywordDensity(title: string, keywordAnalysis: KeywordAnalysis): number {
        const words = title.toLowerCase().split(' ');
        const keywordCount = keywordAnalysis.primary_keywords.filter(kw => 
            words.includes(kw.toLowerCase())
        ).length;
        
        return (keywordCount / words.length) * 100;
    }
    
    private calculateTitleReadability(title: string): number {
        // Score baseado na facilidade de leitura
        const words = title.split(' ');
        const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
        
        if (avgWordLength < 6) return 90;
        if (avgWordLength < 8) return 75;
        return 60;
    }
    
    private calculateCTRPotential(title: string): number {
        let score = 50; // Base
        
        // Fatores que aumentam CTR
        if (title.includes('Original')) score += 15;
        if (title.includes('Garantia')) score += 10;
        if (title.includes('Grátis')) score += 10;
        if (/\d+%/.test(title)) score += 15; // Desconto em %
        
        return Math.min(100, score);
    }
}

export async function fetchTrendingKeywordsFromML(categoryId: string, limit = 20): Promise<string[]> {
    const cached = TRENDING_CACHE.get(categoryId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.data.slice(0, limit);
    }

    try {
        const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
            params: { category: categoryId, limit: 50 },
        });
        const results = Array.isArray(response.data?.results) ? response.data.results : [];
        const titles: string[] = results.map((r: any) => String(r.title || '').toLowerCase());

        const stop = new Set([
            'de','da','do','das','dos','para','por','com','sem','em','na','no','nas','nos','e','ou','o','a','os','as','um','uma','uns','umas','kit','novo','usado'
        ]);

        const freq: Record<string, number> = {};
        for (const t of titles) {
            const tokens = t.split(/[^a-z0-9áéíóúãõâêîôûç]+/i).filter(w => w && w.length > 3);
            for (const w of tokens) {
                if (stop.has(w) || /\d{2,}/.test(w)) continue;
                freq[w] = (freq[w] || 0) + 1;
            }
        }

        const sorted = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([w]) => w)
            .slice(0, limit);

        TRENDING_CACHE.set(categoryId, { data: sorted, ts: Date.now() });
        return sorted;
    } catch {
        const fallback = [] as string[];
        TRENDING_CACHE.set(categoryId, { data: fallback, ts: Date.now() });
        return fallback;
    }
}

export async function fetchCompetitorKeywordsFromML(categoryId: string, limit = 20): Promise<string[]> {
    const cached = COMPETITOR_CACHE.get(categoryId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.data.slice(0, limit);
    }

    try {
        const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
            params: { category: categoryId, limit: 50 },
        });
        const results = Array.isArray(response.data?.results) ? response.data.results : [];
        const titles: string[] = results.map((r: any) => String(r.title || '').toLowerCase());

        const preference = new Set(['original','premium','garantia','frete','grátis','entrega','rápida']);
        const freq: Record<string, number> = {};
        for (const t of titles) {
            const tokens = t.split(/[^a-z0-9áéíóúãõâêîôûç]+/i).filter(w => w && w.length > 3);
            for (const w of tokens) {
                const normalized = w.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (!preference.has(w) && !preference.has(normalized)) continue;
                const key = preference.has(w) ? w : normalized;
                freq[key] = (freq[key] || 0) + 1;
            }
        }

        const sorted = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([w]) => w)
            .slice(0, limit);

        const finalList = sorted.length > 0 ? sorted : ['premium','original','garantia'];
        COMPETITOR_CACHE.set(categoryId, { data: finalList, ts: Date.now() });
        return finalList;
    } catch {
        const fallback = ['premium','original','garantia'];
        COMPETITOR_CACHE.set(categoryId, { data: fallback, ts: Date.now() });
        return fallback.slice(0, limit);
    }
}

export const seoOptimizerService = new SEOOptimizerService();
