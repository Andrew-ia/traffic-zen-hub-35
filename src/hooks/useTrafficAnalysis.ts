import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error("Missing VITE_WORKSPACE_ID environment variable.");
}

export interface CampaignPerformance {
  id: string;
  name: string;
  objective: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpl: number;
  roas: number;
  conversationsStarted: number;
  linkClicks: number;
  landingPageViews: number;
  checkoutsInitiated: number;
}

export interface TrafficAnalysis {
  activeCampaigns: CampaignPerformance[];
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    conversationsStarted: number;
    checkoutsInitiated: number;
  };
  byObjective: Record<string, {
    count: number;
    spend: number;
    conversions: number;
    cpl: number;
  }>;
}

export function useTrafficAnalysis(days: number = 30): UseQueryResult<TrafficAnalysis> {
  return useQuery({
    queryKey: ["traffic-analysis", WORKSPACE_ID, days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceIso = since.toISOString().slice(0, 10);

      // Buscar campanhas com gasto
      const { data: metricsData } = await supabase
        .from('performance_metrics')
        .select('campaign_id')
        .eq('workspace_id', WORKSPACE_ID)
        .not('campaign_id', 'is', null)
        .is('ad_set_id', null)
        .is('ad_id', null)
        .gt('spend', 0)
        .gte('metric_date', sinceIso);

      const activeCampaignIds = [...new Set(metricsData?.map(m => m.campaign_id))];

      // Buscar detalhes das campanhas
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, objective')
        .in('id', activeCampaignIds);

      const campaignMap = new Map(campaigns?.map(c => [c.id, c]) || []);

      // Buscar métricas detalhadas
      const activeCampaigns: CampaignPerformance[] = [];
      const byObjective: Record<string, { count: number; spend: number; conversions: number; cpl: number }> = {};

      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      let totalConversationsStarted = 0;
      let totalCheckoutsInitiated = 0;

      for (const campaignId of activeCampaignIds) {
        const campaign = campaignMap.get(campaignId);
        if (!campaign) continue;

        const { data: metrics } = await supabase
          .from('performance_metrics')
          .select('impressions, clicks, conversions, spend, extra_metrics')
          .eq('workspace_id', WORKSPACE_ID)
          .eq('campaign_id', campaignId)
          .is('ad_set_id', null)
          .is('ad_id', null)
          .gte('metric_date', sinceIso);

        let impressions = 0;
        let clicks = 0;
        let conversions = 0;
        let spend = 0;
        let conversationsStarted = 0;
        let linkClicks = 0;
        let landingPageViews = 0;
        let checkoutsInitiated = 0;

        metrics?.forEach(m => {
          impressions += Number(m.impressions) || 0;
          clicks += Number(m.clicks) || 0;
          conversions += Number(m.conversions) || 0;
          spend += Number(m.spend) || 0;

          const actions = m.extra_metrics?.actions || [];
          actions.forEach((action: any) => {
            const value = Number(action.value) || 0;
            if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
              conversationsStarted += value;
            } else if (action.action_type === 'link_click') {
              linkClicks += value;
            } else if (action.action_type === 'landing_page_view' || action.action_type === 'omni_landing_page_view') {
              landingPageViews += value;
            } else if (
              action.action_type === 'omni_checkout_initiated' ||
              action.action_type === 'checkout_initiated' ||
              action.action_type === 'initiate_checkout'
            ) {
              checkoutsInitiated += value;
            }
          });
        });

        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpl = conversationsStarted > 0 ? spend / conversationsStarted : 0;

        activeCampaigns.push({
          id: campaign.id,
          name: campaign.name,
          objective: campaign.objective || 'Outros',
          status: campaign.status,
          spend,
          impressions,
          clicks,
          conversions,
          ctr,
          cpc,
          cpl,
          roas: 0, // Será calculado quando houver vendas
          conversationsStarted,
          linkClicks,
          landingPageViews,
          checkoutsInitiated,
        });

        totalSpend += spend;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalConversions += conversions;
        totalConversationsStarted += conversationsStarted;
        totalCheckoutsInitiated += checkoutsInitiated;

        // Agregar por objetivo
        const objective = campaign.objective || 'Outros';
        if (!byObjective[objective]) {
          byObjective[objective] = { count: 0, spend: 0, conversions: 0, cpl: 0 };
        }
        byObjective[objective].count++;
        byObjective[objective].spend += spend;
        byObjective[objective].conversions += conversationsStarted;
      }

      // Calcular CPL por objetivo
      Object.keys(byObjective).forEach(obj => {
        const data = byObjective[obj];
        data.cpl = data.conversions > 0 ? data.spend / data.conversions : 0;
      });

      // Ordenar por gasto
      activeCampaigns.sort((a, b) => b.spend - a.spend);

      return {
        activeCampaigns,
        totals: {
          spend: totalSpend,
          impressions: totalImpressions,
          clicks: totalClicks,
          conversions: totalConversions,
          ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
          conversationsStarted: totalConversationsStarted,
          checkoutsInitiated: totalCheckoutsInitiated,
        },
        byObjective,
      };
    },
  });
}
