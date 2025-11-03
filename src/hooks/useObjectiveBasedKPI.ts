/**
 * useObjectiveBasedKPI - Hook to fetch objective-based KPI data
 *
 * This hook queries the v_campaign_kpi view which correctly maps
 * each campaign to its primary result metric based on objective.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { CampaignKPIRow, AggregatedCampaignKPI } from '@/types/kpi';

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID as string | undefined;

if (!WORKSPACE_ID) {
  throw new Error('Missing VITE_WORKSPACE_ID environment variable.');
}

interface UseObjectiveBasedKPIOptions {
  /** Number of days to look back (default: 30) */
  days?: number;
  /** Filter by campaign ID */
  campaignId?: string | null;
  /** Filter by ad set ID */
  adSetId?: string | null;
  /** Filter by platform */
  platformKey?: string;
  /** Start date (ISO format YYYY-MM-DD) */
  dateFrom?: string;
  /** End date (ISO format YYYY-MM-DD) */
  dateTo?: string;
}

/**
 * Hook to fetch raw KPI data from v_campaign_kpi view
 */
export function useObjectiveBasedKPI(
  options: UseObjectiveBasedKPIOptions = {}
): UseQueryResult<CampaignKPIRow[]> {
  const { days = 30, campaignId, adSetId, platformKey, dateFrom, dateTo } = options;

  return useQuery({
    queryKey: ['objective-kpi', WORKSPACE_ID, { days, campaignId, adSetId, platformKey, dateFrom, dateTo }],
    queryFn: async () => {
      // Calculate date range
      let fromDate = dateFrom;
      let toDate = dateTo;

      if (!fromDate || !toDate) {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));

        fromDate = fromDate || start.toISOString().slice(0, 10);
        toDate = toDate || end.toISOString().slice(0, 10);
      }

      // Build query
      let query = supabase
        .from('v_campaign_kpi')
        .select('*')
        .eq('workspace_id', WORKSPACE_ID)
        .gte('metric_date', fromDate)
        .lte('metric_date', toDate);

      // Apply filters
      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      if (adSetId) {
        query = query.eq('ad_set_id', adSetId);
      }

      if (platformKey) {
        query = query.eq('platform_key', platformKey);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch objective-based KPI data', error);
        throw error;
      }

      return (data as CampaignKPIRow[]) || [];
    },
  });
}

/**
 * Hook to fetch aggregated KPI data by campaign
 */
export function useAggregatedCampaignKPI(
  options: UseObjectiveBasedKPIOptions = {}
): UseQueryResult<AggregatedCampaignKPI[]> {
  const { days = 30, platformKey, dateFrom, dateTo } = options;

  return useQuery({
    queryKey: ['aggregated-campaign-kpi', WORKSPACE_ID, { days, platformKey, dateFrom, dateTo }],
    queryFn: async () => {
      // Calculate date range
      let fromDate = dateFrom;
      let toDate = dateTo;

      if (!fromDate || !toDate) {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));

        fromDate = fromDate || start.toISOString().slice(0, 10);
        toDate = toDate || end.toISOString().slice(0, 10);
      }

      // Fetch raw KPI data
      let query = supabase
        .from('v_campaign_kpi')
        .select('*')
        .eq('workspace_id', WORKSPACE_ID)
        .gte('metric_date', fromDate)
        .lte('metric_date', toDate)
        .not('campaign_id', 'is', null)
        .is('ad_set_id', null)
        .is('ad_id', null);

      if (platformKey) {
        query = query.eq('platform_key', platformKey);
      }

      const { data: kpiData, error: kpiError } = await query;

      if (kpiError) {
        console.error('Failed to fetch KPI data for aggregation', kpiError);
        throw kpiError;
      }

      const rows = (kpiData as CampaignKPIRow[]) || [];

      // Group by campaign_id
      const campaignMap = new Map<string, AggregatedCampaignKPI>();

      for (const row of rows) {
        const campaignId = row.campaign_id;
        if (!campaignId) continue;

        const existing = campaignMap.get(campaignId);

        if (!existing) {
          campaignMap.set(campaignId, {
            campaignId,
            objective: row.objective,
            platformKey: row.platform_key,
            resultLabel: row.result_label,
            resultValue: row.result_value || 0,
            costPerResult: null,
            spend: row.spend || 0,
            clicks: row.clicks || 0,
            revenue: row.revenue || null,
            roas: null,
            dateFrom: fromDate,
            dateTo: toDate,
          });
        } else {
          // Aggregate
          existing.spend += row.spend || 0;
          existing.clicks += row.clicks || 0;
          existing.resultValue += row.result_value || 0;

          if (row.revenue) {
            existing.revenue = (existing.revenue || 0) + row.revenue;
          }
        }
      }

      // Calculate cost_per_result and ROAS for each campaign
      const aggregated = Array.from(campaignMap.values());

      for (const campaign of aggregated) {
        if (campaign.resultValue > 0) {
          campaign.costPerResult = campaign.spend / campaign.resultValue;
        }

        // Only calculate ROAS for SALES objectives
        const isSalesObjective =
          campaign.objective.includes('SALES') ||
          campaign.objective.includes('PURCHASE') ||
          campaign.objective.includes('CONVERSIONS') ||
          campaign.objective === 'OUTCOME_SALES';

        if (isSalesObjective && campaign.revenue && campaign.revenue > 0 && campaign.spend > 0) {
          campaign.roas = campaign.revenue / campaign.spend;
        }
      }

      // Fetch campaign names
      const campaignIds = Array.from(campaignMap.keys());
      if (campaignIds.length > 0) {
        const { data: campaignsData } = await supabase
          .from('campaigns')
          .select('id, name')
          .in('id', campaignIds);

        if (campaignsData) {
          const nameMap = new Map(campaignsData.map((c) => [c.id, c.name]));
          for (const campaign of aggregated) {
            campaign.campaignName = nameMap.get(campaign.campaignId) || undefined;
          }
        }
      }

      return aggregated;
    },
  });
}

