import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CONVERSATION_CONNECTION_ACTION,
  CONVERSATION_STARTED_ACTION,
  getActionValueForType,
  type MetaExtraMetrics,
} from "@/lib/conversionMetrics";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface ReportSummary {
  current: {
    impressions: number;
    clicks: number;
    conversions: number;
    conversationsStarted: number;
    messagingConnections: number;
    spend: number;
    conversionValue: number;
    ctr: number;
    cpa: number;
    roas: number;
  };
  previous: {
    impressions: number;
    clicks: number;
    conversions: number;
    conversationsStarted: number;
    messagingConnections: number;
    spend: number;
    conversionValue: number;
    ctr: number;
    cpa: number;
    roas: number;
  };
}

export interface ReportTimePoint {
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

export interface PlatformBreakdownItem {
  platformAccountId: string;
  name: string;
  spend: number;
  conversions: number;
  conversationsStarted: number;
  messagingConnections: number;
  impressions: number;
}

export interface ReportsData {
  summary: ReportSummary;
  timeSeries: ReportTimePoint[];
  platformBreakdown: PlatformBreakdownItem[];
}

function calculateRatios({
  impressions,
  clicks,
  conversions,
  spend,
  conversionValue,
}: {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  conversionValue: number;
}) {
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? conversionValue / spend : 0;
  return { ctr, cpa, roas };
}

export function useReportsData(days = 30): UseQueryResult<ReportsData> {
  return useQuery({
    queryKey: ["reports", "overview", WORKSPACE_ID, days],
    queryFn: async () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const totalDays = days * 2;
      const start = new Date(now);
      start.setDate(start.getDate() - (totalDays - 1));

      const sinceIso = start.toISOString().slice(0, 10);

      const [{ data: metrics, error: metricsError }, { data: platformAccounts, error: paError }] = await Promise.all([
        supabase
          .from("performance_metrics")
          .select("platform_account_id, metric_date, impressions, clicks, conversions, spend, conversion_value, extra_metrics")
          .eq("workspace_id", WORKSPACE_ID)
          .is("campaign_id", null)
          .is("ad_set_id", null)
          .is("ad_id", null)
          .gte("metric_date", sinceIso)
          .order("metric_date", { ascending: true }),
        supabase
          .from("platform_accounts")
          .select("id, name")
          .eq("workspace_id", WORKSPACE_ID),
      ]);

      if (metricsError) {
        console.error("Failed to load performance metrics for reports", metricsError.message);
        throw metricsError;
      }

      if (paError) {
        console.error("Failed to load platform accounts for reports", paError.message);
        throw paError;
      }

      const platformNameMap = new Map<string, string>();
      for (const account of platformAccounts ?? []) {
        if (account.id) {
          platformNameMap.set(account.id, account.name ?? account.id);
        }
      }

      const midpoint = new Date(now);
      midpoint.setDate(midpoint.getDate() - (days - 1));
      midpoint.setHours(0, 0, 0, 0);

      const bucketTotals = {
        current: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversationsStarted: 0,
          messagingConnections: 0,
          spend: 0,
          conversionValue: 0,
        },
        previous: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          conversationsStarted: 0,
          messagingConnections: 0,
          spend: 0,
          conversionValue: 0,
        },
      } as const;

      const timeSeriesMap = new Map<string, ReportTimePoint>();
      const platformTotals = new Map<string, PlatformBreakdownItem>();

      for (const row of metrics ?? []) {
        const date = row.metric_date as string;
        const valueDate = new Date(date);
        valueDate.setHours(0, 0, 0, 0);

        const started = getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_STARTED_ACTION) ?? 0;
        const connections =
          getActionValueForType(row.extra_metrics as MetaExtraMetrics, CONVERSATION_CONNECTION_ACTION) ?? 0;
        const conversions = started;

        const targetBucket = valueDate >= midpoint ? "current" : "previous";
        bucketTotals[targetBucket].impressions += Number(row.impressions ?? 0);
        bucketTotals[targetBucket].clicks += Number(row.clicks ?? 0);
        bucketTotals[targetBucket].conversions += conversions;
        bucketTotals[targetBucket].conversationsStarted += started;
        bucketTotals[targetBucket].messagingConnections += connections;
        bucketTotals[targetBucket].spend += Number(row.spend ?? 0);
        bucketTotals[targetBucket].conversionValue += Number(row.conversion_value ?? 0);

        if (targetBucket === "current") {
          const existing = timeSeriesMap.get(date) ?? {
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

          existing.impressions += Number(row.impressions ?? 0);
          existing.clicks += Number(row.clicks ?? 0);
          existing.conversions += conversions;
          existing.conversationsStarted += started;
          existing.messagingConnections += connections;
          existing.spend += Number(row.spend ?? 0);
          existing.conversionValue += Number(row.conversion_value ?? 0);
          existing.roas = existing.spend > 0 ? existing.conversionValue / existing.spend : 0;
          timeSeriesMap.set(date, existing);

          if (row.platform_account_id) {
            const platformAggregate = platformTotals.get(row.platform_account_id) ?? {
              platformAccountId: row.platform_account_id,
              name: platformNameMap.get(row.platform_account_id) ?? row.platform_account_id,
              spend: 0,
              conversions: 0,
              conversationsStarted: 0,
              messagingConnections: 0,
              impressions: 0,
            };

            platformAggregate.spend += Number(row.spend ?? 0);
            platformAggregate.conversions += conversions;
            platformAggregate.conversationsStarted += started;
            platformAggregate.messagingConnections += connections;
            platformAggregate.impressions += Number(row.impressions ?? 0);

            platformTotals.set(row.platform_account_id, platformAggregate);
          }
        }
      }

      bucketTotals.current.conversions = bucketTotals.current.conversationsStarted;
      bucketTotals.previous.conversions = bucketTotals.previous.conversationsStarted;

      const currentRatios = calculateRatios(bucketTotals.current);
      const previousRatios = calculateRatios(bucketTotals.previous);

      const summary: ReportSummary = {
        current: {
          ...bucketTotals.current,
          conversions: bucketTotals.current.conversationsStarted,
          ...currentRatios,
        },
        previous: {
          ...bucketTotals.previous,
          conversions: bucketTotals.previous.conversationsStarted,
          ...previousRatios,
        },
      };

      const timeSeries: ReportTimePoint[] = Array.from(timeSeriesMap.values()).sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
      );

      const platformBreakdown = Array.from(platformTotals.values()).sort((a, b) => b.spend - a.spend);

      return {
        summary,
        timeSeries,
        platformBreakdown,
      } satisfies ReportsData;
    },
  });
}
