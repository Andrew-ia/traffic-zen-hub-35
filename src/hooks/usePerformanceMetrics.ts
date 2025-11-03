import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CONVERSATION_CONNECTION_ACTION,
  CONVERSATION_STARTED_ACTION,
  getConversionActionLabel,
  getActionValueForType,
  resolvePrimaryConversion,
  type MetaExtraMetrics,
} from "@/lib/conversionMetrics";

export interface PerformancePoint {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  conversationsStarted: number;
  messagingConnections: number;
  spend: number;
  conversionValue: number;
  roas: number;
}

export interface PerformanceSummary {
  totals: {
    impressions: number;
    clicks: number;
    conversions: number;
    conversationsStarted: number;
    messagingConnections: number;
    spend: number;
    conversionValue: number;
    roas: number;
    primaryConversionAction: string | null;
    primaryConversionLabel: string;
  };
  points: PerformancePoint[];
  lastUpdatedAt: string | null;
}

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export function usePerformanceMetrics(days: number = 30): UseQueryResult<PerformanceSummary> {
  return useQuery({
    queryKey: ["meta", "performance-metrics", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from("performance_metrics")
        .select(
          "metric_date, impressions, clicks, conversions, spend, roas, conversion_value, extra_metrics, synced_at",
        )
        .is("campaign_id", null)
        .is("ad_set_id", null)
        .is("ad_id", null)
        .eq("workspace_id", WORKSPACE_ID)
        .gte("metric_date", since.toISOString().slice(0, 10))
        .order("metric_date", { ascending: true });

      if (error) {
        console.error("Failed to load performance metrics:", error.message);
        throw error;
      }

      const rows = Array.isArray(data) ? data : [];
      const latestByDate = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        const key = row.metric_date as string;
        const existing = latestByDate.get(key);
        const currentSynced = row.synced_at ? Date.parse(row.synced_at as string) : Number.NEGATIVE_INFINITY;
        const existingSynced = existing?.synced_at
          ? Date.parse(existing.synced_at as string)
          : Number.NEGATIVE_INFINITY;
        if (!existing || currentSynced >= existingSynced) {
          latestByDate.set(key, row);
        }
      }

      const byDate = new Map<string, PerformancePoint>();
      const conversionTotalsByAction = new Map<string | null, number>();
      let totalStarted = 0;
      let totalConnections = 0;

      for (const row of latestByDate.values()) {
        const date = row.metric_date;
        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const rawConversions = Number(row.conversions ?? 0);
        const resolvedConversions = resolvePrimaryConversion(
          row.extra_metrics as MetaExtraMetrics,
          Number.isFinite(rawConversions) ? rawConversions : 0,
        );
        const started = getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_STARTED_ACTION) ?? 0;
        const connections = getActionValueForType(
          row.extra_metrics as MetaExtraMetrics,
          CONVERSATION_CONNECTION_ACTION,
        ) ?? 0;
        const conversions = started;
        const actionKey = resolvedConversions.actionType ?? null;
        conversionTotalsByAction.set(actionKey, (conversionTotalsByAction.get(actionKey) ?? 0) + conversions);
        const spend = Number(row.spend ?? 0);
        const conversionValue = Number(row.conversion_value ?? 0);
        totalStarted += started;
        totalConnections += connections;

        const existing = byDate.get(date) ?? {
          date,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversationsStarted: 0,
          messagingConnections: 0,
          spend: 0,
          conversionValue: 0,
          roas: 0,
        };

        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.conversions += conversions;
        existing.conversationsStarted += started;
        existing.messagingConnections += connections;
        existing.spend += spend;
        existing.conversionValue += conversionValue;
        existing.roas = existing.spend > 0 ? existing.conversionValue / existing.spend : 0;

        byDate.set(date, existing);
      }

      const points = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

      const totals = points.reduce(
        (acc, point) => {
          acc.impressions += point.impressions;
          acc.clicks += point.clicks;
          acc.conversions += point.conversions;
          acc.spend += point.spend;
          acc.conversionValue += point.conversionValue;
          return acc;
        },
        {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          conversionValue: 0,
        },
      );

      totals.conversions = totalStarted;

      const weightedRoas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;
      let primaryConversionAction: string | null = null;
      let primaryConversionTotal = 0;

      for (const [action, total] of conversionTotalsByAction.entries()) {
        if (total > primaryConversionTotal) {
          primaryConversionAction = action;
          primaryConversionTotal = total;
        }
      }

      if (totalStarted > primaryConversionTotal) {
        primaryConversionAction = CONVERSATION_STARTED_ACTION;
        primaryConversionTotal = totalStarted;
      } else if (totalConnections > primaryConversionTotal) {
        primaryConversionAction = CONVERSATION_CONNECTION_ACTION;
        primaryConversionTotal = totalConnections;
      }

      const latestSync = Array.from(latestByDate.values()).reduce((latest, row) => {
        const ts = row.synced_at ? Date.parse(row.synced_at as string) : Number.NEGATIVE_INFINITY;
        return ts > latest ? ts : latest;
      }, Number.NEGATIVE_INFINITY);

      return {
        totals: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          conversions: totals.conversions,
          conversationsStarted: totalStarted,
          messagingConnections: totalConnections,
          spend: totals.spend,
          conversionValue: totals.conversionValue,
          roas: weightedRoas,
          primaryConversionAction,
          primaryConversionLabel: getConversionActionLabel(primaryConversionAction),
        },
        points,
        lastUpdatedAt: Number.isFinite(latestSync) ? new Date(latestSync).toISOString() : null,
      };
    },
  });
}
