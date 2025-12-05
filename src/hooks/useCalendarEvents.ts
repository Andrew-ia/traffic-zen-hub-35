import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarEvent {
  id: string;
  type: "campaign_start" | "campaign_end" | "campaign_created" | "budget_change" | "performance_alert";
  title: string;
  description: string;
  date: Date;
  campaignId: string | null;
  campaignName: string | null;
  platform: string | null;
  metadata: {
    status?: string;
    budget?: number;
    spend?: number;
    objective?: string;
    color?: string;
  };
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  platform_key: string | null;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
}

interface PerformanceMetricRow {
  campaign_id: string;
  metric_date: string;
  spend: number;
  campaigns?: {
    name: string;
    platform_key: string;
  } | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const EVENT_COLORS: Record<string, string> = {
  campaign_start: "#22C55E", // green
  campaign_end: "#EF4444", // red
  campaign_created: "#3B82F6", // blue
  budget_change: "#F59E0B", // amber
  performance_alert: "#8B5CF6", // purple
};

const PLATFORM_COLORS: Record<string, string> = {
  meta: "#1877F2",
  google: "#4285F4",
  tiktok: "#000000",
  linkedin: "#0A66C2",
};

// ============================================================================
// HOOK
// ============================================================================

export function useCalendarEvents(workspaceId: string | null, options: {
  startDate: Date;
  endDate: Date;
}): UseQueryResult<CalendarEvent[]> {
  const { startDate, endDate } = options;

  return useQuery({
    queryKey: ["calendar-events", workspaceId, startDate.toISOString(), endDate.toISOString()],
    enabled: !!workspaceId,
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (!workspaceId) throw new Error("Workspace não selecionado");
      const events: CalendarEvent[] = [];

      // Format dates for SQL
      const from = startDate.toISOString().split("T")[0];
      const to = endDate.toISOString().split("T")[0];

      // ========================================================================
      // 1. CAMPAIGN START/END DATES
      // ========================================================================
      const { data: campaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, name, status, platform_key, objective, start_date, end_date, created_at, daily_budget, lifetime_budget")
        .eq("workspace_id", workspaceId);

      if (campaignsError) {
        console.error("Failed to fetch campaigns:", campaignsError.message);
      }

      if (campaigns) {
        for (const campaign of campaigns as CampaignRow[]) {
          let hasEventInRange = false;

          // Campaign Start
          if (campaign.start_date) {
            const campaignStartDate = parseISO(campaign.start_date);
            if (isWithinInterval(campaignStartDate, { start: options.startDate, end: options.endDate })) {
              hasEventInRange = true;
              events.push({
                id: `${campaign.id}-start`,
                type: "campaign_start",
                title: `🚀 ${campaign.name}`,
                description: `Início da campanha`,
                date: campaignStartDate,
                campaignId: campaign.id,
                campaignName: campaign.name,
                platform: campaign.platform_key,
                metadata: {
                  status: campaign.status,
                  objective: campaign.objective,
                  budget: campaign.daily_budget || campaign.lifetime_budget || undefined,
                  color: EVENT_COLORS.campaign_start,
                },
              });
            }
          }

          // Campaign End
          if (campaign.end_date) {
            const campaignEndDate = parseISO(campaign.end_date);
            if (isWithinInterval(campaignEndDate, { start: options.startDate, end: options.endDate })) {
              hasEventInRange = true;
              events.push({
                id: `${campaign.id}-end`,
                type: "campaign_end",
                title: `🏁 ${campaign.name}`,
                description: `Término da campanha`,
                date: campaignEndDate,
                campaignId: campaign.id,
                campaignName: campaign.name,
                platform: campaign.platform_key,
                metadata: {
                  status: campaign.status,
                  objective: campaign.objective,
                  color: EVENT_COLORS.campaign_end,
                },
              });
            }
          }

          // Campaign Created (if within range)
          const createdDate = parseISO(campaign.created_at);
          if (isWithinInterval(createdDate, { start: options.startDate, end: options.endDate })) {
            hasEventInRange = true;
            events.push({
              id: `${campaign.id}-created`,
              type: "campaign_created",
              title: `✨ ${campaign.name}`,
              description: `Campanha criada`,
              date: createdDate,
              campaignId: campaign.id,
              campaignName: campaign.name,
              platform: campaign.platform_key,
              metadata: {
                status: campaign.status,
                objective: campaign.objective,
                color: EVENT_COLORS.campaign_created,
              },
            });
          }

          // If campaign is active and has no events in range, show it as "active" on start_date or created_at
          if (!hasEventInRange && campaign.status === 'active') {
            const referenceDate = campaign.start_date ? parseISO(campaign.start_date) : parseISO(campaign.created_at);
            if (isWithinInterval(referenceDate, { start: options.startDate, end: options.endDate })) {
              events.push({
                id: `${campaign.id}-active`,
                type: "campaign_start",
                title: `▶️ ${campaign.name}`,
                description: `Campanha ativa`,
                date: referenceDate,
                campaignId: campaign.id,
                campaignName: campaign.name,
                platform: campaign.platform_key,
                metadata: {
                  status: campaign.status,
                  objective: campaign.objective,
                  color: EVENT_COLORS.campaign_start,
                },
              });
            }
          }
        }
      }

      // ========================================================================
      // 2. PERFORMANCE ALERTS (Days with high spend)
      // ========================================================================
      const { data: metrics, error: metricsError } = await supabase
        .from("performance_metrics")
        .select(
          `
          campaign_id,
          metric_date,
          spend,
          campaigns:campaigns (
            name,
            platform_key
          )
        `,
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("granularity", "day")
        .gte("metric_date", from)
        .lte("metric_date", to)
        .gt("spend", 1000); // Alert for days with spend > R$1000

      if (metricsError) {
        console.error("Failed to fetch metrics:", metricsError.message);
      }

      if (metrics) {
        for (const metric of metrics as PerformanceMetricRow[]) {
          if (metric.campaigns) {
            const metricDate = parseISO(metric.metric_date);
            events.push({
              id: `${metric.campaign_id}-spend-${metric.metric_date}`,
              type: "performance_alert",
              title: `💰 ${metric.campaigns.name}`,
              description: `Alto investimento: R$ ${metric.spend.toFixed(2)}`,
              date: metricDate,
              campaignId: metric.campaign_id,
              campaignName: metric.campaigns.name,
              platform: metric.campaigns.platform_key,
              metadata: {
                spend: metric.spend,
                color: EVENT_COLORS.performance_alert,
              },
            });
          }
        }
      }

      // Sort by date
      events.sort((a, b) => a.date.getTime() - b.date.getTime());

      console.log(`[Calendar] Found ${events.length} events between ${from} and ${to}`);
      if (events.length > 0) {
        console.log('[Calendar] Sample events:', events.slice(0, 3).map(e => ({ date: e.date, title: e.title })));
      }

      return events;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get events for a specific month
 */
export function useMonthlyEvents(date: Date): UseQueryResult<CalendarEvent[]> {
  const startDate = startOfMonth(date);
  const endDate = endOfMonth(date);

  return useCalendarEvents({ startDate, endDate });
}

/**
 * Get events for a specific day
 */
export function useDailyEvents(date: Date): CalendarEvent[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);

  const { data: allEvents } = useCalendarEvents({ startDate: monthStart, endDate: monthEnd });

  if (!allEvents) return [];

  const targetDateStr = date.toISOString().split("T")[0];
  return allEvents.filter((event) => {
    const eventDateStr = event.date.toISOString().split("T")[0];
    return eventDateStr === targetDateStr;
  });
}
