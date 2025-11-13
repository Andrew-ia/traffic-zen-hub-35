import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import {
  CONVERSATION_CONNECTION_ACTION,
  CONVERSATION_STARTED_ACTION,
  getActionValueForType,
  type MetaExtraMetrics,
} from "@/lib/conversionMetrics";

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim();

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
  channelComparison: ChannelComparisonItem[];
  objectiveBreakdown: ObjectiveBreakdownItem[];
  topCampaigns: EntityPerformanceItem[];
  topAdSets: EntityPerformanceItem[];
  topAds: EntityPerformanceItem[];
  topCreatives: EntityPerformanceItem[];
  dataQuality: DataQualityIssue[];
}

export interface ChannelComparisonItem {
  channelKey: "meta" | "google";
  label: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversations: number;
  ctr: number;
  cpc: number;
  cpa: number;
  notes?: string;
}

export interface ObjectiveBreakdownItem {
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversations: number;
  ctr: number;
  cpc: number;
  cpa: number;
  costPerConversation: number;
}

export interface EntityPerformanceItem {
  id: string;
  name: string;
  parentName?: string;
  status?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversations: number;
  ctr: number;
  cpc: number;
  cpa: number;
  costPerConversation: number;
}

export interface DataQualityIssue {
  issue: string;
  impact: string;
  recommendation: string;
  severity: "low" | "medium" | "high";
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
      const untilIso = now.toISOString().slice(0, 10);

      const [
        { data: metrics, error: metricsError },
        { data: platformAccounts, error: paError },
        { data: metaDetail, error: metaDetailError },
        { data: campaigns, error: campaignError },
        { data: creatives, error: creativeError },
        { data: googleSpend, error: googleError },
      ] = await Promise.all([
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
          .select("id, name, platform_key")
          .eq("workspace_id", WORKSPACE_ID),
        supabase
          .from("performance_metrics")
          .select(
            "campaign_id, ad_set_id, ad_id, creative_asset_id, platform_account_id, metric_date, impressions, clicks, spend, extra_metrics",
          )
          .eq("workspace_id", WORKSPACE_ID)
          .not("ad_set_id", "is", null)
          .gte("metric_date", sinceIso)
          .lte("metric_date", untilIso)
          .eq("granularity", "day"),
        supabase
          .from("campaigns")
          .select("id, name, objective, status")
          .eq("workspace_id", WORKSPACE_ID),
        supabase
          .from("creative_assets")
          .select("id, name, type, status")
          .eq("workspace_id", WORKSPACE_ID),
        supabase
          .from("ads_spend_google")
          .select(
            "campaign_id_google, campaign_name, campaign_status, metric_date, impressions, clicks, cost_micros, conversions, conversions_value, platform_account_id",
          )
          .eq("workspace_id", WORKSPACE_ID)
          .gte("metric_date", sinceIso)
          .lte("metric_date", untilIso),
      ]);
      if (metricsError) {
        console.error("Failed to load performance metrics for reports", metricsError.message);
        throw metricsError;
      }


      if (paError) {
        console.error("Failed to load platform accounts for reports", paError.message);
        throw paError;
      }

      const optionalIssues: DataQualityIssue[] = [];

      if (metaDetailError) {
        console.warn("Failed to load detailed performance metrics", metaDetailError.message);
        optionalIssues.push({
          issue: "Métricas detalhadas indisponíveis",
          impact: "Não foi possível carregar dados diários por conjunto/anúncio. Rankings de Meta podem estar vazios.",
          recommendation: "Verifique permissões na tabela performance_metrics para níveis de conjunto/anúncio.",
          severity: "medium",
        });
      }

      if (campaignError) {
        console.warn("Failed to load campaigns for reports", campaignError.message);
        optionalIssues.push({
          issue: "Campanhas não carregadas",
          impact: "Sem informações de nome/objetivo das campanhas, a tabela de objetivos fica incompleta.",
          recommendation: "Confirme permissões de leitura na tabela campaigns para o workspace atual.",
          severity: "medium",
        });
      }

