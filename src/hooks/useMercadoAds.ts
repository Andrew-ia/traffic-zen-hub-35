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

type AutomationRule = {
  id: string;
  workspace_id: string;
  rule_key: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, number>;
};

type PlannedAction = {
  id: string;
  productId: string;
  mlItemId: string;
  type: "pause_ad" | "move_curve";
  currentCurve: "A" | "B" | "C";
  targetCurve?: "A" | "B" | "C";
  reason: string;
  ruleKey: string;
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
    queryKey: ["mercado-ads", "campaigns", workspaceId, token],
    enabled: !!workspaceId && !!token,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      
      const headers = getAuthHeaders(token);
      // Debug temporário
      if (!headers["Authorization"]) {
         console.warn("⚠️ [useMercadoAds] Token missing in headers!");
      }

      const resp = await fetch(`/api/integrations/mercado-ads/campaigns?workspaceId=${workspaceId}`, {
        headers,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to fetch campaigns");
      }
      return resp.json();
    },
  });
}

export function useMercadoAdsPreview(workspaceId: string | null) {
  const { token } = useAuth();
  return useQuery<{
    items: Array<{
      productId: string;
      mlItemId: string;
      curve: "A" | "B" | "C";
      title?: string | null;
      sku?: string | null;
      reason?: string;
      action?: "active" | "paused";
      adsClicks30d?: number;
      adsPrints30d?: number;
      adsCtr?: number;
      adsCpc?: number;
      adsSales30d?: number;
      adsRevenue30d?: number;
      adsCost30d?: number;
      adsAcos?: number;
      lifetimeSales?: number;
      totalSales30d?: number;
      totalRevenue30d?: number;
      visits30d?: number | null;
      conversionRate30d?: number | null;
      profitUnit?: number | null;
      stock?: number | null;
      status?: string | null;
      publishedAt?: string | null;
      ageDays?: number | null;
      hasAdsMetrics?: boolean;
    }>;
    summary: Record<string, number>;
    diagnostics?: {
      adsMetricsAvailable: boolean;
      itemsWithMetrics: number;
      demandMetricsAvailable: boolean;
      itemsWithDemand: number;
      totalItems: number;
      adsMetricsError?: {
        message: string;
        status?: number;
      };
    };
  }>({
    queryKey: ["mercado-ads", "preview", workspaceId, token],
    enabled: !!workspaceId && !!token,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      
      const headers = getAuthHeaders(token);
      const resp = await fetch(`/api/integrations/mercado-ads/automation/preview?workspaceId=${workspaceId}`, {
        headers,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to preview automation");
      }
      return resp.json();
    },
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
        throw new Error(err.error || "Failed to plan automation");
      }
      return resp.json();
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
        throw new Error(err.error || "Failed to apply automation");
      }
      return resp.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns"] });
    },
  });
}

export function useMercadoAdsAutomationRules(workspaceId: string | null) {
  const { token } = useAuth();
  return useQuery<{ rules: AutomationRule[] }>({
    queryKey: ["mercado-ads", "rules", workspaceId, token],
    enabled: !!workspaceId && !!token,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      const resp = await fetch(`/api/integrations/mercado-ads/automation/rules?workspaceId=${workspaceId}`, {
        headers: getAuthHeaders(token),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to fetch rules");
      }
      return resp.json();
    },
  });
}

export function useUpdateMercadoAdsAutomationRules() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; rules: Array<{ ruleKey: string; enabled: boolean; config: Record<string, number> }> }) => {
      const resp = await fetch(`/api/integrations/mercado-ads/automation/rules`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId: input.workspaceId, rules: input.rules }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to update rules");
      }
      return resp.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "rules", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "actions", variables.workspaceId] });
    },
  });
}

export function useMercadoAdsActionPlan(workspaceId: string | null) {
  const { token } = useAuth();
  return useQuery<{
    rules: AutomationRule[];
    actions: PlannedAction[];
    summary: { pause: number; promote: number; demote: number };
  }>({
    queryKey: ["mercado-ads", "actions", workspaceId, token],
    enabled: !!workspaceId && !!token,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      const resp = await fetch(`/api/integrations/mercado-ads/automation/actions/preview?workspaceId=${workspaceId}`, {
        headers: getAuthHeaders(token),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to preview actions");
      }
      return resp.json();
    },
  });
}

export function useApplyMercadoAdsActions() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; actions: PlannedAction[] }) => {
      const resp = await fetch(`/api/integrations/mercado-ads/automation/actions/apply`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId: input.workspaceId, actions: input.actions }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to apply actions");
      }
      return resp.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "preview", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "actions", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns", variables.workspaceId] });
    },
  });
}

export function useMercadoAdsWeeklyReportSettings(workspaceId: string | null) {
  const { token } = useAuth();
  return useQuery<{ settings: { enabled: boolean; send_day: number; send_hour: number; channel: string; last_sent_at?: string | null } }>({
    queryKey: ["mercado-ads", "weekly-settings", workspaceId, token],
    enabled: !!workspaceId && !!token,
    queryFn: async () => {
      if (!workspaceId) throw new Error("workspaceId is required");
      const resp = await fetch(`/api/integrations/mercado-ads/report/weekly/settings?workspaceId=${workspaceId}`, {
        headers: getAuthHeaders(token),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to fetch weekly settings");
      }
      return resp.json();
    },
  });
}

export function useUpdateMercadoAdsWeeklyReportSettings() {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (input: { workspaceId: string; settings: { enabled: boolean; send_day: number; send_hour: number; channel: string } }) => {
      const resp = await fetch(`/api/integrations/mercado-ads/report/weekly/settings`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId: input.workspaceId, settings: input.settings }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to update weekly settings");
      }
      return resp.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "weekly-settings", variables.workspaceId] });
    },
  });
}

export function useSendMercadoAdsWeeklyReport() {
  const { token } = useAuth();
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const resp = await fetch(`/api/integrations/mercado-ads/report/weekly/send`, {
        method: "POST",
        headers: getAuthHeaders(token),
        body: JSON.stringify({ workspaceId }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.details || err.error || "Failed to send weekly report");
      }
      return resp.json();
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
        throw new Error(err.error || "Failed to toggle campaign");
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns"] });
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
        throw new Error(err.error || "Failed to update budget");
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercado-ads", "campaigns"] });
    },
  });
}

export type { MercadoAdsCampaign, MercadoAdsCurve, CampaignsResponse };
