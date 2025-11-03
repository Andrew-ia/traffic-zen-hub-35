import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

// ============================================================================
// TYPES
// ============================================================================

export type ActionPriority = "critical" | "high" | "medium" | "low";
export type ActionCategory = "budget" | "performance" | "creative" | "audience" | "optimization";
export type ActionStatus = "pending" | "in_progress" | "completed" | "dismissed";

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: ActionCategory;
  priority: ActionPriority;
  status: ActionStatus;
  impact: string; // Expected impact (e.g., "+15% CTR", "Save $200/day")
  effort: "low" | "medium" | "high"; // Time/complexity required
  campaignId?: string;
  campaignName?: string;
  adSetId?: string;
  creativeId?: string;
  metadata?: Record<string, any>;
  actionUrl?: string; // Deep link to take action
  createdAt: Date;
  dueDate?: Date;
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  objective: string | null;
  metrics?: {
    spend: number;
    ctr: number;
    cpc: number;
    conversions: number;
    roas: number | null;
  };
}

// ============================================================================
// ACTION GENERATORS
// ============================================================================

function generateBudgetActions(campaigns: CampaignData[]): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const campaign of campaigns) {
    const budget = campaign.daily_budget || campaign.lifetime_budget || 0;
    const spend = campaign.metrics?.spend || 0;

    // Budget exhaustion warning
    if (campaign.daily_budget && spend >= campaign.daily_budget * 0.9) {
      actions.push({
        id: `budget-${campaign.id}`,
        title: `Orçamento quase esgotado: ${campaign.name}`,
        description: `Campanha gastou ${((spend / campaign.daily_budget) * 100).toFixed(0)}% do orçamento diário. Considere aumentar para não perder tráfego.`,
        category: "budget",
        priority: "high",
        status: "pending",
        impact: `+${Math.round(spend * 0.3)} impressões/dia`,
        effort: "low",
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionUrl: `/campaigns/${campaign.id}`,
        createdAt: new Date(),
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      });
    }

    // Underutilized budget
    if (campaign.daily_budget && spend < campaign.daily_budget * 0.5 && campaign.status === "active") {
      actions.push({
        id: `underutilized-${campaign.id}`,
        title: `Orçamento subutilizado: ${campaign.name}`,
        description: `Campanha usando apenas ${((spend / campaign.daily_budget) * 100).toFixed(0)}% do orçamento. Revise segmentação ou lances.`,
        category: "budget",
        priority: "medium",
        status: "pending",
        impact: "Melhor ROI",
        effort: "medium",
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionUrl: `/campaigns/${campaign.id}`,
        createdAt: new Date(),
      });
    }
  }

  return actions;
}

function generatePerformanceActions(campaigns: CampaignData[]): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const campaign of campaigns) {
    const metrics = campaign.metrics;
    if (!metrics || campaign.status !== "active") continue;

    // Low CTR warning
    if (metrics.ctr < 1.0) {
      actions.push({
        id: `low-ctr-${campaign.id}`,
        title: `CTR baixo: ${campaign.name}`,
        description: `CTR de ${metrics.ctr.toFixed(2)}% está abaixo do recomendado. Teste novos criativos ou ajuste público.`,
        category: "performance",
        priority: metrics.ctr < 0.5 ? "critical" : "high",
        status: "pending",
        impact: "+2x engajamento",
        effort: "medium",
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionUrl: `/campaigns/${campaign.id}`,
        createdAt: new Date(),
        metadata: { currentCTR: metrics.ctr, targetCTR: 1.5 },
      });
    }

    // High CPC
    if (metrics.cpc > 2.0) {
      actions.push({
        id: `high-cpc-${campaign.id}`,
        title: `CPC elevado: ${campaign.name}`,
        description: `CPC de R$ ${metrics.cpc.toFixed(2)} está alto. Otimize lances ou revise relevância dos anúncios.`,
        category: "optimization",
        priority: "medium",
        status: "pending",
        impact: `-R$ ${(metrics.spend * 0.2).toFixed(0)}/dia`,
        effort: "low",
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionUrl: `/campaigns/${campaign.id}`,
        createdAt: new Date(),
      });
    }

    // Low conversions
    if (metrics.spend > 100 && metrics.conversions < 5) {
      actions.push({
        id: `low-conversions-${campaign.id}`,
        title: `Poucas conversões: ${campaign.name}`,
        description: `Apenas ${metrics.conversions} conversões com R$ ${metrics.spend.toFixed(0)} investidos. Revise funil ou público.`,
        category: "performance",
        priority: "high",
        status: "pending",
        impact: "+3x conversões",
        effort: "high",
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionUrl: `/campaigns/${campaign.id}`,
        createdAt: new Date(),
        metadata: { currentConversions: metrics.conversions, targetConversions: 15 },
      });
    }

    // Good ROAS - scale opportunity
    if (metrics.roas && metrics.roas > 3.0 && metrics.spend < 500) {
      actions.push({
        id: `scale-${campaign.id}`,
        title: `Oportunidade de escala: ${campaign.name}`,
        description: `ROAS de ${metrics.roas.toFixed(1)}x está excelente! Aumente o orçamento para escalar resultados.`,
        category: "optimization",
        priority: "high",
        status: "pending",
        impact: `+R$ ${(metrics.spend * metrics.roas * 0.5).toFixed(0)} receita`,
        effort: "low",
        campaignId: campaign.id,
        campaignName: campaign.name,
        actionUrl: `/campaigns/${campaign.id}`,
        createdAt: new Date(),
        metadata: { roas: metrics.roas, recommendation: "increase_budget" },
      });
    }
  }

  return actions;
}

