import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Helper para obter headers com autenticação
const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('trafficpro.auth.token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

// Interface para métricas do Mercado Livre
export interface MercadoLivreMetrics {
    totalSales: number;
    totalOrders?: number;
    canceledOrders?: number;
    totalRevenue: number;
    totalVisits: number;
    averageUnitPrice?: number;
    averageOrderPrice?: number;
    conversionRate: number;
    responseRate: number;
    reputation: string;
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
    alerts?: Array<{
        title: string;
        message: string;
        severity: "info" | "warning" | "error";
    }>;
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
    classification: 'A' | 'B' | 'C' | 'D' | 'N/A';
    recommendation: string;
    tags: string[];
    ml_tax_rate: number;
    fixed_fee: number;
    last_analyzed_at: string;
    adsActive?: boolean;
}

export const useMercadoLivreFullAnalytics = (workspaceId: string | null) => {
    return useQuery({
        queryKey: ["mercadolivre-full-analytics", workspaceId],
        queryFn: async () => {
            if (!workspaceId) return [];
            const headers = getAuthHeaders();
            const response = await fetch(`/api/integrations/mercadolivre-full-analytics/products`, {
                headers: headers as HeadersInit
            });
            if (!response.ok) {
                throw new Error("Failed to fetch full analytics products");
            }
            return response.json() as Promise<MercadoLivreFullProduct[]>;
        },
        enabled: !!workspaceId,
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

/**
 * Hook para buscar métricas do Mercado Livre
 */
export function useMercadoLivreMetrics(workspaceId: string | null, days: number = 30, range?: { dateFrom?: string; dateTo?: string }) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
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
        enabled: !!effectiveWorkspaceId,
        staleTime: 5 * 60 * 1000, // 5 minutos
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
        enabled: !!effectiveWorkspaceId,
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
        enabled: !!effectiveWorkspaceId,
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
        enabled: !!effectiveWorkspaceId,
        staleTime: 2 * 60 * 1000, // 2 minutos (perguntas precisam de atualização mais frequente)
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
        },
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
        enabled: !!workspaceId && !!categoryId,
        staleTime: 30 * 60 * 1000,
    });
}
