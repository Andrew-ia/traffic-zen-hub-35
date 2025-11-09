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
  start_date?: string;
  end_date?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas?: number;
  messaging_metrics?: {
    conversations_started: number;
    total_connections: number;
    first_replies: number;
  };
  ad_copies?: Array<{
    ad_name: string;
    creative_type: string;
    text_content: string;
    bodies?: string[];
    title?: string;
    description?: string;
    thumbnail_url?: string;
    aspect_ratio?: string;
    duration_seconds?: number;
    performance?: {
      impressions: number;
      clicks: number;
      spend: number;
      ctr: number;
    };
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

export interface CampaignDetailsOptions {
  days?: number;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
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
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
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
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
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
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
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
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
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
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
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
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
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
  options: CampaignDetailsOptions = {}
): Promise<CampaignData | null> {
  console.log('🔍 getCampaignDetails called with:', { campaignName, options });

  const defaultDays = options.days ?? 30;
  const now = new Date();

  const parseDateOnly = (value: string | undefined): Date | null => {
    if (!value) return null;
    const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  let startDate: Date;
  let endDate: Date;

  if (options.dateRange) {
    const startParsed = parseDateOnly(options.dateRange.startDate);
    const endParsed = parseDateOnly(options.dateRange.endDate);
    if (startParsed && endParsed) {
      startDate = startParsed;
      endDate = endParsed;
    } else {
      endDate = new Date(now);
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - defaultDays);
    }
  } else {
    const days = options.days ?? defaultDays;
    endDate = new Date(now);
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
  }

  if (endDate.getTime() < startDate.getTime()) {
    const tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Build flexible search patterns
  // Split campaign name into words and create patterns that match any order
  const words = campaignName.split(/\s+/).filter(w => w.length > 0);
  console.log('📝 Search words:', words);

  // Build WHERE condition that checks if ALL words appear in the name (any order)
  const wordConditions = words.map((_, i) => `c.name ILIKE $${i + 2}`).join(' AND ');
  const startParamIndex = words.length + 2;
  const endParamIndex = startParamIndex + 1;

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
      AND pm.metric_date >= $${startParamIndex}
      AND pm.metric_date <= $${endParamIndex}
      AND pm.granularity = 'day'
      AND pm.ad_set_id IS NULL
      AND pm.ad_id IS NULL
    WHERE c.workspace_id = $1
      AND (${wordConditions})
    GROUP BY c.id, c.name, c.status, c.objective
    LIMIT 1
  `;

  const params = [
    workspaceId,
    ...words.map(w => `%${w}%`),
    startDateStr,
    endDateStr,
  ];

  const result = await pool.query(query, params);

  console.log('🔎 Query result:', result.rows.length > 0 ? `Found: ${result.rows[0].name}` : 'No campaign found');

  if (!result.rows[0]) {
    console.log('❌ Campaign not found for words:', words);
    return null;
  }

  const campaignData = result.rows[0];
  console.log('✅ Campaign found:', campaignData.name, '| Objective:', campaignData.objective);
  campaignData.start_date = startDateStr;
  campaignData.end_date = endDateStr;

  // Fetch ad copies with performance data for this campaign
  const copiesQuery = `
    SELECT
      a.id as ad_id,
      a.name as ad_name,
      ca.type as creative_type,
      ca.text_content,
      ca.thumbnail_url,
      ca.aspect_ratio,
      ca.duration_seconds,
      ca.metadata->>'body' as body,
      ca.metadata->'asset_feed_spec'->'bodies' as bodies,
      ca.metadata->'asset_feed_spec'->'titles'->0->>'text' as title,
      ca.metadata->'asset_feed_spec'->'descriptions'->0->>'text' as description,
      pm.impressions,
      pm.clicks,
      pm.spend,
      CASE WHEN pm.impressions > 0 THEN (pm.clicks::float / pm.impressions) * 100 ELSE 0 END as ctr
    FROM ads a
    JOIN creative_assets ca ON a.creative_asset_id = ca.id
    LEFT JOIN (
      SELECT
        ad_id,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(spend) as spend
      FROM performance_metrics
      WHERE granularity = 'day'
        AND metric_date BETWEEN $2 AND $3
      GROUP BY ad_id
    ) pm ON a.id = pm.ad_id
    WHERE a.ad_set_id IN (
      SELECT id FROM ad_sets WHERE campaign_id = $1
    )
    ORDER BY pm.impressions DESC NULLS LAST
    LIMIT 10
  `;

  const copiesResult = await pool.query(copiesQuery, [
    campaignData.id,
    startDateStr,
    endDateStr,
  ]);

  campaignData.ad_copies = copiesResult.rows.map(row => ({
    ad_name: row.ad_name,
    creative_type: row.creative_type,
    text_content: row.text_content || row.body || '',
    bodies: row.bodies ? JSON.parse(JSON.stringify(row.bodies)).map((b: any) => b.text) : [],
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    aspect_ratio: row.aspect_ratio,
    duration_seconds: row.duration_seconds ? parseFloat(row.duration_seconds) : undefined,
    performance: {
      impressions: parseInt(row.impressions || 0),
      clicks: parseInt(row.clicks || 0),
      spend: parseFloat(row.spend || 0),
      ctr: parseFloat(row.ctr || 0),
    },
  }));

  // For OUTCOME_LEADS campaigns, extract detailed messaging metrics
  if (campaignData.objective === 'OUTCOME_LEADS') {
    const messagingQuery = `
      SELECT
        SUM(pm.conversions) as conversations_started,
        SUM((
          SELECT COALESCE((a->>'value')::int, 0)
          FROM jsonb_array_elements(pm.extra_metrics->'actions') AS a
          WHERE a->>'action_type' = 'onsite_conversion.total_messaging_connection'
          LIMIT 1
        )) as total_connections,
        SUM((
          SELECT COALESCE((a->>'value')::int, 0)
          FROM jsonb_array_elements(pm.extra_metrics->'actions') AS a
          WHERE a->>'action_type' = 'onsite_conversion.messaging_first_reply'
          LIMIT 1
        )) as first_replies
      FROM performance_metrics pm
      WHERE pm.campaign_id = $1
        AND pm.metric_date BETWEEN $2 AND $3
        AND pm.granularity = 'day'
        AND pm.ad_set_id IS NULL
        AND pm.ad_id IS NULL
    `;

    const messagingResult = await pool.query(messagingQuery, [
      campaignData.id,
      startDateStr,
      endDateStr,
    ]);

    if (messagingResult.rows[0]) {
      campaignData.messaging_metrics = {
        conversations_started: parseInt(messagingResult.rows[0].conversations_started || 0),
        total_connections: parseInt(messagingResult.rows[0].total_connections || 0),
        first_replies: parseInt(messagingResult.rows[0].first_replies || 0),
      };
    }
  }

  return campaignData;
}
