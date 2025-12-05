import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CONVERSATION_CONNECTION_ACTION,
  CONVERSATION_STARTED_ACTION,
  getActionValueForType,
  type MetaExtraMetrics,
} from "@/lib/conversionMetrics";

export interface CampaignMetricPoint {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  conversationsStarted: number;
  messagingConnections: number;
  spend: number;
  conversionValue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface CampaignMetricsSummary {
  totals: {
    impressions: number;
    clicks: number;
    conversions: number;
    conversationsStarted: number;
    messagingConnections: number;
    spend: number;
    conversionValue: number;
    roas: number;
    ctr: number;
    cpc: number;
    cpa: number;
  };
  points: CampaignMetricPoint[];
  since: string;
}

export interface CampaignMetricsOptions {
  campaignId?: string;
  adSetId?: string;
  adId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  granularity?: "day" | "week" | "month" | "lifetime";
}

export function useCampaignMetrics(
  workspaceId: string | null,
  options: CampaignMetricsOptions = {},
): UseQueryResult<CampaignMetricsSummary> {
  const { campaignId, adSetId, adId, startDate, endDate, granularity = "day" } = options;
  const startKey = startDate instanceof Date ? startDate.toISOString() : startDate ?? "auto";
  const endKey = endDate instanceof Date ? endDate.toISOString() : endDate ?? "auto";
  const hasCustomStart = Boolean(startDate);

  return useQuery({
    queryKey: ["campaign", workspaceId, campaignId, "metrics", granularity, adSetId ?? "none", adId ?? "none", startKey, endKey],
    enabled: Boolean((campaignId ?? adSetId ?? adId) && workspaceId),
    queryFn: async (): Promise<CampaignMetricsSummary> => {
      if (!campaignId && !adSetId && !adId) {
        throw new Error("Missing identifiers for campaign metrics query");
      }
      if (!workspaceId) {
        throw new Error("Workspace não selecionado");
      }

      const resolvedEnd = endDate ? new Date(endDate) : new Date();
      resolvedEnd.setHours(0, 0, 0, 0);
      const resolvedStart = startDate ? new Date(startDate) : new Date(resolvedEnd);
      if (!hasCustomStart) {
        resolvedStart.setDate(resolvedEnd.getDate() - 29);
      }
      resolvedStart.setHours(0, 0, 0, 0);

      const startIso = resolvedStart.toISOString().slice(0, 10);
      const endIso = resolvedEnd.toISOString().slice(0, 10);

      let query = supabase
        .from("performance_metrics")
        .select(
          `
            metric_date,
            impressions,
            clicks,
            conversions,
            spend,
            conversion_value,
            roas,
            ctr,
            cpc,
            cpa,
            extra_metrics
          `,
        )
        .eq("workspace_id", workspaceId)
        .eq("granularity", granularity)
        .gte("metric_date", startIso)
        .lte("metric_date", endIso)
        .order("metric_date", { ascending: true });

      if (adId) {
        query = query.eq("ad_id", adId);
      } else if (adSetId) {
        query = query.eq("ad_set_id", adSetId).is("ad_id", null);
        if (campaignId) {
          query = query.eq("campaign_id", campaignId);
        }
      } else if (campaignId) {
        query = query.eq("campaign_id", campaignId).is("ad_set_id", null).is("ad_id", null);
      } else {
        query = query.is("campaign_id", null).is("ad_set_id", null).is("ad_id", null);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to load campaign metrics:", error.message);
        throw error;
      }

      const byDate = new Map<string, CampaignMetricPoint>();

      let totalStarted = 0;
      let totalConnections = 0;

      for (const row of data ?? []) {
        const date = row.metric_date as string;
        const entry =
          byDate.get(date) ?? {
            date,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            conversationsStarted: 0,
            messagingConnections: 0,
            spend: 0,
            conversionValue: 0,
            roas: 0,
            ctr: 0,
            cpc: 0,
            cpa: 0,
          };

        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const started = getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_STARTED_ACTION) ?? 0;
        const connections =
          getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_CONNECTION_ACTION) ?? 0;
        const spend = Number(row.spend ?? 0);
        const conversionValue = Number(row.conversion_value ?? 0);

        entry.impressions += impressions;
        entry.clicks += clicks;
        entry.conversions += started;
        entry.conversationsStarted += started;
        entry.messagingConnections += connections;
        entry.spend += spend;
        entry.conversionValue += conversionValue;

        totalStarted += started;
        totalConnections += connections;

        // For rates we recompute after aggregating to avoid averaging errors.
        byDate.set(date, entry);
      }

      const points = Array.from(byDate.values())
        .map((point) => {
          const ctr = point.impressions > 0 ? (point.clicks / point.impressions) * 100 : 0;
          const cpc = point.clicks > 0 ? point.spend / point.clicks : 0;
          const cpa = point.conversions > 0 ? point.spend / point.conversions : 0;
          const roas = point.spend > 0 ? point.conversionValue / point.spend : 0;
          return {
            ...point,
            ctr,
            cpc,
            cpa,
            roas,
          };
        })
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      const totals = points.reduce(
        (acc, point) => {
          acc.impressions += point.impressions;
          acc.clicks += point.clicks;
          acc.conversions += point.conversions;
          acc.conversationsStarted += point.conversationsStarted;
          acc.messagingConnections += point.messagingConnections;
          acc.spend += point.spend;
          acc.conversionValue += point.conversionValue;
          return acc;
        },
        {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversationsStarted: 0,
          messagingConnections: 0,
          spend: 0,
          conversionValue: 0,
        },
      );

      totals.conversions = totalStarted;
      totals.conversationsStarted = totalStarted;
      totals.messagingConnections = totalConnections;

      const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const totalCpa = totalStarted > 0 ? totals.spend / totalStarted : 0;
      const totalRoas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;

      return {
        totals: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          conversions: totalStarted,
          conversationsStarted: totalStarted,
          messagingConnections: totalConnections,
          spend: totals.spend,
          conversionValue: totals.conversionValue,
          roas: totalRoas,
          ctr: totalCtr,
          cpc: totalCpc,
          cpa: totalCpa,
        },
        points,
        since: startIso,
      };
    },
  });
}
