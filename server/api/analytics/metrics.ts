import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

function getWorkspaceId(): string {
  const wid =
    process.env.META_WORKSPACE_ID ||
    process.env.WORKSPACE_ID ||
    process.env.SUPABASE_WORKSPACE_ID ||
    // Frontend often sets only VITE_WORKSPACE_ID; use it as a backend fallback.
    process.env.VITE_WORKSPACE_ID;

  if (!wid) {
    // Provide a clearer error to aid local dev troubleshooting.
    throw new Error(
      'Missing workspace id env. Set META_WORKSPACE_ID or WORKSPACE_ID (or VITE_WORKSPACE_ID) in .env.local'
    );
  }
  return wid.trim();
}

function parseDaysParam(days?: unknown): number {
  const value = Array.isArray(days) ? days[0] : days;
  const raw = typeof value === 'string' ? value : (value != null ? String(value) : '');
  const n = Number(raw);
  return !isNaN(n) && n > 0 ? Math.min(n, 90) : 7;
}

async function resolveAccountIds(pool: any, workspaceId: string, platform: string, accountId?: string) {
  if (accountId && accountId !== 'all') return [accountId];
  const { rows } = await pool.query(`
    select id from platform_accounts
    where workspace_id = $1 and platform_key = $2
  `, [workspaceId, platform]);
  return rows.map((r: any) => r.id);
}

export async function getAggregateMetrics(req: Request, res: Response) {
  try {
    const pool = getPool();
    const workspaceId = getWorkspaceId();
    const platform = (req.query.platform as string) || 'meta';
    const days = parseDaysParam(req.query.days);
    const accountId = req.query.accountId as string | undefined;
    const status = (req.query.status as string | undefined);
    const objective = (req.query.objective as string | undefined);

    const accountIds = await resolveAccountIds(pool, workspaceId, platform, accountId);
    if (accountIds.length === 0) {
      return res.json({
        totalSpend: 0,
        totalResults: 0,
        totalRevenue: 0,
        avgRoas: 0,
        avgCostPerResult: 0,
        impressions: 0,
        clicks: 0,
        cpm: 0,
        ctr: 0,
        cpc: 0,
        activeCampaigns: 0,
        totalCampaigns: 0,
      });
    }

    const { rows } = await pool.query<{
      spend: number | null;
      results: number | null;
      revenue: number | null;
      roas_weighted_spend: number | null;
      impressions: number | null;
      clicks: number | null;
      active_campaigns: number | null;
      total_campaigns: number | null;
    }>(
      `
      -- Usar v_campaign_kpi que já tem a lógica correta de conversões por objetivo
      with kpi_data as (
        select
          kpi.campaign_id,
          kpi.metric_date,
          kpi.spend,
          kpi.result_value,
          kpi.revenue,
          kpi.roas,
          pm.impressions,
          pm.clicks
        from v_campaign_kpi kpi
        join performance_metrics pm on
          pm.workspace_id = kpi.workspace_id
          and pm.campaign_id = kpi.campaign_id
          and pm.metric_date = kpi.metric_date
          and pm.granularity = 'day'
          and pm.ad_set_id is null
          and pm.ad_id is null
        where kpi.workspace_id = $1
          and kpi.platform_account_id = any($2::uuid[])
          and kpi.metric_date >= current_date - $3::int
          and kpi.metric_date < current_date
          and (
            $4::text is null
            or exists (
              select 1 from campaigns c
              where c.id = kpi.campaign_id and c.status = $4
            )
          )
          and (
            $5::text is null
            or exists (
              select 1 from campaigns c
              where c.id = kpi.campaign_id and UPPER(c.objective) = UPPER($5)
            )
          )
      )
      select
        sum(spend)::float8 as spend,
        sum(result_value)::float8 as results,
        sum(revenue)::float8 as revenue,
        sum(coalesce(roas, 0) * coalesce(spend, 0))::float8 as roas_weighted_spend,
        sum(impressions)::float8 as impressions,
        sum(clicks)::float8 as clicks,
        count(distinct case when campaign_id is not null and spend > 0 then campaign_id end) as active_campaigns,
        count(distinct case when campaign_id is not null then campaign_id end) as total_campaigns
      from kpi_data
      `,
      [workspaceId, accountIds, days, status && status !== 'all' ? status : null, objective || null]
    );

    const row = rows[0] || {} as any;
    const spend = Number(row.spend || 0);
    const results = Number(row.results || 0);
    const revenue = Number(row.revenue || 0);
    const roasWeightedSpend = Number(row.roas_weighted_spend || 0);
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);

    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const avgCostPerResult = results > 0 ? spend / results : 0;
    // Prefer ROAS computed from real revenue; fallback to spend-weighted average of pm.roas
    const avgRoas = spend > 0
      ? (revenue > 0 ? revenue / spend : (roasWeightedSpend > 0 ? roasWeightedSpend / spend : 0))
      : 0;

    res.json({
      totalSpend: spend,
      totalResults: results,
      totalRevenue: revenue,
      avgRoas,
      avgCostPerResult,
      impressions,
      clicks,
      cpm,
      ctr,
      cpc,
      activeCampaigns: Number(row.active_campaigns || 0),
      totalCampaigns: Number(row.total_campaigns || 0),
    });
  } catch (err: any) {
    console.error('getAggregateMetrics error', err);
    res.status(500).json({ error: 'failed_to_fetch_metrics' });
  }
}

