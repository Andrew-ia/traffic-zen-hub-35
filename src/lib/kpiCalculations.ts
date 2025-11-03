/**
 * KPI Calculations - Objective-based Performance Metrics
 *
 * Deterministic functions to compute primary KPIs based on campaign objectives.
 * These functions implement the official mapping from the plan.
 */

import type { CampaignObjective, PrimaryKPI, ResultLabel } from '@/types/kpi';

/**
 * Official objective-to-metric mapping
 *
 * - OUTCOME_LEADS | LEAD_GENERATION → Leads = `leads`; custo = spend/leads
 * - MESSAGES → Conversas = `conversations_started`; custo = spend/conversations_started
 * - LINK_CLICKS → Cliques = `clicks`; custo = spend/clicks
 * - OUTCOME_ENGAGEMENT | POST_ENGAGEMENT → Engajamentos = `engagements`; custo = spend/engagements
 * - VIDEO_VIEWS → Views = `video_views`/`thruplays`; custo = spend/views
 * - SALES | CONVERSIONS (compra) → Compras = `purchases`; custo = spend/purchases; ROAS se `revenue` > 0
 * - Google Ads sem conversão válida → tratar como LINK_CLICKS
 */

interface MetricRow {
  objective?: string | null;
  platform_key?: string;
  leads?: number;
  conversations_started?: number;
  conversations?: number;
  clicks?: number;
  engagements?: number;
  video_views?: number;
  purchases?: number;
  spend?: number;
  revenue?: number | null;
}

/**
 * Maps an objective string to a ResultLabel
 */
export function getResultLabel(objective: string | null | undefined, platformKey?: string): ResultLabel {
  const obj = objective?.toUpperCase() || 'UNKNOWN';

  if (obj.includes('LEAD') || obj === 'OUTCOME_LEADS') {
    return 'Leads';
  }

  if (obj.includes('MESSAGE') || obj === 'OUTCOME_MESSAGES') {
    return 'Conversas';
  }

  if (
    obj.includes('LINK_CLICKS') ||
    obj.includes('TRAFFIC') ||
    obj === 'OUTCOME_TRAFFIC'
  ) {
    return 'Cliques';
  }

  if (
    obj.includes('ENGAGEMENT') ||
    obj === 'POST_ENGAGEMENT' ||
    obj === 'OUTCOME_ENGAGEMENT'
  ) {
    return 'Engajamentos';
  }

  if (obj.includes('VIDEO_VIEWS') || obj === 'VIDEO_VIEWS') {
    return 'Views';
  }

  if (
    obj.includes('SALES') ||
    obj.includes('PURCHASE') ||
    obj.includes('CONVERSIONS') ||
    obj === 'OUTCOME_SALES'
  ) {
    return 'Compras';
  }

  // Google Ads fallback: treat as clicks if no valid conversion
  if (platformKey === 'google_ads') {
    return 'Cliques';
  }

  return 'Resultados';
}

/**
 * Extracts the primary KPI value from a metric row based on its objective
 */
export function extractResultValue(row: MetricRow): number {
  const objective = row.objective?.toUpperCase() || 'UNKNOWN';
  const platformKey = row.platform_key;

  // LEADS
  if (objective.includes('LEAD') || objective === 'OUTCOME_LEADS') {
    return row.leads || 0;
  }

  // MESSAGES/CONVERSATIONS
  if (objective.includes('MESSAGE') || objective === 'OUTCOME_MESSAGES') {
    // Use the max of conversations_started or conversations (fallback)
    return Math.max(row.conversations_started || 0, row.conversations || 0);
  }

  // LINK_CLICKS / TRAFFIC
  if (
    objective.includes('LINK_CLICKS') ||
    objective.includes('TRAFFIC') ||
    objective === 'OUTCOME_TRAFFIC'
  ) {
    return row.clicks || 0;
  }

  // ENGAGEMENT
  if (
    objective.includes('ENGAGEMENT') ||
    objective === 'POST_ENGAGEMENT' ||
    objective === 'OUTCOME_ENGAGEMENT'
  ) {
    return row.engagements || 0;
  }

  // VIDEO_VIEWS
  if (objective.includes('VIDEO_VIEWS') || objective === 'VIDEO_VIEWS') {
    return row.video_views || 0;
  }

  // SALES / PURCHASES
  if (
    objective.includes('SALES') ||
    objective.includes('PURCHASE') ||
    objective.includes('CONVERSIONS') ||
    objective === 'OUTCOME_SALES'
  ) {
    return row.purchases || 0;
  }

  // Google Ads fallback
  if (platformKey === 'google_ads') {
    return row.clicks || 0;
  }

  // Unknown: return 0
  return 0;
}

/**
 * Computes the primary KPI for a metric row
 *
 * @param row - Raw metric data with objective, spend, and various conversion metrics
 * @returns PrimaryKPI object with label, value, and costPerResult
 */
export function computePrimaryKpi(row: MetricRow): PrimaryKPI {
  const label = getResultLabel(row.objective, row.platform_key);
  const value = extractResultValue(row);
  const spend = row.spend || 0;
  const costPerResult = costPerResultCalc(spend, value);

  return {
    label,
    value,
    costPerResult,
  };
}

/**
 * Calculates cost per result
 *
 * @param spend - Total spend
 * @param resultValue - Number of primary results
 * @returns Cost per result or null if not calculable
 */
export function costPerResultCalc(spend: number, resultValue: number): number | null {
  if (!resultValue || resultValue === 0) {
    return null;
  }
  return spend / resultValue;
}

/**
 * Calculates ROAS (Return on Ad Spend)
 *
 * ROAS should ONLY be calculated for SALES objectives with revenue > 0
 *
 * @param revenue - Total revenue generated
 * @param spend - Total spend
 * @param objective - Campaign objective
 * @returns ROAS value or null if not applicable
 */
export function calculateRoas(
  revenue: number | null | undefined,
  spend: number,
  objective?: string | null
): number | null {
  // Guard: only calculate ROAS for SALES objectives
  const obj = objective?.toUpperCase() || '';
  const isSalesObjective =
    obj.includes('SALES') ||
    obj.includes('PURCHASE') ||
    obj.includes('CONVERSIONS') ||
    obj === 'OUTCOME_SALES';

  if (!isSalesObjective) {
    return null;
  }

  // Guard: revenue must be > 0 and spend > 0
  if (!revenue || revenue <= 0 || !spend || spend <= 0) {
    return null;
  }

  return revenue / spend;
}

/**
 * Formats cost per result for display
 */
export function formatCostPerResult(value: number | null): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats ROAS for display
 */
export function formatRoas(value: number | null): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return `${value.toFixed(2)}x`;
}

/**
 * Formats result value with appropriate label
 */
export function formatResultValue(value: number, label: ResultLabel): string {
  const formatted = new Intl.NumberFormat('pt-BR').format(value);
  return `${formatted} ${label}`;
}
