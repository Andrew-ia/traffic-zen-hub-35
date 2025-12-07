import axios from "axios";

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";

export interface MLBAnalysisData {
    // Dados básicos do produto
    id: string;
    title: string;
    category_id: string;
    price: number;
    original_price?: number;
    currency_id: string;
    available_quantity: number;
    sold_quantity: number;
    condition: string;
    status: string;

    // Dados SEO e otimização
    permalink: string;
    thumbnail: string;
    pictures: Array<{
        url: string;
        secure_url: string;
        size: string;
        max_size: string;
    }>;

    // Atributos e ficha técnica
    attributes: Array<{
        id: string;
        name: string;
        value_id?: string;
        value_name?: string;
        values?: Array<{
            id?: string;
            name?: string;
            struct?: any;
        }>;
    }>;

    // Dados para análise SEO
    descriptions?: Array<{
        id: string;
        plain_text?: string;
        snapshot?: {
            url: string;
            width: number;
            height: number;
            status: string;
        };
    }>;

    // Informações de categoria
    category_prediction?: {
        path_from_root: Array<{
            id: string;
            name: string;
        }>;
    };

    // Dados de shipping
    shipping?: {
        mode: string;
        free_shipping: boolean;
        local_pick_up: boolean;
        tags: string[];
        dimensions?: string;
        costs?: Array<{
            type: string;
            cost: number;
        }>;
    };

    // Variações
    variations?: Array<{
        id: number;
        price: number;
        attribute_combinations: Array<{
            id: string;
            name: string;
            value_id: string;
            value_name: string;
        }>;
        available_quantity: number;
        sold_quantity: number;
        picture_ids: string[];
    }>;

    // Dados de seller
    seller?: {
        id: number;
        power_seller_status: string;
        reputation: {
            level_id: string;
            power_seller_status: string;
            transactions: {
                total: number;
                completed: number;
                canceled: number;
            };
        };
    };

    // Tags e classificações
    tags: string[];
    warranty?: string;

    // Clips/Videos
    video_id?: string;

    // Dados temporais
    date_created: string;
    last_updated: string;
    start_time?: string;
    stop_time?: string;
}

export interface MLBQualityScore {
    overall_score: number; // 0-100
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
}

export interface KeywordAnalysis {
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
}

export interface TitleOptimization {
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
}

export interface CompetitorAnalysis {
    competitors: Array<{
        id: string;
        title: string;
        price: number;
        sold_quantity: number;
        keywords: string[];
        quality_score: number;
        advantages: string[];
        weaknesses: string[];
    }>;
    market_insights: {
        average_price: number;
        price_position: 'below' | 'average' | 'above';
        title_length_average: number;
        common_keywords: string[];
        gaps: string[];
    };
    recommendations: Array<{
        action: string;
        impact: 'high' | 'medium' | 'low';
        description: string;
    }>;
}

/**
 * Serviço principal para análise completa de produtos do Mercado Livre
 */
export class MLBAnalyzerService {

