import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CONVERSATION_CONNECTION_ACTION,
  CONVERSATION_STARTED_ACTION,
  getActionValueAmount,
  type MetaExtraMetrics,
} from "@/lib/conversionMetrics";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

const DEFAULT_DAYS = 30;
const DATA_LAG_SAFETY_DAYS = 7;

export type PlatformKey = "facebook" | "instagram" | "whatsapp" | "messenger" | "audience_network" | "other";

export interface TrendPoint {
  date: string;
  value: number;
}

interface TrendSpendPoint {
  date: string;
  spend: number;
  value: number;
}

export interface EngagementSummary {
  totalConversations: number;
  conversationsByPlatform: Array<{ platform: PlatformKey; value: number }>;
  messagingConnections: number;
  postEngagements: number;
  profileVisits: number;
  costPerEngagement: number;
  costPerProfileVisit: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  videoViews: number;
  trend: TrendPoint[];
}

export interface TrafficSummary {
  linkClicks: number;
  landingPageViews: number;
  profileVisits: number;
  ctr: number;
  cpc: number;
  costPerClick: number;
  costPerLanding: number;
  costPerProfileVisit: number;
  conversationsByPlatform: Array<{ platform: PlatformKey; value: number }>;
  trend: TrendPoint[];
}

export interface LeadsSummary {
  whatsappConversations: number;
  formLeads: number;
  cpl: number;
  costPerConversation: number;
  trend: TrendPoint[];
  conversationsByPlatform: Array<{ platform: PlatformKey; value: number }>;
}

export interface SalesSummary {
  purchases: number;
  value: number;
  roas: number;
  costPerPurchase: number;
  trend: TrendPoint[];
  breakdown: Array<{ platform: PlatformKey; value: number }>;
}

export interface RecognitionSummary {
  reach: number;
  frequency: number;
  cpm: number;
  costPerReach: number;
  trend: TrendPoint[];
  breakdown: Array<{ platform: PlatformKey; value: number }>;
}

export interface AppPromotionSummary {
  installs: number;
  cpi: number;
  appEngagements: number;
  costPerEngagement: number;
  trend: TrendPoint[];
  breakdown: Array<{ platform: PlatformKey; value: number }>;
}

export interface ExtrasSummary {
  totalSpend: number;
  totalValue: number;
  roi: number;
  trend: TrendSpendPoint[];
}

export interface ObjectivePerformanceSummary {
  engagement: EngagementSummary;
  traffic: TrafficSummary;
  leads: LeadsSummary;
  sales: SalesSummary;
  recognition: RecognitionSummary;
  app: AppPromotionSummary;
  extras: ExtrasSummary;
  dateRange: { from: string; to: string };
}

type ObjectiveCategory = "ENGAGEMENT" | "TRAFFIC" | "LEADS" | "SALES" | "RECOGNITION" | "APP" | "OTHER";

type AdSetMetadata = {
  objective: ObjectiveCategory;
  platform: PlatformKey;
};

const OBJECTIVE_CATEGORY_MAP: Record<string, ObjectiveCategory> = {
  OUTCOME_ENGAGEMENT: "ENGAGEMENT",
  POST_ENGAGEMENT: "ENGAGEMENT",
  PAGE_LIKES: "ENGAGEMENT",
  EVENT_RESPONSES: "ENGAGEMENT",
  VIDEO_VIEWS: "ENGAGEMENT",
  MESSAGES: "ENGAGEMENT",
  ENGAGEMENT: "ENGAGEMENT",

  OUTCOME_TRAFFIC: "TRAFFIC",
  LINK_CLICKS: "TRAFFIC",
  TRAFFIC: "TRAFFIC",

  OUTCOME_LEADS: "LEADS",
  LEAD_GENERATION: "LEADS",
  LEADS: "LEADS",

  OUTCOME_SALES: "SALES",
  SALES: "SALES",
  CONVERSIONS: "SALES",
  PURCHASE: "SALES",

  OUTCOME_AWARENESS: "RECOGNITION",
  BRAND_AWARENESS: "RECOGNITION",
  REACH: "RECOGNITION",

  OUTCOME_APP_PROMOTION: "APP",
  APP_INSTALLS: "APP",
  MOBILE_APP_INSTALLS: "APP",
  OUTCOME_APP_INSTALLS: "APP",
  OUTCOME_APP_ENGAGEMENT: "APP",
};

