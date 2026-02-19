import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Helper para obter headers com autenticação
const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('trafficpro.auth.token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

/**
 * Hook para verificar status da conexão com Mercado Livre
 */
export function useMercadoLivreAuthStatus(workspaceId: string | null) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;

    return useQuery({
        queryKey: ["mercadolivre", "auth-status", effectiveWorkspaceId],
        queryFn: async (): Promise<{ connected: boolean }> => {
            if (!effectiveWorkspaceId) return { connected: false };
            const response = await fetch(`/api/integrations/mercadolivre/auth/status?workspaceId=${effectiveWorkspaceId}`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) return { connected: false };
            return response.json();
        },
        enabled: !!effectiveWorkspaceId,
        staleTime: 5 * 60 * 1000, // 5 minutos
        retry: false, // Não tentar novamente se falhar a verificação de status
    });
}

// Helper para configuração de retry
export const shouldRetry = (failureCount: number, error: Error) => {
    const message = error.message.toLowerCase();
    // Não tentar novamente para erros de autenticação ou configuração
    if (message.includes("401") || message.includes("403") || message.includes("ml_not_connected") || message.includes("workspace id is required")) {
        return false;
    }
    // Limite padrão para outros erros
    return failureCount < 2;
};

// Interface para métricas do Mercado Livre
export interface MercadoLivreMetrics {
    totalSales: number;
    totalBuyers?: number;
    totalBuyersToday?: number;
    totalOrders?: number;
    canceledOrders?: number;
    canceledRevenue?: number;
    totalRevenue: number;
    totalVisits: number;
    totalSaleFees?: number;
    totalShippingCosts?: number;
    totalNetIncome?: number;
    averageUnitPrice?: number;
    averageOrderPrice?: number;
    conversionRate: number;
    responseRate: number;
    reputation: string;
    reputationMetrics?: {
        level: string;
        color: string;
        claimsRate: number;
        delayedHandlingRate: number;
        cancellationsRate: number;
    };
    salesTrend?: number;
    revenueTrend?: number;
    visitsTrend?: number;
    lastSync?: string;
    sellerId?: string;
    salesTimeSeries?: Array<{
        date: string;
        sales: number;
        revenue: number;
        visits: number;
    }>;
    hourlySales?: Array<{
        date: string;
        sales: number;
        revenue: number;
    }>;
    alerts?: Array<{
        title: string;
        message: string;
        severity: "info" | "warning" | "error";
    }>;
}

export interface MercadoLivreGrowthMetricComparison {
    current: number;
    previous: number;
    delta: number;
    deltaPct: number | null;
}

export interface MercadoLivreGrowthItem {
    ml_item_id: string;
    sku?: string | null;
    title?: string | null;
    visits: number;
    units: number;
    revenue: number;
    conversion: number | null;
    prevVisits?: number;
    prevConversion?: number | null;
}

export interface MercadoLivreSkuPlan {
    ml_item_id: string;
    sku?: string | null;
    title?: string | null;
    visits: number;
    units: number;
    revenue: number;
    conversion: number | null;
    prevVisits?: number;
    prevConversion?: number | null;
    price?: number | null;
    stock?: number | null;
    logistic_type?: string | null;
    status?: string | null;
    priority: "A" | "B" | "C" | "D";
    diagnosis: string;
    actions: string[];
    priceTests?: { current: number; t1: number; t2: number; t3: number } | null;
    flags?: string[];
}

export interface MercadoLivreGrowthPeriod {
    days: number;
    range: { from: string; to: string; previousFrom: string; previousTo: string };
    summary: {
        revenue: MercadoLivreGrowthMetricComparison;
        orders: MercadoLivreGrowthMetricComparison;
        units: MercadoLivreGrowthMetricComparison;
        visits: MercadoLivreGrowthMetricComparison;
        conversion: MercadoLivreGrowthMetricComparison;
    };
    topVisitDrop: MercadoLivreGrowthItem[];
    topConversionDrop: MercadoLivreGrowthItem[];
    opportunities: MercadoLivreGrowthItem[];
    lowTrafficHighConversion: MercadoLivreGrowthItem[];
}

