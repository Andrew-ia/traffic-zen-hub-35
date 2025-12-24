import { useQuery } from "@tanstack/react-query";

/**
 * Interface para item de pedido
 */
export interface OrderItem {
    itemId: string;
    title: string;
    quantity: number;
    unitPrice: number;
    fullUnitPrice: number;
    thumbnail?: string | null;
    permalink?: string | null;
}

/**
 * Interface para pedido do Mercado Livre
 */
export interface MercadoLivreOrder {
    id: string;
    status: string;
    dateCreated: string | null;
    lastUpdated: string | null;
    totalAmount: number;
    paidAmount: number;
    currencyId: string;
    buyerId: string;
    items: OrderItem[];
}

/**
 * Interface para dados de vendas diárias
 */
export interface DailySales {
    date: string;
    sales: number;
    revenue: number;
    orders: number;
}

/**
 * Interface para resposta de pedidos
 */
export interface OrdersResponse {
    orders: MercadoLivreOrder[];
    paging: {
        total: number;
        offset: number;
        limit: number;
    };
}

/**
 * Interface para resposta de vendas diárias
 */
export interface DailySalesResponse {
    dailySales: DailySales[];
    totalOrders: number;
    totalSales: number;
    totalRevenue: number;
}

/**
 * Hook para buscar pedidos do Mercado Livre
 */
export function useMercadoLivreOrders(
    workspaceId: string | null,
    options?: {
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
        offset?: number;
    }
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    return useQuery({
        queryKey: ["mercadolivre", "orders", effectiveWorkspaceId, options],
        queryFn: async (): Promise<OrdersResponse> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID é obrigatório");
            }

            const params = new URLSearchParams({
                workspaceId: effectiveWorkspaceId,
            });

            if (options?.dateFrom) params.append("dateFrom", options.dateFrom);
            if (options?.dateTo) params.append("dateTo", options.dateTo);
            if (options?.limit) params.append("limit", options.limit.toString());
            if (options?.offset) params.append("offset", options.offset.toString());

            const response = await fetch(
                `/api/integrations/mercadolivre/orders?${params}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar pedidos do Mercado Livre");
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
}

/**
 * Hook para buscar vendas diárias agregadas
 */
export function useMercadoLivreDailySales(
    workspaceId: string | null,
    dateFrom?: string,
    dateTo?: string
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;
    return useQuery({
        queryKey: ["mercadolivre", "daily-sales", effectiveWorkspaceId, dateFrom, dateTo],
        queryFn: async (): Promise<DailySalesResponse> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID é obrigatório");
            }

            const params = new URLSearchParams({
                workspaceId: effectiveWorkspaceId,
            });

            if (dateFrom) params.append("dateFrom", dateFrom);
            if (dateTo) params.append("dateTo", dateTo);

            console.log("[useMercadoLivreDailySales] Buscando vendas diárias:", { workspaceId, dateFrom, dateTo });

            const response = await fetch(
                `/api/integrations/mercadolivre/orders/daily-sales?${params}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar vendas diárias do Mercado Livre");
            }

            const data = await response.json();
            console.log("[useMercadoLivreDailySales] Dados recebidos:", data);

            return data;
        },
        enabled: !!effectiveWorkspaceId && !!dateFrom && !!dateTo,
        staleTime: 10 * 60 * 1000, // 10 minutos
        gcTime: 15 * 60 * 1000, // 15 minutos
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
}