export async function getTimeSeriesMetrics(req: Request, res: Response) {
  try {
    const pool = getPool();
    const workspaceId = getWorkspaceId();
    const platform = (req.query.platform as string) || 'meta';
    const days = parseDaysParam(req.query.days);
    const accountId = req.query.accountId as string | undefined;
    const metric = (req.query.metric as string) || 'spend';
    const status = (req.query.status as string | undefined);
    const objective = (req.query.objective as string | undefined);

    const accountIds = await resolveAccountIds(pool, workspaceId, platform, accountId);
    if (accountIds.length === 0) return res.json([]);

    const { rows } = await pool.query<{
      d: string;
      spend: number | null;
      results: number | null;
      revenue: number | null;
      impressions: number | null;
      clicks: number | null;
    }>(
      `
      -- Usar v_campaign_kpi para ter conversões corretas por objetivo
      select
        kpi.metric_date::text as d,
        sum(kpi.spend)::float8 as spend,
        sum(kpi.result_value)::float8 as results,
        sum(kpi.revenue)::float8 as revenue,
        sum(pm.impressions)::float8 as impressions,
        sum(pm.clicks)::float8 as clicks
      from v_campaign_kpi kpi
      join performance_metrics pm on
        pm.workspace_id = kpi.workspace_id
        and pm.campaign_id = kpi.campaign_id
        and pm.metric_date = kpi.metric_date
        and pm.granularity = 'day'
        and pm.ad_set_id is null
        and pm.ad_id is null
      where kpi.workspace_id = $1
        and kpi.platform_account_id = any($2::uuid[])
        and kpi.metric_date >= current_date - $3::int
        and kpi.metric_date < current_date
        and (
          $4::text is null
          or exists (
            select 1 from campaigns c
            where c.id = kpi.campaign_id and c.status = $4
          )
        )
        and (
          $5::text is null
          or exists (
            select 1 from campaigns c
            where c.id = kpi.campaign_id and UPPER(c.objective) = UPPER($5)
          )
        )
      group by kpi.metric_date
      order by kpi.metric_date
      `,
      [workspaceId, accountIds, days, status && status !== 'all' ? status : null, objective || null]
    );

    const data = rows.map((r: {
      d: string;
      spend: number | null;
      results: number | null;
      revenue: number | null;
      impressions: number | null;
      clicks: number | null;
    }) => ({
      date: r.d,
      spend: Number(r.spend || 0),
      results: Number(r.results || 0),
      revenue: Number(r.revenue || 0),
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
    }));

    res.json(data);
  } catch (err: any) {
    console.error('getTimeSeriesMetrics error', err);
    res.status(500).json({ error: 'failed_to_fetch_timeseries' });
  }
}

export async function getAggregateMetricsByObjective(req: Request, res: Response) {
  try {
    const pool = getPool();
    const workspaceId = getWorkspaceId();
    const platform = (req.query.platform as string) || 'meta';
    const days = parseDaysParam(req.query.days);
    const accountId = req.query.accountId as string | undefined;
    const status = (req.query.status as string | undefined);

    const accountIds = await resolveAccountIds(pool, workspaceId, platform, accountId);
    if (accountIds.length === 0) {
      return res.json([]);
    }

    // Usar v_campaign_kpi que já filtra conversões por objetivo
    const { rows } = await pool.query<{
      objective: string;
      result_label: string;
      campaign_count: number;
      total_spend: number | null;
      total_results: number | null;
      total_revenue: number | null;
      avg_roas: number | null;
      avg_cost_per_result: number | null;
    }>(
      `
      SELECT
        objective,
        result_label,
        COUNT(DISTINCT campaign_id) as campaign_count,
        SUM(spend)::float8 as total_spend,
        SUM(result_value)::float8 as total_results,
        SUM(revenue)::float8 as total_revenue,
        AVG(roas)::float8 as avg_roas,
        AVG(cost_per_result)::float8 as avg_cost_per_result
      FROM v_campaign_kpi
      WHERE workspace_id = $1
        AND platform_account_id = ANY($2::uuid[])
        AND metric_date >= CURRENT_DATE - $3::int
        AND metric_date < CURRENT_DATE
        ${status && status !== 'all' ? `
        AND EXISTS (
          SELECT 1 FROM campaigns c
          WHERE c.id = campaign_id AND c.status = $4
        )` : ''}
      GROUP BY objective, result_label
      ORDER BY total_spend DESC NULLS LAST
      `,
      status && status !== 'all'
        ? [workspaceId, accountIds, days, status]
        : [workspaceId, accountIds, days]
    );

    const data = rows.map((r) => ({
      objective: r.objective,
      resultLabel: r.result_label,
      campaignCount: Number(r.campaign_count || 0),
      totalSpend: Number(r.total_spend || 0),
      totalResults: Number(r.total_results || 0),
      totalRevenue: Number(r.total_revenue || 0),
      avgRoas: r.avg_roas ? Number(r.avg_roas) : null,
      avgCostPerResult: r.avg_cost_per_result ? Number(r.avg_cost_per_result) : null,
    }));

    res.json(data);
  } catch (err: any) {
    console.error('getAggregateMetricsByObjective error', err);
    res.status(500).json({ error: 'failed_to_fetch_objective_metrics' });
  }
}
