import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

export interface CampaignData {
  id: string;
  name: string;
  status: string;
  objective: string;
  platform_type?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas?: number;
  ad_copies?: Array<{
    ad_name: string;
    creative_type: string;
    text_content: string;
    bodies?: string[];
    title?: string;
    description?: string;
  }>;
}

export interface MetricsSummary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_roas: number;
}

/**
 * Get top performing campaigns by a metric
 */
export async function getTopCampaigns(
  workspaceId: string,
  days: number = 7,
  limit: number = 10,
  orderBy: 'spend' | 'clicks' | 'conversions' | 'roas' = 'spend'
): Promise<CampaignData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const query = `
    SELECT
      c.id,
      c.name,
      c.status,
      c.objective,
      COALESCE(SUM(pm.spend), 0) as spend,
      COALESCE(SUM(pm.impressions), 0) as impressions,
      COALESCE(SUM(pm.clicks), 0) as clicks,
      CASE
        WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::float / SUM(pm.impressions)) * 100
        ELSE 0
      END as ctr,
      CASE
        WHEN SUM(pm.clicks) > 0 THEN SUM(pm.spend) / SUM(pm.clicks)
        ELSE 0
      END as cpc,
      COALESCE(SUM(pm.conversions), 0) as conversions,
      CASE
        WHEN SUM(pm.spend) > 0 THEN
          (COALESCE(SUM((pm.extra_metrics->>'purchase_value')::numeric), 0) / SUM(pm.spend))
        ELSE 0
      END as roas
    FROM campaigns c
    LEFT JOIN performance_metrics pm ON c.id = pm.campaign_id
    WHERE c.workspace_id = $1
      AND pm.metric_date >= $2
      AND pm.granularity = 'day'
    GROUP BY c.id, c.name, c.status, c.objective
    ORDER BY ${orderBy} DESC
    LIMIT $3
  `;

  const result = await pool.query(query, [workspaceId, startDate.toISOString().split('T')[0], limit]);
  return result.rows;
}

/**
 * Get campaigns with poor performance (low CTR or high CPC)
 */
export async function getUnderperformingCampaigns(
  workspaceId: string,
  days: number = 7,
  ctrThreshold: number = 1.0 // CTR below 1%
): Promise<CampaignData[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const query = `
    SELECT
      c.id,
      c.name,
      c.status,
      c.objective,
      COALESCE(SUM(pm.spend), 0) as spend,
      COALESCE(SUM(pm.impressions), 0) as impressions,
      COALESCE(SUM(pm.clicks), 0) as clicks,
      CASE
        WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::float / SUM(pm.impressions)) * 100
        ELSE 0
      END as ctr,
      CASE
        WHEN SUM(pm.clicks) > 0 THEN SUM(pm.spend) / SUM(pm.clicks)
        ELSE 0
      END as cpc,
      COALESCE(SUM(pm.conversions), 0) as conversions
    FROM campaigns c
    LEFT JOIN performance_metrics pm ON c.id = pm.campaign_id
    WHERE c.workspace_id = $1
      AND pm.metric_date >= $2
      AND pm.granularity = 'day'
      AND c.status = 'ACTIVE'
    GROUP BY c.id, c.name, c.status, c.objective
    HAVING
      SUM(pm.impressions) > 1000 AND
      (SUM(pm.clicks)::float / NULLIF(SUM(pm.impressions), 0)) * 100 < $3
    ORDER BY ctr ASC
    LIMIT 20
  `;

  const result = await pool.query(query, [workspaceId, startDate.toISOString().split('T')[0], ctrThreshold]);
  return result.rows;
}

/**
 * Get metrics summary for a period
 */
