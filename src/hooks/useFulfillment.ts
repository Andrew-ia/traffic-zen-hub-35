import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ReplenishmentItem {
    id: string;
    ml_item_id: string;
    title: string;
    ml_full_stock: number;
    sales_30d: number;
    stock_cover_days: number;
    replenishment_suggestion: number;
    last_replenishment_calc_at: string;
    thumbnail?: string;
}

export interface ReplenishmentResponse {
    items: ReplenishmentItem[];
    count: number;
}

/**
 * Hook para buscar sugestões de reabastecimento
 */
export function useReplenishmentSuggestions(workspaceId: string | null, refresh: boolean = false) {
    return useQuery({
        queryKey: ["fulfillment", "replenishment", workspaceId, refresh],
        queryFn: async (): Promise<ReplenishmentResponse> => {
            if (!workspaceId) {
                throw new Error("Workspace ID é obrigatório");
            }

            const response = await fetch(
                `/api/integrations/mercadolivre-fulfillment/replenishment?workspaceId=${workspaceId}&refresh=${refresh}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar sugestões de reabastecimento");
            }

            return response.json();
        },
        enabled: !!workspaceId,
        refetchOnWindowFocus: false,
    });
}

/**
 * Mutation para recalcular sugestões
 */
export function useUpdateReplenishment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (workspaceId: string) => {
            const response = await fetch(
                `/api/integrations/mercadolivre-fulfillment/replenishment?workspaceId=${workspaceId}&refresh=true`
            );
            if (!response.ok) throw new Error("Falha ao atualizar sugestões");
            return response.json();
        },
        onSuccess: (_, workspaceId) => {
            queryClient.invalidateQueries({ queryKey: ["fulfillment", "replenishment", workspaceId] });
        },
    });
}

// Interface para detalhes de estoque indisponível
export interface UnavailableDetail {
    status: string;
    quantity: number;
    conditions?: string[];
}

// Interface para estoque Full de um produto
export interface FulfillmentStock {
    inventory_id: string;
    total: number;
    available_quantity: number;
    not_available_quantity: number;
    not_available_detail?: UnavailableDetail[];
}

// Interface para operação de estoque
export interface FulfillmentOperation {
    operation_id: string;
    operation_type: string;
    inventory_id: string;
    quantity: number;
    date_created: string;
    external_reference?: string;
    seller_id: string;
}

// Interface para resumo consolidado
export interface FulfillmentSummary {
    totalProducts: number;
    fullProducts: number;
    totalStock: number;
    availableStock: number;
    unavailableStock: number;
    unavailableDetail: {
        damaged: number;
        lost: number;
        withdrawal: number;
        internal_process: number;
        transfer: number;
        noFiscalCoverage: number;
        not_supported: number;
    };
    products: Array<{
        itemId: string;
        inventoryId: string;
        title: string;
        thumbnail: string;
        total: number;
        available: number;
        unavailable: number;
        unavailableDetail: UnavailableDetail[];
    }>;
}

/**
 * Hook para buscar inventory_id de um produto
 */
export function useInventoryId(itemId: string | null, workspaceId: string | null) {
    return useQuery({
        queryKey: ["fulfillment", "inventory", itemId, workspaceId],
        queryFn: async () => {
            if (!itemId || !workspaceId) {
                throw new Error("Item ID e Workspace ID são obrigatórios");
            }

            const response = await fetch(
                `/api/integrations/mercadolivre-fulfillment/inventory/${itemId}?workspaceId=${workspaceId}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar inventory_id");
            }

            return response.json();
        },
        enabled: !!itemId && !!workspaceId,
        staleTime: 60 * 60 * 1000, // 1 hora
    });
}

/**
 * Hook para buscar estoque Full de um produto
 */
export function useFulfillmentStock(
    inventoryId: string | null,
    workspaceId: string | null,
    includeConditions: boolean = false
) {
    return useQuery({
        queryKey: ["fulfillment", "stock", inventoryId, workspaceId, includeConditions],
        queryFn: async (): Promise<FulfillmentStock> => {
            if (!inventoryId || !workspaceId) {
                throw new Error("Inventory ID e Workspace ID são obrigatórios");
            }

            const url = `/api/integrations/mercadolivre-fulfillment/stock/${inventoryId}?workspaceId=${workspaceId}${
                includeConditions ? "&includeConditions=true" : ""
            }`;

            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("Produto não encontrado no fulfillment");
                }
                throw new Error("Falha ao buscar estoque fulfillment");
            }

            return response.json();
        },
        enabled: !!inventoryId && !!workspaceId,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
}

/**
 * Hook para buscar operações de estoque Full (histórico)
 */
export function useFulfillmentOperations(
    inventoryId: string | null,
    workspaceId: string | null,
    options?: {
        dateFrom?: string;
        dateTo?: string;
        type?: string;
        limit?: number;
    }
) {
    return useQuery({
        queryKey: ["fulfillment", "operations", inventoryId, workspaceId, options],
        queryFn: async (): Promise<{ results: FulfillmentOperation[]; scroll?: string }> => {
            if (!inventoryId || !workspaceId) {
                throw new Error("Inventory ID e Workspace ID são obrigatórios");
            }

            const params = new URLSearchParams({
                workspaceId,
                inventoryId,
            });

            if (options?.dateFrom) params.append("dateFrom", options.dateFrom);
            if (options?.dateTo) params.append("dateTo", options.dateTo);
            if (options?.type) params.append("type", options.type);
            if (options?.limit) params.append("limit", options.limit.toString());

            const response = await fetch(
                `/api/integrations/mercadolivre-fulfillment/operations?${params}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar operações de estoque");
            }

            return response.json();
        },
        enabled: !!inventoryId && !!workspaceId,
        staleTime: 5 * 60 * 1000, // 5 minutos
    });
}

/**
 * Hook para buscar detalhes de uma operação específica
 */
export function useFulfillmentOperation(
    operationId: string | null,
    workspaceId: string | null
) {
    return useQuery({
        queryKey: ["fulfillment", "operation", operationId, workspaceId],
        queryFn: async (): Promise<FulfillmentOperation> => {
            if (!operationId || !workspaceId) {
                throw new Error("Operation ID e Workspace ID são obrigatórios");
            }

            const response = await fetch(
                `/api/integrations/mercadolivre-fulfillment/operation/${operationId}?workspaceId=${workspaceId}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar detalhes da operação");
            }

            return response.json();
        },
        enabled: !!operationId && !!workspaceId,
        staleTime: 60 * 60 * 1000, // 1 hora
    });
}

/**
 * Hook para buscar resumo consolidado de estoque Full
 */
export function useFulfillmentSummary(workspaceId: string | null) {
    return useQuery({
        queryKey: ["fulfillment", "summary", workspaceId],
        queryFn: async (): Promise<FulfillmentSummary> => {
            if (!workspaceId) {
                throw new Error("Workspace ID é obrigatório");
            }

            const response = await fetch(
                `/api/integrations/mercadolivre-fulfillment/summary?workspaceId=${workspaceId}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar resumo de estoque");
            }

            return response.json();
        },
        enabled: !!workspaceId,
        staleTime: 10 * 60 * 1000, // 10 minutos
    });
}
