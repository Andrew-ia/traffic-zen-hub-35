import { getPool } from '../config/database.js';

const pool = getPool();

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

export interface CampaignCounts {
  active_campaigns: number;
  total_campaigns: number;
}

export interface CampaignDetailsOptions {
  days?: number;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

const BASE_METRICS_CTE = `
  with pm_dedup as (
    select * from (
      select
        pm.workspace_id,
        pm.platform_account_id,
        pm.campaign_id,
        pm.ad_set_id,
        pm.ad_id,
        pm.metric_date,
        pm.spend,
        pm.reach,
        pm.impressions,
        pm.clicks,
        pm.conversions,
        pm.extra_metrics,
        pm.synced_at,
        row_number() over (
          partition by pm.platform_account_id, pm.campaign_id, pm.ad_set_id, pm.ad_id, pm.metric_date
          order by pm.synced_at desc nulls last
        ) as rn
      from performance_metrics pm
      where pm.workspace_id = $1
        and pm.metric_date >= current_date - $2::int
        and pm.metric_date < current_date
        and pm.granularity = 'day'
    ) t
    where rn = 1
  ),
  pm_campaign as (
    select
      campaign_id,
      sum(spend)::float8 as spend,
      sum(impressions)::float8 as impressions,
      sum(clicks)::float8 as clicks,
      sum(reach)::float8 as reach,
      sum(conversions)::float8 as conversions,
      sum((coalesce(pm.extra_metrics ->> 'purchase_value', '0'))::numeric)::float8 as purchase_value
    from pm_dedup pm
    where pm.ad_set_id is null and pm.ad_id is null
    group by campaign_id
  ),
  kpi_raw as (
    select
      kpi.campaign_id,
      kpi.metric_date,
      kpi.spend,
      kpi.result_value,
      kpi.revenue,
      kpi.roas
    from v_campaign_kpi kpi
    where kpi.workspace_id = $1
      and kpi.metric_date >= current_date - $2::int
      and kpi.metric_date < current_date
      and kpi.ad_set_id is null
      and kpi.ad_id is null
  ),
  kpi_campaign as (
    select
      campaign_id,
      sum(result_value)::float8 as result_value,
      sum(revenue)::float8 as revenue,
      sum(spend)::float8 as spend,
      sum(coalesce(roas, 0) * coalesce(spend, 0))::float8 as roas_weighted
    from kpi_raw
    group by campaign_id
  )
`;

/**
 * Get top performing campaigns by a metric
 */
export async function getTopCampaigns(
  workspaceId: string,
  days: number = 7,
  limit: number = 10,
  orderBy: 'spend' | 'clicks' | 'conversions' | 'roas' = 'spend'
): Promise<CampaignData[]> {
  const query = `
    ${BASE_METRICS_CTE},
    agg as (
      select
        c.id,
        c.name,
        c.status,
        c.objective,
        coalesce(pm_campaign.spend, 0) as spend,
        coalesce(pm_campaign.impressions, 0) as impressions,
        coalesce(pm_campaign.clicks, 0) as clicks,
        coalesce(pm_campaign.conversions, 0) as raw_conversions,
        coalesce(kpi_campaign.result_value, 0) as conversions,
        coalesce(kpi_campaign.revenue, 0) as revenue,
        coalesce(kpi_campaign.spend, pm_campaign.spend, 0) as kpi_spend
      from campaigns c
      left join pm_campaign on pm_campaign.campaign_id = c.id
      left join kpi_campaign on kpi_campaign.campaign_id = c.id
      where c.workspace_id = $1
    )
    select
      id,
      name,
      status,
      objective,
      spend,
      impressions,
      clicks,
      case when impressions > 0 then (clicks / impressions) * 100 else 0 end as ctr,
      case when clicks > 0 then spend / clicks else 0 end as cpc,
      conversions,
      case when spend > 0 then coalesce(revenue, 0) / spend else 0 end as roas
    from agg
    order by ${orderBy} desc nulls last
    limit $3
  `;

  const result = await pool.query(query, [workspaceId, days, limit]);
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
  const query = `
    ${BASE_METRICS_CTE}
    select
      c.id,
      c.name,
      c.status,
      c.objective,
      coalesce(pm_campaign.spend, 0) as spend,
      coalesce(pm_campaign.impressions, 0) as impressions,
      coalesce(pm_campaign.clicks, 0) as clicks,
      case
        when coalesce(pm_campaign.impressions, 0) > 0 then (coalesce(pm_campaign.clicks, 0) / coalesce(pm_campaign.impressions, 0)) * 100
        else 0
      end as ctr,
      case
        when coalesce(pm_campaign.clicks, 0) > 0 then coalesce(pm_campaign.spend, 0) / coalesce(pm_campaign.clicks, 0)
        else 0
      end as cpc,
      coalesce(kpi_campaign.result_value, 0) as conversions
    from campaigns c
    left join pm_campaign on pm_campaign.campaign_id = c.id
    left join kpi_campaign on kpi_campaign.campaign_id = c.id
    where c.workspace_id = $1
      and c.status = 'ACTIVE'
    having
      coalesce(pm_campaign.impressions, 0) > 1000
      and (
        case
          when coalesce(pm_campaign.impressions, 0) > 0 then (coalesce(pm_campaign.clicks, 0) / coalesce(pm_campaign.impressions, 0)) * 100
          else 0
        end
      ) < $3
    order by ctr asc
    limit 20
  `;

  const result = await pool.query(query, [workspaceId, days, ctrThreshold]);
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
  const query = `
    ${BASE_METRICS_CTE}
    select
      coalesce(sum(pm_campaign.spend), 0) as total_spend,
      coalesce(sum(pm_campaign.impressions), 0) as total_impressions,
      coalesce(sum(pm_campaign.clicks), 0) as total_clicks,
      coalesce(sum(kpi_campaign.result_value), 0) as total_conversions,
      case
        when sum(pm_campaign.impressions) > 0 then (sum(pm_campaign.clicks)::float / sum(pm_campaign.impressions)) * 100
        else 0
      end as avg_ctr,
      case
        when sum(pm_campaign.clicks) > 0 then sum(pm_campaign.spend) / sum(pm_campaign.clicks)
        else 0
      end as avg_cpc,
      case
        when sum(pm_campaign.spend) > 0 then
          (
            coalesce(sum(kpi_campaign.revenue), 0) /
            nullif(sum(pm_campaign.spend), 0)
          )
        else 0
      end as avg_roas
    from pm_campaign
    left join kpi_campaign on kpi_campaign.campaign_id = pm_campaign.campaign_id
    ${platform ? 'join campaigns c on c.id = pm_campaign.campaign_id' : ''}
    ${platform ? 'join platform_accounts pa on pa.id = c.platform_account_id and pa.platform_key = $3' : ''}
  `;

  const params: any[] = [workspaceId, days];
  if (platform) params.push(platform);

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

export async function getCampaignCounts(
  workspaceId: string
): Promise<CampaignCounts> {
  const query = `
    select
      count(*) filter (where upper(status) = 'ACTIVE') as active_campaigns,
      count(*) as total_campaigns
    from campaigns
    where workspace_id = $1
  `;

  const result = await pool.query(query, [workspaceId]);
  const row = result.rows[0] || { active_campaigns: 0, total_campaigns: 0 };
  return {
    active_campaigns: Number(row.active_campaigns || 0),
    total_campaigns: Number(row.total_campaigns || 0),
  };
}

/**
 * Compare performance between platforms
 */
export async function comparePlatforms(
  workspaceId: string,
  days: number = 7
): Promise<Array<MetricsSummary & { platform: string }>> {
  const query = `
    ${BASE_METRICS_CTE},
    pm_platform as (
      select
        platform_account_id,
        sum(spend)::float8 as spend,
        sum(impressions)::float8 as impressions,
        sum(clicks)::float8 as clicks,
        sum(conversions)::float8 as conversions,
        sum((coalesce(pm.extra_metrics ->> 'purchase_value', '0'))::numeric)::float8 as purchase_value
      from pm_dedup pm
      where pm.ad_set_id is null and pm.ad_id is null
      group by platform_account_id
    ),
    kpi_platform as (
      select
        platform_account_id,
        sum(result_value)::float8 as result_value,
        sum(revenue)::float8 as revenue,
        sum(spend)::float8 as spend
      from kpi_raw
      group by platform_account_id
    )
    select
      pa.platform_key as platform,
      coalesce(pm_platform.spend, 0) as total_spend,
      coalesce(pm_platform.impressions, 0) as total_impressions,
      coalesce(pm_platform.clicks, 0) as total_clicks,
      coalesce(kpi_platform.result_value, 0) as total_conversions,
      case when pm_platform.impressions > 0 then (pm_platform.clicks / pm_platform.impressions) * 100 else 0 end as avg_ctr,
      case when pm_platform.clicks > 0 then pm_platform.spend / pm_platform.clicks else 0 end as avg_cpc,
      case when pm_platform.spend > 0 then coalesce(kpi_platform.revenue, 0) / pm_platform.spend else 0 end as avg_roas
    from pm_platform
    left join kpi_platform on kpi_platform.platform_account_id = pm_platform.platform_account_id
    left join platform_accounts pa on pa.id = pm_platform.platform_account_id
    order by total_spend desc nulls last
  `;

  const result = await pool.query(query, [workspaceId, days]);
  return result.rows;
}

/**
 * Get performance by objective
 */
export async function getPerformanceByObjective(
  workspaceId: string,
  days: number = 7
): Promise<Array<MetricsSummary & { objective: string; campaign_count: number }>> {
  const query = `
    ${BASE_METRICS_CTE}
    select
      c.objective,
      count(distinct c.id) as campaign_count,
      coalesce(sum(pm_campaign.spend), 0) as total_spend,
      coalesce(sum(pm_campaign.impressions), 0) as total_impressions,
      coalesce(sum(pm_campaign.clicks), 0) as total_clicks,
      coalesce(sum(kpi_campaign.result_value), 0) as total_conversions,
      case
        when sum(pm_campaign.impressions) > 0 then (sum(pm_campaign.clicks)::float / sum(pm_campaign.impressions)) * 100
        else 0
      end as avg_ctr,
      case
        when sum(pm_campaign.clicks) > 0 then sum(pm_campaign.spend) / sum(pm_campaign.clicks)
        else 0
      end as avg_cpc,
      case
        when sum(pm_campaign.spend) > 0 then coalesce(sum(kpi_campaign.revenue), 0) / sum(pm_campaign.spend)
        else 0
      end as avg_roas
    from campaigns c
    left join pm_campaign on pm_campaign.campaign_id = c.id
    left join kpi_campaign on kpi_campaign.campaign_id = c.id
    where c.workspace_id = $1
    group by c.objective
    order by total_spend desc nulls last
  `;

  const result = await pool.query(query, [workspaceId, days]);
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
  const metricExpression = (() => {
    switch (metric) {
      case 'ctr':
        return `CASE WHEN coalesce(SUM(pm_daily.impressions), 0) > 0 THEN (SUM(pm_daily.clicks)::float / SUM(pm_daily.impressions)) * 100 ELSE 0 END`;
      case 'conversions':
        return `COALESCE(SUM(kpi_daily.result_value), 0)`;
      case 'spend':
        return `COALESCE(SUM(kpi_daily.spend), SUM(pm_daily.spend), 0)`;
      default:
        return `COALESCE(SUM(pm_daily.${metric}), 0)`;
    }
  })();

  const query = `
    with pm_dedup as (
      select * from (
        select
          pm.workspace_id,
          pm.platform_account_id,
          pm.campaign_id,
          pm.ad_set_id,
          pm.ad_id,
          pm.metric_date,
          pm.spend,
          pm.reach,
          pm.impressions,
          pm.clicks,
          pm.conversions,
          pm.extra_metrics,
          pm.synced_at,
          row_number() over (
            partition by pm.platform_account_id, pm.campaign_id, pm.ad_set_id, pm.ad_id, pm.metric_date
            order by pm.synced_at desc nulls last
          ) as rn
        from performance_metrics pm
        where pm.workspace_id = $1
          and pm.metric_date >= current_date - $2::int
          and pm.metric_date < current_date
          and pm.granularity = 'day'
          and pm.ad_set_id is null
          and pm.ad_id is null
      ) t
      where rn = 1
    ),
    pm_daily as (
      select
        metric_date,
        sum(spend)::float8 as spend,
        sum(impressions)::float8 as impressions,
        sum(clicks)::float8 as clicks
      from pm_dedup
      group by metric_date
    ),
    kpi_daily as (
      select
        metric_date,
        sum(result_value)::float8 as result_value,
        sum(revenue)::float8 as revenue,
        sum(spend)::float8 as spend
      from v_campaign_kpi kpi
      where kpi.workspace_id = $1
        and kpi.metric_date >= current_date - $2::int
        and kpi.metric_date < current_date
        and kpi.ad_set_id is null
        and kpi.ad_id is null
      group by metric_date
    )
    select
      coalesce(pm_daily.metric_date::text, kpi_daily.metric_date::text) as date,
      ${metricExpression} as value
    from pm_daily
    full join kpi_daily on kpi_daily.metric_date = pm_daily.metric_date
    order by date
  `;

  const result = await pool.query(query, [workspaceId, days]);
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
    with pm_dedup as (
      select * from (
        select
          pm.workspace_id,
          pm.campaign_id,
          pm.metric_date,
          pm.spend,
          pm.impressions,
          pm.clicks,
          pm.conversions,
          pm.extra_metrics,
          pm.synced_at,
          row_number() over (
            partition by pm.platform_account_id, pm.campaign_id, pm.metric_date
            order by pm.synced_at desc nulls last
          ) as rn
        from performance_metrics pm
        where pm.workspace_id = $1
          and pm.metric_date >= $${startParamIndex}
          and pm.metric_date <= $${endParamIndex}
          and pm.granularity = 'day'
          and pm.ad_set_id is null
          and pm.ad_id is null
      ) t where rn = 1
    )
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
    LEFT JOIN pm_dedup pm ON c.id = pm.campaign_id
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
    with pm_ads as (
      select * from (
        select
          pm.ad_id,
          pm.campaign_id,
          pm.metric_date,
          pm.impressions,
          pm.clicks,
          pm.spend,
          pm.synced_at,
          row_number() over (
            partition by pm.ad_id, pm.metric_date
            order by pm.synced_at desc nulls last
          ) as rn
        from performance_metrics pm
        where pm.granularity = 'day'
          and pm.metric_date between $2 and $3
          and pm.ad_id is not null
          and pm.campaign_id = $1
      ) t where rn = 1
    ),
    pm_sum as (
      select
        ad_id,
        sum(impressions) as impressions,
        sum(clicks) as clicks,
        sum(spend) as spend
      from pm_ads
      group by ad_id
    )
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
    LEFT JOIN pm_sum pm ON a.id = pm.ad_id
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