export interface MercadoLivreGrowthReport {
    generatedAt: string;
    workspaceId: string;
    executiveSummary: {
        headline: string;
        mainCauses: string[];
        metrics: {
            revenue: MercadoLivreGrowthMetricComparison;
            orders: MercadoLivreGrowthMetricComparison;
            visits: MercadoLivreGrowthMetricComparison;
            conversion: MercadoLivreGrowthMetricComparison;
        };
    };
    periods: MercadoLivreGrowthPeriod[];
    ads?: {
        periods: Array<{
            days: number;
            range: { from: string; to: string; previousFrom: string; previousTo: string };
            summary: Record<string, MercadoLivreGrowthMetricComparison>;
        }>;
        leaks: Array<{ ml_item_id: string; title?: string | null; cost: number; sales: number; revenue: number }>;
    };
    actions: Array<{ title: string; impact: "high" | "medium" | "low"; effort: "low" | "medium" | "high"; category: string }>;
    checklist: string[];
    productOpportunityRanking: MercadoLivreGrowthItem[];
    skuPlans: MercadoLivreSkuPlan[];
    notes: string[];
}

// Interface para produtos
export interface MercadoLivreProduct {
    id: string;
    title: string;
    price: number;
    thumbnail?: string;
    permalink?: string;
    description?: string;
    sku?: string;
    variation?: string;
    sales: number;
    visits: number;
    conversionRate: number;
    revenue: number;
    status: "active" | "paused" | "closed";
    category: string;
    stock: number;
    logisticType?: string | null;
    isFull?: boolean;
    warranty?: string;
    warranty_time?: string;
    shipping?: {
        mode?: string;
        free_shipping?: boolean;
        logistic_type?: string;
        local_pick_up?: boolean;
        dimensions?: string;
    };
    tags?: string[];
    pictures?: Array<{ url: string; id: string }>;
    attributes?: Array<{ id?: string; name: string; value_name?: string; value_id?: string }>;
    listing_type_id?: string;
    condition?: string;
    dimensions?: {
        height?: string;
        width?: string;
        length?: string;
        weight?: string;
    };
    color?: string;
    material?: string;
    style?: string;
    length?: string;
    width?: string;
    diameter?: string;
    earring_type?: string;
    has_stones?: string;
    stone_type?: string;
    kit_pieces?: string;
    universal_code?: string;
    fiscal?: {
        ncm?: string;
        origin?: string;
        cfop?: string;
        cst?: string;
        csosn?: string;
        state?: string;
        ean?: string;
        additionalInfo?: string;
    };
}

export interface MercadoLivreFullProduct {
    id: string;
    ml_item_id: string;
    title: string;
    price: number;
    available_quantity: number;
    sold_quantity: number;
    ml_listing_type: string;
    ml_permalink: string;
    images: string; // JSON string or array depending on how it's returned (postgres jsonb comes as object usually)
    status: string;
    ml_logistic_type: string;
    revenue_30d: number;
    sales_30d: number;
    profit_unit: number;
    classification: 'A' | 'B' | 'C' | 'N/A';
    recommendation: string;
    tags: string[];
    ml_tax_rate: number;
    fixed_fee: number;
    last_analyzed_at: string;
    adsActive?: boolean;
}

export interface MercadoLivreAnalyticsTopProduct {
    id: string;
    mlItemId: string;
    title: string;
    price: number;
    sales30d: number;
    revenue30d: number;
    profitUnit: number;
    profit30d: number;
    profitMargin: number;
    costMissing: boolean;
    listingType?: string | null;
    mlPermalink?: string | null;
    status?: string | null;
}

export interface MercadoLivreAnalyticsTopResponse {
    days: number;
    lastSyncedAt: string | null;
    missingCostCount: number;
    topSales: MercadoLivreAnalyticsTopProduct[];
    topProfit: MercadoLivreAnalyticsTopProduct[];
}

