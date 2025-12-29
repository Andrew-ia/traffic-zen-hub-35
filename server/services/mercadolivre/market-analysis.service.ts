
import axios from "axios";
import { getPool } from "../../config/database";

const MERCADO_LIVRE_API_BASE = "https://api.mercadolibre.com";
const MAX_COMPETITOR_RESULTS = 1000;
const MAX_COMPETITOR_DETAILS = 60;
const MAX_SELLER_LISTINGS_LOOKUP = 30;
const SELLER_LISTINGS_BATCH = 4;
const DAY_MS = 24 * 60 * 60 * 1000;
const BRAZIL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});
const DEFAULT_HEADERS: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "TrafficPro-ML-MarketAnalysis/1.0",
};

interface MarketProductSummary {
    id: string;
    title: string;
    price: number;
    sold_quantity: number;
    permalink: string;
    thumbnail: string;
    date_created: string | null;
    ad_age_days: number | null;
    sales_per_day: number | null;
    official_store_id: number | null;
    logistic_type: string | null;
    shipping_free_shipping: boolean;
    seller_power_seller_status: string | null;
    seller_id: string | null;
    seller_nickname: string | null;
    seller_reputation_level: string | null;
    seller_transactions: number | null;
    seller_listings: number | null;
}

interface MarketProductStats {
    total_listings: number;
    scanned_listings: number;
    unique_sellers: number;
    official_stores_count: number;
    fulfillment_count: number;
    free_shipping_count: number;
    mercado_lider_count: number;
    created_today_count: number;
    total_revenue: number;
    average_price: number;
    total_sold_quantity: number;
    average_listing_age_days: number | null;
    sample_truncated: boolean;
}

export class MarketAnalysisService {
    
