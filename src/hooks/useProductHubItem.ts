import { useQuery } from "@tanstack/react-query";
import type { ProductHubAsset, ProductHubItem } from "./useProductHub";

export interface ProductHubAdsEntry {
  id: string;
  platform: string;
  platform_ad_id: string;
  platform_account_id?: string | null;
  status?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  spend?: number | null;
  permalink?: string | null;
  last_seen_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductHubChannelLink {
  source: string;
  source_id: string;
  internal_product_id?: string | null;
  channel: string;
  external_listing_id: string;
  sku?: string | null;
  title?: string | null;
  status?: string | null;
  price?: number | null;
  published_stock?: number | null;
  permalink?: string | null;
  last_synced_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProductHubInventoryMovement {
  id: string;
  movement_type: string;
  delta_quantity: number;
  balance_before: number;
  balance_after: number;
  reason?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface ProductHubDetailResponse {
  product: ProductHubItem & { metadata?: any };
  ads: ProductHubAdsEntry[];
  channelLinks: ProductHubChannelLink[];
  inventoryMovements: ProductHubInventoryMovement[];
}

export function useProductHubItem(id: string | null, workspaceId: string | null) {
  return useQuery<ProductHubDetailResponse>({
    queryKey: ["product-hub", "detail", id, workspaceId],
    queryFn: async () => {
      if (!id || !workspaceId) throw new Error("id and workspaceId are required");
      const res = await fetch(`/api/product-hub/${id}?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to fetch product");
      return res.json();
    },
    enabled: !!id && !!workspaceId,
  });
}
