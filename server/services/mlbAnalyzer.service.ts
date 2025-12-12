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
    description_text?: string;
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

export interface MLBAnalysisResult {
    mlb_id: string;
    product_data: MLBAnalysisData & {
        attributes?: Array<{ id: string; value_id?: string; value_name?: string }>;
        permalink?: string;
        thumbnail?: string;
        description?: string;
        plain_text?: string;
        listing_type_id?: string;
        shipping?: {
            free_shipping?: boolean;
            mode?: string;
        };
    };
    quality_score: MLBQualityScore;
    keyword_analysis: KeywordAnalysis;
    title_optimization: TitleOptimization;
    technical_analysis: {
        total_attributes?: number;
        filled_attributes?: number;
        missing_important?: string[];
        completion_percentage?: number;
    };
    image_analysis: {
        total_images: number;
        has_video?: boolean;
        high_quality_images?: number;
        has_variations_images?: boolean;
    };
    model_optimization?: {
        current_model?: string;
        current_score?: number;
        optimized_models?: Array<{ model: string; score: number }>;
    };
    competitive_analysis: {
        competitive_score?: number;
        price_analysis: {
            current_price: number;
            market_average?: number;
            price_position: 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest';
            optimal_price_range: { min: number; max: number; recommended: number };
        };
        top_competitors?: Array<{
            id: string;
            title: string;
            price: number;
            sold_quantity: number;
            permalink?: string;
            thumbnail?: string;
            seller?: {
                id: string;
                nickname?: string;
                reputation_level?: string;
                transactions?: number;
            };
            shipping?: {
                free_shipping?: boolean;
                mode?: string;
            };
            attributes?: Array<{ id: string; value_name?: string }>;
            score?: { overall?: number };
        }>;
        market_position?: 'leader' | 'strong' | 'average' | 'weak';
    };
    seo_description?: {
        optimized_description: string;
        structure?: any;
        seo_keywords?: string[];
        readability_score?: number;
        call_to_action?: string;
    };
    success?: boolean;
    analyzed_at?: string;
    organic_delivery_prediction?: any;
    recommendations?: any;
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
            let descriptionText: string | undefined = undefined;
            try {
                const descriptionsResponse = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/items/${mlbId}/descriptions`,
                    { headers }
                );
                descriptions = descriptionsResponse.data;
            } catch (error) {
                console.warn(`Não foi possível buscar descrições para ${mlbId}:`, error);
            }
            try {
                const descResp = await axios.get(
                    `${MERCADO_LIVRE_API_BASE}/items/${mlbId}/description`,
                    { headers }
                );
                descriptionText = descResp.data?.plain_text || descResp.data?.text || undefined;
            } catch (error) {
                // Se falhar, tentamos extrair plain_text do array de descriptions
                try {
                    const first = Array.isArray(descriptions) ? descriptions[0] : undefined;
                    if (first?.id) {
                        const descDetail = await axios.get(
                            `${MERCADO_LIVRE_API_BASE}/items/${mlbId}/descriptions/${first.id}`,
                            { headers }
                        );
                        descriptionText = descDetail.data?.plain_text || descDetail.data?.text || undefined;
                    }
                } catch (e) {
                    console.warn(`Não foi possível obter plain_text da descrição para ${mlbId}:`, e);
                }
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
                description_text: descriptionText,
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

        // Calcular score geral (média ponderada) com pesos recalibrados para refletir o que mais importa no ML
        const weights = {
            title_seo: 0.25,             // título tem alto impacto
            technical_sheet: 0.20,       // ficha técnica/atributos
            images_quality: 0.15,        // fotos
            description_quality: 0.10,   // descrição
            keywords_density: 0.10,      // palavras-chave
            category_relevance: 0.05,    // categoria coerente
            shipping_optimization: 0.05, // frete/logística
            pricing_strategy: 0.05,      // preço
            variations_usage: 0.025,     // variações
            model_optimization: 0.025    // modelo/sku
        };

        // Bônus por atender requisitos básicos (evita notas muito baixas quando já está bom)
        const attrCount = Array.isArray(productData.attributes) ? productData.attributes.length : 0;
        const picturesCount = Array.isArray(productData.pictures) ? productData.pictures.length : 0;
        const titleLength = (productData.title || '').length;
        let baselineBoost = 0;
        if (titleLength >= 20 && titleLength <= 60) baselineBoost += 4;
        if (attrCount >= 5) baselineBoost += 4;
        if (picturesCount >= 6) baselineBoost += 4;
        if (productData.shipping?.free_shipping) baselineBoost += 2;

        const weightedScore = Object.entries(breakdown).reduce((sum, [key, score]) => {
            return sum + (score * weights[key as keyof typeof weights]);
        }, 0);
        const overall_score = Math.min(100, Math.round(weightedScore + baselineBoost));

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

        let score = 40; // Base por ter o campo preenchido
        const modelValue = modelAttribute.value_name.toLowerCase();
        const brandValue = productData.attributes.find(attr => attr.id === 'BRAND')?.value_name?.toLowerCase() || '';

        // Comprimento ideal (10-50 caracteres)
        if (modelValue.length >= 10 && modelValue.length <= 60) score += 30;
        else if (modelValue.length >= 5) score += 20;

        // Palavras descritivas
        const descriptiveWords = [
            'premium', 'professional', 'profissional', 'deluxe', 'especial', 'plus', 'pro',
            'diario', 'diário', 'daily', 'pessoal', 'personal', 'uso diario', 'uso diário'
        ];
        if (descriptiveWords.some(word => modelValue.includes(word))) score += 15;

        // Números/versões
        if (/\d/.test(modelValue)) score += 10;

        // Palavras-chave relevantes
        const categoryKeywords = this.extractCategoryKeywordsFromData(productData);
        const keywordsInModel = categoryKeywords.filter(kw => modelValue.includes(kw.toLowerCase()));
        score += Math.min(20, keywordsInModel.length * 5);

        // Presença de marca dentro do modelo
        if (brandValue && modelValue.includes(brandValue)) {
            score += 10;
        }

        // Recompensar modelos com múltiplas palavras
        const wordCount = modelValue.split(/\s+/).filter(Boolean).length;
        if (wordCount >= 3) score += 5;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Score da qualidade da descrição (0-100)
     */
    private scoreDescriptionQuality(productData: MLBAnalysisData): number {
        const description = productData.description_text || productData.descriptions?.[0]?.plain_text || '';

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

    /**
     * Busca produtos top da mesma categoria para análise competitiva inteligente
     */
    async searchTopProducts(categoryId: string, limit: number = 20): Promise<any[]> {
        try {
            const searchUrl = `${MERCADO_LIVRE_API_BASE}/sites/MLB/search`;
            const params = {
                category: categoryId,
                sort: 'sold_quantity_desc', // Produtos mais vendidos
                limit: limit,
                offset: 0
            };

            const response = await axios.get(searchUrl, {
                params,
                headers: { 'User-Agent': 'TrafficPro-MLB-Analyzer/1.0' }
            });

            return response.data.results || [];
        } catch (error) {
            console.error('Erro ao buscar produtos top:', error);
            return [];
        }
    }

    /**
     * Analisa padrões de atributos e títulos dos top produtos
     */
    async analyzeMarketPatterns(categoryId: string, currentProduct: MLBAnalysisData): Promise<{
        common_attributes: Record<string, { values: string[], frequency: number }>,
        title_patterns: { avg_length: number, common_words: string[], structures: string[] },
        price_insights: { avg: number, min: number, max: number, recommended: number }
    }> {
        const topProducts = await this.searchTopProducts(categoryId, 20);

        // Analisar atributos mais usados
        const attributeMap = new Map<string, Map<string, number>>();
        const titleWords = new Map<string, number>();
        let titleLengthSum = 0;
        const prices: number[] = [];

        for (const product of topProducts) {
            // Contar palavras nos títulos
            const words = product.title.toLowerCase().split(/\s+/);
            titleLengthSum += product.title.length;
            words.forEach((word: string) => {
                if (word.length > 3) { // Ignorar palavras muito curtas
                    titleWords.set(word, (titleWords.get(word) || 0) + 1);
                }
            });

            // Analisar preços
            if (product.price) prices.push(product.price);

            // Buscar atributos do produto
            try {
                const itemResponse = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${product.id}`, {
                    headers: { 'User-Agent': 'TrafficPro-MLB-Analyzer/1.0' }
                });