      if (creativeError) {
        console.warn("Failed to load creative assets", creativeError.message);
        optionalIssues.push({
          issue: "Criativos não carregados",
          impact: "Os rankings de criativos não puderam ser montados.",
          recommendation: "Revisar grants na tabela creative_assets ou refazer sincronização.",
          severity: "low",
        });
      }

      if (googleError) {
        console.warn("Failed to load Google Ads spend data", googleError.message);
        optionalIssues.push({
          issue: "Google Ads não carregado",
          impact: "Comparativo de canais pode estar incompleto sem os dados de Google.",
          recommendation: "Verifique se a tabela ads_spend_google está acessível (grants/RLS) e se a sincronização foi executada.",
          severity: "high",
        });
      }

      const platformAccountIds = (platformAccounts ?? [])
        .map((account) => account.id)
        .filter((id): id is string => Boolean(id));

      let adSets: { id: string; name: string; status: string | null; campaign_id: string | null }[] = [];
      let ads: {
        id: string;
        name: string;
        status: string | null;
        ad_set_id: string | null;
        creative_asset_id: string | null;
        platform_account_id: string | null;
      }[] = [];

      if (platformAccountIds.length > 0 && !metaDetailError) {
        const [{ data: adSetData, error: adSetError }, { data: adData, error: adsError }] = await Promise.all([
          supabase
            .from("ad_sets")
            .select("id, name, status, campaign_id, platform_account_id")
            .in("platform_account_id", platformAccountIds),
          supabase
            .from("ads")
            .select("id, name, status, ad_set_id, creative_asset_id, platform_account_id")
            .in("platform_account_id", platformAccountIds),
        ]);

        if (adSetError) {
          console.warn("Failed to load ad sets for reports", adSetError.message);
          optionalIssues.push({
            issue: "Conjuntos não carregados",
            impact: "Ranking de conjuntos pode estar ausente.",
            recommendation: "Confirme permissões de leitura na tabela ad_sets para o workspace.",
            severity: "medium",
          });
        }

        if (adsError) {
          console.warn("Failed to load ads for reports", adsError.message);
          optionalIssues.push({
            issue: "Anúncios não carregados",
            impact: "Ranking de anúncios e criativos pode estar incompleto.",
            recommendation: "Verificar grants/RLS da tabela ads.",
            severity: "medium",
          });
        }

        adSets = adSetData ?? [];
        ads = adData ?? [];
      }

      const platformNameMap = new Map<string, string>();
      const platformKeyMap = new Map<string, string>();
      for (const account of platformAccounts ?? []) {
        if (account.id) {
          platformNameMap.set(account.id, account.name ?? account.id);
          platformKeyMap.set(account.id, account.platform_key ?? "meta");
        }
      }

      const campaignMap = new Map<
        string,
        { id: string; name: string; objective: string | null; status: string | null }
      >();
      for (const campaign of campaigns ?? []) {
        if (campaign?.id) {
          campaignMap.set(campaign.id, {
            id: campaign.id,
            name: campaign.name ?? "Campanha sem nome",
            objective: campaign.objective ?? null,
            status: campaign.status ?? null,
          });
        }
      }

      const adSetMap = new Map<
        string,
        { id: string; name: string; status: string | null; campaign_id: string | null }
      >();
      for (const adSet of adSets ?? []) {
        if (adSet?.id) {
          adSetMap.set(adSet.id, {
            id: adSet.id,
            name: adSet.name ?? "Conjunto sem nome",
            status: adSet.status ?? null,
            campaign_id: adSet.campaign_id ?? null,
          });
        }
      }

      const adMap = new Map<
        string,
        {
          id: string;
          name: string;
          status: string | null;
          ad_set_id: string | null;
          creative_asset_id: string | null;
          platform_account_id: string | null;
        }
      >();
      for (const ad of ads ?? []) {
        if (ad?.id) {
          adMap.set(ad.id, {
            id: ad.id,
            name: ad.name ?? "Anúncio sem nome",
            status: ad.status ?? null,
            ad_set_id: ad.ad_set_id ?? null,
            creative_asset_id: ad.creative_asset_id ?? null,
            platform_account_id: ad.platform_account_id ?? null,
          });
        }
      }