const PLATFORM_ORDER: PlatformKey[] = ["whatsapp", "instagram", "facebook", "messenger", "audience_network", "other"];

type AdSetRow = {
  id: string;
  targeting: Record<string, unknown> | null;
  destination_type?: string | null;
  promoted_object?: Record<string, unknown> | null;
  campaign_id: string | null;
};

type MetricRow = {
  ad_set_id: string | null;
  campaign_id: string | null;
  platform_account_id?: string | null;
  metric_date: string;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  spend: number | null;
  cpc: number | null;
  cpm: number | null;
  reach: number | null;
  extra_metrics: MetaExtraMetrics | null;
  synced_at?: string | null;
};

function normalizePlatform(adSetRow: AdSetRow): PlatformKey {
  const targeting = adSetRow.targeting;

  // Try publisher_platforms first
  const publishersRaw = (targeting as { publisher_platforms?: unknown } | null)?.publisher_platforms;
  const publishers = Array.isArray(publishersRaw) ? (publishersRaw as Array<string>) : [];
  const normalized = publishers.map((value) => value.toLowerCase());

  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("instagram") && !normalized.includes("facebook")) return "instagram";
  if (normalized.includes("facebook")) return "facebook";
  if (normalized.includes("messenger")) return "messenger";
  if (normalized.includes("audience_network")) return "audience_network";
  if (normalized.length > 0) {
    const candidate = normalized[0] as PlatformKey;
    if (PLATFORM_ORDER.includes(candidate)) {
      return candidate;
    }
  }

  // Fallback: check destination_type for WhatsApp/Messenger
  const destinationType = adSetRow.destination_type;
  if (destinationType) {
    const destLower = destinationType.toLowerCase();
    if (destLower.includes("whatsapp") || destLower.includes("messaging")) return "whatsapp";
    if (destLower.includes("messenger")) return "messenger";
    if (destLower.includes("instagram")) return "instagram";
  }

  // Fallback: check promoted_object for app_id (WhatsApp = specific app ID)
  const promotedObject = adSetRow.promoted_object;
  if (promotedObject?.application_id) {
    // WhatsApp Business App ID is typically known, but we can infer from messaging
    return "whatsapp";
  }

  return "other";
}

function mapObjective(objective?: string | null): ObjectiveCategory {
  if (!objective) return "OTHER";
  return OBJECTIVE_CATEGORY_MAP[objective] ?? "OTHER";
}

function incrementMap(map: Map<PlatformKey, number>, platform: PlatformKey, value: number) {
  if (!value) return;
  map.set(platform, (map.get(platform) ?? 0) + value);
}

function addTrend(trend: Map<string, number>, date: string, value: number) {
  if (!value) return;
  trend.set(date, (trend.get(date) ?? 0) + value);
}

function addTrendPair(trend: Map<string, { spend: number; value: number }>, date: string, spend: number, value: number) {
  const existing = trend.get(date) ?? { spend: 0, value: 0 };
  existing.spend += spend;
  existing.value += value;
  trend.set(date, existing);
}

function mapToArray(map: Map<PlatformKey, number>): Array<{ platform: PlatformKey; value: number }> {
  return PLATFORM_ORDER.map((key) => ({ platform: key, value: map.get(key) ?? 0 })).filter((item) => item.value > 0);
}

function trendMapToArray(trend: Map<string, number>, fromIso: string, toIso: string): TrendPoint[] {
  const points: TrendPoint[] = [];
  const current = new Date(fromIso);
  const end = new Date(toIso);

  while (current <= end) {
    const dateKey = current.toISOString().slice(0, 10);
    points.push({ date: dateKey, value: trend.get(dateKey) ?? 0 });
    current.setDate(current.getDate() + 1);
  }

  return points;
}

