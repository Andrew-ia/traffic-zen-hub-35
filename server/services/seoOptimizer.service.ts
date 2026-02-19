import { MLBAnalysisData, KeywordAnalysis, TitleOptimization } from './mlbAnalyzer.service.js';
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
    private normalizeToken(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    private isGenericMaterial(value?: string | null): boolean {
        if (!value) return true;
        const normalized = this.normalizeToken(value);
        if (!normalized) return true;
        const specificSignals = [
            'inox',
            'aco inox',
            'prata',
            'ouro',
            '18k',
            '24k',
            '925',
            'folheado',
            'banhado',
            'titanio',
            'titanio',
            'zirconia',
            'cristal',
            'perola',
            'resina',
            'ceramica',
        ];
        if (specificSignals.some((signal) => normalized.includes(signal))) return false;
        if (normalized.includes('metal')) return true;
        if (normalized.includes('liga')) return true;
        if (normalized.includes('aco') && !normalized.includes('inox')) return true;
        return false;
    }

    private shouldIncludeBrandInTitle(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): boolean {
        const brand = this.getBrand(productData);
        if (!brand) return false;
        const normalizedBrand = this.normalizeToken(brand);
        if (!normalizedBrand || normalizedBrand === 'generica' || normalizedBrand === 'genérica') return false;

        const title = this.normalizeToken(productData.title || '');
        if (title.includes(normalizedBrand)) return true;

        const pool = new Set([
            ...(keywordAnalysis.trending_keywords || []),
            ...(keywordAnalysis.competitor_keywords || []),
        ].map((kw) => this.normalizeToken(kw)));

        return pool.has(normalizedBrand);
    }

    private filterMissingKeywords(
        productData: MLBAnalysisData,
        missing: string[],
        keywordAnalysis: KeywordAnalysis,
    ): string[] {
        const brand = this.getBrand(productData);
        const material = this.getAttribute(productData, 'MATERIAL');
        const normalizedBrand = brand ? this.normalizeToken(brand) : '';
        const normalizedMaterial = material ? this.normalizeToken(material) : '';
        const allowBrand = this.shouldIncludeBrandInTitle(productData, keywordAnalysis);
        const genericMaterial = this.isGenericMaterial(material);

        return missing.filter((kw) => {
            const normalized = this.normalizeToken(kw);
            if (normalizedBrand && normalized === normalizedBrand && !allowBrand) return false;
            if (genericMaterial && normalizedMaterial && normalized === normalizedMaterial) return false;
            return true;
        });
    }

    /**
     * Analisa palavras-chave do produto
     */
    analyzeKeywords(productData: MLBAnalysisData): KeywordAnalysis {
        const title = productData.title.toLowerCase();
        const description = (productData.description_text || productData.descriptions?.[0]?.plain_text || '').toLowerCase();
        const categoryId = productData.category_id;

        // Extrair palavras-chave primárias (categoria + atributos importantes)
        const primary_keywords = this.extractPrimaryKeywords(productData);

        // Extrair palavras-chave secundárias (do título e atributos)
        const secondary_keywords = this.extractSecondaryKeywords(productData);

        // Extrair long-tail keywords
        const long_tail_keywords = this.extractLongTailKeywords(productData);

        // Calcular densidade de palavras-chave
        const keyword_density = this.calculateKeywordDensity(productData);

        // Identificar palavras-chave em tendência
        const trending_keywords = this.getTrendingKeywords(categoryId);

        // Analisar competidores (simulado por enquanto)
        const competitor_keywords = this.getCompetitorKeywords(categoryId);

        // Identificar palavras-chave em falta (filtradas por relevância)
        const missing_keywords_raw = this.identifyMissingKeywords(productData);
        const missing_keywords = this.filterMissingKeywords(productData, missing_keywords_raw, {
            primary_keywords,
            secondary_keywords,
            long_tail_keywords,
            missing_keywords: missing_keywords_raw,
            keyword_density,
            trending_keywords,
            competitor_keywords,
            recommended_for_title: [],
            recommended_for_model: [],
            recommended_for_attributes: [],
            recommended_for_description: [],
        });

        // Gerar recomendações por seção
        const recommendations = this.generateKeywordRecommendations(productData, {
            primary_keywords,
            secondary_keywords,
            long_tail_keywords,
            missing_keywords,
            keyword_density,
            trending_keywords,
            competitor_keywords,
            recommended_for_title: [],
            recommended_for_model: [],
            recommended_for_attributes: [],
            recommended_for_description: [],
        });

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
        if (this.isJewelryCategory(productData)) {
            return this.buildJewelryDescription(productData, keywordAnalysis);
        }

        const title = productData.title;
        const brand = this.getBrand(productData);
        const categoryName = this.getCategoryNameByData(productData);
        const material = this.getAttribute(productData, 'MATERIAL');
        const color = this.getAttribute(productData, 'COLOR') || this.getAttribute(productData, 'MAIN_COLOR');
        const size = this.getAttribute(productData, 'SIZE');

        const details: string[] = [];
        if (brand) details.push(`Marca: ${brand}`);
        if (material) details.push(`Material: ${material}`);
        if (color) details.push(`Cor: ${color}`);
        if (size) details.push(`Tamanho: ${size}`);

        const parts: string[] = [];
        parts.push(title);
        parts.push('');
        parts.push(`Descrição do ${categoryName.toLowerCase()}: ${title}.`);

        if (details.length > 0) {
            parts.push('');
            parts.push('DETALHES:');
            parts.push(...details.map(detail => `• ${detail}`));
        }

        parts.push('');
        parts.push('CONTEÚDO DA EMBALAGEM:');
        parts.push(`• 1x ${title}`);
        parts.push('• Embalagem segura para transporte');

        parts.push('');
        parts.push('ENVIO:');
        parts.push('• Seg a sex: pedidos até 12h saem no mesmo dia.');
        parts.push('• Sáb/Dom/Feriados: envio no próximo dia útil.');

        const optimized_description = parts.join('\n');
        const wordCount = optimized_description.split(/\s+/).filter(Boolean).length;
        const readability_score = Math.min(100, 70 + Math.floor(wordCount / 4));

        return {
            optimized_description,
            structure: {
                title_section: title,
                bullet_points: details,
                technical_specs: details.join('\n'),
                benefits: [],
                usage_info: '',
                warranty_info: productData.warranty || '',
                faq_section: []
            },
            seo_keywords: keywordAnalysis.primary_keywords,
            readability_score,
            call_to_action: 'Aproveite enquanto há estoque disponível.'
        };
    }

    /**
     * Extrai palavras-chave primárias
     */
    private extractPrimaryKeywords(productData: MLBAnalysisData): string[] {
        const keywords: string[] = [];

        // Categoria principal
        const categoryKeyword = this.getCategoryKeywordFromData(productData);
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
        const category = this.getCategoryKeywordFromData(productData);

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
        const description = (productData.description_text || productData.descriptions?.[0]?.plain_text || '').toLowerCase();

        // Keywords que deveriam estar presentes
        const shouldHave = this.getExpectedKeywordsDynamic(productData);

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
        const description = (productData.description_text || productData.descriptions?.[0]?.plain_text || '').toLowerCase();
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
    private generateKeywordRecommendations(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis) {
        const brand = this.getBrand(productData);
        const category = this.getCategoryKeyword(productData.category_id);
        const trending = keywordAnalysis.trending_keywords || [];

        const colorAttr = (this.getAttribute(productData, 'COLOR') || '').toLowerCase();
        const normalizeColor = (s: string) => {
            const n = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            if (n === 'ouro' || n === 'dourado') return 'dourado';
            if (n === 'prata' || n === 'prateado') return 'prateado';
            return n;
        };
        const colorWords = new Set(['dourado', 'ouro', 'prateado', 'prata', 'preto', 'branco', 'azul', 'verde', 'vermelho', 'rosa', 'roxo', 'bege', 'cinza', 'laranja', 'amarelo', 'marrom']);
        const safeTrending = trending.filter((kw) => {
            const n = normalizeColor(kw);
            const isColor = colorWords.has(n);
            return !isColor || (colorAttr && normalizeColor(colorAttr) === n);
        });

        const includeBrand = this.shouldIncludeBrandInTitle(productData, keywordAnalysis);
        return {
            title: [category, includeBrand ? brand : null, ...safeTrending.slice(0, 2)].filter(Boolean),
            model: safeTrending.concat(['premium', 'original', 'qualidade']),
            attributes: ['cor', 'tamanho', 'material', 'marca'],
            description: ['garantia', 'entrega', 'qualidade', 'durabilidade', ...safeTrending]
        };
    }

    /**
     * Gera sugestões de título otimizado
     */
    private generateTitleSuggestions(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): SEOTitleSuggestion[] {
        const suggestions: SEOTitleSuggestion[] = [];
        const currentScore = this.scoreTitleSEO(productData.title, productData);
        const brand = this.getBrand(productData);
        const model = this.getModel(productData);
        const category = this.getCategoryKeyword(productData.category_id);
        const color = this.getAttribute(productData, 'COLOR');
        const size = this.getAttribute(productData, 'SIZE');
        const material = this.getAttribute(productData, 'MATERIAL');
        const currentTitle = productData.title.toLowerCase();
        const normalizeTitle = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
        const normalizedCurrent = normalizeTitle(productData.title);

        const colorAttr = (color || '').toLowerCase();
        const normalizeColor = (s: string) => {
            const n = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            if (n === 'ouro' || n === 'dourado') return 'dourado';
            if (n === 'prata' || n === 'prateado') return 'prateado';
            return n;
        };
        const colorWords = new Set(['dourado', 'ouro', 'prateado', 'prata', 'preto', 'branco', 'azul', 'verde', 'vermelho', 'rosa', 'roxo', 'bege', 'cinza', 'laranja', 'amarelo', 'marrom']);
        const safeTrending = keywordAnalysis.trending_keywords.filter((kw) => {
            const n = normalizeColor(kw);
            const isColor = colorWords.has(n);
            return (!isColor || (colorAttr && normalizeColor(colorAttr) === n)) && !currentTitle.includes(kw.toLowerCase());
        });

        const includeBrand = this.shouldIncludeBrandInTitle(productData, keywordAnalysis);
        const includeMaterial = material && !this.isGenericMaterial(material);

        // Estratégia 1: Categoria + (Marca) + Modelo + Diferencial
        if (category) {
            const safeBrand = includeBrand && model && brand
                ? (model.toLowerCase().includes(brand.toLowerCase()) ? null : brand)
                : (includeBrand ? brand : null);
            const safeColor = model && color ? (model.toLowerCase().includes(color.toLowerCase()) ? null : color) : color;
            const title1 = this.buildTitleFromParts([category, includeMaterial ? material : null, safeBrand, model, safeColor, safeTrending[0]]);
            suggestions.push(this.evaluateTitle(title1, productData, keywordAnalysis));
        }

        // Estratégia 2: Foco em benefícios
        if (category) {
            const benefits = safeTrending.slice(0, 2).join(' ');
            const safeBrand = includeBrand && model && brand
                ? (model.toLowerCase().includes(brand.toLowerCase()) ? null : brand)
                : (includeBrand ? brand : null);
            const safeColor = model && color ? (model.toLowerCase().includes(color.toLowerCase()) ? null : color) : color;
            const title2 = this.buildTitleFromParts([category, benefits, includeMaterial ? material : null, safeBrand, safeColor || size]);
            suggestions.push(this.evaluateTitle(title2, productData, keywordAnalysis));
        }

        // Estratégia 3: Long-tail otimizado
        if (keywordAnalysis.long_tail_keywords.length > 0) {
            const longTail = keywordAnalysis.long_tail_keywords[0];
            const safeBrand = includeBrand && model && brand
                ? (model.toLowerCase().includes(brand.toLowerCase()) ? null : brand)
                : (includeBrand ? brand : null);
            const title3 = this.buildTitleFromParts([longTail, includeMaterial ? material : null, safeBrand]);
            suggestions.push(this.evaluateTitle(title3, productData, keywordAnalysis));
        }

        // Estratégia 4: Otimização do título atual
        const currentOptimized = this.optimizeCurrentTitle(productData.title, keywordAnalysis);
        suggestions.push(this.evaluateTitle(currentOptimized, productData, keywordAnalysis));

        const baseline = this.evaluateTitle(productData.title, productData, keywordAnalysis);
        const unique = new Map<string, SEOTitleSuggestion>();
        [baseline, ...suggestions].forEach((item) => {
            const key = normalizeTitle(item.title);
            if (!unique.has(key)) unique.set(key, item);
        });
        const threshold = currentScore >= 80 ? 8 : 5;
        const improved = Array.from(unique.values()).filter((item) => {
            const normalized = normalizeTitle(item.title);
            if (normalized === normalizedCurrent) return false;
            return item.score >= currentScore + threshold;
        });
        if (improved.length === 0) {
            return [baseline];
        }
        return improved.sort((a, b) => b.score - a.score);
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

    private getCategoryKeywordFromData(productData: MLBAnalysisData): string | null {
        const path = productData.category_prediction?.path_from_root || [];
        const leaf = String(path[path.length - 1]?.name || '').toLowerCase();
        if (/anel/.test(leaf)) return 'Anel';
        if (/brinco/.test(leaf)) return 'Brinco';
        if (/colar/.test(leaf)) return 'Colar';
        if (/pulseira/.test(leaf)) return 'Pulseira';
        return null;
    }

    private getCategoryNameByData(productData: MLBAnalysisData): string {
        return this.getCategoryKeywordFromData(productData) || 'Produto';
    }

    private buildTitleFromParts(parts: Array<string | null | undefined>): string {
        const cleaned: string[] = [];
        const seen = new Set<string>();

        for (const part of parts) {
            const text = String(part || '').trim();
            if (!text) continue;
            const normalized = text.toLowerCase();
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            cleaned.push(text);
        }

        const title = cleaned.join(' ').replace(/\s+/g, ' ').trim();
        return title;
    }

    private isJewelryCategory(productData: MLBAnalysisData): boolean {
        const categoryName = this.getCategoryNameByData(productData).toLowerCase();
        const title = (productData.title || '').toLowerCase();
        return /brinco|anel|colar|pulseira|joia|bijuteria/.test(categoryName)
            || /brinco|anel|colar|pulseira|joia|bijuteria/.test(title);
    }

    private buildJewelryDescription(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): SEODescriptionData {
        const title = productData.title;
        const brand = this.getBrand(productData);
        const categoryName = this.getCategoryNameByData(productData);
        const material = this.getAttribute(productData, 'MATERIAL');
        const color = this.getAttribute(productData, 'COLOR') || this.getAttribute(productData, 'MAIN_COLOR');
        const finish = this.getAttribute(productData, 'FINISH');
        const style = this.getAttribute(productData, 'STYLE') || this.getAttribute(productData, 'DESIGN');
        const stoneType = this.getAttribute(productData, 'STONE_TYPE');
        const size = this.getAttribute(productData, 'SIZE');
        const length = this.getAttribute(productData, 'LENGTH');
        const diameter = this.getAttribute(productData, 'DIAMETER');
        const weight = this.getAttribute(productData, 'WEIGHT');

        const highlights: string[] = [];
        if (material) highlights.push(`Material ${material}`);
        if (finish) highlights.push(`Acabamento ${finish}`);
        if (color) highlights.push(`Cor ${color}`);
        if (style) highlights.push(`Estilo ${style}`);
        if (stoneType) highlights.push(`Detalhes com ${stoneType}`);

        while (highlights.length < 3) {
            const fallback = [
                'Design versátil para o dia a dia',
                'Ótimo para presentear',
                'Combina com looks casuais e elegantes'
            ][highlights.length];
            highlights.push(fallback);
        }

        const details: string[] = [];
        if (brand) details.push(`Marca: ${brand}`);
        if (material) details.push(`Material: ${material}`);
        if (finish) details.push(`Acabamento: ${finish}`);
        if (color) details.push(`Cor: ${color}`);
        if (style) details.push(`Estilo: ${style}`);
        if (stoneType) details.push(`Pedra: ${stoneType}`);
        if (size) details.push(`Tamanho: ${size}`);
        if (length) details.push(`Comprimento: ${length}`);
        if (diameter) details.push(`Diâmetro: ${diameter}`);
        if (weight) details.push(`Peso: ${weight}`);

        const measures = [length, diameter, weight].filter(Boolean) as string[];

        const introParts = [
            `Realce seu estilo com ${title}.`,
            material ? `Produzido em ${material.toLowerCase()}` : null,
            color ? `na cor ${color.toLowerCase()}` : null,
            style ? `com estilo ${style.toLowerCase()}` : null,
            `Perfeito para uso diário e ocasiões especiais.`
        ].filter(Boolean);

        const parts: string[] = [];
        parts.push(title);
        parts.push('');
        parts.push(introParts.join(' '));
        parts.push('');
        parts.push('DESTAQUES:');
        parts.push(...highlights.map(item => `• ${item}`));

        if (details.length) {
            parts.push('');
            parts.push('DETALHES DO PRODUTO:');
            parts.push(...details.map(item => `• ${item}`));
        }

        if (measures.length) {
            parts.push('');
            parts.push('MEDIDAS:');
            parts.push(...measures.map(item => `• ${item}`));
        }

        parts.push('');
        parts.push('CONTEÚDO DA EMBALAGEM:');
        parts.push(`• 1x ${title}`);
        parts.push('• Embalagem segura para transporte');

        parts.push('');
        parts.push('ENVIO:');
        parts.push('• Seg a sex: pedidos até 12h saem no mesmo dia.');
        parts.push('• Sáb/Dom/Feriados: envio no próximo dia útil.');

        parts.push('');
        parts.push('CUIDADOS:');
        parts.push('• Evite contato com água, perfumes e produtos químicos.');
        parts.push('• Guarde em local seco e separado de outras peças.');

        parts.push('');
        parts.push('GARANTIA:');
        parts.push(productData.warranty ? `• ${productData.warranty}` : '• Garantia conforme política do Mercado Livre.');

        const optimized_description = parts.join('\n');
        const wordCount = optimized_description.split(/\s+/).filter(Boolean).length;
        const readability_score = Math.min(100, 75 + Math.floor(wordCount / 5));

        return {
            optimized_description,
            structure: {
                title_section: title,
                bullet_points: highlights,
                technical_specs: details.join('\n'),
                benefits: highlights,
                usage_info: 'Uso diário, presentes e ocasiões especiais.',
                warranty_info: productData.warranty || 'Conforme política do Mercado Livre.',
                faq_section: []
            },
            seo_keywords: Array.from(new Set([
                ...keywordAnalysis.primary_keywords,
                ...keywordAnalysis.secondary_keywords
            ])).slice(0, 8),
            readability_score,
            call_to_action: 'Aproveite enquanto há estoque disponível.'
        };
    }

    private getCategoryKeyword(categoryId: string): string | null {
        const mapping: Record<string, string> = {
            'MLB1432': 'Joia',
            'MLB1276': 'Fone',
            'MLB1051': 'Celular',
            'MLB1652': 'Notebook'
        };
        return mapping[categoryId] || null;
    }

    private getExpectedKeywords(categoryId: string): string[] {
        const mapping: Record<string, string[]> = {
            'MLB1432': ['joia', 'bijuteria', 'acessório', 'anel', 'brinco', 'colar', 'pulseira'],
            'MLB1276': ['fone', 'headphone', 'audio', 'som', 'bluetooth'],
            'MLB1051': ['celular', 'smartphone', 'mobile', 'telefone'],
            'MLB1652': ['notebook', 'laptop', 'computador']
        };
        return mapping[categoryId] || [];
    }

    private getExpectedKeywordsDynamic(productData: MLBAnalysisData): string[] {
        const kw: string[] = [];
        const cat = this.getCategoryKeywordFromData(productData);
        if (cat) kw.push(cat.toLowerCase());
        const material = this.getAttribute(productData, 'MATERIAL');
        const color = this.getAttribute(productData, 'COLOR');
        const size = this.getAttribute(productData, 'SIZE');
        if (material && !this.isGenericMaterial(material)) kw.push(material.toLowerCase());
        if (color) kw.push(color.toLowerCase());
        if (size) kw.push(size.toLowerCase());
        return [...new Set(kw)];
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
        return '';
    }

    private generateBulletPoints(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): string[] { return []; }
    private generateTechnicalSpecs(productData: MLBAnalysisData): string { return ''; }
    private generateBenefits(productData: MLBAnalysisData, keywordAnalysis: KeywordAnalysis): string[] { return []; }
    private generateUsageInfo(productData: MLBAnalysisData): string { return ''; }
    private generateWarrantyInfo(productData: MLBAnalysisData): string { return ''; }
    private generateFAQSection(productData: MLBAnalysisData): string[] { return []; }
    private assembleDescription(structure: any): string { return ''; }
    private calculateReadabilityScore(text: string): number { return 100; }
    private generateCallToAction(productData: MLBAnalysisData): string { return ''; }

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
            'de', 'da', 'do', 'das', 'dos', 'para', 'por', 'com', 'sem', 'em', 'na', 'no', 'nas', 'nos', 'e', 'ou', 'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'kit', 'novo', 'usado'
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

        const preference = new Set(['original', 'premium', 'garantia', 'frete', 'grátis', 'entrega', 'rápida']);
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

        const finalList = sorted.length > 0 ? sorted : ['premium', 'original', 'garantia'];
        COMPETITOR_CACHE.set(categoryId, { data: finalList, ts: Date.now() });
        return finalList;
    } catch {
        const fallback = ['premium', 'original', 'garantia'];
        COMPETITOR_CACHE.set(categoryId, { data: fallback, ts: Date.now() });
        return fallback.slice(0, limit);
    }
}

export const seoOptimizerService = new SEOOptimizerService();
