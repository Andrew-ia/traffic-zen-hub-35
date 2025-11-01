import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

export interface PerformancePoint {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  conversionValue: number;
  roas: number;
}

export interface PerformanceSummary {
  totals: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    conversionValue: number;
    roas: number;
  };
  points: PerformancePoint[];
}

const DAYS = 30;

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export function usePerformanceMetrics(): UseQueryResult<PerformanceSummary> {
  return useQuery({
    queryKey: ["meta", "performance-metrics", DAYS],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - DAYS);

      const { data, error } = await supabase
        .from("performance_metrics")
        .select("metric_date, impressions, clicks, conversions, spend, roas, conversion_value")
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

      const byDate = new Map<string, PerformancePoint>();

      for (const row of data ?? []) {
        const date = row.metric_date;
        const impressions = Number(row.impressions ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const conversions = Number(row.conversions ?? 0);
        const spend = Number(row.spend ?? 0);
        const conversionValue = Number(row.conversion_value ?? 0);

        const existing = byDate.get(date) ?? {
          date,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          conversionValue: 0,
          roas: 0,
        };

        existing.impressions += impressions;
        existing.clicks += clicks;
        existing.conversions += conversions;
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
        { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversionValue: 0 },
      );

      const weightedRoas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;

      return {
        totals: {
          impressions: totals.impressions,
          clicks: totals.clicks,
          conversions: totals.conversions,
          spend: totals.spend,
          conversionValue: totals.conversionValue,
          roas: weightedRoas,
        },
        points,
      };
    },
  });
}
