import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface AdBreakdownItem {
  key: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  conversionValue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpa: number;
  dimensionValues: Record<string, unknown>;
}

export interface AdBreakdownResult {
  items: AdBreakdownItem[];
  total: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    conversionValue: number;
  };
}

export interface AdBreakdownOptions {
  adId?: string;
  breakdownKey: string;
  startDate?: string | Date;
  endDate?: string | Date;
  granularity?: "day" | "week" | "month" | "lifetime";
}

export function useAdBreakdowns(options: AdBreakdownOptions): UseQueryResult<AdBreakdownResult> {
  const { adId, breakdownKey, startDate, endDate, granularity = "day" } = options;
  const startKey = startDate instanceof Date ? startDate.toISOString() : startDate ?? "auto";
  const endKey = endDate instanceof Date ? endDate.toISOString() : endDate ?? "auto";
  const hasCustomStart = Boolean(startDate);

  return useQuery({
    queryKey: ["ad", adId, "breakdowns", breakdownKey, granularity, startKey, endKey],
    enabled: Boolean(adId && breakdownKey),
    queryFn: async (): Promise<AdBreakdownResult> => {
      if (!adId) {
        throw new Error("Missing ad id");
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
            breakdown_value_key,
            dimension_values,
            impressions,
            clicks,
            conversions,
            spend,
            conversion_value
          `,
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("ad_id", adId)
        .eq("breakdown_key", breakdownKey)
        .eq("granularity", granularity)
        .gte("metric_date", startIso)
        .lte("metric_date", endIso);

      if (error) {
        console.error("Failed to load ad breakdown metrics:", error.message);
        throw error;
      }

      const aggregated = new Map<string, AdBreakdownItem>();

      for (const row of data ?? []) {
        const key = row.breakdown_value_key ?? "unknown";
        const existing =
          aggregated.get(key) ??
          ({
            key,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spend: 0,
            conversionValue: 0,
            roas: 0,
            ctr: 0,
            cpc: 0,
            cpa: 0,
            dimensionValues: (row.dimension_values as Record<string, unknown>) ?? {},
          } satisfies AdBreakdownItem);

        existing.impressions += Number(row.impressions ?? 0);
        existing.clicks += Number(row.clicks ?? 0);
        existing.conversions += Number(row.conversions ?? 0);
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
          acc.spend += item.spend;
          acc.conversionValue += item.conversionValue;
          return acc;
        },
        { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversionValue: 0 },
      );

      return {
        items: items.sort((a, b) => b.spend - a.spend),
        total,
      };
    },
  });
}