      const creativeMap = new Map<string, { id: string; name: string; type: string | null; status: string | null }>();
      for (const creative of creatives ?? []) {
        if (creative?.id) {
          creativeMap.set(creative.id, {
            id: creative.id,
            name: creative.name ?? "Criativo sem nome",
            type: creative.type ?? null,
            status: creative.status ?? null,
          });
        }
      }

      type Totals = {
        spend: number;
        impressions: number;
        clicks: number;
        conversions: number;
        conversations: number;
      };

      const initTotals = (): Totals => ({
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversations: 0,
      });

      type AggregateRecord = Totals & {
        id: string;
        name: string;
        status?: string | null;
        parentId?: string | null;
        parentName?: string;
        objective?: string | null;
        creativeId?: string | null;
        typeLabel?: string | null;
      };

      const metaChannel: ChannelComparisonItem = {
        channelKey: "meta",
        label: "Meta Ads",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversations: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
      };

      const googleChannel: ChannelComparisonItem = {
        channelKey: "google",
        label: "Google Ads",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversations: 0,
        ctr: 0,
        cpc: 0,
        cpa: 0,
      };

      const objectiveTotals = new Map<string, Totals>();
      const campaignAggregates = new Map<string, AggregateRecord>();
      const adSetAggregates = new Map<string, AggregateRecord>();
      const adAggregates = new Map<string, AggregateRecord>();
      const creativeAggregates = new Map<string, AggregateRecord>();
      const channelAggregatesCurrent = new Map<"meta" | "google", Totals>();
      const channelAggregatesPrevious = new Map<"meta" | "google", Totals>();
      const metaTotalsCurrent = initTotals();
      const googleTotalsCurrent = initTotals();

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
        // NOTE: This is using generic "conversions" = conversations_started for ALL objectives
        // TODO: Use v_campaign_kpi view to get objective-specific primary results
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

            const spendValue = Number(row.spend ?? 0);
            platformAggregate.spend += spendValue;
            platformAggregate.conversions += conversions;
            platformAggregate.conversationsStarted += started;
            platformAggregate.messagingConnections += connections;
            platformAggregate.impressions += Number(row.impressions ?? 0);

            platformTotals.set(row.platform_account_id, platformAggregate);