function trendSpendMapToArray(trend: Map<string, { spend: number; value: number }>, fromIso: string, toIso: string): TrendSpendPoint[] {
  const points: TrendSpendPoint[] = [];
  const current = new Date(fromIso);
  const end = new Date(toIso);

  while (current <= end) {
    const dateKey = current.toISOString().slice(0, 10);
    const payload = trend.get(dateKey) ?? { spend: 0, value: 0 };
    points.push({ date: dateKey, spend: payload.spend, value: payload.value });
    current.setDate(current.getDate() + 1);
  }

  return points;
}

function pickActionValueAmount(extra: MetaExtraMetrics | null | undefined, actionTypes: string[]): number {
  for (const type of actionTypes) {
    const amount = getActionValueAmount(extra, type);
    if (amount !== null) {
      return amount;
    }
  }
  return 0;
}

function subtractDaysFromIso(dateIso: string, daysToSubtract: number): string {
  if (!dateIso || daysToSubtract <= 0) {
    return dateIso;
  }

  const [yearStr, monthStr, dayStr] = dateIso.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    return dateIso;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - daysToSubtract);
  return date.toISOString().slice(0, 10);
}

function createEmptySummary(fromIso: string, toIso: string): ObjectivePerformanceSummary {
  return {
    engagement: {
      totalConversations: 0,
      conversationsByPlatform: [],
      messagingConnections: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      videoViews: 0,
      trend: [],
    },
    traffic: {
      linkClicks: 0,
      landingPageViews: 0,
      ctr: 0,
      cpc: 0,
      conversationsByPlatform: [],
      trend: [],
    },
    leads: {
      whatsappConversations: 0,
      formLeads: 0,
      cpl: 0,
      trend: [],
      conversationsByPlatform: [],
    },
    sales: { purchases: 0, value: 0, roas: 0, trend: [], breakdown: [] },
    recognition: { reach: 0, frequency: 0, cpm: 0, trend: [], breakdown: [] },
    app: { installs: 0, cpi: 0, appEngagements: 0, trend: [], breakdown: [] },
    extras: { totalSpend: 0, totalValue: 0, roi: 0, trend: [] },
    dateRange: { from: fromIso, to: toIso },
  };
}