/**
 * Hook to fetch KPI summary across all campaigns
 */
export function useKPISummary(
  options: UseObjectiveBasedKPIOptions = {}
): UseQueryResult<{
  totalSpend: number;
  totalClicks: number;
  totalRevenue: number;
  avgRoas: number | null;
  byObjective: Array<{
    objective: string;
    resultLabel: string;
    resultValue: number;
    spend: number;
    costPerResult: number | null;
  }>;
}> {
  const { days = 30, platformKey, dateFrom, dateTo } = options;

  return useQuery({
    queryKey: ['kpi-summary', WORKSPACE_ID, { days, platformKey, dateFrom, dateTo }],
    queryFn: async () => {
      // Calculate date range
      let fromDate = dateFrom;
      let toDate = dateTo;

      if (!fromDate || !toDate) {
        const end = new Date();
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));

        fromDate = fromDate || start.toISOString().slice(0, 10);
        toDate = toDate || end.toISOString().slice(0, 10);
      }

      // Fetch raw KPI data
      let query = supabase
        .from('v_campaign_kpi')
        .select('*')
        .eq('workspace_id', WORKSPACE_ID)
        .gte('metric_date', fromDate)
        .lte('metric_date', toDate);

      if (platformKey) {
        query = query.eq('platform_key', platformKey);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch KPI summary', error);
        throw error;
      }

      const rows = (data as CampaignKPIRow[]) || [];

      let totalSpend = 0;
      let totalClicks = 0;
      let totalRevenue = 0;

      const objectiveMap = new Map<
        string,
        {
          resultLabel: string;
          resultValue: number;
          spend: number;
        }
      >();

      for (const row of rows) {
        totalSpend += row.spend || 0;
        totalClicks += row.clicks || 0;
        totalRevenue += row.revenue || 0;

        const key = row.objective;
        const existing = objectiveMap.get(key);

        if (!existing) {
          objectiveMap.set(key, {
            resultLabel: row.result_label,
            resultValue: row.result_value || 0,
            spend: row.spend || 0,
          });
        } else {
          existing.resultValue += row.result_value || 0;
          existing.spend += row.spend || 0;
        }
      }

      const byObjective = Array.from(objectiveMap.entries()).map(([objective, data]) => ({
        objective,
        resultLabel: data.resultLabel,
        resultValue: data.resultValue,
        spend: data.spend,
        costPerResult: data.resultValue > 0 ? data.spend / data.resultValue : null,
      }));

      const avgRoas = totalSpend > 0 && totalRevenue > 0 ? totalRevenue / totalSpend : null;

      return {
        totalSpend,
        totalClicks,
        totalRevenue,
        avgRoas,
        byObjective,
      };
    },
  });
}