export interface MercadoLivrePriceSuggestion {
    id: string;
    workspace_id: string;
    ml_item_id?: string | null;
    title?: string | null;
    current_price?: number | null;
    suggested_price?: number | null;
    currency_id?: string | null;
    status: "new" | "applied" | "dismissed";
    resource?: string | null;
    created_at: string;
    updated_at: string;
    applied_at?: string | null;
    dismissed_at?: string | null;
    applied_price?: number | null;
}

export interface MercadoLivrePriceSuggestionResponse {
    items: MercadoLivrePriceSuggestion[];
    total: number;
}

export interface MercadoLivreRadarProduct {
    id: string;
    title: string;
    price: number;
    sold_quantity?: number;
    permalink?: string;
    thumbnail?: string;
    ad_age_days?: number | null;
    sales_per_day?: number | null;
    official_store_id?: number | null;
    logistic_type?: string | null;
    shipping_free_shipping?: boolean;
    seller_power_seller_status?: string | null;
    seller_id?: string | null;
    seller_nickname?: string | null;
    seller_reputation_level?: string | null;
    seller_transactions?: number | null;
    seller_listings?: number | null;
}

export interface MercadoLivreRadarStats {
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

export interface MercadoLivreCompetitiveRadarResult {
    targetProduct: MercadoLivreRadarProduct;
    statistics: MercadoLivreRadarStats;
    competitors: MercadoLivreRadarProduct[];
    meta?: {
        search_strategy?: string;
        total_listings?: number;
        scanned_listings?: number;
        sample_truncated?: boolean;
    };
}

export interface MercadoLivreChecklistResult {
    mlb_id: string;
    analyzed_at: string;
    product_data: {
        id: string;
        title: string;
        price: number;
        category_id?: string;
        status?: string;
        sold_quantity?: number;
        available_quantity?: number;
        permalink?: string;
        thumbnail?: string;
        shipping?: any;
        tags?: any[];
    };
    quality_score?: {
        overall_score?: number;
        breakdown?: Record<string, number>;
        alerts?: Array<{ message: string }>;
        suggestions?: Array<{ category: string; title: string; description: string; impact: string; difficulty: string }>;
    };
    technical_analysis?: {
        completion_percentage?: number;
        missing_important?: string[];
    };
    technical_sheet_analysis?: any;
    image_analysis?: {
        total_images?: number;
        has_video?: boolean;
        video_status?: string;
        high_quality_images?: number;
        has_variations_images?: boolean;
    };
    competitive_analysis?: any;
    recommendations?: {
        priority_actions?: Array<{ title: string; description?: string; impact?: string; difficulty?: string }>;
        quick_wins?: Array<{ title: string; description?: string; impact?: string; difficulty?: string }>;
        advanced_optimizations?: Array<{ title: string; description?: string; impact?: string; difficulty?: string }>;
    };
    title_optimization?: any;
    seo_description?: any;
}

export const useMercadoLivreFullAnalytics = (workspaceId: string | null) => {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    return useQuery({
        queryKey: ["mercadolivre-full-analytics", effectiveWorkspaceId],
        queryFn: async () => {
            if (!effectiveWorkspaceId) return [];
            const headers = getAuthHeaders();
            const response = await fetch(`/api/integrations/mercadolivre-full-analytics/products`, {
                headers: headers as HeadersInit
            });
            if (!response.ok) {
                throw new Error("Failed to fetch full analytics products");
            }
            return response.json() as Promise<MercadoLivreFullProduct[]>;
        },
        enabled: !!effectiveWorkspaceId,
        retry: shouldRetry,
    });
};

export const useSyncFullAnalytics = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (workspaceId: string) => {
            const headers = getAuthHeaders();
            const response = await fetch(`/api/integrations/mercadolivre-full-analytics/sync-full`, {
                method: "POST",
                headers: headers as HeadersInit
            });
            if (!response.ok) {
                throw new Error("Failed to sync full analytics");
            }
            return response.json();
        },
        onSuccess: (_, workspaceId) => {
            queryClient.invalidateQueries({ queryKey: ["mercadolivre-full-analytics", workspaceId] });
        }
    });
};

// Interface para perguntas
export interface MercadoLivreQuestion {
    id: string;
    text: string;
    productId: string;
    productTitle: string;
    date: string;
    answered: boolean;
    answer?: string;
}

