import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';
import { resolveWorkspaceId } from '../../utils/workspace.js';

function parseDaysParam(days?: unknown): number {
  const value = Array.isArray(days) ? days[0] : days;
  const raw = typeof value === 'string' ? value : (value != null ? String(value) : '');
  const n = Number(raw);
  return !isNaN(n) && n > 0 ? Math.min(n, 90) : 7;
}

function expandObjectiveAliases(obj?: string | null): string[] | null {
  if (!obj || obj === 'all') return null;
  const o = String(obj).toUpperCase();
  const map: Record<string, string[]> = {
    'OUTCOME_LEADS': ['OUTCOME_LEADS', 'LEAD_GENERATION', 'LEADS'],
    'OUTCOME_SALES': ['OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE'],
    'OUTCOME_TRAFFIC': ['OUTCOME_TRAFFIC', 'TRAFFIC', 'LINK_CLICKS'],
    'OUTCOME_MESSAGES': ['OUTCOME_MESSAGES', 'MESSAGES'],
    'OUTCOME_ENGAGEMENT': ['OUTCOME_ENGAGEMENT', 'ENGAGEMENT', 'POST_ENGAGEMENT'],
    'OUTCOME_AWARENESS': ['OUTCOME_AWARENESS', 'AWARENESS', 'BRAND_AWARENESS', 'REACH'],
    'OUTCOME_APP_PROMOTION': ['OUTCOME_APP_PROMOTION', 'APP_PROMOTION']
  };
  const arr = map[o] || [o];
  return arr.map((s) => s.toUpperCase());
}

async function resolveAccountIds(pool: any, workspaceId: string, platform: string, accountId?: string) {
  if (accountId && accountId !== 'all') return [accountId];
  const { rows } = await pool.query(`
    select id from platform_accounts
    where workspace_id = $1 and platform_key = $2
      and coalesce(name, '') not ilike '%demo%'
  `, [workspaceId, platform]);
  return rows.map((r: any) => r.id);
}