export async function getMetricsSummary(
  workspaceId: string,
  days: number = 7,
  platform?: 'meta' | 'google' | 'instagram'
): Promise<MetricsSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let platformFilter = '';
  const params: any[] = [workspaceId, startDate.toISOString().split('T')[0]];

  if (platform) {
    platformFilter = 'AND pa.platform_key = $3';
    params.push(platform);
  }

  const query = `
    SELECT
      COALESCE(SUM(pm.spend), 0) as total_spend,
      COALESCE(SUM(pm.impressions), 0) as total_impressions,
      COALESCE(SUM(pm.clicks), 0) as total_clicks,
      COALESCE(SUM(pm.conversions), 0) as total_conversions,
      CASE
        WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::float / SUM(pm.impressions)) * 100
        ELSE 0
      END as avg_ctr,
      CASE
        WHEN SUM(pm.clicks) > 0 THEN SUM(pm.spend) / SUM(pm.clicks)
        ELSE 0
      END as avg_cpc,
      CASE
        WHEN SUM(pm.spend) > 0 THEN
          (COALESCE(SUM((pm.extra_metrics->>'purchase_value')::numeric), 0) / SUM(pm.spend))
        ELSE 0
      END as avg_roas
    FROM performance_metrics pm
    LEFT JOIN platform_accounts pa ON pm.platform_account_id = pa.id
    WHERE pm.workspace_id = $1
      AND pm.metric_date >= $2
      AND pm.granularity = 'day'
      ${platformFilter}
  `;

  const result = await pool.query(query, params);
  return result.rows[0] || {
    total_spend: 0,
    total_impressions: 0,
    total_clicks: 0,
    total_conversions: 0,
    avg_ctr: 0,
    avg_cpc: 0,
    avg_roas: 0,
  };
}

/**
 * Compare performance between platforms
 */
export async function comparePlatforms(
  workspaceId: string,
  days: number = 7
): Promise<Array<MetricsSummary & { platform: string }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const query = `
    SELECT
      pa.platform_key as platform,
      COALESCE(SUM(pm.spend), 0) as total_spend,
      COALESCE(SUM(pm.impressions), 0) as total_impressions,
      COALESCE(SUM(pm.clicks), 0) as total_clicks,
      COALESCE(SUM(pm.conversions), 0) as total_conversions,
      CASE
        WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::float / SUM(pm.impressions)) * 100
        ELSE 0
      END as avg_ctr,
      CASE
        WHEN SUM(pm.clicks) > 0 THEN SUM(pm.spend) / SUM(pm.clicks)
        ELSE 0
      END as avg_cpc,
      CASE
        WHEN SUM(pm.spend) > 0 THEN
          (COALESCE(SUM((pm.extra_metrics->>'purchase_value')::numeric), 0) / SUM(pm.spend))
        ELSE 0
      END as avg_roas
    FROM performance_metrics pm
    LEFT JOIN platform_accounts pa ON pm.platform_account_id = pa.id
    WHERE pm.workspace_id = $1
      AND pm.metric_date >= $2
      AND pm.granularity = 'day'
    GROUP BY pa.platform_key
    ORDER BY total_spend DESC
  `;

  const result = await pool.query(query, [workspaceId, startDate.toISOString().split('T')[0]]);
  return result.rows;
}

/**
 * Get performance by objective
 */
export async function getPerformanceByObjective(
  workspaceId: string,
  days: number = 7
): Promise<Array<MetricsSummary & { objective: string; campaign_count: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const query = `
    SELECT
      c.objective,
      COUNT(DISTINCT c.id) as campaign_count,
      COALESCE(SUM(pm.spend), 0) as total_spend,
      COALESCE(SUM(pm.impressions), 0) as total_impressions,
      COALESCE(SUM(pm.clicks), 0) as total_clicks,
      COALESCE(SUM(pm.conversions), 0) as total_conversions,
      CASE
        WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::float / SUM(pm.impressions)) * 100
        ELSE 0
      END as avg_ctr,
      CASE
        WHEN SUM(pm.clicks) > 0 THEN SUM(pm.spend) / SUM(pm.clicks)
        ELSE 0
      END as avg_cpc,
      CASE
        WHEN SUM(pm.spend) > 0 THEN
          (COALESCE(SUM((pm.extra_metrics->>'purchase_value')::numeric), 0) / SUM(pm.spend))
        ELSE 0
      END as avg_roas
    FROM campaigns c
    LEFT JOIN performance_metrics pm ON c.id = pm.campaign_id
    WHERE c.workspace_id = $1
      AND pm.metric_date >= $2
      AND pm.granularity = 'day'
    GROUP BY c.objective
    ORDER BY total_spend DESC
  `;

  const result = await pool.query(query, [workspaceId, startDate.toISOString().split('T')[0]]);
  return result.rows;
}

