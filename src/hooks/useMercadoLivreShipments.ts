import { useQuery } from "@tanstack/react-query";

export interface ShipmentItem {
    id: string;
    description: string;
    quantity: number;
    order_id: string;
}

export interface MercadoLivreShipment {
    id: number;
    status: string;
    substatus: string | null;
    date_created: string;
    last_updated: string;
    tracking_number: string | null;
    tracking_method: string | null;
    service_id: number | null;
    sender_id: number;
    receiver_id: number;
    order_id: number | null;
    order_cost: number;
    base_cost: number;
    site_id: string;
    mode: string; // 'me2', 'custom', 'not_specified', 'me1'
    shipping_option: {
        id: number;
        name: string;
        currency_id: string;
        cost: number;
        delivery_type: string;
        estimated_delivery_time: {
            date: string; // ISO
            pay_before: string | null;
            shipping: number;
            handling: number;
            unit: string;
            offset: {
                date: string;
                shipping: number;
            }
        }
    };
    shipping_items: ShipmentItem[];
}

export interface ShipmentsResponse {
    results: MercadoLivreShipment[];
    paging: {
        total: number;
        offset: number;
        limit: number;
    };
}

export function useMercadoLivreShipments(
    workspaceId: string | null,
    options?: {
        status?: string;
        limit?: number;
        offset?: number;
    }
) {
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;

    return useQuery({
        queryKey: ["mercadolivre", "shipments", effectiveWorkspaceId, options],
        queryFn: async (): Promise<ShipmentsResponse> => {
            if (!effectiveWorkspaceId) {
                throw new Error("Workspace ID é obrigatório");
            }

            const params = new URLSearchParams();
            if (effectiveWorkspaceId) params.append("workspaceId", effectiveWorkspaceId);

            if (options?.status) params.append("status", options.status);
            if (options?.limit) params.append("limit", options.limit.toString());
            if (options?.offset) params.append("offset", options.offset.toString());

            const response = await fetch(
                `/api/integrations/mercadolivre/shipments?${params}`
            );

            if (!response.ok) {
                throw new Error("Falha ao buscar envios do Mercado Livre");
            }

            return response.json();
        },
        enabled: !!effectiveWorkspaceId,
        refetchInterval: 60000, // Refresh every minute
    });
}