    /**
     * Busca dados completos de um produto via API do ML
     */
    async getProductData(mlbId: string, accessToken?: string): Promise<MLBAnalysisData> {
        try {
            const headers: any = {
                'User-Agent': 'TrafficPro-MLB-Analyzer/1.0'
            };

            if (accessToken) {
                headers.Authorization = `Bearer ${accessToken}`;
            }

            // Buscar dados principais do item
            const itemResponse = await axios.get(
                `${MERCADO_LIVRE_API_BASE}/items/${mlbId}`,
                { headers }
            );

            const itemData = itemResponse.data;

            // Buscar descrições
            let descriptions = [];
            try {
                const descriptionsResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/items/${mlbId}/descriptions`,
                    { headers }
                );
                descriptions = descriptionsResponse.data;
            } catch (error) {
                console.warn(`Não foi possível buscar descrições para ${mlbId}:`, error);
            }

            // Buscar dados da categoria
            let categoryPrediction = undefined;
            try {
                const categoryResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/categories/${itemData.category_id}`,
                    { headers }
                );
                categoryPrediction = {
                    path_from_root: categoryResponse.data.path_from_root || []
                };
            } catch (error) {
                console.warn(`Não foi possível buscar categoria ${itemData.category_id}:`, error);
            }

            // Buscar dados do seller (se token disponível)
            let seller = undefined;
            if (accessToken && itemData.seller_id) {
                try {
                    const sellerResponse = await axios.get(
                        `${MERCADO_LIVRE_API_BASE}/users/${itemData.seller_id}`,
                        { headers }
                    );
                    seller = sellerResponse.data;
                } catch (error) {
                    console.warn(`Não foi possível buscar dados do seller:`, error);
                }
            }

            return {
                id: itemData.id,
                title: itemData.title,
                category_id: itemData.category_id,
                price: itemData.price,
                original_price: itemData.original_price,
                currency_id: itemData.currency_id,
                available_quantity: itemData.available_quantity,
                sold_quantity: itemData.sold_quantity,
                condition: itemData.condition,
                status: itemData.status,
                permalink: itemData.permalink,
                thumbnail: itemData.thumbnail,
                pictures: itemData.pictures || [],
                attributes: itemData.attributes || [],
                descriptions,
                category_prediction: categoryPrediction,
                shipping: itemData.shipping,
                variations: itemData.variations || [],
                seller,
                tags: itemData.tags || [],
                warranty: itemData.warranty,
                video_id: itemData.video_id,
                date_created: itemData.date_created,
                last_updated: itemData.last_updated,
                start_time: itemData.start_time,
                stop_time: itemData.stop_time
            };

        } catch (error: any) {
            const status = error?.response?.status;
            const msg = (error?.response?.data && (error.response.data.message || error.response.data.error)) || error?.message || 'Erro desconhecido';
            const e: any = new Error(`Não foi possível analisar o produto ${mlbId}: ${msg}`);
            e.status = status;
            throw e;
        }
    }

    /**
     * Calcula score de qualidade do anúncio (0-100)
     */
    calculateQualityScore(productData: MLBAnalysisData): MLBQualityScore {
        const breakdown = {
            title_seo: this.scoreTitleSEO(productData),
            technical_sheet: this.scoreTechnicalSheet(productData),
            images_quality: this.scoreImagesQuality(productData),
            keywords_density: this.scoreKeywordsDensity(productData),
            model_optimization: this.scoreModelOptimization(productData),
            description_quality: this.scoreDescriptionQuality(productData),
            category_relevance: this.scoreCategoryRelevance(productData),
            pricing_strategy: this.scorePricingStrategy(productData),
            shipping_optimization: this.scoreShippingOptimization(productData),
            variations_usage: this.scoreVariationsUsage(productData)
        };

        // Calcular score geral (média ponderada)
        const weights = {
            title_seo: 0.20,          // 20% - muito importante
            technical_sheet: 0.15,    // 15% - importante
            images_quality: 0.10,     // 10% - importante
            keywords_density: 0.15,   // 15% - muito importante
            model_optimization: 0.10, // 10% - importante
            description_quality: 0.10, // 10% - importante
            category_relevance: 0.05, // 5% - menos crítico
            pricing_strategy: 0.05,   // 5% - menos crítico
            shipping_optimization: 0.05, // 5% - menos crítico
            variations_usage: 0.05    // 5% - menos crítico
        };

        const overall_score = Math.round(
            Object.entries(breakdown).reduce((sum, [key, score]) => {
                return sum + (score * weights[key as keyof typeof weights]);
            }, 0)
        );

        // Gerar alertas baseados no score
        const alerts = this.generateAlerts(breakdown, productData);

        // Gerar sugestões de melhoria
        const suggestions = this.generateSuggestions(breakdown, productData);

        return {
            overall_score,
            breakdown,
            alerts,
            suggestions
        };
    }

    /**
     * Score do SEO do título (0-100)
     */
    private scoreTitleSEO(productData: MLBAnalysisData): number {
        let score = 0;
        const title = productData.title;

        // Comprimento do título (20-60 caracteres é ideal)
        const length = title.length;
        if (length >= 20 && length <= 60) {
            score += 25;
        } else if (length >= 15 && length <= 80) {
            score += 15;
        } else {
            score += 5;
        }

        // Uso de palavras-chave importantes
        const categoryName = this.extractCategoryKeywordsFromData(productData);
        if (categoryName.some(keyword => title.toLowerCase().includes(keyword.toLowerCase()))) {
            score += 20;
        }

        // Presença de atributos importantes no título
        const importantAttributes = this.getImportantAttributes(productData.attributes);
        const attributesInTitle = importantAttributes.filter(attr =>
            title.toLowerCase().includes(attr.toLowerCase())
        );
        score += Math.min(15, attributesInTitle.length * 5);

        // Estrutura do título
        if (title.includes(' - ') || title.includes(' | ')) score += 10; // Separadores
        if (/\d/.test(title)) score += 5; // Números (tamanhos, medidas)
        if (title.includes('"') || title.includes('pol')) score += 5; // Medidas em polegadas

        // Penalizações
        if (title.toUpperCase() === title) score -= 20; // Tudo maiúsculo
        if (title.includes('!!!') || title.includes('***')) score -= 10; // Excesso de símbolos
        if (title.length > 100) score -= 15; // Muito longo

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da ficha técnica (0-100)
     */
    private scoreTechnicalSheet(productData: MLBAnalysisData): number {
        const attributes = productData.attributes || [];
        let score = 0;

        // Número de atributos preenchidos
        const filledAttributes = attributes.filter(attr =>
            attr.value_name || (attr.values && attr.values.length > 0)
        );

        if (filledAttributes.length >= 10) score += 40;
        else if (filledAttributes.length >= 5) score += 25;
        else if (filledAttributes.length >= 2) score += 15;
        else score += 5;

        // Qualidade dos atributos
        const importantAttributeIds = ['BRAND', 'MODEL', 'COLOR', 'SIZE', 'MATERIAL', 'WEIGHT', 'DIMENSIONS'];
        const hasImportantAttributes = importantAttributeIds.filter(id =>
            attributes.some(attr => attr.id === id && (attr.value_name || attr.values?.length))
        );

        score += hasImportantAttributes.length * 8;

        // Atributos específicos de qualidade
        const hasGTIN = attributes.some(attr => attr.id === 'GTIN' && attr.value_name);
        if (hasGTIN) score += 10;

        const hasBrand = attributes.some(attr => attr.id === 'BRAND' && attr.value_name);
        if (hasBrand) score += 15;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da qualidade das imagens (0-100)
     */
    private scoreImagesQuality(productData: MLBAnalysisData): number {
        const pictures = productData.pictures || [];
        let score = 0;

        // Número de imagens
        if (pictures.length >= 8) score += 30;
        else if (pictures.length >= 5) score += 20;
        else if (pictures.length >= 3) score += 10;
        else if (pictures.length >= 1) score += 5;

        // Qualidade das imagens (baseado no tamanho)
        const highQualityImages = pictures.filter(pic => {
            const sizes = pic.max_size?.split('x').map(s => parseInt(s));
            return sizes && sizes[0] >= 800 && sizes[1] >= 800;
        });

        if (highQualityImages.length >= 5) score += 25;
        else if (highQualityImages.length >= 3) score += 15;
        else if (highQualityImages.length >= 1) score += 10;

        // Vídeos/Clips
        if (productData.video_id) score += 20;

        // Variações com imagens
        if (productData.variations?.some(v => v.picture_ids?.length > 0)) {
            score += 15;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da densidade de palavras-chave (0-100)
     */
    private scoreKeywordsDensity(productData: MLBAnalysisData): number {
        let score = 0;
        const title = productData.title.toLowerCase();
        const description = productData.descriptions?.[0]?.plain_text?.toLowerCase() || '';

        // Palavras-chave da categoria
        const categoryKeywords = this.extractCategoryKeywordsFromData(productData);
        const keywordsInTitle = categoryKeywords.filter(kw => title.includes(kw.toLowerCase()));

        score += Math.min(30, keywordsInTitle.length * 10);

        // Densidade no modelo/atributos
        const modelAttribute = productData.attributes.find(attr => attr.id === 'MODEL');
        if (modelAttribute?.value_name) {
            const modelKeywords = modelAttribute.value_name.toLowerCase().split(' ');
            if (modelKeywords.length >= 3) score += 15;
        }

        // Palavras-chave na descrição
        const keywordsInDescription = categoryKeywords.filter(kw => description.includes(kw.toLowerCase()));
        score += Math.min(20, keywordsInDescription.length * 5);

        // Long-tail keywords
        if (title.split(' ').length >= 5) score += 15;
        if (description.split(' ').length >= 50) score += 10;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da otimização do campo modelo (0-100)
     */
    private scoreModelOptimization(productData: MLBAnalysisData): number {
        const modelAttribute = productData.attributes.find(attr => attr.id === 'MODEL');

        if (!modelAttribute?.value_name) return 0;

        let score = 30; // Base por ter o campo preenchido
        const modelValue = modelAttribute.value_name.toLowerCase();

        // Comprimento ideal (10-50 caracteres)
        if (modelValue.length >= 10 && modelValue.length <= 50) score += 25;
        else if (modelValue.length >= 5) score += 15;

        // Palavras descritivas
        const descriptiveWords = ['premium', 'professional', 'deluxe', 'especial', 'plus', 'pro'];
        if (descriptiveWords.some(word => modelValue.includes(word))) score += 15;

        // Números/versões
        if (/\d/.test(modelValue)) score += 10;

        // Palavras-chave relevantes
        const categoryKeywords = this.extractCategoryKeywordsFromData(productData);
        const keywordsInModel = categoryKeywords.filter(kw => modelValue.includes(kw.toLowerCase()));
        score += Math.min(20, keywordsInModel.length * 5);

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da qualidade da descrição (0-100)
     */
    private scoreDescriptionQuality(productData: MLBAnalysisData): number {
        const description = productData.descriptions?.[0]?.plain_text || '';

        if (!description.trim()) return 0;

        let score = 20; // Base por ter descrição

        // Verificar formato "Clean" (Nossa estrutura padronizada)
        const hasCleanStructure =
            description.includes('CARACTERÍSTICAS:') &&
            description.includes('GARANTIA:') &&
            description.includes('ACOMPANHA:') &&
            description.includes('ENVIO:');

        if (hasCleanStructure) {
            // Se tiver nossa estrutura, já garante um score alto de base
            score = 80;

            // Bônus adicionais
            const wordCount = description.split(' ').length;
            if (wordCount >= 50) score += 10;

            // Verificar se os campos estão preenchidos (não vazios após o header)
            if (description.split('CARACTERÍSTICAS:')[1]?.trim().length > 10) score += 5;
            if (description.split('ACOMPANHA:')[1]?.trim().length > 5) score += 5;

            return Math.min(100, score);
        }

        // --- Lógica Legada (Fallback para descrições antigas/diferentes) ---

        // Comprimento da descrição
        const wordCount = description.split(' ').length;
        if (wordCount >= 100) score += 25;
        else if (wordCount >= 50) score += 15;
        else if (wordCount >= 20) score += 10;

        // Estrutura da descrição
        if (description.includes('•') || description.includes('-') || description.includes('*')) score += 15; // Bullet points
        if (description.includes('\n') && description.split('\n').length >= 3) score += 10; // Parágrafos

        // Palavras-chave na descrição
        const categoryKeywords = this.extractCategoryKeywordsFromData(productData);
        const keywordsInDescription = categoryKeywords.filter(kw =>
            description.toLowerCase().includes(kw.toLowerCase())
        );
        score += Math.min(20, keywordsInDescription.length * 3);

        // Informações úteis
        if (description.toLowerCase().includes('garantia')) score += 5;
        if (description.toLowerCase().includes('entrega') || description.toLowerCase().includes('envio')) score += 5;
        if (/\d+\s*(cm|mm|m|kg|g|pol)/.test(description.toLowerCase())) score += 5; // Medidas

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da relevância da categoria (0-100)
     */
    private scoreCategoryRelevance(productData: MLBAnalysisData): number {
        // Por enquanto, assumimos que a categoria está correta
        // Em uma implementação mais avançada, poderíamos usar ML para verificar
        return 80; // Score base alto
    }

    /**
     * Score da estratégia de preço (0-100)
     */
    private scorePricingStrategy(productData: MLBAnalysisData): number {
        let score = 50; // Score base

        // Preço original vs preço atual
        if (productData.original_price && productData.original_price > productData.price) {
            score += 20; // Desconto aplicado
        }

        // Frete grátis
        if (productData.shipping?.free_shipping) {
            score += 15;
        }

        // Quantidade disponível
        if (productData.available_quantity > 0) {
            score += 15;
        } else {
            score -= 30; // Sem estoque é crítico
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da otimização de envio (0-100)
     */
    private scoreShippingOptimization(productData: MLBAnalysisData): number {
        let score = 0;
        const shipping = productData.shipping;

        if (!shipping) return 30; // Score base baixo

        // Frete grátis
        if (shipping.free_shipping) score += 40;

        // Modo de envio
        if (shipping.mode === 'me2') score += 20;
        else if (shipping.mode === 'me1') score += 15;

        // Retirada local
        if (shipping.local_pick_up) score += 10;

        // Dimensões configuradas
        if (shipping.dimensions) score += 15;

        // Tags de envio
        if (shipping.tags?.includes('fulfillment')) score += 15;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score do uso de variações (0-100)
     */
    private scoreVariationsUsage(productData: MLBAnalysisData): number {
        const variations = productData.variations || [];

        if (variations.length === 0) return 70; // Nem sempre é necessário ter variações

        let score = 20; // Base por ter variações

        // Número de variações
        if (variations.length >= 5) score += 25;
        else if (variations.length >= 3) score += 20;
        else if (variations.length >= 2) score += 15;

        // Variações com imagens
        const variationsWithImages = variations.filter(v => v.picture_ids?.length > 0);
        score += Math.min(25, variationsWithImages.length * 5);

        // Estoque nas variações
        const variationsWithStock = variations.filter(v => v.available_quantity > 0);
        score += Math.min(20, (variationsWithStock.length / variations.length) * 20);

        // Vendas nas variações
        const variationsWithSales = variations.filter(v => v.sold_quantity > 0);
        score += Math.min(10, variationsWithSales.length * 2);

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Gera alertas baseados no score
     */
    private generateAlerts(breakdown: any, productData: MLBAnalysisData): Array<any> {
        const alerts = [];

        if (breakdown.title_seo < 60) {
            alerts.push({
                type: 'warning',
                message: 'Título com baixa otimização SEO',
                priority: 'high',
                action: 'Otimize o título com palavras-chave relevantes'
            });
        }

        if (breakdown.technical_sheet < 50) {
            alerts.push({
                type: 'error',
                message: 'Ficha técnica incompleta',
                priority: 'high',
                action: 'Preencha mais atributos do produto'
            });
        }

        if (breakdown.images_quality < 40) {
            alerts.push({
                type: 'warning',
                message: 'Poucas imagens ou baixa qualidade',
                priority: 'medium',
                action: 'Adicione mais imagens em alta resolução'
            });
        }

        if (!productData.video_id) {
            alerts.push({
                type: 'info',
                message: 'Sem clips/vídeos',
                priority: 'medium',
                action: 'Adicione um vídeo do produto para melhorar conversão'
            });
        }

        if (breakdown.keywords_density < 50) {
            alerts.push({
                type: 'warning',
                message: 'Baixa densidade de palavras-chave',
                priority: 'high',
                action: 'Otimize título e descrição com palavras-chave relevantes'
            });
        }

        return alerts;
    }

    /**
     * Gera sugestões de melhoria
     */
    private generateSuggestions(breakdown: any, productData: MLBAnalysisData): Array<any> {
        const suggestions = [];

        if (breakdown.title_seo < 80) {
            suggestions.push({
                category: 'SEO',
                title: 'Otimizar título',
                description: 'Melhore o título com palavras-chave estratégicas e estrutura otimizada',
                impact: 'high',
                difficulty: 'easy'
            });
        }

        if (breakdown.technical_sheet < 70) {
            suggestions.push({
                category: 'Ficha Técnica',
                title: 'Completar atributos',
                description: 'Preencha marca, modelo, dimensões e outros atributos importantes',
                impact: 'high',
                difficulty: 'medium'
            });
        }

        if (breakdown.model_optimization < 60) {
            suggestions.push({
                category: 'Modelo',
                title: 'Otimizar campo modelo',
                description: 'Use o campo modelo para adicionar palavras-chave estratégicas',
                impact: 'medium',
                difficulty: 'easy'
            });
        }

        return suggestions;
    }

    /**
     * Extrai palavras-chave relevantes da categoria
     */
    private extractCategoryKeywordsLegacy(categoryId: string): string[] {
        const categoryMappings: { [key: string]: string[] } = {
            'MLB1276': ['fone', 'headphone', 'audio', 'som'],
            'MLB1051': ['celular', 'smartphone', 'mobile', 'telefone'],
            'MLB1652': ['notebook', 'laptop', 'computador'],
            'MLB1432': ['joia', 'bijuteria', 'acessório']
        };
        return categoryMappings[categoryId] || [];
    }

    private extractCategoryKeywordsFromData(productData: MLBAnalysisData): string[] {
        const path = productData.category_prediction?.path_from_root || [];
        const leaf = String(path[path.length - 1]?.name || '').toLowerCase();
        const set = new Set<string>();
        if (/brinco/.test(leaf)) set.add('brinco');
        if (/anel/.test(leaf)) set.add('anel');
        if (/colar/.test(leaf)) set.add('colar');
        if (/pulseira/.test(leaf)) set.add('pulseira');
        if (set.size === 0) return this.extractCategoryKeywordsLegacy(productData.category_id);
        return Array.from(set);
    }

    /**
     * Extrai atributos importantes do produto
     */
    private getImportantAttributes(attributes: any[]): string[] {
        const importantAttrs = ['BRAND', 'MODEL', 'COLOR', 'SIZE', 'MATERIAL'];

        return attributes
            .filter(attr => importantAttrs.includes(attr.id))
            .map(attr => attr.value_name || '')
            .filter(value => value);
    }
}

export const mlbAnalyzerService = new MLBAnalyzerService();
