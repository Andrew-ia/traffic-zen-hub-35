import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Helper para obter headers com autenticação
const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

// Interface para métricas do Mercado Livre
export interface MercadoLivreMetrics {
    totalSales: number;
    totalRevenue: number;
    totalVisits: number;
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
    sales: number;
    visits: number;
    conversionRate: number;
    revenue: number;
    status: "active" | "paused" | "closed";
    category: string;
    stock: number;
    logisticType?: string | null;
    isFull?: boolean;
    shipping?: {
        mode?: string;
        free_shipping?: boolean;
        logistic_type?: string;
        local_pick_up?: boolean;
        dimensions?: string;
    };
    tags?: string[];
    pictures?: Array<{ url: string; id: string }>;
    attributes?: Array<{ name: string; value_name: string }>;
    listing_type_id?: string;
    condition?: string;
}

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
export function useMercadoLivreMetrics(workspaceId: string | null, days: number = 30) {
    return useQuery({
        queryKey: ["mercadolivre", "metrics", workspaceId, days],
        queryFn: async (): Promise<MercadoLivreMetrics> => {
            if (!workspaceId) {
                throw new Error("Workspace ID is required");
            }

            const response = await fetch(
                `/api/integrations/mercadolivre/metrics?workspaceId=${workspaceId}&days=${days}`,
                { headers: getAuthHeaders() }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch Mercado Livre metrics");
            }

            return response.json();
        },
        enabled: !!workspaceId,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
}

/**
 * Hook para buscar produtos do Mercado Livre
 */
export function useMercadoLivreProducts(
    workspaceId: string | null,
    category: string = "all"
) {
    return useQuery({
        queryKey: ["mercadolivre", "products", workspaceId, category],
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
            if (!workspaceId) {
                throw new Error("Workspace ID is required");
            }

            const params = new URLSearchParams({
                workspaceId,
                ...(category !== "all" && { category }),
                page: String(1),
                limit: String(1000), // Buscar até 1000 produtos
            });

            const response = await fetch(
                `/api/integrations/mercadolivre/products?${params}`,
                { headers: getAuthHeaders() }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch Mercado Livre products");
            }

            return response.json();
        },
        enabled: !!workspaceId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useMercadoLivreListings(
    workspaceId: string | null,
    page: number = 1,
    limit: number = 20,
    category: string = "all"
) {
    return useQuery({
        queryKey: ["mercadolivre", "listings", workspaceId, category, page, limit],
        queryFn: async (): Promise<{
            items: MercadoLivreProduct[];
            totalCount: number;
            activeCount: number;
            page: number;
            limit: number;
        }> => {
            if (!workspaceId) {
                throw new Error("Workspace ID is required");
            }

            const params = new URLSearchParams({
                workspaceId,
                ...(category !== "all" && { category }),
                page: String(page),
                limit: String(limit),
            });

            const response = await fetch(`/api/integrations/mercadolivre/products?${params}`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error("Failed to fetch Mercado Livre products");
            }
            return response.json();
        },
        enabled: !!workspaceId,
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
    return useQuery({
        queryKey: ["mercadolivre", "questions", workspaceId, days],
        queryFn: async (): Promise<{
            items: MercadoLivreQuestion[];
            total: number;
            unanswered: number;
        }> => {
            if (!workspaceId) {
                throw new Error("Workspace ID is required");
            }

            const response = await fetch(
                `/api/integrations/mercadolivre/questions?workspaceId=${workspaceId}&days=${days}`,
                { headers: getAuthHeaders() }
            );

            if (!response.ok) {
                throw new Error("Failed to fetch Mercado Livre questions");
            }

            return response.json();
        },
        enabled: !!workspaceId,
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
                throw new Error("Failed to sync Mercado Livre data");
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
                throw new Error("Failed to answer question");
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
                throw new Error("Failed to update product price");
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
                throw new Error("Failed to update product status");
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
