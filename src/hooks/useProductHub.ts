import { useQuery } from "@tanstack/react-query";

export interface ProductHubAsset {
  id: string;
  type: "image" | "video" | string;
  url: string;
  is_primary?: boolean;
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
  video_url?: string | null;
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

export function useProductHub(workspaceId: string | null, opts?: { search?: string; page?: number; limit?: number }) {
  return useQuery<ProductHubResponse>({
    queryKey: ["product-hub", workspaceId, opts?.search, opts?.page, opts?.limit],
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace ID required");
      const params = new URLSearchParams({
        workspaceId,
        page: String(opts?.page || 1),
        limit: String(opts?.limit || 24),
      });
      if (opts?.search) params.set("search", opts.search);

      const res = await fetch(`/api/product-hub?${params}`);
      if (!res.ok) throw new Error("Failed to fetch product hub");
      return res.json();
    },
    enabled: !!workspaceId,
  });
}