/**
 * Get trend data for metrics over time
 */
export async function getMetricsTrend(
  workspaceId: string,
  days: number = 7,
  metric: 'spend' | 'clicks' | 'conversions' | 'ctr' = 'spend'
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const metricExpression = metric === 'ctr'
    ? `CASE WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::float / SUM(pm.impressions)) * 100 ELSE 0 END`
    : `SUM(pm.${metric})`;

  const query = `
    SELECT
      pm.metric_date as date,
      ${metricExpression} as value
    FROM performance_metrics pm
    WHERE pm.workspace_id = $1
      AND pm.metric_date >= $2
      AND pm.granularity = 'day'
    GROUP BY pm.metric_date
    ORDER BY pm.metric_date ASC
  `;

  const result = await pool.query(query, [workspaceId, startDate.toISOString().split('T')[0]]);
  return result.rows;
}

/**
 * Get detailed information about a specific campaign by name
 * Uses smart matching to find campaigns with flexible word order
 */
export async function getCampaignDetails(
  workspaceId: string,
  campaignName: string,
  days: number = 30
): Promise<CampaignData | null> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Build flexible search patterns
  // Split campaign name into words and create patterns that match any order
  const words = campaignName.split(/\s+/).filter(w => w.length > 0);

  // Build WHERE condition that checks if ALL words appear in the name (any order)
  const wordConditions = words.map((_, i) => `c.name ILIKE $${i + 2}`).join(' AND ');

  const query = `
    SELECT
      c.id,
      c.name,
      c.status,
      c.objective,
      COALESCE(SUM(pm.spend), 0) as spend,
      COALESCE(SUM(pm.impressions), 0) as impressions,
      COALESCE(SUM(pm.clicks), 0) as clicks,
      CASE
        WHEN SUM(pm.impressions) > 0 THEN (SUM(pm.clicks)::float / SUM(pm.impressions)) * 100
        ELSE 0
      END as ctr,
      CASE
        WHEN SUM(pm.clicks) > 0 THEN SUM(pm.spend) / SUM(pm.clicks)
        ELSE 0
      END as cpc,
      COALESCE(SUM(pm.conversions), 0) as conversions,
      CASE
        WHEN SUM(pm.spend) > 0 THEN
          (COALESCE(SUM((pm.extra_metrics->>'purchase_value')::numeric), 0) / SUM(pm.spend))
        ELSE 0
      END as roas
    FROM campaigns c
    LEFT JOIN performance_metrics pm ON c.id = pm.campaign_id
    WHERE c.workspace_id = $1
      AND (${wordConditions})
      AND pm.metric_date >= $${words.length + 2}
      AND pm.granularity = 'day'
    GROUP BY c.id, c.name, c.status, c.objective
    LIMIT 1
  `;

  const params = [
    workspaceId,
    ...words.map(w => `%${w}%`),
    startDate.toISOString().split('T')[0]
  ];

  const result = await pool.query(query, params);

  if (!result.rows[0]) {
    return null;
  }

  const campaignData = result.rows[0];

  // Fetch ad copies for this campaign
  const copiesQuery = `
    SELECT
      a.name as ad_name,
      ca.type as creative_type,
      ca.text_content,
      ca.metadata->>'body' as body,
      ca.metadata->'asset_feed_spec'->'bodies' as bodies,
      ca.metadata->'asset_feed_spec'->'titles'->0->>'text' as title,
      ca.metadata->'asset_feed_spec'->'descriptions'->0->>'text' as description
    FROM ads a
    JOIN creative_assets ca ON a.creative_asset_id = ca.id
    WHERE a.ad_set_id IN (
      SELECT id FROM ad_sets WHERE campaign_id = $1
    )
    LIMIT 10
  `;

  const copiesResult = await pool.query(copiesQuery, [campaignData.id]);

  campaignData.ad_copies = copiesResult.rows.map(row => ({
    ad_name: row.ad_name,
    creative_type: row.creative_type,
    text_content: row.text_content || row.body || '',
    bodies: row.bodies ? JSON.parse(JSON.stringify(row.bodies)).map((b: any) => b.text) : [],
    title: row.title,
    description: row.description,
  }));

  return campaignData;
}
