/**
 * KPI Types - Objective-based Performance Metrics
 *
 * These types define the structure for campaign KPIs that vary by objective.
 * Each campaign shows its PRIMARY RESULT based on its objective, not generic "conversions".
 */

export type CampaignObjective =
  | 'OUTCOME_LEADS'
  | 'LEAD_GENERATION'
  | 'MESSAGES'
  | 'OUTCOME_MESSAGES'
  | 'LINK_CLICKS'
  | 'OUTCOME_TRAFFIC'
  | 'TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'POST_ENGAGEMENT'
  | 'ENGAGEMENT'
  | 'VIDEO_VIEWS'
  | 'SALES'
  | 'CONVERSIONS'
  | 'OUTCOME_SALES'
  | 'PURCHASE'
  | 'UNKNOWN';

export type ResultLabel =
  | 'Leads'
  | 'Conversas'
  | 'Cliques'
  | 'Engajamentos'
  | 'Views'
  | 'Compras'
  | 'Resultados';

/**
 * Primary KPI computed for a campaign based on its objective
 */
export interface PrimaryKPI {
  /** Human-readable label (Leads, Conversas, Cliques, etc) */
  label: ResultLabel;
  /** The actual numeric value of the primary result */
  value: number;
  /** Cost per primary result (spend / value) */
  costPerResult: number | null;
}

/**
 * Raw campaign KPI data from v_campaign_kpi view
 */
export interface CampaignKPIRow {
  metric_date: string;
  workspace_id: string;
  platform_key: string;
  platform_account_id: string;
  account_external_id: string;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  objective: string;
  spend: number;
  clicks: number;
  revenue: number | null;
  result_label: ResultLabel;
  result_value: number | null;
  cost_per_result: number | null;
  roas: number | null;
}

/**
 * Aggregated KPI data for a campaign over a period
 */
export interface AggregatedCampaignKPI {
  campaignId: string;
  campaignName?: string;
  objective: string;
  platformKey: string;

  // Primary KPI
  resultLabel: ResultLabel;
  resultValue: number;
  costPerResult: number | null;

  // Standard metrics
  spend: number;
  clicks: number;

  // Revenue metrics (only for SALES objectives)
  revenue: number | null;
  roas: number | null;

  // Period
  dateFrom: string;
  dateTo: string;
}

/**
 * Aggregated KPI data for an ad set over a period
 */
export interface AggregatedAdSetKPI {
  adSetId: string;
  adSetName?: string;
  campaignId: string;
  objective: string;
  platformKey: string;

  // Primary KPI
  resultLabel: ResultLabel;
  resultValue: number;
  costPerResult: number | null;

  // Standard metrics
  spend: number;
  clicks: number;

  // Revenue metrics (only for SALES objectives)
  revenue: number | null;
  roas: number | null;

  // Period
  dateFrom: string;
  dateTo: string;
}

/**
 * KPI summary for reports and dashboards
 */
export interface KPISummary {
  totalSpend: number;

  // Primary result metrics
  resultLabel: ResultLabel;
  totalResults: number;
  avgCostPerResult: number | null;

  // Revenue metrics (null if not applicable)
  totalRevenue: number | null;
  avgRoas: number | null;

  // Breakdown by objective
  byObjective: Array<{
    objective: string;
    resultLabel: ResultLabel;
    results: number;
    spend: number;
    costPerResult: number | null;
  }>;
}