    /**
     * Fetches and saves category hierarchy (Root + Children)
     * @param rootCategoryId e.g. 'MLB3937' (Joias e Bijuterias)
     */
    async syncCategoryHierarchy(rootCategoryId: string) {
        console.log(`[MarketAnalysis] Syncing category hierarchy for ${rootCategoryId}`);
        try {
            const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${rootCategoryId}`, {
                headers: this.buildHeaders(),
            });
            const data = response.data;
            
            const pool = getPool();
            
            // Save Root Category
            await this.saveCategory(data, null);
            
            // Save Children
            if (data.children_categories && data.children_categories.length > 0) {
                console.log(`[MarketAnalysis] Found ${data.children_categories.length} subcategories`);
                for (const child of data.children_categories) {
                    // We need to fetch full details of child to get permalink, picture, etc.
                    // But 'children_categories' usually has id, name, total_items_in_this_category
                    // Let's fetch full details to be sure
                    try {
                        const childResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/categories/${child.id}`, {
                            headers: this.buildHeaders(),
                        });
                        await this.saveCategory(childResp.data, rootCategoryId);
                    } catch (e) {
                        console.error(`[MarketAnalysis] Failed to fetch child category ${child.id}:`, e);
                    }
                }
            }
            
            return data.children_categories || [];
        } catch (error) {
            console.error(`[MarketAnalysis] Failed to sync category ${rootCategoryId}:`, error);
            throw error;
        }
    }
    
    private async saveCategory(data: any, parentId: string | null) {
        const pool = getPool();
        await pool.query(
            `INSERT INTO ml_categories (
                id, name, parent_id, permalink, total_items_in_this_category, 
                path_from_root, children_categories_count, picture, settings, last_updated
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                parent_id = EXCLUDED.parent_id,
                permalink = EXCLUDED.permalink,
                total_items_in_this_category = EXCLUDED.total_items_in_this_category,
                path_from_root = EXCLUDED.path_from_root,
                children_categories_count = EXCLUDED.children_categories_count,
                picture = EXCLUDED.picture,
                settings = EXCLUDED.settings,
                last_updated = NOW()`,
            [
                data.id,
                data.name,
                parentId,
                data.permalink,
                data.total_items_in_this_category,
                JSON.stringify(data.path_from_root),
                data.children_categories ? data.children_categories.length : 0,
                data.picture,
                JSON.stringify(data.settings)
            ]
        );
    }
    
    /**
     * Fetches and saves trends for a category
     */
    async syncTrends(categoryId: string, accessToken?: string) {
        console.log(`[MarketAnalysis] Syncing trends for ${categoryId}`);
        try {
            const headers = this.buildHeaders(accessToken);

            // Mercado Livre Trends API
            const response = await axios.get(`${MERCADO_LIVRE_API_BASE}/trends/MLB/${categoryId}`, { headers });
            const trends = response.data; // Array of { keyword, url }
            
            if (!Array.isArray(trends)) return [];
            
            const pool = getPool();
            
            // Optional: Clear old trends for this category to keep only fresh ones?
            // Or just append? User said "save trends", usually implies keeping history.
            // But for "Top Trends" usually we want the current snapshot.
            // My table has `captured_at`. I'll just insert new ones.
            
            for (let i = 0; i < trends.length; i++) {
                const trend = trends[i];
                await pool.query(
                    `INSERT INTO ml_trends (
                        category_id, keyword, url, position, captured_at
                    ) VALUES ($1, $2, $3, $4, NOW())`,
                    [categoryId, trend.keyword, trend.url, i + 1]
                );
            }
            
            return trends;
        } catch (error) {
            console.error(`[MarketAnalysis] Failed to sync trends for ${categoryId}:`, error);
            // Don't throw, just return empty so process can continue
            return [];
        }
    }
    
    /**
     * Fetches and saves top selling products for a category
     */
    async syncTopProducts(categoryId: string, limit = 20, accessToken?: string) {
        console.log(`[MarketAnalysis] Syncing top products for ${categoryId}`);
        try {
            // Strategy: Use Search API with sort=sold_quantity_desc
            // If accessToken is provided, use it.
            
            let searchUrl = `${MERCADO_LIVRE_API_BASE}/sites/MLB/search?category=${categoryId}&sort=sold_quantity_desc&limit=${limit}`;
            const headers = this.buildHeaders(accessToken);

            let response;
            try {
                response = await axios.get(searchUrl, { headers });
            } catch (err: any) {
                // If 403 Forbidden (common for public sort=sold_quantity_desc), fallback to relevance
                if (err.response?.status === 403) {
                    console.warn(`[MarketAnalysis] Sort by sold_quantity forbidden for ${categoryId}, falling back to relevance.`);
                    searchUrl = `${MERCADO_LIVRE_API_BASE}/sites/MLB/search?category=${categoryId}&limit=${limit}`;
                    response = await axios.get(searchUrl, { headers });
                } else {
                    throw err;
                }
            }

            const results = response.data.results || [];
            
            const savedProducts = [];
            
            for (const item of results) {
                // We need more details (date_created) which usually comes in /items/{id}
                try {
                    const itemDetailResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${item.id}`, { headers });
                    const fullItem = itemDetailResp.data;
                    
                    await this.saveProduct(fullItem);
                    savedProducts.push(fullItem);
                } catch (e) {
                    console.error(`[MarketAnalysis] Failed to fetch details for item ${item.id}:`, e);
                }
            }
            
            return savedProducts;
        } catch (error) {
            console.error(`[MarketAnalysis] Failed to sync top products for ${categoryId}:`, error);
            return [];
        }
    }
    
    private async saveProduct(item: any) {
        const pool = getPool();
        
        await pool.query(
            `INSERT INTO ml_products (
                id, title, price, original_price, currency_id,
                sold_quantity, available_quantity, permalink, thumbnail,
                condition, listing_type_id, accepts_mercadopago,
                seller_id, seller_nickname, seller_reputation_level_id,
                category_id, stop_time, date_created, last_updated,
                status, catalog_product_id, attributes,
                shipping_free_shipping, logistic_type, official_store_id, seller_power_seller_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), $19, $20, $21, $22, $23, $24, $25)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                price = EXCLUDED.price,
                original_price = EXCLUDED.original_price,
                sold_quantity = EXCLUDED.sold_quantity,
                available_quantity = EXCLUDED.available_quantity,
                permalink = EXCLUDED.permalink,
                thumbnail = EXCLUDED.thumbnail,
                status = EXCLUDED.status,
                last_updated = NOW(),
                shipping_free_shipping = EXCLUDED.shipping_free_shipping,
                logistic_type = EXCLUDED.logistic_type,
                official_store_id = EXCLUDED.official_store_id,
                seller_power_seller_status = EXCLUDED.seller_power_seller_status`,
            [
                item.id,
                item.title,
                item.price,
                item.original_price,
                item.currency_id,
                item.sold_quantity,
                item.available_quantity,
                item.permalink,
                item.thumbnail,
                item.condition,
                item.listing_type_id,
                item.accepts_mercadopago,
                item.seller_id,
                item.seller_address?.nickname, 
                null, 
                item.category_id,
                item.stop_time,
                item.date_created,
                item.status,
                item.catalog_product_id,
                JSON.stringify(item.attributes),
                item.shipping?.free_shipping || false,
                item.shipping?.logistic_type || null,
                item.official_store_id || null,
                item.seller?.power_seller_status || null
            ]
        );
    }

    /**
     * Orchestrates the full analysis for a category
     */
    async performFullCategoryAnalysis(rootCategoryId: string, accessToken?: string) {
        console.log(`[MarketAnalysis] Starting full analysis for ${rootCategoryId}`);
        
        // 1. Sync Categories
        const subcategories = await this.syncCategoryHierarchy(rootCategoryId);
        
        // 2. For each subcategory, sync trends and products
        const results = [];
        
        // Include root category in the list to process
        const categoriesToProcess = [
            { id: rootCategoryId, name: 'Root' },
            ...subcategories
        ];
        
        for (const cat of categoriesToProcess) {
            console.log(`[MarketAnalysis] Processing category: ${cat.id} (${cat.name})`);
            
            // Sync Trends
            await this.syncTrends(cat.id, accessToken);
            
            // Sync Top Products
            const products = await this.syncTopProducts(cat.id, 20, accessToken); // Top 20
            
            results.push({
                categoryId: cat.id,
                productsCount: products.length
            });
            
            // Rate limiting/Courtesy delay
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        return results;
    }

    /**
     * Retrieves the analysis report for a category
     */
    async getCategoryAnalysisReport(categoryId: string) {
        const pool = getPool();

        // Get top profitable products from the category AND its subcategories (recursive)
        // We use path_from_root to find all categories that have the requested category in their path
        // We calculate "sales_per_day" (velocity)
        const productsResult = await pool.query(`
            SELECT 
                p.id, p.title, p.price, p.sold_quantity, p.permalink, p.thumbnail,
                p.date_created,
                EXTRACT(DAY FROM (NOW() - p.date_created)) as ad_age_days,
                (p.sold_quantity::float / GREATEST(EXTRACT(DAY FROM (NOW() - p.date_created)), 1)) as sales_per_day
            FROM ml_products p
            JOIN ml_categories c ON p.category_id = c.id
            WHERE c.path_from_root::jsonb @> $1::jsonb
            AND p.sold_quantity >= 50
            ORDER BY sales_per_day DESC
            LIMIT 100
        `, [JSON.stringify([{ id: categoryId }])]);

        // Get trends
        const trendsResult = await pool.query(`
            SELECT keyword, url, position
            FROM ml_trends
            WHERE category_id = $1
            ORDER BY position ASC
            LIMIT 20
        `, [categoryId]);

        return {
            products: productsResult.rows,
            trends: trendsResult.rows
        };
    }

    /**
     * Retrieves aggregated statistics for a category
     */
    async getCategoryStatistics(categoryId: string) {
        const pool = getPool();
        
        // We use the same recursive logic to include subcategories
        const query = `
            SELECT 
                COUNT(*) as total_listings,
                SUM(CASE WHEN official_store_id IS NOT NULL THEN 1 ELSE 0 END) as official_stores_count,
                SUM(CASE WHEN logistic_type = 'fulfillment' THEN 1 ELSE 0 END) as fulfillment_count,
                SUM(CASE WHEN shipping_free_shipping = true THEN 1 ELSE 0 END) as free_shipping_count,
                SUM(CASE WHEN seller_power_seller_status IN ('platinum', 'gold', 'leader') THEN 1 ELSE 0 END) as mercado_lider_count,
                SUM(CASE WHEN date(date_created) = CURRENT_DATE THEN 1 ELSE 0 END) as created_today_count,
                SUM(price * sold_quantity) as total_revenue,
                AVG(price) as average_price,
                SUM(sold_quantity) as total_sold_quantity
            FROM ml_products p
            JOIN ml_categories c ON p.category_id = c.id
            WHERE c.path_from_root::jsonb @> $1::jsonb
        `;
        
        const result = await pool.query(query, [JSON.stringify([{ id: categoryId }])]);
        return result.rows[0];
    }

    private getBrazilDateKey(date: Date) {
        return BRAZIL_DATE_FORMATTER.format(date);
    }

    private buildHeaders(accessToken?: string) {
        const headers: Record<string, string> = { ...DEFAULT_HEADERS };
        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }
        return headers;
    }

    private normalizeProductId(productId: string) {
        const raw = String(productId || "").trim();
        if (!raw) return "";
        const match = raw.match(/MLB-?(\d+)/i);
        if (match) return `MLB${match[1]}`;
        const numeric = raw.match(/(\d{6,})/);
        if (numeric) return `MLB${numeric[1]}`;
        return raw.toUpperCase();
    }

    private calculateAgeDays(dateCreated: string | null) {
        if (!dateCreated) return null;
        const date = new Date(dateCreated);
        if (Number.isNaN(date.getTime())) return null;
        const diff = Date.now() - date.getTime();
        return Math.max(0, Math.floor(diff / DAY_MS));
    }

    private buildProductSummary(item: any, searchItem?: any): MarketProductSummary {
        const source = searchItem || item || {};
        const sellerFromSearch = source?.seller || {};
        const sellerId = String(sellerFromSearch.id || item?.seller_id || source?.seller_id || "").trim() || null;
        const dateCreated = String(item?.date_created || source?.date_created || "") || null;
        const ageDays = this.calculateAgeDays(dateCreated);
        const soldQuantity = Number(item?.sold_quantity ?? source?.sold_quantity ?? 0);
        const salesPerDay = ageDays !== null ? soldQuantity / Math.max(ageDays, 1) : null;
        const logisticType = String(
            item?.shipping?.logistic_type ||
            item?.shipping?.mode ||
            source?.shipping?.logistic_type ||
            source?.shipping?.mode ||
            item?.logistic_type ||
            ""
        ) || null;
        const sellerTransactionsRaw = sellerFromSearch?.seller_reputation?.transactions?.total;
        const sellerTransactions = sellerTransactionsRaw !== undefined && sellerTransactionsRaw !== null
            ? Number(sellerTransactionsRaw)
            : null;

        return {
            id: String(item?.id || source?.id || ""),
            title: String(item?.title || source?.title || ""),
            price: Number(item?.price ?? source?.price ?? 0),
            sold_quantity: soldQuantity,
            permalink: String(item?.permalink || source?.permalink || ""),
            thumbnail: String(item?.thumbnail || source?.thumbnail || ""),
            date_created: dateCreated,
            ad_age_days: ageDays,
            sales_per_day: salesPerDay,
            official_store_id: Number(item?.official_store_id ?? source?.official_store_id ?? 0) || null,
            logistic_type: logisticType,
            shipping_free_shipping: Boolean(
                item?.shipping?.free_shipping ??
                source?.shipping?.free_shipping ??
                false
            ),
            seller_power_seller_status: String(
                sellerFromSearch?.seller_reputation?.power_seller_status ||
                sellerFromSearch?.power_seller_status ||
                ""
            ) || null,
            seller_id: sellerId,
            seller_nickname: String(sellerFromSearch?.nickname || "") || null,
            seller_reputation_level: String(sellerFromSearch?.seller_reputation?.level_id || "") || null,
            seller_transactions: sellerTransactions,
            seller_listings: null,
        };
    }

    private async fetchSearchResults(params: Record<string, any>, headers: Record<string, string>) {
        const limit = 50;
        let offset = 0;
        let total = 0;
        const results: any[] = [];

        while (offset < MAX_COMPETITOR_RESULTS) {
            const resp = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
                params: { ...params, limit, offset },
                headers,
            });
            const data = resp.data || {};
            const pageResults = Array.isArray(data.results) ? data.results : [];
            if (!total) total = Number(data.paging?.total || pageResults.length || 0);
            results.push(...pageResults);

            if (pageResults.length < limit) break;
            if (results.length >= Math.min(total || MAX_COMPETITOR_RESULTS, MAX_COMPETITOR_RESULTS)) break;
            offset += limit;
        }

        const clippedResults = results.slice(0, MAX_COMPETITOR_RESULTS);
        return {
            results: clippedResults,
            total: total || clippedResults.length,
            truncated: total > clippedResults.length,
        };
    }

    private async fetchSellerListingsCount(
        sellerIds: string[],
        headers: Record<string, string>
    ): Promise<Map<string, number>> {
        const sellerMap = new Map<string, number>();
        const ids = sellerIds.filter(Boolean).slice(0, MAX_SELLER_LISTINGS_LOOKUP);
        for (let i = 0; i < ids.length; i += SELLER_LISTINGS_BATCH) {
            const batch = ids.slice(i, i + SELLER_LISTINGS_BATCH);
            const results = await Promise.all(
                batch.map(async (sellerId) => {
                    try {
                        const resp = await axios.get(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`, {
                            params: { seller_id: sellerId, limit: 1 },
                            headers,
                        });
                        const total = Number(resp.data?.paging?.total || 0);
                        return { sellerId, total };
                    } catch (error) {
                        console.warn(`[MarketAnalysis] Falha ao buscar anuncios do vendedor ${sellerId}:`, (error as any)?.message || error);
                        return { sellerId, total: 0 };
                    }
                })
            );
            results.forEach((entry) => sellerMap.set(entry.sellerId, entry.total));
        }
        return sellerMap;
    }

    /**
     * Analyzes a specific product and its competitors
     */
    async analyzeProductCompetitors(productId: string, accessToken?: string) {
        const normalizedId = this.normalizeProductId(productId);
        console.log(`[MarketAnalysis] Analyzing product competitors for ${normalizedId}`);
        const headers = this.buildHeaders(accessToken);

        try {
            const itemResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${normalizedId}`, { headers });
            const item = itemResp.data;

            const searchParams: Record<string, any> = {};
            let searchStrategy: "catalog" | "title" = "title";

            if (item.catalog_product_id) {
                searchParams.catalog_product_id = item.catalog_product_id;
                searchStrategy = "catalog";
            } else {
                searchParams.q = item.title;
                searchParams.category = item.category_id;
            }

            const searchData = await this.fetchSearchResults(searchParams, headers);
            const searchResults = searchData.results || [];
            const totalListings = Math.max(searchData.total || searchResults.length || 0, 1);

            const searchMap = new Map<string, any>();
            searchResults.forEach((r: any) => {
                if (r?.id) searchMap.set(String(r.id), r);
            });

            const targetSearchItem = searchMap.get(String(item.id));
            let targetProduct = this.buildProductSummary(item, targetSearchItem);

            if (!targetProduct.seller_nickname && targetProduct.seller_id) {
                try {
                    const sellerResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/users/${targetProduct.seller_id}`, { headers });
                    const seller = sellerResp.data || {};
                    const sellerTransactions = seller.seller_reputation?.transactions?.total;
                    const normalizedSellerTransactions = sellerTransactions !== undefined && sellerTransactions !== null
                        ? Number(sellerTransactions)
                        : targetProduct.seller_transactions;
                    targetProduct = {
                        ...targetProduct,
                        seller_nickname: seller.nickname || targetProduct.seller_nickname,
                        seller_reputation_level: seller.seller_reputation?.level_id || targetProduct.seller_reputation_level,
                        seller_power_seller_status: seller.seller_reputation?.power_seller_status || targetProduct.seller_power_seller_status,
                        seller_transactions: normalizedSellerTransactions ?? null,
                    };
                } catch (error) {
                    console.warn(`[MarketAnalysis] Falha ao buscar vendedor ${targetProduct.seller_id}:`, (error as any)?.message || error);
                }
            }

            const competitorCandidates = searchResults.filter((r: any) => String(r.id) !== String(item.id));
            const competitorSlice = competitorCandidates.slice(0, MAX_COMPETITOR_DETAILS);

            const detailedCompetitors: MarketProductSummary[] = [];
            for (const competitor of competitorSlice) {
                try {
                    const compDetailResp = await axios.get(`${MERCADO_LIVRE_API_BASE}/items/${competitor.id}`, { headers });
                    detailedCompetitors.push(
                        this.buildProductSummary(compDetailResp.data, searchMap.get(String(competitor.id)))
                    );
                } catch (error) {
                    console.warn(`[MarketAnalysis] Falha ao enriquecer item ${competitor.id}:`, (error as any)?.message || error);
                    detailedCompetitors.push(this.buildProductSummary(competitor, competitor));
                }
            }

            const sellerIds = [
                targetProduct.seller_id,
                ...detailedCompetitors.map((c) => c.seller_id),
            ].filter(Boolean) as string[];
            const uniqueSellerIds = Array.from(new Set(sellerIds));
            const sellerListingsMap = await this.fetchSellerListingsCount(uniqueSellerIds, headers);

            const applySellerListings = (product: MarketProductSummary) => ({
                ...product,
                seller_listings: product.seller_id ? (sellerListingsMap.get(product.seller_id) ?? null) : null,
            });

            const enrichedTarget = applySellerListings(targetProduct);
            const enrichedCompetitors = detailedCompetitors
                .map(applySellerListings)
                .sort((a, b) => {
                    const aSales = a.sales_per_day ?? -1;
                    const bSales = b.sales_per_day ?? -1;
                    return bSales - aSales;
                });

            const summaryItems = [
                enrichedTarget,
                ...searchResults
                    .filter((r: any) => String(r.id) !== String(item.id))
                    .map((r: any) => this.buildProductSummary(r, r)),
            ];

            const todayKey = this.getBrazilDateKey(new Date());
            let totalRevenue = 0;
            let totalPrice = 0;
            let priceCount = 0;
            let totalSold = 0;
            let totalAge = 0;
            let ageCount = 0;
            let officialStores = 0;
            let fulfillment = 0;
            let freeShipping = 0;
            let mercadoLider = 0;
            let createdToday = 0;

            const uniqueSellers = new Set<string>();
            summaryItems.forEach((p) => {
                if (p.seller_id) uniqueSellers.add(p.seller_id);
                if (p.official_store_id) officialStores += 1;
                if (p.logistic_type === "fulfillment") fulfillment += 1;
                if (p.shipping_free_shipping) freeShipping += 1;
                if (p.seller_power_seller_status && ["platinum", "gold", "leader"].includes(p.seller_power_seller_status)) {
                    mercadoLider += 1;
                }
                if (p.date_created) {
                    const dateKey = this.getBrazilDateKey(new Date(p.date_created));
                    if (dateKey === todayKey) createdToday += 1;
                }

                totalRevenue += Number(p.price || 0) * Number(p.sold_quantity || 0);
                if (p.price) {
                    totalPrice += Number(p.price);
                    priceCount += 1;
                }
                totalSold += Number(p.sold_quantity || 0);
                if (p.ad_age_days !== null) {
                    totalAge += p.ad_age_days;
                    ageCount += 1;
                }
            });

            const stats: MarketProductStats = {
                total_listings: totalListings,
                scanned_listings: summaryItems.length,
                unique_sellers: uniqueSellers.size,
                official_stores_count: officialStores,
                fulfillment_count: fulfillment,
                free_shipping_count: freeShipping,
                mercado_lider_count: mercadoLider,
                created_today_count: createdToday,
                total_revenue: totalRevenue,
                average_price: priceCount ? totalPrice / priceCount : 0,
                total_sold_quantity: totalSold,
                average_listing_age_days: ageCount ? totalAge / ageCount : null,
                sample_truncated: totalListings > summaryItems.length,
            };

            return {
                targetProduct: enrichedTarget,
                statistics: stats,
                competitors: enrichedCompetitors,
                meta: {
                    search_strategy: searchStrategy,
                    total_listings: totalListings,
                    scanned_listings: summaryItems.length,
                    sample_truncated: totalListings > summaryItems.length,
                },
            };
        } catch (error) {
            console.error(`[MarketAnalysis] Failed to analyze product ${normalizedId}:`, error);
            throw error;
        }
    }
}
