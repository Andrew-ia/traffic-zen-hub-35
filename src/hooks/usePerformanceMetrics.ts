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

export function usePerformanceMetrics(workspaceId: string | null, days: number = 30, offsetDays: number = 0): UseQueryResult<PerformanceSummary> {
  return useQuery({
    queryKey: ["meta", "performance-metrics", workspaceId, days, offsetDays],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const since = new Date();
      since.setDate(since.getDate() - days - offsetDays);

      const until = offsetDays > 0 ? new Date() : undefined;
      if (until && offsetDays > 0) {
        until.setDate(until.getDate() - offsetDays);
      }

      let query = supabase
        .from("performance_metrics")
        .select(
          "metric_date, impressions, clicks, conversions, spend, roas, conversion_value, extra_metrics, synced_at, platform_account_id",
        )
        .is("campaign_id", null)
        .is("ad_set_id", null)
        .is("ad_id", null)
        .eq("workspace_id", workspaceId)
        .gte("metric_date", since.toISOString().slice(0, 10));

      if (until) {
        query = query.lt("metric_date", until.toISOString().slice(0, 10));
      }

      const { data: rawData, error } = await query.order("metric_date", { ascending: true });

      if (error) {
        console.error("Failed to load performance metrics:", error.message);
        throw error;
      }

      // Filter out demo accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from("platform_accounts")
        .select("id, name")
        .eq("workspace_id", workspaceId);

      if (accountsError) {
        console.error("Failed to load platform accounts for filtering:", accountsError.message);
        throw accountsError;
      }

      const allowedIds = new Set(
        ((accountsData as { id: string | null; name: string | null }[]) ?? [])
          .filter((a) => !/\bdemo\b/i.test(String(a.name || "")))
          .map((a) => a.id)
          .filter(Boolean) as string[]
      );

      const data = (rawData ?? []).filter((r) => 
        !r.platform_account_id || allowedIds.has(r.platform_account_id)
      );

      const rows = Array.isArray(data) ? data : [];
      
      // Group by date and platform to handle deduplication properly
      const latestByDateAndPlatform = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        const key = `${row.metric_date}::${row.platform_account_id || 'null'}`;
        const existing = latestByDateAndPlatform.get(key);
        const currentSynced = row.synced_at ? Date.parse(row.synced_at as string) : Number.NEGATIVE_INFINITY;
        const existingSynced = existing?.synced_at
          ? Date.parse(existing.synced_at as string)
          : Number.NEGATIVE_INFINITY;
        if (!existing || currentSynced >= existingSynced) {
          latestByDateAndPlatform.set(key, row);
        }
      }

      const byDate = new Map<string, PerformancePoint>();
      const conversionTotalsByAction = new Map<string | null, number>();
      let totalStarted = 0;
      let totalConnections = 0;

      // Now aggregate by date (summing across platforms)
      for (const row of latestByDateAndPlatform.values()) {
        const date = row.metric_date;
        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const rawConversions = Number(row.conversions ?? 0);
        let resolvedConversions;
        let started = 0;
        let connections = 0;
        
        try {
          resolvedConversions = resolvePrimaryConversion(
            row.extra_metrics as MetaExtraMetrics,
            Number.isFinite(rawConversions) ? rawConversions : 0,
          );
          started = getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_STARTED_ACTION) ?? 0;
          connections = getActionValueForType(
            row.extra_metrics as MetaExtraMetrics,
            CONVERSATION_CONNECTION_ACTION,
          ) ?? 0;
        } catch (conversionError) {
          // Only log conversion errors in development
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error processing conversions for row:', row.metric_date, conversionError);
          }
          resolvedConversions = { value: 0, actionType: null };
          started = 0;
          connections = 0;
        }
        // Contar apenas conversas iniciadas, ignorar conexões duplicadas
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

      const latestSync = Array.from(latestByDateAndPlatform.values()).reduce((latest, row) => {
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