export function useObjectivePerformanceSummary(days = DEFAULT_DAYS): UseQueryResult<ObjectivePerformanceSummary> {
  return useQuery({
    queryKey: ["dashboard", "objective-summary", WORKSPACE_ID, days],
    queryFn: async () => {
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1 + DATA_LAG_SAFETY_DAYS));

      let fromIso = start.toISOString().slice(0, 10);
      let toIso = end.toISOString().slice(0, 10);

      const { data: metricsData, error: metricsError } = await supabase
        .from("performance_metrics")
        .select(
          "ad_set_id, campaign_id, platform_account_id, metric_date, impressions, clicks, ctr, spend, cpc, cpm, reach, extra_metrics, synced_at",
        )
        .eq("workspace_id", WORKSPACE_ID)
        .eq("granularity", "day")
        .not("ad_set_id", "is", null)
        .gte("metric_date", fromIso)
        .lte("metric_date", toIso);

      if (metricsError) {
        console.error("Failed to load performance metrics for objective summary", metricsError.message);
        throw metricsError;
      }

      const metricRowsRaw = (metricsData as MetricRow[]) ?? [];

      const { data: accountsData, error: accountsError } = await supabase
        .from("platform_accounts")
        .select("id, name")
        .eq("workspace_id", WORKSPACE_ID);

      if (accountsError) {
        console.error("Failed to load platform accounts for objective summary", accountsError.message);
        throw accountsError;
      }

      const allowedIds = new Set(
        ((accountsData as { id: string | null; name: string | null }[]) ?? [])
          .filter((a) => !/\bdemo\b/i.test(String(a.name || "")))
          .map((a) => a.id)
          .filter(Boolean) as string[]
      );

      let metricRows = metricRowsRaw.filter((r) => r.platform_account_id ? allowedIds.has(r.platform_account_id) : true);

      type AggregatedRow = {
        ad_set_id: string | null;
        campaign_id: string | null;
        metric_date: string;
        impressions: number;
        clicks: number;
        ctr: number;
        spend: number;
        cpc: number;
        cpm: number;
        reach: number;
        conversationsStarted: number;
        messagingConnections: number;
        pageEngagements: number;
        profileVisits: number;
        inlinePostEngagement: number;
        inlineLinkClicks: number;
        likes: number;
        comments: number;
        shares: number;
        saves: number;
        videoViews: number;
        linkClicks: number;
        landingPageViews: number;
        formLeads: number;
        purchases: number;
        purchaseValue: number;
        installs: number;
        appEngagements: number;
        synced_at: number;
      };

      const aggregatedMap = new Map<string, AggregatedRow>();

      for (const row of metricRowsRaw) {
        const adSetKey = row.ad_set_id ?? "none";
        const campaignKey = row.campaign_id ?? "none";
        const key = `${row.metric_date}::${adSetKey}::${campaignKey}`;
        const syncedAt = row.synced_at ? Date.parse(row.synced_at) : Number.NEGATIVE_INFINITY;

        const actions = Array.isArray(row.extra_metrics?.actions) ? row.extra_metrics.actions : [];
        const actionCounts = new Map(actions.map((action) => [action?.action_type ?? "", Number(action?.value ?? 0)]));
        const actionValueEntries = Array.isArray(row.extra_metrics?.action_values) ? row.extra_metrics.action_values : [];
        const actionValueMap = new Map(
          actionValueEntries.map((action) => [action?.action_type ?? "", Number(action?.value ?? 0)]),
        );

        const inlinePostEngagement = Number(row.extra_metrics?.inline_post_engagement ?? 0);
        const inlineLinkClicks = Number(row.extra_metrics?.inline_link_clicks ?? 0);
        const derivedCounts = (row.extra_metrics?.derived_metrics as { counts?: Record<string, unknown> } | null)?.counts ?? {};

        const conversationsStarted = actionCounts.get(CONVERSATION_STARTED_ACTION) ?? 0;
        const messagingConnections = actionCounts.get(CONVERSATION_CONNECTION_ACTION) ?? 0;
        const pageEngagements = Math.max(
          actionCounts.get("post_engagement") ?? 0,
          actionCounts.get("page_engagement") ?? 0,
          inlinePostEngagement,
        );
        const profileVisits = Math.max(
          Number(derivedCounts.instagram_profile_visits ?? 0),
          actionCounts.get("onsite_conversion.profile_visit") ?? 0,
          actionCounts.get("visit_instagram_profile") ?? 0,
        );
        const likes = actionCounts.get("like") ?? 0;
        const comments = actionCounts.get("comment") ?? 0;
        const shares = actionCounts.get("post_share") ?? 0;
        const saves = actionCounts.get("post_save") ?? 0;
        const videoViews = actionCounts.get("video_view") ?? 0;
        const linkClicks = Math.max(actionCounts.get("link_click") ?? 0, inlineLinkClicks, Number(row.clicks ?? 0));
        const landingPageViews = Math.max(
          actionCounts.get("landing_page_view") ?? 0,
          actionCounts.get("omni_landing_page_view") ?? 0,
        );
        const formLeads = actionCounts.get("lead") ?? 0;
        const purchases = Math.max(
          actionCounts.get("purchase") ?? 0,
          actionCounts.get("omni_purchase") ?? 0,
          actionCounts.get("offsite_conversion.fb_pixel_purchase") ?? 0,
        );
        const installs = Math.max(actionCounts.get("app_install") ?? 0, actionCounts.get("mobile_app_install") ?? 0);
        const appEngagements = actionCounts.get("app_engagement") ?? 0;

        const purchaseValue = pickActionValueAmount(row.extra_metrics, [
          "purchase",
          "omni_purchase",
          "offsite_conversion.fb_pixel_purchase",
          "value",
        ]);

        const reachSource = row.reach ?? (row.extra_metrics?.reach as number | undefined) ?? 0;

        const existing = aggregatedMap.get(key);
        if (!existing) {
          aggregatedMap.set(key, {
            ad_set_id: row.ad_set_id,
            campaign_id: row.campaign_id,
            metric_date: row.metric_date,
            impressions: Number(row.impressions ?? 0),
            clicks: Number(row.clicks ?? 0),
            ctr: Number(row.ctr ?? 0),
            spend: Number(row.spend ?? 0),
            cpc: Number(row.cpc ?? 0),
            cpm: Number(row.cpm ?? 0),
            reach: Number(reachSource ?? 0),
            conversationsStarted,
            messagingConnections,
            pageEngagements,
            inlinePostEngagement,
            profileVisits,
            likes,
            comments,
            shares,
            saves,
            videoViews,
            linkClicks,
            inlineLinkClicks,
            landingPageViews,
            formLeads,
            purchases,
            purchaseValue,
            installs,
            appEngagements,
            synced_at: syncedAt,
          });
        } else {
          if (syncedAt >= existing.synced_at) {
            existing.impressions = Number(row.impressions ?? 0);
            existing.clicks = Number(row.clicks ?? 0);
            existing.ctr = Number(row.ctr ?? 0);
            existing.spend = Number(row.spend ?? 0);
            existing.cpc = Number(row.cpc ?? 0);
            existing.cpm = Number(row.cpm ?? 0);
            existing.reach = Number(reachSource ?? 0);
            existing.synced_at = syncedAt;
          }
          existing.conversationsStarted = Math.max(existing.conversationsStarted, conversationsStarted);
          existing.messagingConnections = Math.max(existing.messagingConnections, messagingConnections);
          existing.pageEngagements = Math.max(existing.pageEngagements, pageEngagements);
          existing.inlinePostEngagement = Math.max(existing.inlinePostEngagement, inlinePostEngagement);
          existing.profileVisits = Math.max(existing.profileVisits, profileVisits);
          existing.likes = Math.max(existing.likes, likes);
          existing.comments = Math.max(existing.comments, comments);
          existing.shares = Math.max(existing.shares, shares);
          existing.saves = Math.max(existing.saves, saves);
          existing.videoViews = Math.max(existing.videoViews, videoViews);
          existing.linkClicks = Math.max(existing.linkClicks, linkClicks);
          existing.inlineLinkClicks = Math.max(existing.inlineLinkClicks, inlineLinkClicks);
          existing.landingPageViews = Math.max(existing.landingPageViews, landingPageViews);
          existing.formLeads = Math.max(existing.formLeads, formLeads);
          existing.purchases = Math.max(existing.purchases, purchases);
          existing.purchaseValue = Math.max(existing.purchaseValue, purchaseValue);
          existing.installs = Math.max(existing.installs, installs);
          existing.appEngagements = Math.max(existing.appEngagements, appEngagements);
        }
      }

      metricRows = Array.from(aggregatedMap.values());

      const latestMetricDate = metricRows.reduce<string | null>((latest, row) => {
        if (!row.metric_date) return latest;
        if (!latest || row.metric_date > latest) {
          return row.metric_date;
        }
        return latest;
      }, null);

      const effectiveToIso = latestMetricDate ?? toIso;
      const effectiveFromIso = subtractDaysFromIso(effectiveToIso, Math.max(days - 1, 0));

      toIso = effectiveToIso;
      fromIso = effectiveFromIso;

      if (metricRows.length === 0) {
        return createEmptySummary(fromIso, toIso);
      }

      metricRows = metricRows.filter((row) => row.metric_date >= fromIso && row.metric_date <= toIso);

      if (metricRows.length === 0) {
        return createEmptySummary(fromIso, toIso);
      }

      const adSetIds = new Set<string>();
      for (const row of metricRows) {
        if (row.ad_set_id) {
          adSetIds.add(row.ad_set_id);
        }
      }

      const adSetIdList = Array.from(adSetIds);

      const { data: adSetsData, error: adSetsError } = adSetIdList.length
        ? await supabase
            .from("ad_sets")
            .select("id, targeting, destination_type, promoted_object, campaign_id")
            .in("id", adSetIdList)
        : { data: [], error: null };

      if (adSetsError) {
        console.error("Failed to load ad sets for objective summary", adSetsError.message);
        throw adSetsError;
      }

      const adSetRows = (adSetsData as AdSetRow[]) ?? [];
      const campaignIds = new Set<string>();
      for (const row of adSetRows) {
        if (row.campaign_id) {
          campaignIds.add(row.campaign_id);
        }
      }

      const campaignIdList = Array.from(campaignIds);
      const { data: campaignsData, error: campaignsError } = campaignIdList.length
        ? await supabase
            .from("campaigns")
            .select("id, objective")
            .in("id", campaignIdList)
        : { data: [], error: null };

      if (campaignsError) {
        console.error("Failed to load campaigns for objective summary", campaignsError.message);
        throw campaignsError;
      }

      const campaignObjectiveMap = new Map<string, string | null | undefined>();
      for (const row of (campaignsData as { id: string; objective?: string | null }[]) ?? []) {
        if (row.id) {
          campaignObjectiveMap.set(row.id, row.objective);
        }
      }

      const adSetMap = new Map<string, AdSetMetadata>();
      for (const row of adSetRows) {
        if (!row.id) continue;
        const objectiveSource = row.campaign_id ? campaignObjectiveMap.get(row.campaign_id) : null;
        const objectiveCategory = mapObjective(objectiveSource);
        const platform = normalizePlatform(row);
        adSetMap.set(row.id, { objective: objectiveCategory, platform });
      }

      const engagementPlatform = new Map<PlatformKey, number>();
      const engagementTrend = new Map<string, number>();
      let engagementSpend = 0;
      let engagementPostEngagements = 0;
      let engagementProfileVisits = 0;

      const trafficPlatform = new Map<PlatformKey, number>();
      const trafficTrend = new Map<string, number>();
      let trafficLinkClicks = 0;
      let trafficLandingViews = 0;
      let trafficProfileVisits = 0;
      let trafficSpend = 0;
      let trafficClicksForCtr = 0;
      let trafficImpressionsForCtr = 0;

      const leadsTrend = new Map<string, number>();
      const leadsConvoPlatform = new Map<PlatformKey, number>();
      let leadsFormTotal = 0;
      let leadsSpend = 0;
      let leadsWhatsappConversations = 0;

      const salesTrend = new Map<string, number>();
      const salesPlatform = new Map<PlatformKey, number>();
      let salesPurchases = 0;
      let salesValue = 0;
      let salesSpend = 0;

      const recognitionTrend = new Map<string, number>();
      const recognitionPlatform = new Map<PlatformKey, number>();
      let recognitionReach = 0;
      let recognitionImpressions = 0;
      let recognitionSpend = 0;

      const appTrend = new Map<string, number>();
      const appPlatform = new Map<PlatformKey, number>();
      let appInstalls = 0;
      let appEngagements = 0;
      let appSpend = 0;

      let engagementConnections = 0;
      let engagementLikes = 0;
      let engagementComments = 0;
      let engagementShares = 0;
      let engagementSaves = 0;
      let engagementVideoViews = 0;

      let extrasSpend = 0;
      let extrasValue = 0;
      const extrasTrend = new Map<string, { spend: number; value: number }>();

      for (const row of metricRows) {
        if (!row.ad_set_id) continue;
        const metadata = adSetMap.get(row.ad_set_id);
        const platform = metadata?.platform ?? "other";
        const objective = metadata?.objective ?? "OTHER";

        const spend = Number(row.spend ?? 0);
        const impressions = Number(row.impressions ?? 0);
        const reach = Number(row.reach ?? 0);
        const clicks = Number(row.clicks ?? 0);
        const date = row.metric_date;
        const conversationsStarted = row.conversationsStarted ?? 0;
        const messagingConnections = row.messagingConnections ?? 0;
        const purchaseValue = row.purchaseValue ?? 0;

        extrasSpend += spend;
        extrasValue += purchaseValue;
        addTrendPair(extrasTrend, date, spend, purchaseValue);

        switch (objective) {
          case "ENGAGEMENT": {
            engagementSpend += spend;
            const postEngagementsValue = row.pageEngagements ?? row.inlinePostEngagement ?? 0;
            engagementPostEngagements += postEngagementsValue;
            engagementProfileVisits += row.profileVisits ?? 0;
            incrementMap(engagementPlatform, platform, conversationsStarted);
            engagementConnections += messagingConnections;
            engagementLikes += row.likes ?? 0;
            engagementComments += row.comments ?? 0;
            engagementShares += row.shares ?? 0;
            engagementSaves += row.saves ?? 0;
            engagementVideoViews += row.videoViews ?? 0;
            addTrend(engagementTrend, date, postEngagementsValue > 0 ? postEngagementsValue : conversationsStarted);
            break;
          }
          case "TRAFFIC": {
            const linkClicks =
              row.linkClicks && row.linkClicks > 0
                ? row.linkClicks
                : Math.max(row.inlineLinkClicks ?? 0, clicks);
            const landingViews = row.landingPageViews ?? 0;
            trafficLinkClicks += linkClicks;
            trafficLandingViews += landingViews;
            trafficProfileVisits += row.profileVisits ?? 0;
            trafficSpend += spend;
            trafficClicksForCtr += clicks;
            trafficImpressionsForCtr += impressions;
            incrementMap(trafficPlatform, platform, linkClicks);
            addTrend(trafficTrend, date, linkClicks);
            break;
          }
          case "LEADS": {
            const formLeads = row.formLeads ?? 0;
            const hasConversations = conversationsStarted > 0;
            leadsFormTotal += formLeads;
            leadsSpend += spend;

            if (hasConversations) {
              incrementMap(leadsConvoPlatform, platform, conversationsStarted);
              leadsWhatsappConversations += conversationsStarted;
            }

            addTrend(leadsTrend, date, formLeads + conversationsStarted);
            break;
          }
          case "SALES": {
            const purchases = row.purchases ?? 0;
            salesPurchases += purchases;
            salesValue += purchaseValue;
            salesSpend += spend;
            incrementMap(salesPlatform, platform, purchases);
            addTrend(salesTrend, date, purchases);
            break;
          }
          case "RECOGNITION": {
            recognitionReach += reach;
            recognitionImpressions += impressions;
            recognitionSpend += spend;
            incrementMap(recognitionPlatform, platform, reach);
            addTrend(recognitionTrend, date, reach);
            break;
          }
          case "APP": {
            const installs = row.installs ?? 0;
            const engagements = row.appEngagements ?? 0;
            appInstalls += installs;
            appEngagements += engagements;
            appSpend += spend;
            incrementMap(appPlatform, platform, installs);
            addTrend(appTrend, date, installs);
            break;
          }
          default:
            break;
        }
      }

      const engagementSummary: EngagementSummary = {
        totalConversations: Array.from(engagementPlatform.values()).reduce((acc, value) => acc + value, 0),
        conversationsByPlatform: mapToArray(engagementPlatform),
        messagingConnections: engagementConnections,
        postEngagements: engagementPostEngagements,
        profileVisits: engagementProfileVisits,
        costPerEngagement: engagementPostEngagements > 0 ? engagementSpend / engagementPostEngagements : 0,
        costPerProfileVisit: engagementProfileVisits > 0 ? engagementSpend / engagementProfileVisits : 0,
        likes: engagementLikes,
        comments: engagementComments,
        shares: engagementShares,
        saves: engagementSaves,
        videoViews: engagementVideoViews,
        trend: trendMapToArray(engagementTrend, fromIso, toIso),
      };

      const trafficCtr =
        trafficImpressionsForCtr > 0 ? (trafficClicksForCtr / trafficImpressionsForCtr) * 100 : 0;
      const trafficCpc = trafficLinkClicks > 0 ? trafficSpend / trafficLinkClicks : 0;

      const trafficSummary: TrafficSummary = {
        linkClicks: trafficLinkClicks,
        landingPageViews: trafficLandingViews,
        profileVisits: trafficProfileVisits,
        ctr: trafficCtr,
        cpc: trafficCpc,
        costPerClick: trafficLinkClicks > 0 ? trafficSpend / trafficLinkClicks : 0,
        costPerLanding: trafficLandingViews > 0 ? trafficSpend / trafficLandingViews : 0,
        costPerProfileVisit: trafficProfileVisits > 0 ? trafficSpend / trafficProfileVisits : 0,
        conversationsByPlatform: mapToArray(trafficPlatform),
        trend: trendMapToArray(trafficTrend, fromIso, toIso),
      };

      const cpl = leadsFormTotal > 0 ? leadsSpend / leadsFormTotal : 0;

      const leadsSummary: LeadsSummary = {
        whatsappConversations: leadsWhatsappConversations,
        formLeads: leadsFormTotal,
        cpl,
        costPerConversation: leadsWhatsappConversations > 0 ? leadsSpend / leadsWhatsappConversations : 0,
        trend: trendMapToArray(leadsTrend, fromIso, toIso),
        conversationsByPlatform: mapToArray(leadsConvoPlatform),
      };

      const salesRoas = salesSpend > 0 ? salesValue / salesSpend : 0;

      const salesSummary: SalesSummary = {
        purchases: salesPurchases,
        value: salesValue,
        roas: salesRoas,
        costPerPurchase: salesPurchases > 0 ? salesSpend / salesPurchases : 0,
        trend: trendMapToArray(salesTrend, fromIso, toIso),
        breakdown: mapToArray(salesPlatform),
      };

      const recognitionFrequency =
        recognitionReach > 0 ? recognitionImpressions / recognitionReach : 0;
      const recognitionCpm =
        recognitionImpressions > 0 ? (recognitionSpend / recognitionImpressions) * 1000 : 0;

      const recognitionSummary: RecognitionSummary = {
        reach: recognitionReach,
        frequency: recognitionFrequency,
        cpm: recognitionCpm,
        costPerReach: recognitionReach > 0 ? recognitionSpend / recognitionReach : 0,
        trend: trendMapToArray(recognitionTrend, fromIso, toIso),
        breakdown: mapToArray(recognitionPlatform),
      };

      const appCpi = appInstalls > 0 ? appSpend / appInstalls : 0;

      const appSummary: AppPromotionSummary = {
        installs: appInstalls,
        cpi: appCpi,
        appEngagements,
        costPerEngagement: appEngagements > 0 ? appSpend / appEngagements : 0,
        trend: trendMapToArray(appTrend, fromIso, toIso),
        breakdown: mapToArray(appPlatform),
      };

      const extrasSummary: ExtrasSummary = {
        totalSpend: extrasSpend,
        totalValue: extrasValue,
        roi: extrasSpend > 0 ? extrasValue / extrasSpend : 0,
        trend: trendSpendMapToArray(extrasTrend, fromIso, toIso),
      };

      return {
        engagement: engagementSummary,
        traffic: trafficSummary,
        leads: leadsSummary,
        sales: salesSummary,
        recognition: recognitionSummary,
        app: appSummary,
        extras: extrasSummary,
        dateRange: { from: fromIso, to: toIso },
      };
    },
  });
}
