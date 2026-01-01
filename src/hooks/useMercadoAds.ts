import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

type MercadoAdsCampaign = {
  id: string;
  name: string;
  curve: "A" | "B" | "C";
  campaign_type: string;
  advertiser_id: string;
  ml_campaign_id?: string | null;
  status: "draft" | "active" | "paused" | "archived" | "error";
  daily_budget: number | null;
  curve_daily_budget?: number | null;
  min_revenue_30d?: number | null;
  min_orders_30d?: number | null;
  min_roas?: number | null;
  min_conversion?: number | null;
  total_products?: number;
  active_products?: number;
  avg_conversion?: number;
  avg_revenue?: number;
  last_synced_at?: string | null;
  last_automation_at?: string | null;
};

type MercadoAdsCurve = {
  id: string;
  curve: "A" | "B" | "C";
  name: string;
  campaign_type: string;
  daily_budget: number;
  min_revenue_30d: number;
  min_orders_30d: number;
  min_roas: number;
  min_conversion: number;
  priority: number;
};

type CampaignsResponse = {
  campaigns: MercadoAdsCampaign[];
  curves: MercadoAdsCurve[];
  metrics?: {
    summary: {
      clicks: number;
      prints: number;
      cost: number;
      cpc: number;
      acos: number;
      roas: number;
      units: number;
      revenue: number;
      organic_units: number;
      organic_revenue: number;
    };
    daily: Array<{ date: string; clicks: number; prints: number; cost: number; acos: number; roas: number; revenue: number; units: number; organic_units: number; organic_revenue: number }>;
    date_from: string;
    date_to: string;
  } | null;
};

type PlanResponse = {
  summary: Record<"A" | "B" | "C", number>;
  planCampaigns: Array<{
    curve: "A" | "B" | "C";
    name: string;
    budget: number;
    action: "create" | "update";
    currentCampaignId?: string | null;
    mlCampaignId?: string | null;
  }>;
  movements: Array<{
    productId: string;
    mlItemId: string;
    curve: "A" | "B" | "C";
    targetCampaignId?: string | null;
    title?: string | null;
    sku?: string | null;
    reason?: string;
    sales30d?: number;
    revenue30d?: number;
    cost30d?: number;
    acos?: number;
  }>;
  advertiserId: string;
};

const getAuthHeaders = (token?: string | null): HeadersInit => {
  const resolvedToken = token || localStorage.getItem("trafficpro.auth.token");
  return {
    "Content-Type": "application/json",
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
  };
};

export function useMercadoAdsCampaigns(workspaceId: string | null) {
  const { token } = useAuth();
  return useQuery<CampaignsResponse>({
    queryKey: ["mercado-ads", "campaigns", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      const resp = await fetch(`/api/integrations/mercado-ads/campaigns?workspaceId=${workspaceId}`, {
        headers: getAuthHeaders(token),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || "Falha ao carregar campanhas");
      }
      return resp.json();
    },
    staleTime: 30_000,
  });
}

export function useRunMercadoAdsAutomation() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; budgets?: Partial<Record<"A" | "B" | "C", number>>; names?: Partial<Record<"A" | "B" | "C", string>> }) => {
      const resp = await fetch("/api/integrations/mercado-ads/automation/plan", {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId: input.workspaceId, budgets: input.budgets, names: input.names }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.details || err?.error || "Falha ao planejar automação");
      }
      return resp.json() as Promise<PlanResponse>;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns", input.workspaceId] });
    },
  });
}

export function useApplyMercadoAdsAutomation() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; budgets?: Partial<Record<"A" | "B" | "C", number>>; names?: Partial<Record<"A" | "B" | "C", string>> }) => {
      const resp = await fetch("/api/integrations/mercado-ads/automation/apply", {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId: input.workspaceId, budgets: input.budgets, names: input.names }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.details || err?.error || "Falha ao aplicar automação");
      }
      return resp.json();
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns", input.workspaceId] });
    },
  });
}

export function useToggleMercadoAdsCampaign() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; campaignId: string; status: "active" | "paused" }) => {
      const resp = await fetch(`/api/integrations/mercado-ads/campaigns/${input.campaignId}/toggle`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId: input.workspaceId, status: input.status }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.details || err?.error || "Falha ao atualizar status");
      }
      return resp.json();
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns", input.workspaceId] });
    },
  });
}

export function useUpdateMercadoAdsBudget() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; campaignId: string; dailyBudget: number }) => {
      const resp = await fetch(`/api/integrations/mercado-ads/campaigns/${input.campaignId}/budget`, {
        method: "PUT",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId: input.workspaceId, dailyBudget: input.dailyBudget }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.details || err?.error || "Falha ao salvar orçamento");
      }
      return resp.json();
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns", input.workspaceId] });
    },
  });
}

export type { MercadoAdsCampaign, MercadoAdsCurve, CampaignsResponse };
