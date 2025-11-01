import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface AdMetricPoint {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  conversionValue: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpa: number;
}

export interface AdMetricsSummary {
  totals: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    conversionValue: number;
    roas: number;
    ctr: number;
    cpc: number;
    cpa: number;
  };
  points: AdMetricPoint[];
  since: string;
}

export interface AdMetricsOptions {
  adId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  granularity?: "day" | "week" | "month" | "lifetime";
}

export function useAdMetrics(options: AdMetricsOptions = {}): UseQueryResult<AdMetricsSummary> {
  const { adId, startDate, endDate, granularity = "day" } = options;
  const startKey = startDate instanceof Date ? startDate.toISOString() : startDate ?? "auto";
  const endKey = endDate instanceof Date ? endDate.toISOString() : endDate ?? "auto";
  const hasCustomStart = Boolean(startDate);

  return useQuery({
    queryKey: ["ad", adId, "metrics", granularity, startKey, endKey],
    enabled: Boolean(adId),
    queryFn: async (): Promise<AdMetricsSummary> => {
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
            cpa
          `,
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("ad_id", adId)
        .eq("granularity", granularity)
        .gte("metric_date", startIso)
        .lte("metric_date", endIso)
        .order("metric_date", { ascending: true });

      if (error) {
        console.error("Failed to load ad metrics:", error.message);
        throw error;
      }

      const byDate = new Map<string, AdMetricPoint>();

      for (const row of data ?? []) {
        const date = row.metric_date as string;
        const entry =
          byDate.get(date) ?? {
            date,
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spend: 0,
            conversionValue: 0,
            roas: 0,
            ctr: 0,
            cpc: 0,
            cpa: 0,
          };

        entry.impressions += Number(row.impressions ?? 0);
        entry.clicks += Number(row.clicks ?? 0);
        entry.conversions += Number(row.conversions ?? 0);
        entry.spend += Number(row.spend ?? 0);
        entry.conversionValue += Number(row.conversion_value ?? 0);

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
          acc.spend += point.spend;
          acc.conversionValue += point.conversionValue;
          return acc;
        },
        { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversionValue: 0 },
      );

      const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const totalCpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
      const totalRoas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;

      return {
        totals: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          conversions: totals.conversions,
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