export interface MercadoLivreTrend {
    keyword: string;
    url: string;
}

export interface MercadoLivreCategory {
    id: string;
    name: string;
    children_categories?: Array<{
        id: string;
        name: string;
        total_items_in_this_category?: number;
    }>;
    path_from_root?: Array<{
        id: string;
        name: string;
    }>;
}

/**
 * Hook para buscar detalhes de uma categoria (incluindo subcategorias)
 */
export function useMercadoLivreCategory(workspaceId: string | null, categoryId: string) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "category", effectiveWorkspaceId, categoryId],
        queryFn: async (): Promise<MercadoLivreCategory> => {
            const params = new URLSearchParams();
            if (effectiveWorkspaceId) {
                params.append("workspaceId", effectiveWorkspaceId);
            }

            const response = await fetch(`/api/integrations/mercadolivre/categories/${categoryId}?${params.toString()}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch category (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!categoryId && isConnected,
        retry: shouldRetry,
        staleTime: 60 * 60 * 1000, // 1 hora
    });
}

/**
 * Hook para buscar tendências de uma categoria
 */
export function useMercadoLivreTrends(workspaceId: string | null, categoryId: string) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "trends", effectiveWorkspaceId, categoryId],
        queryFn: async (): Promise<MercadoLivreTrend[]> => {
            const params = new URLSearchParams();
            if (effectiveWorkspaceId) {
                params.append("workspaceId", effectiveWorkspaceId);
            }

            const response = await fetch(`/api/integrations/mercadolivre/trends/${categoryId}?${params.toString()}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch trends (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!categoryId && isConnected,
        retry: shouldRetry,
        staleTime: 10 * 60 * 1000, // 10 minutos
    });
}

/**
 * Hook para buscar produtos mais vendidos de uma categoria
 */