export async function getAggregateMetrics(req: Request, res: Response) {
  try {
    const pool = getPool();
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    }
    const platform = (req.query.platform as string) || 'meta';
    const days = parseDaysParam(req.query.days);
    const accountId = req.query.accountId as string | undefined;
    const status = (req.query.status as string | undefined);
    const objective = (req.query.objective as string | undefined);
    const objectiveAliases = expandObjectiveAliases(objective);

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
        linkClicks: 0,
        landingPageViews: 0,
        conversationsStarted: 0,
        buttonClicks: 0,
        engagements: 0,
        saves: 0,
        shares: 0,
        addToCart: 0,
        checkouts: 0,
        purchases: 0,
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
      reach: number | null;
      link_clicks: number | null;
      landing_page_views: number | null;
      conversations_started: number | null;
      button_clicks: number | null;
      engagements: number | null;
      saves: number | null;
      shares: number | null;
      add_to_cart: number | null;
      checkouts: number | null;
      purchases: number | null;
      active_campaigns: number | null;
      total_campaigns: number | null;
    }>(
      `
      -- Usar v_campaign_kpi que já tem a lógica correta de conversões por objetivo
      with pm_dedup as (
        select * from (
          select
            pm.workspace_id,
            pm.platform_account_id,
            pm.campaign_id,
            pm.metric_date,
            pm.spend,
            pm.reach,
            pm.impressions,
            pm.clicks,
            coalesce(pm.extra_metrics, '{}'::jsonb) as extra_metrics,
            pm.synced_at,
            row_number() over (
              partition by pm.platform_account_id, pm.campaign_id, pm.metric_date
              order by pm.synced_at desc nulls last
            ) as rn
          from performance_metrics pm
          where pm.workspace_id = $1
            and pm.platform_account_id = any($2::uuid[])
            and pm.granularity = 'day'
            and pm.ad_set_id is null
            and pm.ad_id is null
            and pm.metric_date >= current_date - $3::int
            and pm.metric_date < current_date
            and pm.campaign_id is not null
            and pm.campaign_id is not null
        ) t where rn = 1
      ),
      pm_agg as (
        select
          workspace_id,
          campaign_id,
          metric_date,
          sum(impressions)::float8 as impressions,
          sum(clicks)::float8 as clicks,
          sum(reach)::float8 as reach,
          sum(spend)::float8 as spend
        from pm_dedup
        where (
          $5::text[] is null
          or exists (
            select 1 from campaigns c
            where c.id = campaign_id
              and upper(c.objective) = any($5::text[])
          )
        )
        group by workspace_id, campaign_id, metric_date
      ),
      pm_actions as (
        select
          pm.workspace_id,
          pm.campaign_id,
          pm.metric_date,
          sum((act->>'value')::numeric) filter (where act->>'action_type' in ('link_click', 'inline_link_click', 'outbound_click')) as link_clicks,
          sum((act->>'value')::numeric) filter (where act->>'action_type' in ('landing_page_view', 'omni_landing_page_view', 'onsite_conversion.landing_page_view')) as landing_page_views,
          sum((act->>'value')::numeric) filter (
            where act->>'action_type' in (
              'onsite_conversion.messaging_conversation_started_7d',
              'onsite_conversion.whatsapp_conversation_started_7d',
              'onsite_conversion.messenger_conversation_started_7d'
            )
          ) as conversations_started,
          sum((act->>'value')::numeric) filter (
            where act->>'action_type' in (
              'post_engagement',
              'page_engagement',
              'post_interaction_gross',
              'post_reaction',
              'comment',
              'like',
              'omni_engagement',
              'post'
            )
          ) as engagements,
          sum((act->>'value')::numeric) filter (where act->>'action_type' in ('onsite_conversion.post_save', 'post_save')) as saves,
          sum((act->>'value')::numeric) filter (where act->>'action_type' in ('post_share', 'share', 'onsite_conversion.post_share')) as shares,
          sum((act->>'value')::numeric) filter (where act->>'action_type' = 'outbound_click') as button_clicks,
          sum((act->>'value')::numeric) filter (
            where act->>'action_type' in (
              'add_to_cart',
              'omni_add_to_cart',
              'onsite_conversion.add_to_cart',
              'onsite_conversion.omni_add_to_cart'
            )
          ) as add_to_cart,
          sum((act->>'value')::numeric) filter (
            where act->>'action_type' in (
              'initiate_checkout',
              'checkout_initiated',
              'omni_checkout_initiated',
              'onsite_conversion.checkout_initiated',
              'onsite_conversion.initiated_checkout'
            )
          ) as checkouts,
          sum((act->>'value')::numeric) filter (
            where act->>'action_type' in (
              'purchase',
              'omni_purchase',
              'onsite_conversion.purchase',
              'offsite_conversion.fb_pixel_purchase'
            )
          ) as purchases
        from pm_dedup pm
        left join lateral jsonb_array_elements(coalesce(pm.extra_metrics -> 'actions', '[]'::jsonb)) act on true
        group by pm.workspace_id, pm.campaign_id, pm.metric_date
      ),
      pm_steps as (
        select
          pm.workspace_id,
          pm.campaign_id,
          pm.metric_date,
          (
            coalesce(pm_actions.link_clicks, 0) +
            coalesce((pm.extra_metrics ->> 'inline_link_clicks')::numeric, 0)
          )::float8 as link_clicks,
          (
            coalesce(pm_actions.landing_page_views, 0) +
            coalesce((pm.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'landing_page_view')::numeric, 0)
          )::float8 as landing_page_views,
          (
            coalesce(pm_actions.conversations_started, 0) +
            coalesce((pm.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'conversations_started')::numeric, 0) +
            coalesce((pm.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'onsite_conversion.messaging_conversation_started_7d')::numeric, 0) +
            coalesce((pm.extra_metrics -> 'derived_metrics' -> 'counts' ->> 'onsite_conversion.whatsapp_conversation_started_7d')::numeric, 0)
          )::float8 as conversations_started,
          (
            coalesce(pm_actions.engagements, 0) +
            coalesce((pm.extra_metrics ->> 'inline_post_engagement')::numeric, 0)
          )::float8 as engagements,
          coalesce(pm_actions.saves, 0)::float8 as saves,
          coalesce(pm_actions.shares, 0)::float8 as shares,
          (
            coalesce(pm_actions.button_clicks, 0) +
            coalesce((pm.extra_metrics ->> 'inline_link_clicks')::numeric, 0)
          )::float8 as button_clicks,
          coalesce(pm_actions.add_to_cart, 0)::float8 as add_to_cart,
          coalesce(pm_actions.checkouts, 0)::float8 as checkouts,
          coalesce(pm_actions.purchases, 0)::float8 as purchases
        from pm_dedup pm
        left join pm_actions on
          pm_actions.workspace_id = pm.workspace_id
          and pm_actions.campaign_id = pm.campaign_id
          and pm_actions.metric_date = pm.metric_date
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
          and kpi.platform_account_id = any($2::uuid[])
          and kpi.metric_date >= current_date - $3::int
          and kpi.metric_date < current_date
          and kpi.campaign_id is not null
          and kpi.ad_set_id is null
          and kpi.ad_id is null
          and (
            $4::text is null
            or exists (
              select 1 from campaigns c
              where c.id = kpi.campaign_id and c.status = $4
            )
          )
          and (
            $5::text[] is null
            or exists (
              select 1 from campaigns c
              where c.id = kpi.campaign_id
                and upper(c.objective) = any($5::text[])
            )
          )
      ),
      kpi_data as (
        select distinct on (campaign_id, metric_date)
          campaign_id,
          metric_date,
          spend,
          result_value,
          revenue,
          roas
        from kpi_raw
        order by campaign_id, metric_date, spend desc nulls last
      )
      select
        sum(pm_agg.spend)::float8 as spend,
        sum(kpi_data.result_value)::float8 as results,
        sum(kpi_data.revenue)::float8 as revenue,
        sum(coalesce(kpi_data.roas, 0) * coalesce(kpi_data.spend, 0))::float8 as roas_weighted_spend,
        sum(pm_agg.impressions)::float8 as impressions,
        sum(pm_agg.clicks)::float8 as clicks,
        sum(pm_agg.reach)::float8 as reach,
        sum(pm_steps.link_clicks)::float8 as link_clicks,
        sum(pm_steps.landing_page_views)::float8 as landing_page_views,
        sum(pm_steps.conversations_started)::float8 as conversations_started,
        sum(pm_steps.button_clicks)::float8 as button_clicks,
        sum(pm_steps.engagements)::float8 as engagements,
        sum(pm_steps.saves)::float8 as saves,
        sum(pm_steps.shares)::float8 as shares,
        sum(pm_steps.add_to_cart)::float8 as add_to_cart,
        sum(pm_steps.checkouts)::float8 as checkouts,
        sum(pm_steps.purchases)::float8 as purchases,
        count(distinct case when c.id is not null and pm_agg.spend > 0 then c.id end) as active_campaigns,
        count(distinct c.id) as total_campaigns
      from kpi_data
      left join pm_agg on pm_agg.workspace_id = $1 and pm_agg.campaign_id = kpi_data.campaign_id and pm_agg.metric_date = kpi_data.metric_date
      left join pm_steps on pm_steps.workspace_id = $1 and pm_steps.campaign_id = kpi_data.campaign_id and pm_steps.metric_date = kpi_data.metric_date
      left join campaigns c on c.id = kpi_data.campaign_id
      where (
        $4::text is null or c.status = $4
      ) and (
        $5::text[] is null
        or (c.id is not null and upper(c.objective) = any($5::text[]))
      )
      `,
      [workspaceId, accountIds, days, status && status !== 'all' ? status : null, objectiveAliases]
    );

    const row = rows[0] || {} as any;
    const spend = Number(row.spend || 0);
    const results = Number(row.results || 0);
    const revenue = Number(row.revenue || 0);
    const roasWeightedSpend = Number(row.roas_weighted_spend || 0);
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    const reach = Number(row.reach || 0);
    const linkClicks = Number(row.link_clicks || 0);
    const landingPageViews = Number(row.landing_page_views || 0);
    const conversationsStarted = Number(row.conversations_started || 0);
    const buttonClicks = Number(row.button_clicks || 0);
    const engagements = Number(row.engagements || 0);
    const saves = Number(row.saves || 0);
    const shares = Number(row.shares || 0);
    const addToCart = Number(row.add_to_cart || 0);
    const checkouts = Number(row.checkouts || 0);
    const purchases = Number(row.purchases || 0);

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
      reach,
      impressions,
      clicks,
      linkClicks,
      landingPageViews,
      conversationsStarted,
      buttonClicks,
      engagements,
      saves,
      shares,
      addToCart,
      checkouts,
      purchases,
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
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    }
    const platform = (req.query.platform as string) || 'meta';
    const days = parseDaysParam(req.query.days);
    const accountId = req.query.accountId as string | undefined;
    const metric = (req.query.metric as string) || 'spend';
    const status = (req.query.status as string | undefined);
    const objective = (req.query.objective as string | undefined);
    const objectiveAliases = expandObjectiveAliases(objective);

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
      with pm_dedup as (
        select * from (
          select
            pm.workspace_id,
            pm.platform_account_id,
            pm.campaign_id,
            pm.metric_date,
            pm.spend,
            pm.reach,
            pm.impressions,
            pm.clicks,
            pm.synced_at,
            row_number() over (
              partition by pm.platform_account_id, pm.campaign_id, pm.metric_date
              order by pm.synced_at desc nulls last
            ) as rn
          from performance_metrics pm
          where pm.workspace_id = $1
            and pm.platform_account_id = any($2::uuid[])
            and pm.granularity = 'day'
            and pm.ad_set_id is null
            and pm.ad_id is null
            and pm.metric_date >= current_date - $3::int
            and pm.metric_date < current_date
        ) t where rn = 1
      ),
      pm_agg as (
        select
          workspace_id,
          campaign_id,
          metric_date,
          sum(impressions)::float8 as impressions,
          sum(clicks)::float8 as clicks,
          sum(reach)::float8 as reach,
          sum(spend)::float8 as spend
        from pm_dedup
        where exists (
          select 1 from campaigns c
          where c.id = campaign_id
            and (
              $5::text[] is null
              or upper(c.objective) = any($5::text[])
            )
        )
        group by workspace_id, campaign_id, metric_date
      ),
      kpi_raw as (
        select
          kpi.campaign_id,
          kpi.metric_date,
          kpi.spend,
          kpi.result_value,
          kpi.revenue
        from v_campaign_kpi kpi
        where kpi.workspace_id = $1
          and kpi.platform_account_id = any($2::uuid[])
          and kpi.metric_date >= current_date - $3::int
          and kpi.metric_date < current_date
          and kpi.campaign_id is not null
          and (
            $4::text is null
            or exists (
              select 1 from campaigns c
              where c.id = kpi.campaign_id and c.status = $4
            )
          )
          and (
            exists (
              select 1 from campaigns c
              where c.id = kpi.campaign_id
                and (
                  $5::text[] is not null and upper(c.objective) = any($5::text[])
                  or $5::text[] is null
                )
            )
          )
          and kpi.ad_set_id is null
          and kpi.ad_id is null
      ),
      kpi_dedup as (
        select distinct on (campaign_id, metric_date)
          campaign_id,
          metric_date,
          spend,
          result_value,
          revenue
        from kpi_raw
        order by campaign_id, metric_date, spend desc nulls last
      )
      select
        kpi_dedup.metric_date::text as d,
        sum(kpi_dedup.spend)::float8 as spend,
        sum(kpi_dedup.result_value)::float8 as results,
        sum(kpi_dedup.revenue)::float8 as revenue,
        sum(pm_agg.impressions)::float8 as impressions,
        sum(pm_agg.clicks)::float8 as clicks,
        sum(pm_agg.reach)::float8 as reach
      from kpi_dedup
      left join pm_agg on pm_agg.workspace_id = $1 and pm_agg.campaign_id = kpi_dedup.campaign_id and pm_agg.metric_date = kpi_dedup.metric_date
      group by kpi_dedup.metric_date
      order by kpi_dedup.metric_date
      `,
      [workspaceId, accountIds, days, status && status !== 'all' ? status : null, objectiveAliases]
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
    const { id: workspaceId } = resolveWorkspaceId(req);
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspace id. Send workspaceId in query/body/header.' });
    }
    const platform = (req.query.platform as string) || 'meta';
    const days = parseDaysParam(req.query.days);
    const accountId = req.query.accountId as string | undefined;
    const status = (req.query.status as string | undefined);

    const accountIds = await resolveAccountIds(pool, workspaceId, platform, accountId);
    if (accountIds.length === 0) {
      return res.json([]);
    }

    // Usar exclusivamente v_campaign_kpi (fonte única dos KPIs por objetivo)
    const { rows } = await pool.query<{
      objective: string | null;
      result_label: string | null;
      campaign_count: number;
      total_spend: number | null;
      total_results: number | null;
      total_revenue: number | null;
    }>(
      `
      with kpi as (
        select
          kpi.campaign_id,
          upper(coalesce(kpi.objective, 'UNKNOWN')) as objective,
          coalesce(kpi.result_label, 'Resultados') as result_label,
          sum(coalesce(kpi.spend, 0))::float8 as spend,
          sum(coalesce(kpi.result_value, 0))::float8 as result_value,
          sum(coalesce(kpi.revenue, 0))::float8 as revenue
        from v_campaign_kpi kpi
        where kpi.workspace_id = $1
          and kpi.platform_account_id = any($2::uuid[])
          and kpi.metric_date >= current_date - $3::int
          and kpi.metric_date < current_date
          and kpi.campaign_id is not null
          and kpi.ad_set_id is null
          and kpi.ad_id is null
        group by kpi.campaign_id, objective, result_label
      )
      select
        k.objective,
        k.result_label,
        count(distinct c.id) as campaign_count,
        sum(k.spend)::float8 as total_spend,
        sum(k.result_value)::float8 as total_results,
        sum(k.revenue)::float8 as total_revenue
      from kpi k
      left join campaigns c on c.id = k.campaign_id
      where (${status && status !== 'all' ? 'c.status = $4 and ' : ''}1=1)
      group by k.objective, k.result_label
      order by total_spend desc nulls last
      `,
      status && status !== 'all'
        ? [workspaceId, accountIds, days, status]
        : [workspaceId, accountIds, days]
    );

    const data = rows.map((r: any) => {
      const totalSpend = Number(r.total_spend || 0);
      const totalResults = Number(r.total_results || 0);
      const totalRevenue = Number(r.total_revenue || 0);

      return {
        objective: r.objective || 'UNKNOWN',
        resultLabel: r.result_label || 'Resultados',
        campaignCount: Number(r.campaign_count || 0),
        totalSpend,
        totalResults,
        totalRevenue,
        avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : null,
        avgCostPerResult: totalResults > 0 ? totalSpend / totalResults : null,
      };
    });

    res.json(data);
  } catch (err: any) {
    console.error('getAggregateMetricsByObjective error', err);
    res.status(500).json({ error: 'failed_to_fetch_objective_metrics' });
  }
}
