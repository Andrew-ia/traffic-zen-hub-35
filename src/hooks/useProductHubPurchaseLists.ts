import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProductHubPurchaseList {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  items_count?: number;
}

export interface ProductHubPurchaseListItem {
  id: string;
  product_id: string;
  name: string;
  suggestion?: string | null;
  sizes?: string | null;
  image_url?: string | null;
  sku?: string | null;
  platform?: string | null;
  platform_product_id?: string | null;
}

export interface ProductHubPurchaseListResponse {
  lists: ProductHubPurchaseList[];
}

export interface ProductHubPurchaseListItemsResponse {
  items: ProductHubPurchaseListItem[];
}

export interface CreatePurchaseListPayload {
  name: string;
  items: Array<{ productId: string; suggestion?: string; sizes?: string }>;
}

export interface UpdatePurchaseListPayload {
  listId: string;
  name?: string;
  items?: Array<{ productId: string; suggestion?: string; sizes?: string }>;
}

export function useProductHubPurchaseLists(workspaceId: string | null) {
  return useQuery<ProductHubPurchaseListResponse>({
    queryKey: ["product-hub", "purchase-lists", workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace ID required");
      const params = new URLSearchParams({ workspaceId });
      const res = await fetch(`/api/product-hub/lists?${params}`);
      if (!res.ok) throw new Error("Failed to fetch purchase lists");
      return res.json();
    },
    enabled: !!workspaceId,
  });
}

export function useProductHubPurchaseListItems(workspaceId: string | null, listId: string | null) {
  return useQuery<ProductHubPurchaseListItemsResponse>({
    queryKey: ["product-hub", "purchase-list-items", workspaceId, listId],
    queryFn: async () => {
      if (!workspaceId || !listId) throw new Error("Workspace ID and list ID required");
      const params = new URLSearchParams({ workspaceId });
      const res = await fetch(`/api/product-hub/lists/${listId}/items?${params}`);
      if (!res.ok) throw new Error("Failed to fetch purchase list items");
      return res.json();
    },
    enabled: !!workspaceId && !!listId,
  });
}

export function useCreateProductHubPurchaseList(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePurchaseListPayload) => {
      if (!workspaceId) throw new Error("Workspace ID required");
      const params = new URLSearchParams({ workspaceId });
      const res = await fetch(`/api/product-hub/lists?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create purchase list");
      return res.json();
    },
    onSuccess: () => {
      if (!workspaceId) return;
      queryClient.invalidateQueries({ queryKey: ["product-hub", "purchase-lists", workspaceId] });
    },
  });
}

export function useUpdateProductHubPurchaseList(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePurchaseListPayload) => {
      if (!workspaceId) throw new Error("Workspace ID required");
      const params = new URLSearchParams({ workspaceId });
      const res = await fetch(`/api/product-hub/lists/${payload.listId}?${params}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload.name, items: payload.items }),
      });
      if (!res.ok) throw new Error("Failed to update purchase list");
      return res.json();
    },
    onSuccess: (_data, payload) => {
      if (!workspaceId) return;
      queryClient.invalidateQueries({ queryKey: ["product-hub", "purchase-lists", workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["product-hub", "purchase-list-items", workspaceId, payload.listId],
      });
    },
  });
}