export function useMercadoLivreCategoryTopProducts(workspaceId: string | null, categoryId: string) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "category-top-products", effectiveWorkspaceId, categoryId],
        queryFn: async (): Promise<any[]> => {
            const params = new URLSearchParams();
            if (effectiveWorkspaceId) {
                params.append("workspaceId", effectiveWorkspaceId);
            }

            const response = await fetch(`/api/integrations/mercadolivre/category-top-products/${categoryId}?${params.toString()}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch top products (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!categoryId && isConnected,
        retry: shouldRetry,
        staleTime: 10 * 60 * 1000,
    });
}


/**
 * Hook para buscar métricas do Mercado Livre
 */
export function useMercadoLivreMetrics(workspaceId: string | null, days: number = 30, range?: { dateFrom?: string; dateTo?: string }) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "metrics", effectiveWorkspaceId, days, range?.dateFrom, range?.dateTo],
        queryFn: async (): Promise<MercadoLivreMetrics> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID is required");
            }

            const params = new URLSearchParams({
                workspaceId: effectiveWorkspaceId,
                days: String(days),
                ...(range?.dateFrom ? { dateFrom: range.dateFrom } : {}),
                ...(range?.dateTo ? { dateTo: range.dateTo } : {}),
            });

            const response = await fetch(`/api/integrations/mercadolivre/metrics?${params.toString()}`, { headers: getAuthHeaders() });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch Mercado Livre metrics (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId && isConnected,
        retry: shouldRetry,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
}

/**
 * Hook para buscar relatório executivo de growth do Mercado Livre
 */
export function useMercadoLivreGrowthReport(
    workspaceId: string | null,
    options?: { periods?: number[]; topN?: number }
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "growth-report", effectiveWorkspaceId, options?.periods?.join(","), options?.topN],
        queryFn: async (): Promise<MercadoLivreGrowthReport> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID is required");
            }

            const params = new URLSearchParams({ workspaceId: effectiveWorkspaceId });
            if (options?.periods?.length) {
                params.append("periods", options.periods.join(","));
            }
            if (options?.topN) {
                params.append("topN", String(options.topN));
            }

            const response = await fetch(`/api/integrations/mercadolivre/growth-report?${params.toString()}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch growth report (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId && isConnected,
        retry: shouldRetry,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Hook para buscar produtos do Mercado Livre
 */
export function useMercadoLivreProducts(
    workspaceId: string | null,
    category: string = "all",
    search: string = ""
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "products", effectiveWorkspaceId, category, search],
        queryFn: async (): Promise<{
            items: MercadoLivreProduct[];
            totalCount: number;
            activeCount: number;
            counts?: {
                active: number;
                full: number;
                normal: number;
            };
            stock?: {
                full: number;
                normal: number;
                total: number;
            };
            page?: number;
            limit?: number;
        }> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID is required");
            }

            const params = new URLSearchParams({
                workspaceId: effectiveWorkspaceId,
                ...(category !== "all" && { category }),
                ...(search && { search }),
                page: String(1),
                limit: String(1000), // Buscar até 1000 produtos
            });

            const response = await fetch(
                `/api/integrations/mercadolivre/products?${params}`,
                { headers: getAuthHeaders() }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch Mercado Livre products (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId && isConnected,
        retry: shouldRetry,
        staleTime: 5 * 60 * 1000,
    });
}

export function useMercadoLivreListings(
    workspaceId: string | null,
    page: number = 1,
    limit: number = 20,
    category: string = "all"
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "listings", effectiveWorkspaceId, category, page, limit],
        queryFn: async (): Promise<{
            items: MercadoLivreProduct[];
            totalCount: number;
            activeCount: number;
            page: number;
            limit: number;
        }> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID is required");
            }

            const params = new URLSearchParams({
                workspaceId: effectiveWorkspaceId,
                ...(category !== "all" && { category }),
                page: String(page),
                limit: String(limit),
            });

            const response = await fetch(`/api/integrations/mercadolivre/products?${params}`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch Mercado Livre products (HTTP ${response.status})`;
                throw new Error(message);
            }
            return response.json();
        },
        enabled: !!effectiveWorkspaceId && isConnected,
        retry: shouldRetry,
        staleTime: 2 * 60 * 1000,
    });
}

/**
 * Hook para buscar perguntas do Mercado Livre
 */
export function useMercadoLivreQuestions(
    workspaceId: string | null,
    days: number = 30
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "questions", effectiveWorkspaceId, days],
        queryFn: async (): Promise<{
            items: MercadoLivreQuestion[];
            total: number;
            unanswered: number;
        }> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID is required");
            }

            const response = await fetch(
                `/api/integrations/mercadolivre/questions?workspaceId=${effectiveWorkspaceId}&days=${days}`,
                { headers: getAuthHeaders() }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch Mercado Livre questions (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId && isConnected,
        retry: shouldRetry,
        staleTime: 2 * 60 * 1000, // 2 minutos (perguntas precisam de atualização mais frequente)
    });
}

/**
 * Hook para atualizar preço de produto no Mercado Livre
 */
export function useUpdateMercadoLivrePrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { workspaceId: string; productId: string; price: number }) => {
            const response = await fetch(
                `/api/integrations/mercadolivre/products/${payload.productId}/price`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        workspaceId: payload.workspaceId,
                        price: payload.price,
                    }),
                }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to update price (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        onSuccess: (_, payload) => {
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "products", payload.workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "growth-report", payload.workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "analytics-top", payload.workspaceId] });
        },
    });
}

/**
 * Hook para sincronizar dados do Mercado Livre
 */
export function useSyncMercadoLivre() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (workspaceId: string) => {
            const response = await fetch(
                `/api/integrations/mercadolivre/sync`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ workspaceId }),
                }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to sync Mercado Livre data (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        onSuccess: (_, workspaceId) => {
            // Invalidate all queries related to Mercado Livre
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "metrics", workspaceId],
            });
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "products", workspaceId],
            });
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "questions", workspaceId],
            });
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "growth-report", workspaceId],
            });
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "analytics-top", workspaceId],
            });
        },
    });
}

/**
 * Hook para sincronizar analytics 30d (pedidos + lucro)
 */
export function useSyncMercadoLivreAnalytics() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (workspaceId: string) => {
            const response = await fetch(
                `/api/integrations/mercadolivre/analytics/sync`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ workspaceId, days: 30 }),
                }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to sync analytics (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        onSuccess: (_, workspaceId) => {
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "analytics-top", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["mercado-ads", "preview", workspaceId] });
            queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns", workspaceId] });
        },
    });
}

/**
 * Hook para buscar top vendidos e top lucro (30d) no banco
 */
export function useMercadoLivreAnalyticsTop(workspaceId: string | null) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: ["mercadolivre", "analytics-top", effectiveWorkspaceId],
        queryFn: async (): Promise<MercadoLivreAnalyticsTopResponse> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID is required");
            }
            const response = await fetch(
                `/api/integrations/mercadolivre/analytics/top?workspaceId=${effectiveWorkspaceId}`,
                { headers: getAuthHeaders() }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch analytics (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId && isConnected,
        retry: shouldRetry,
        staleTime: 2 * 60 * 1000,
    });
}

/**
 * Hook para responder uma pergunta no Mercado Livre
 */
export function useAnswerMercadoLivreQuestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            questionId,
            answer,
            workspaceId,
        }: {
            questionId: string;
            answer: string;
            workspaceId: string;
        }) => {
            const response = await fetch(
                `/api/integrations/mercadolivre/questions/${questionId}/answer`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ answer, workspaceId }),
                }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to answer question (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "questions", variables.workspaceId],
            });
        },
    });
}

/**
 * Hook para atualizar preço de um produto
 */
export function useUpdateMercadoLivreProductPrice() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            productId,
            price,
            workspaceId,
        }: {
            productId: string;
            price: number;
            workspaceId: string;
        }) => {
            const response = await fetch(
                `/api/integrations/mercadolivre/products/${productId}/price`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ price, workspaceId }),
                }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to update product price (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "products", variables.workspaceId],
            });
        },
    });
}

/**
 * Hook para pausar/ativar um produto
 */
export function useToggleMercadoLivreProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            productId,
            status,
            workspaceId,
        }: {
            productId: string;
            status: "active" | "paused";
            workspaceId: string;
        }) => {
            const response = await fetch(
                `/api/integrations/mercadolivre/products/${productId}/status`,
                {
                    method: "PUT",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status, workspaceId }),
                }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to update product status (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ["mercadolivre", "products", variables.workspaceId],
            });
        },
    });
}

/**
 * Hook para busca avançada de anúncios no Mercado Livre
 */
export function useMercadoLivreAdvancedSearch(
    workspaceId: string | null,
    params: {
        categoryId: string;
        subcategoryId?: string | null;
        periodDays?: number;
        minMonthlySales?: number;
        maxMonthlySales?: number;
        limit?: number;
        offset?: number;
    }
) {
    const {
        categoryId,
        subcategoryId = null,
        periodDays = 30,
        minMonthlySales,
        maxMonthlySales,
        limit = 50,
        offset = 0,
    } = params;

    const { data: authStatus } = useMercadoLivreAuthStatus(workspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: [
            "mercadolivre",
            "advanced-search",
            workspaceId,
            categoryId,
            subcategoryId,
            periodDays,
            minMonthlySales,
            maxMonthlySales,
            limit,
            offset,
        ],
        queryFn: async (): Promise<{
            items: Array<
                MercadoLivreProduct & {
                    sold_quantity?: number;
                    monthly_estimate?: number;
                    visits_last_period?: number;
                    conversion_rate_estimate?: number;
                }
            >;
            summary: {
                total_found: number;
                total_returned: number;
                average_price: number;
                total_visits_last_period: number;
                period_days: number;
                category: string;
                filters: { minMonthlySales?: number; maxMonthlySales?: number };
            };
        }> => {
            if (!workspaceId) {
                throw new Error("Workspace ID is required");
            }
            if (!categoryId) {
                throw new Error("Category ID is required");
            }

            const q = new URLSearchParams({
                workspaceId,
                categoryId,
                ...(subcategoryId ? { subcategoryId } : {}),
                periodDays: String(periodDays),
                limit: String(limit),
                offset: String(offset),
                ...(typeof minMonthlySales === "number" ? { minMonthlySales: String(minMonthlySales) } : {}),
                ...(typeof maxMonthlySales === "number" ? { maxMonthlySales: String(maxMonthlySales) } : {}),
            });

            const response = await fetch(`/api/integrations/mercadolivre/search/advanced?${q.toString()}`, {
                headers: getAuthHeaders(),
            });
            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore parse errors */ }
                const message = details?.error || details?.message || `Failed to run advanced ML search (HTTP ${response.status})`;
                throw new Error(message);
            }
            return response.json();
        },
        enabled: !!workspaceId && !!categoryId && isConnected,
        retry: shouldRetry,
        staleTime: 30 * 60 * 1000,
    });
}

/**
 * Hook para listar sugestões de preço recebidas via webhook
 */
export function useMercadoLivrePriceSuggestions(
    workspaceId: string | null,
    options?: { status?: string; limit?: number; offset?: number }
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    const { data: authStatus } = useMercadoLivreAuthStatus(effectiveWorkspaceId);
    const isConnected = authStatus?.connected ?? false;

    return useQuery({
        queryKey: [
            "mercadolivre",
            "price-suggestions",
            effectiveWorkspaceId,
            options?.status || "new",
            options?.limit || 50,
            options?.offset || 0,
        ],
        queryFn: async (): Promise<MercadoLivrePriceSuggestionResponse> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID is required");
            }

            const params = new URLSearchParams({
                workspaceId: effectiveWorkspaceId,
                status: options?.status || "new",
                limit: String(options?.limit ?? 50),
                offset: String(options?.offset ?? 0),
            });

            const response = await fetch(`/api/integrations/mercadolivre/price-suggestions?${params.toString()}`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to fetch price suggestions (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId && isConnected,
        retry: shouldRetry,
        staleTime: 2 * 60 * 1000,
    });
}

/**
 * Hook para atualizar status de sugestão de preço
 */
export function useUpdateMercadoLivrePriceSuggestionStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { workspaceId: string; id: string; status: "new" | "applied" | "dismissed"; appliedPrice?: number | null }) => {
            const response = await fetch(
                `/api/integrations/mercadolivre/price-suggestions/${payload.id}/status`,
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        workspaceId: payload.workspaceId,
                        status: payload.status,
                        appliedPrice: typeof payload.appliedPrice === "number" ? payload.appliedPrice : null,
                    }),
                }
            );

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to update suggestion (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
        onSuccess: (_, payload) => {
            queryClient.invalidateQueries({ queryKey: ["mercadolivre", "price-suggestions", payload.workspaceId] });
        },
    });
}

/**
 * Hook para rodar radar de concorrência (on-demand)
 */
export function useMercadoLivreCompetitiveRadar() {
    return useMutation({
        mutationFn: async (payload: { workspaceId: string; productId: string }): Promise<MercadoLivreCompetitiveRadarResult> => {
            const response = await fetch(`/api/integrations/mercadolivre/analyze-product`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    workspaceId: payload.workspaceId,
                    productId: payload.productId,
                }),
            });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to run competitor radar (HTTP ${response.status})`;
                throw new Error(message);
            }

            const data = await response.json();
            return data?.results || data;
        },
    });
}

/**
 * Hook para checklist diário (análise rápida do anúncio)
 */
export function useMercadoLivreDailyChecklist() {
    return useMutation({
        mutationFn: async (payload: { workspaceId: string; mlbId: string }): Promise<MercadoLivreChecklistResult> => {
            const response = await fetch(`/api/integrations/mercadolivre/analyze`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    workspaceId: payload.workspaceId,
                    mlbId: payload.mlbId,
                }),
            });

            if (!response.ok) {
                let details: any = null;
                try {
                    details = await response.json();
                } catch { /* ignore */ }
                const message = details?.error || details?.message || `Failed to run daily checklist (HTTP ${response.status})`;
                throw new Error(message);
            }

            return response.json();
        },
    });
}
