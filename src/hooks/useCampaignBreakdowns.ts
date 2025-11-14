import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CONVERSATION_CONNECTION_ACTION,
  CONVERSATION_STARTED_ACTION,
  getActionValueForType,
  type MetaExtraMetrics,
} from "@/lib/conversionMetrics";
import { keepLatestBreakdownRows } from "@/lib/breakdownMetrics";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface CampaignBreakdownItem {
  key: string;
  label: string;
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
  dimensionValues: Record<string, unknown>;
}

export interface CampaignBreakdownResult {
  items: CampaignBreakdownItem[];
  total: {
    impressions: number;
    clicks: number;
    conversions: number;
    conversationsStarted: number;
    messagingConnections: number;
    spend: number;
    conversionValue: number;
  };
}

export interface CampaignBreakdownOptions {
  campaignId?: string;
  breakdownKey: string;
  startDate?: string | Date;
  endDate?: string | Date;
  granularity?: "day" | "week" | "month" | "lifetime";
}

export function useCampaignBreakdowns(options: CampaignBreakdownOptions): UseQueryResult<CampaignBreakdownResult> {
  const { campaignId, breakdownKey, startDate, endDate, granularity = "day" } = options;
  const startKey = startDate instanceof Date ? startDate.toISOString() : startDate ?? "auto";
  const endKey = endDate instanceof Date ? endDate.toISOString() : endDate ?? "auto";
  const hasCustomStart = Boolean(startDate);

  return useQuery({
    queryKey: [
      "campaign",
      campaignId,
      "breakdowns",
      breakdownKey,
      granularity,
      startKey,
      endKey,
    ],
    enabled: Boolean(campaignId && breakdownKey),
    queryFn: async (): Promise<CampaignBreakdownResult> => {
      if (!campaignId) {
        throw new Error("Missing campaign id");
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

      const { data, error } = await supabase
        .from("performance_metric_breakdowns")
        .select(
          `
            metric_date,
            granularity,
            ad_set_id,
            ad_id,
            synced_at,
            breakdown_value_key,
            dimension_values,
            impressions,
            clicks,
            conversions,
            spend,
            conversion_value,
            extra_metrics
          `,
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("campaign_id", campaignId)
        .eq("breakdown_key", breakdownKey)
        .eq("granularity", granularity)
        .is("ad_set_id", null)
        .is("ad_id", null)
        .gte("metric_date", startIso)
        .lte("metric_date", endIso);

      if (error) {
        console.error("Failed to load campaign breakdown metrics:", error.message);
        throw error;
      }

      const aggregated = new Map<string, CampaignBreakdownItem>();
      const latestRows = keepLatestBreakdownRows(
        (data ?? []) as Array<{
          metric_date?: string | null;
          granularity?: string | null;
          ad_set_id?: string | null;
          ad_id?: string | null;
          synced_at?: string | null;
          breakdown_value_key?: string | null;
          dimension_values?: Record<string, unknown> | null;
          impressions?: number | null;
          clicks?: number | null;
          conversions?: number | null;
          spend?: number | null;
          conversion_value?: number | null;
          extra_metrics?: MetaExtraMetrics | null;
        }>,
      );
      for (const row of latestRows) {
        const key = row.breakdown_value_key ?? "unknown";
        const existing =
          aggregated.get(key) ??
          ({
            key,
            label: key,
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
            dimensionValues: (row.dimension_values as Record<string, unknown>) ?? {},
          } satisfies CampaignBreakdownItem);

        existing.impressions += Number(row.impressions ?? 0);
        existing.clicks += Number(row.clicks ?? 0);
        const started = getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_STARTED_ACTION) ?? 0;
        const connections =
          getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_CONNECTION_ACTION) ?? 0;
        const conversions = started;

        existing.conversions += conversions;
        existing.conversationsStarted += started;
        existing.messagingConnections += connections;
        existing.spend += Number(row.spend ?? 0);
        existing.conversionValue += Number(row.conversion_value ?? 0);

        aggregated.set(key, existing);
      }

      const items = Array.from(aggregated.values()).map((item) => {
        const ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
        const cpc = item.clicks > 0 ? item.spend / item.clicks : 0;
        const cpa = item.conversions > 0 ? item.spend / item.conversions : 0;
        const roas = item.spend > 0 ? item.conversionValue / item.spend : 0;
        return {
          ...item,
          ctr,
          cpc,
          cpa,
          roas,
        };
      });

      const total = items.reduce(
        (acc, item) => {
          acc.impressions += item.impressions;
          acc.clicks += item.clicks;
          acc.conversions += item.conversions;
          acc.conversationsStarted += item.conversationsStarted;
          acc.messagingConnections += item.messagingConnections;
          acc.spend += item.spend;
          acc.conversionValue += item.conversionValue;
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

      total.conversions = total.conversationsStarted;

      return {
        items: items.sort((a, b) => b.spend - a.spend),
        total,
      };
    },
  });
}
