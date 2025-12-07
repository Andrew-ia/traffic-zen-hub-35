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
}

/**
 * Interface para pedido do Mercado Livre
 */
export interface MercadoLivreOrder {
    id: string;
    status: string;
    dateCreated: string | null;
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
    return useQuery({
        queryKey: ["mercadolivre", "orders", workspaceId, options],
        queryFn: async (): Promise<OrdersResponse> => {
            if (!workspaceId) {
                throw new Error("Workspace ID é obrigatório");
            }

            const params = new URLSearchParams({
                workspaceId,
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
        enabled: !!workspaceId,
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
    return useQuery({
        queryKey: ["mercadolivre", "daily-sales", workspaceId, dateFrom, dateTo],
        queryFn: async (): Promise<DailySalesResponse> => {
            if (!workspaceId) {
                throw new Error("Workspace ID é obrigatório");
            }

            const params = new URLSearchParams({
                workspaceId,
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
        enabled: !!workspaceId && !!dateFrom && !!dateTo,
        staleTime: 10 * 60 * 1000, // 10 minutos
        gcTime: 15 * 60 * 1000, // 15 minutos
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });
}