                const attributes = itemResponse.data.attributes || [];
                attributes.forEach((attr: any) => {
                    if (!attributeMap.has(attr.id)) {
                        attributeMap.set(attr.id, new Map());
                    }
                    const valueMap = attributeMap.get(attr.id)!;
                    const valueName = attr.value_name || String(attr.value_id || '');
                    if (valueName) {
                        valueMap.set(valueName, (valueMap.get(valueName) || 0) + 1);
                    }
                });
            } catch (error) {
                // Ignorar erros em produtos individuais
                continue;
            }
        }

        // Processar resultados
        const common_attributes: Record<string, { values: string[], frequency: number }> = {};
        attributeMap.forEach((valueMap, attrId) => {
            const sortedValues = Array.from(valueMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            common_attributes[attrId] = {
                values: sortedValues.map(([value]) => value),
                frequency: sortedValues[0]?.[1] || 0
            };
        });

        // Palavras mais comuns nos títulos
        const commonWords = Array.from(titleWords.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([word]) => word);

        // Análise de preços
        prices.sort((a, b) => a - b);
        const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        const min = prices[0] || 0;
        const max = prices[prices.length - 1] || 0;
        const median = prices[Math.floor(prices.length / 2)] || avg;

        return {
            common_attributes,
            title_patterns: {
                avg_length: Math.round(titleLengthSum / topProducts.length),
                common_words: commonWords,
                structures: [] // Pode ser expandido para detectar padrões estruturais
            },
            price_insights: {
                avg: Math.round(avg),
                min: Math.round(min),
                max: Math.round(max),
                recommended: Math.round(median)
            }
        };
    }

    /**
     * Gera sugestões inteligentes baseadas na análise de mercado
     */
    async generateSmartSuggestions(productData: MLBAnalysisData): Promise<{
        attribute_suggestions: Array<{
            attribute_id: string,
            attribute_name: string,
            suggested_values: string[],
            reason: string,
            priority: 'high' | 'medium' | 'low'
        }>,
        title_suggestions: Array<{
            suggested_title: string,
            reason: string,
            keywords_used: string[]
        }>,
        market_positioning: {
            price_recommendation: string,
            competitive_advantages: string[],
            improvement_areas: string[]
        }
    }> {
        const marketData = await this.analyzeMarketPatterns(productData.category_id, productData);

        // Gerar sugestões de atributos
        const attribute_suggestions = [];
        const currentAttrs = new Map(productData.attributes.map(a => [a.id, a.value_name || a.value_id]));

        for (const [attrId, data] of Object.entries(marketData.common_attributes)) {
            const currentValue = currentAttrs.get(attrId);
            const isHighFrequency = data.frequency > 10; // Mais de 50% dos top produtos usa

            if (!currentValue || !data.values.includes(String(currentValue))) {
                attribute_suggestions.push({
                    attribute_id: attrId,
                    attribute_name: this.getAttributeName(attrId),
                    suggested_values: data.values,
                    reason: isHighFrequency
                        ? `${data.frequency} dos top 20 produtos usam este atributo`
                        : `Atributo usado pelos concorrentes de sucesso`,
                    priority: isHighFrequency ? 'high' as const : 'medium' as const
                });
            }
        }

        // Gerar sugestões de título
        const title_suggestions = [];
        const currentTitle = productData.title.toLowerCase();
        const missingKeywords = marketData.title_patterns.common_words.filter(
            word => !currentTitle.includes(word)
        ).slice(0, 5);

        if (missingKeywords.length > 0) {
            const categoryPath = productData.category_prediction?.path_from_root || [];
            const categoryName = categoryPath[categoryPath.length - 1]?.name || '';

            // Construir título otimizado
            const brandAttr = productData.attributes.find(a => a.id === 'BRAND');
            const colorAttr = productData.attributes.find(a => a.id === 'COLOR' || a.id === 'MAIN_COLOR');
            const materialAttr = productData.attributes.find(a => a.id === 'MATERIAL');

            const titleParts = [
                categoryName,
                materialAttr?.value_name,
                colorAttr?.value_name,
                brandAttr?.value_name,
                ...missingKeywords.slice(0, 2)
            ].filter(Boolean);

            title_suggestions.push({
                suggested_title: titleParts.join(' '),
                reason: 'Inclui palavras-chave dos top produtos da categoria',
                keywords_used: missingKeywords
            });
        }

        // Análise de posicionamento de mercado
        const currentPrice = productData.price;
        const priceInsights = marketData.price_insights;
        let priceRecommendation = '';

        if (currentPrice < priceInsights.avg * 0.7) {
            priceRecommendation = `Seu preço está ${Math.round((1 - currentPrice / priceInsights.avg) * 100)}% abaixo da média (R$ ${priceInsights.avg}). Considere aumentar.`;
        } else if (currentPrice > priceInsights.avg * 1.3) {
            priceRecommendation = `Seu preço está ${Math.round((currentPrice / priceInsights.avg - 1) * 100)}% acima da média (R$ ${priceInsights.avg}). Pode dificultar vendas.`;
        } else {
            priceRecommendation = `Preço competitivo (média: R$ ${priceInsights.avg})`;
        }

        return {
            attribute_suggestions,
            title_suggestions,
            market_positioning: {
                price_recommendation: priceRecommendation,
                competitive_advantages: this.identifyAdvantages(productData, marketData),
                improvement_areas: this.identifyImprovements(productData, marketData)
            }
        };
    }

    private getAttributeName(attrId: string): string {
        const names: Record<string, string> = {
            'BRAND': 'Marca',
            'MODEL': 'Modelo',
            'COLOR': 'Cor',
            'MAIN_COLOR': 'Cor Principal',
            'SIZE': 'Tamanho',
            'MATERIAL': 'Material',
            'GENDER': 'Gênero',
            'STYLE': 'Estilo',
            'FINISH': 'Acabamento',
            'WITH_STONES': 'Com Pedras',
            'STONE_TYPE': 'Tipo de Pedra',
            'CLOSURE': 'Tipo de Fecho',
            'OCCASION': 'Ocasião',
            'WARRANTY_TYPE': 'Garantia',
            'ITEM_CONDITION': 'Estado'
        };
        return names[attrId] || attrId.replace(/_/g, ' ');
    }

    private identifyAdvantages(productData: MLBAnalysisData, marketData: any): string[] {
        const advantages = [];

        if (productData.shipping?.free_shipping) {
            advantages.push('Frete grátis - vantagem competitiva');
        }

        if ((productData.pictures?.length || 0) > 6) {
            advantages.push(`${productData.pictures.length} fotos - acima da média`);
        }

        if (productData.video_id) {
            advantages.push('Possui vídeo do produto');
        }

        const filledAttrs = productData.attributes.filter(a => a.value_name || a.value_id).length;
        if (filledAttrs > 10) {
            advantages.push(`Ficha técnica completa (${filledAttrs} atributos)`);
        }

        return advantages.length > 0 ? advantages : ['Nenhuma vantagem clara identificada'];
    }

    private identifyImprovements(productData: MLBAnalysisData, marketData: any): string[] {
        const improvements = [];

        if (!productData.shipping?.free_shipping) {
            improvements.push('Ativar frete grátis');
        }

        if ((productData.pictures?.length || 0) < 5) {
            improvements.push('Adicionar mais fotos (mínimo 8 recomendado)');
        }

        if (!productData.video_id) {
            improvements.push('Adicionar vídeo do produto');
        }

        const filledAttrs = productData.attributes.filter(a => a.value_name || a.value_id).length;
        if (filledAttrs < 8) {
            improvements.push('Completar mais atributos da ficha técnica');
        }

        if (productData.title.length < 40) {
            improvements.push('Expandir título com mais palavras-chave');
        }

        return improvements;
    }
}

export const mlbAnalyzerService = new MLBAnalyzerService();
