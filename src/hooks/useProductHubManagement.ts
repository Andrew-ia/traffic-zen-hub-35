import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProductHubChannelLink, ProductHubDetailResponse } from "./useProductHubItem";

export interface ProductHubImagePayload {
  id?: string | null;
  url?: string | null;
  imageData?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  isPrimary?: boolean;
}

export interface ProductHubSavePayload {
  sku: string;
  name: string;
  category?: string;
  price?: string | number | null;
  cost_price?: string | number | null;
  stock_on_hand?: string | number | null;
  stock_reserved?: string | number | null;
  status?: string;
  supplier?: string;
  barcode?: string;
  description?: string;
  notes?: string;
  video_url?: string;
  weight_kg?: string | number | null;
  width_cm?: string | number | null;
  height_cm?: string | number | null;
  length_cm?: string | number | null;
  images?: ProductHubImagePayload[];
}

export interface ProductHubLinkableListing {
  id: string;
  ml_item_id: string;
  sku?: string | null;
  title?: string | null;
  price?: number | null;
  available_quantity?: number | null;
  status?: string | null;
  ml_permalink?: string | null;
  hub_product_id?: string | null;
  updated_at?: string | null;
}

export interface ProductHubInventoryAdjustmentPayload {
  deltaQuantity: number;
  reason?: string;
  notes?: string;
  syncChannels?: boolean;
}

export interface ProductHubManualChannelPayload {
  channel: "shopee" | "other";
  externalListingId: string;
  sku?: string;
  title?: string;
  status?: string;
  price?: string | number | null;
  publishedStock?: string | number | null;
  permalink?: string;
  metadata?: Record<string, any>;
}

type ChannelLinkPayload =
  | { channel: "mercadolivre"; internalProductId: string }
  | ProductHubManualChannelPayload;

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return response.json();
  }

  const data = await response.json().catch(() => ({}));
  throw new Error(data?.error || data?.message || "request_failed");
}

export function useCreateProductHubProduct(workspaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProductHubSavePayload) => {
      if (!workspaceId) throw new Error("workspace_id_required");
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`/api/product-hub?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return parseResponse<{ product: ProductHubDetailResponse["product"] }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-hub"] });
    },
  });
}

export function useUpdateProductHubProduct(workspaceId: string | null, productId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProductHubSavePayload) => {
      if (!workspaceId || !productId) throw new Error("workspace_id_required");
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`/api/product-hub/${productId}?${params}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return parseResponse<{ product: ProductHubDetailResponse["product"] }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-hub"] });
      if (workspaceId && productId) {
        queryClient.invalidateQueries({ queryKey: ["product-hub", "detail", productId, workspaceId] });
      }
    },
  });
}

export function useProductHubLinkableListings(
  productId: string | null,
  workspaceId: string | null,
  search: string,
  enabled = true,
) {
  return useQuery<{ items: ProductHubLinkableListing[] }>({
    queryKey: ["product-hub", "linkable-listings", productId, workspaceId, search],
    queryFn: async () => {
      if (!productId || !workspaceId) throw new Error("workspace_id_required");
      const params = new URLSearchParams({ workspaceId });
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/product-hub/${productId}/linkable-listings?${params}`);
      return parseResponse<{ items: ProductHubLinkableListing[] }>(response);
    },
    enabled: enabled && !!productId && !!workspaceId,
  });
}

export function useCreateProductHubChannelLink(workspaceId: string | null, productId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ChannelLinkPayload) => {
      if (!workspaceId || !productId) throw new Error("workspace_id_required");
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`/api/product-hub/${productId}/channel-links?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return parseResponse<{ link: ProductHubChannelLink }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-hub"] });
      if (workspaceId && productId) {
        queryClient.invalidateQueries({ queryKey: ["product-hub", "detail", productId, workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["product-hub", "linkable-listings", productId, workspaceId] });
      }
    },
  });
}

export function useDeleteProductHubChannelLink(workspaceId: string | null, productId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { source: string; sourceId: string }) => {
      if (!workspaceId || !productId) throw new Error("workspace_id_required");
      const params = new URLSearchParams({ workspaceId, source: payload.source });
      const response = await fetch(
        `/api/product-hub/${productId}/channel-links/${payload.sourceId}?${params}`,
        { method: "DELETE" },
      );
      return parseResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-hub"] });
      if (workspaceId && productId) {
        queryClient.invalidateQueries({ queryKey: ["product-hub", "detail", productId, workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["product-hub", "linkable-listings", productId, workspaceId] });
      }
    },
  });
}

export function useAdjustProductHubInventory(workspaceId: string | null, productId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ProductHubInventoryAdjustmentPayload) => {
      if (!workspaceId || !productId) throw new Error("workspace_id_required");
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`/api/product-hub/${productId}/inventory-adjustments?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return parseResponse<{
        product: ProductHubDetailResponse["product"];
        inventoryMovement: ProductHubDetailResponse["inventoryMovements"][number];
        syncResults: Array<Record<string, any>>;
      }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-hub"] });
      if (workspaceId && productId) {
        queryClient.invalidateQueries({ queryKey: ["product-hub", "detail", productId, workspaceId] });
      }
    },
  });
}

export function useSyncProductHubInventory(workspaceId: string | null, productId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId || !productId) throw new Error("workspace_id_required");
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`/api/product-hub/${productId}/inventory-sync?${params}`, {
        method: "POST",
      });
      return parseResponse<{ availableStock: number; syncResults: Array<Record<string, any>> }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-hub"] });
      if (workspaceId && productId) {
        queryClient.invalidateQueries({ queryKey: ["product-hub", "detail", productId, workspaceId] });
      }
    },
  });
}
