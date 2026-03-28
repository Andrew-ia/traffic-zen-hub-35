import { useQuery } from "@tanstack/react-query";

export interface ProductHubAsset {
  id: string;
  type: "image" | "video" | string;
  url: string;
  is_primary?: boolean;
  storage_mode?: "url" | "inline" | string;
  file_name?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  created_at?: string;
}

export interface ProductHubItem {
  id: string;
  workspace_id: string;
  platform: string;
  platform_product_id: string;
  sku?: string | null;
  name: string;
  category?: string | null;
  price?: number | null;
  source?: string | null;
  description?: string | null;
  barcode?: string | null;
  supplier?: string | null;
  cost_price?: number | null;
  stock_on_hand?: number | null;
  stock_reserved?: number | null;
  available_stock?: number | null;
  status?: string | null;
  weight_kg?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  length_cm?: number | null;
  notes?: string | null;
  video_url?: string | null;
  linked_listings?: number | null;
  mercado_livre_listings?: number | null;
  shopee_listings?: number | null;
  created_at?: string;
  updated_at?: string;
  assets?: ProductHubAsset[];
}

export interface ProductHubResponse {
  items: ProductHubItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useProductHub(
  workspaceId: string | null,
  opts?: { search?: string; searchBy?: "name" | "mlb" | "all"; page?: number; limit?: number }
) {
  return useQuery<ProductHubResponse>({
    queryKey: ["product-hub", workspaceId, opts?.search, opts?.searchBy, opts?.page, opts?.limit],
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace ID required");
      const params = new URLSearchParams({
        workspaceId,
        page: String(opts?.page || 1),
        limit: String(opts?.limit || 24),
      });
      if (opts?.search) params.set("search", opts.search);
      if (opts?.searchBy) params.set("searchBy", opts.searchBy);

      const res = await fetch(`/api/product-hub?${params}`);
      if (!res.ok) throw new Error("Failed to fetch product hub");
      return res.json();
    },
    enabled: !!workspaceId,
  });
}
