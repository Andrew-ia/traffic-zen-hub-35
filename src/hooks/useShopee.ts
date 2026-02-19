import { useQuery } from "@tanstack/react-query";

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem("trafficpro.auth.token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface ShopeeAuthStatus {
  connected: boolean;
  shopId?: string | null;
  partnerId?: string | null;
  apiBase?: string | null;
  updatedAt?: string | null;
}

export function useShopeeAuthStatus(workspaceId: string | null) {
  const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
  const effectiveWorkspaceId = workspaceId || fallbackWorkspaceId;

  return useQuery({
    queryKey: ["shopee", "auth-status", effectiveWorkspaceId],
    queryFn: async (): Promise<ShopeeAuthStatus> => {
      if (!effectiveWorkspaceId) return { connected: false };
      const response = await fetch(`/api/integrations/shopee/auth/status?workspaceId=${effectiveWorkspaceId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { connected: false };
      return response.json();
    },
    enabled: !!effectiveWorkspaceId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