            const platformKey = platformKeyMap.get(row.platform_account_id);
            const channelKey = platformKey === "google_ads" ? "google" : platformKey === "meta" ? "meta" : null;
            if (channelKey) {
              const targetChannelMap = targetBucket === "current" ? channelAggregatesCurrent : channelAggregatesPrevious;
              const channelTotal = targetChannelMap.get(channelKey) ?? initTotals();
              channelTotal.spend += spendValue;
              channelTotal.impressions += Number(row.impressions ?? 0);
              channelTotal.clicks += Number(row.clicks ?? 0);
              channelTotal.conversions += conversions;
              channelTotal.conversations += connections;
              targetChannelMap.set(channelKey, channelTotal);

              if (targetBucket === "current") {
                const runningTotal = channelKey === "meta" ? metaTotalsCurrent : googleTotalsCurrent;
                runningTotal.spend += spendValue;
                runningTotal.impressions += Number(row.impressions ?? 0);
                runningTotal.clicks += Number(row.clicks ?? 0);
                runningTotal.conversions += conversions;
                runningTotal.conversations += connections;
              }
            }
          }
        }
      }

      if (!metaDetailError) {
        for (const row of metaDetail ?? []) {
          const metricDate = new Date(row.metric_date as string);
          metricDate.setHours(0, 0, 0, 0);
          if (metricDate < midpoint) continue;

          const spend = Number(row.spend ?? 0);
          const impressions = Number(row.impressions ?? 0);
          const clicks = Number(row.clicks ?? 0);
          const extraMetrics = row.extra_metrics as MetaExtraMetrics | null;
          const started = getActionValueForType(extraMetrics, CONVERSATION_STARTED_ACTION) ?? 0;
          const connections = getActionValueForType(extraMetrics, CONVERSATION_CONNECTION_ACTION) ?? 0;
          const adId = (row.ad_id as string | null) ?? null;
          const adSetId = (row.ad_set_id as string | null) ?? null;
          let campaignId = (row.campaign_id as string | null) ?? null;
          if (!campaignId && adSetId) {
            campaignId = adSetMap.get(adSetId)?.campaign_id ?? null;
          }
          const campaignInfo = campaignId ? campaignMap.get(campaignId) : undefined;
          const objectiveKey = campaignInfo?.objective ?? "Sem objetivo definido";

          if (!adId) {
            const objectiveAgg = objectiveTotals.get(objectiveKey) ?? initTotals();
            objectiveAgg.spend += spend;
            objectiveAgg.impressions += impressions;
            objectiveAgg.clicks += clicks;
            objectiveAgg.conversions += started;
            objectiveAgg.conversations += connections;
            objectiveTotals.set(objectiveKey, objectiveAgg);

            if (campaignId) {
              const existing = campaignAggregates.get(campaignId) ?? {
                ...initTotals(),
                id: campaignId,
                name: campaignInfo?.name ?? "Campanha sem nome",
                status: campaignInfo?.status ?? null,
                objective: campaignInfo?.objective ?? null,
              };
              existing.spend += spend;
              existing.impressions += impressions;
              existing.clicks += clicks;
              existing.conversions += started;
              existing.conversations += connections;
              campaignAggregates.set(campaignId, existing);
            }

            if (adSetId) {
              const adSetInfo = adSetMap.get(adSetId);
              const parentCampaignName = adSetInfo?.campaign_id ? campaignMap.get(adSetInfo.campaign_id)?.name : undefined;
              const existing = adSetAggregates.get(adSetId) ?? {
                ...initTotals(),
                id: adSetId,
                name: adSetInfo?.name ?? "Conjunto sem nome",
                status: adSetInfo?.status ?? null,
                parentId: adSetInfo?.campaign_id ?? undefined,
                parentName: parentCampaignName,
              };
              existing.spend += spend;
              existing.impressions += impressions;
              existing.clicks += clicks;
              existing.conversions += started;
              existing.conversations += connections;
              adSetAggregates.set(adSetId, existing);
            }
          } else {
            const adInfo = adMap.get(adId);
            const adSetInfo = adInfo?.ad_set_id
              ? adSetMap.get(adInfo.ad_set_id)
              : adSetId
                ? adSetMap.get(adSetId)
                : undefined;
            const parentCampaignName =
              adSetInfo?.campaign_id && campaignMap.get(adSetInfo.campaign_id)
                ? campaignMap.get(adSetInfo.campaign_id)?.name
                : campaignInfo?.name;

            const existing = adAggregates.get(adId) ?? {
              ...initTotals(),
              id: adId,
              name: adInfo?.name ?? "Anúncio sem nome",
              status: adInfo?.status ?? null,
              parentId: adSetInfo?.id ?? undefined,
              parentName: adSetInfo?.name ?? undefined,
              objective: campaignInfo?.objective ?? null,
              creativeId: adInfo?.creative_asset_id ?? (row.creative_asset_id as string | null) ?? null,
            };
            existing.spend += spend;
            existing.impressions += impressions;
            existing.clicks += clicks;
            existing.conversions += started;
            existing.conversations += connections;
            existing.parentName = existing.parentName ?? parentCampaignName ?? undefined;
            if (!existing.creativeId) {
              existing.creativeId = (row.creative_asset_id as string | null) ?? adInfo?.creative_asset_id ?? null;
            }
            adAggregates.set(adId, existing);

            const creativeId =
              (row.creative_asset_id as string | null) ?? adInfo?.creative_asset_id ?? existing.creativeId ?? null;
            if (creativeId) {
              const creativeInfo = creativeMap.get(creativeId);
              const creativeAggregate = creativeAggregates.get(creativeId) ?? {
                ...initTotals(),
                id: creativeId,
                name: creativeInfo?.name ?? "Criativo sem nome",
                status: creativeInfo?.status ?? null,
                typeLabel: creativeInfo?.type ?? null,
              };
              creativeAggregate.spend += spend;
              creativeAggregate.impressions += impressions;
              creativeAggregate.clicks += clicks;
              creativeAggregate.conversions += started;
              creativeAggregate.conversations += connections;
              creativeAggregates.set(creativeId, creativeAggregate);
            }
          }
        }
      }

      if (!googleError) {
        for (const row of googleSpend ?? []) {
          const metricDate = new Date(row.metric_date as string);
          metricDate.setHours(0, 0, 0, 0);
          const spend = Number(row.cost_micros ?? 0) / 1_000_000;
          const impressions = Number(row.impressions ?? 0);
          const clicks = Number(row.clicks ?? 0);
          const conversions = Number(row.conversions ?? 0);
          const conversionValue = Number(row.conversions_value ?? 0);

          const bucket = metricDate >= midpoint ? "current" : "previous";
          bucketTotals[bucket].spend += spend;
          bucketTotals[bucket].impressions += impressions;
          bucketTotals[bucket].clicks += clicks;
          bucketTotals[bucket].conversions += conversions;
          bucketTotals[bucket].conversionValue += conversionValue;

          const dateKey = metricDate.toISOString().slice(0, 10);
          if (bucket === "current") {
            const existing = timeSeriesMap.get(dateKey) ?? {
              date: dateKey,
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
            existing.spend += spend;
            existing.conversionValue += conversionValue;
            existing.roas = existing.spend > 0 ? existing.conversionValue / existing.spend : 0;
            timeSeriesMap.set(dateKey, existing);
          }

          const channelMap = metricDate >= midpoint ? channelAggregatesCurrent : channelAggregatesPrevious;
          const channelTotal = channelMap.get("google") ?? initTotals();
          channelTotal.spend += spend;
          channelTotal.impressions += impressions;
          channelTotal.clicks += clicks;
          channelTotal.conversions += conversions;
          channelTotal.conversations += conversions;
          channelMap.set("google", channelTotal);

          if (bucket === "current") {
            googleTotalsCurrent.spend += spend;
            googleTotalsCurrent.impressions += impressions;
            googleTotalsCurrent.clicks += clicks;
            googleTotalsCurrent.conversions += conversions;
            googleTotalsCurrent.conversations += conversions;
          }

          const platformAggregate = platformTotals.get("google:aggregate") ?? {
            platformAccountId: "google:aggregate",
            name: "Google Ads",
            spend: 0,
            conversions: 0,
            conversationsStarted: 0,
            messagingConnections: 0,
            impressions: 0,
          };
          platformAggregate.spend += spend;
          platformAggregate.conversions += conversions;
          platformAggregate.impressions += impressions;
          platformTotals.set("google:aggregate", platformAggregate);
        }
      }

      metaChannel.spend = metaTotalsCurrent.spend;
      metaChannel.impressions = metaTotalsCurrent.impressions;
      metaChannel.clicks = metaTotalsCurrent.clicks;
      metaChannel.conversions = metaTotalsCurrent.conversions;
      metaChannel.conversations = metaTotalsCurrent.conversations;

      googleChannel.spend = googleTotalsCurrent.spend;
      googleChannel.impressions = googleTotalsCurrent.impressions;
      googleChannel.clicks = googleTotalsCurrent.clicks;
      googleChannel.conversions = googleTotalsCurrent.conversions;
      googleChannel.conversations = googleTotalsCurrent.conversations;

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

      if (channelAggregatesCurrent.get("google")) {
        const googleAggregate = platformTotals.get("google:aggregate");
        if (!googleAggregate) {
          platformTotals.set("google:aggregate", {
            platformAccountId: "google:aggregate",
            name: "Google Ads",
            spend: channelAggregatesCurrent.get("google")!.spend,
            conversions: channelAggregatesCurrent.get("google")!.conversions,
            conversationsStarted: 0,
            messagingConnections: 0,
            impressions: channelAggregatesCurrent.get("google")!.impressions,
          });
        }
      }

      const platformBreakdown = Array.from(platformTotals.values())
        .filter((item) => item.spend > 0)
        .sort((a, b) => b.spend - a.spend);

      const finalizeChannel = (channel: ChannelComparisonItem) => {
        channel.ctr = channel.impressions > 0 ? (channel.clicks / channel.impressions) * 100 : 0;
        channel.cpc = channel.clicks > 0 ? channel.spend / channel.clicks : 0;
        channel.cpa = channel.conversions > 0 ? channel.spend / channel.conversions : 0;
      };

      finalizeChannel(metaChannel);
      finalizeChannel(googleChannel);

      const channelComparison = [metaChannel, googleChannel];

      const objectiveBreakdown: ObjectiveBreakdownItem[] = Array.from(objectiveTotals.entries())
        .map(([objective, totals]) => ({
          objective,
          spend: totals.spend,
          impressions: totals.impressions,
          clicks: totals.clicks,
          conversions: totals.conversions,
          conversations: totals.conversations,
          ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
          cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
          costPerConversation: totals.conversations > 0 ? totals.spend / totals.conversations : 0,
        }))
        .sort((a, b) => b.spend - a.spend);

      const toEntityPerformance = (record: AggregateRecord): EntityPerformanceItem => ({
        id: record.id,
        name: record.name,
        parentName: record.parentName,
        status: record.status ?? undefined,
        spend: record.spend,
        impressions: record.impressions,
        clicks: record.clicks,
        conversions: record.conversions,
        conversations: record.conversations,
        ctr: record.impressions > 0 ? (record.clicks / record.impressions) * 100 : 0,
        cpc: record.clicks > 0 ? record.spend / record.clicks : 0,
        cpa: record.conversions > 0 ? record.spend / record.conversions : 0,
        costPerConversation: record.conversations > 0 ? record.spend / record.conversations : 0,
      });

      const topCampaigns = Array.from(campaignAggregates.values())
        .map(toEntityPerformance)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

      const topAdSets = Array.from(adSetAggregates.values())
        .map(toEntityPerformance)
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

      const topAds = Array.from(adAggregates.values())
        .map((record) => {
          const entity = toEntityPerformance(record);
          entity.parentName = record.parentName ?? entity.parentName;
          return entity;
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

      const topCreatives = Array.from(creativeAggregates.values())
        .map((record) => {
          const entity = toEntityPerformance(record);
          if (record.typeLabel) {
            entity.parentName = record.typeLabel;
          }
          return entity;
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);

      const dataQuality: DataQualityIssue[] = [...optionalIssues];

      const spendVariance = metaChannel.spend - bucketTotals.current.spend;
      const spendVariancePct =
        metaChannel.spend > 0 ? Math.abs(spendVariance) / metaChannel.spend : 0;
      if (Math.abs(spendVariance) > 5 && spendVariancePct > 0.01) {
        dataQuality.push({
          issue: "Diferença entre spend por nível",
          impact: `Diferença de R$ ${Math.abs(spendVariance).toFixed(2)} entre o spend consolidado e o de conjuntos.`,
          recommendation:
            "Garantir que relatórios dediquem-se a um único nível (campanha, conjunto ou anúncio) para evitar somas duplicadas.",
          severity: "medium",
        });
      }

      const adsWithoutCreative = Array.from(adAggregates.values()).filter((agg) => !agg.creativeId).length;
      if (adsWithoutCreative > 0) {
        dataQuality.push({
          issue: "Anúncios sem criativo vinculado",
          impact: `${adsWithoutCreative} anúncios não apontam para um criativo na base, bloqueando análises de peça criativa.`,
          recommendation:
            "Reprocessar a sincronização Meta garantindo preenchimento de creative_asset_id nos anúncios.",
          severity: "medium",
        });
      }

      if (!googleError && (googleSpend ?? []).length === 0) {
        dataQuality.push({
          issue: "Google Ads sem histórico",
          impact: "Nenhum registro disponível na tabela ads_spend_google para o período analisado.",
          recommendation:
            "Rodar o script de importação ou sincronização do Google Ads antes de exibir os relatórios ao cliente.",
          severity: "high",
        });
      }

      const result: ReportsData = {
        summary,
        timeSeries,
        platformBreakdown,
        channelComparison,
        objectiveBreakdown,
        topCampaigns,
        topAdSets,
        topAds,
        topCreatives,
        dataQuality,
      } satisfies ReportsData;

      return result;
    },
  });
}