function generateCreativeActions(campaigns: CampaignData[]): ActionItem[] {
  const actions: ActionItem[] = [];

  // Creative fatigue detection (would need ad-level data)
  const oldCampaigns = campaigns.filter(c => c.status === "active");

  if (oldCampaigns.length > 0) {
    actions.push({
      id: "creative-refresh",
      title: "Revisar criativos ativos",
      description: `${oldCampaigns.length} campanhas podem estar com fadiga de criativos. Teste novas variações.`,
      category: "creative",
      priority: "medium",
      status: "pending",
      impact: "+25% CTR",
      effort: "medium",
      actionUrl: "/creatives",
      createdAt: new Date(),
    });
  }

  return actions;
}

function generateOptimizationActions(): ActionItem[] {
  const now = new Date();
  const hour = now.getHours();

  const actions: ActionItem[] = [];

  // Morning review
  if (hour >= 8 && hour < 12) {
    actions.push({
      id: "morning-review",
      title: "Revisão matinal de desempenho",
      description: "Analise os resultados de ontem e ajuste campanhas com baixo desempenho.",
      category: "optimization",
      priority: "high",
      status: "pending",
      impact: "Correção rápida",
      effort: "low",
      actionUrl: "/traffic-analysis",
      createdAt: new Date(),
      dueDate: new Date(now.setHours(12, 0, 0, 0)),
    });
  }

  // Afternoon optimization
  if (hour >= 14 && hour < 18) {
    actions.push({
      id: "afternoon-optimization",
      title: "Otimização de meio do dia",
      description: "Revise campanhas em tempo real e ajuste lances para horário de pico.",
      category: "optimization",
      priority: "medium",
      status: "pending",
      impact: "Melhor timing",
      effort: "low",
      actionUrl: "/campaigns",
      createdAt: new Date(),
    });
  }

  return actions;
}

// ============================================================================
// HOOK
// ============================================================================

export function useActionItems() {
  return useQuery({
    queryKey: ["action-items", WORKSPACE_ID],
    queryFn: async (): Promise<ActionItem[]> => {
      // Fetch campaigns with recent metrics
      const { data: campaigns, error } = await supabase
        .from("campaigns")
        .select(`
          id,
          name,
          status,
          daily_budget,
          lifetime_budget,
          objective
        `)
        .eq("workspace_id", WORKSPACE_ID);

      if (error) {
        console.error("Failed to fetch campaigns for actions:", error);
        throw error;
      }

      // Fetch recent performance metrics (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: metrics } = await supabase
        .from("performance_metrics")
        .select("campaign_id, spend, clicks, impressions, conversions, revenue")
        .eq("workspace_id", WORKSPACE_ID)
        .eq("granularity", "day")
        .gte("metric_date", sevenDaysAgo.toISOString().split("T")[0]);

      // Aggregate metrics by campaign
      const campaignMetrics = new Map<string, any>();
      if (metrics) {
        for (const metric of metrics) {
          const existing = campaignMetrics.get(metric.campaign_id) || {
            spend: 0,
            clicks: 0,
            impressions: 0,
            conversions: 0,
            revenue: 0,
          };

          existing.spend += metric.spend;
          existing.clicks += metric.clicks;
          existing.impressions += metric.impressions;
          existing.conversions += metric.conversions;
          existing.revenue += metric.revenue;

          campaignMetrics.set(metric.campaign_id, existing);
        }
      }

      // Calculate derived metrics
      const campaignsWithMetrics: CampaignData[] = (campaigns || []).map((c: any) => {
        const m = campaignMetrics.get(c.id);
        if (!m) return { ...c, metrics: undefined };

        const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0;
        const cpc = m.clicks > 0 ? m.spend / m.clicks : 0;
        const roas = m.spend > 0 ? m.revenue / m.spend : null;

        return {
          ...c,
          metrics: {
            spend: m.spend,
            ctr,
            cpc,
            conversions: m.conversions,
            roas,
          },
        };
      });

      // Generate actions from different sources
      const budgetActions = generateBudgetActions(campaignsWithMetrics);
      const performanceActions = generatePerformanceActions(campaignsWithMetrics);
      const creativeActions = generateCreativeActions(campaignsWithMetrics);
      const optimizationActions = generateOptimizationActions();

      const allActions = [
        ...budgetActions,
        ...performanceActions,
        ...creativeActions,
        ...optimizationActions,
      ];

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      allActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      console.log(`[useActionItems] Generated ${allActions.length} action items`);

      return allActions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}
