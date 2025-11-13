import { DatabaseClient, SyncContext, defaultLogger } from './db.js';

type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface RecommendationInsight {
  id: string;
  ruleId: string;
  date: string;
  severity: Severity;
  title: string;
  explanation: string;
  actionKind: string;
  actionParams: Record<string, unknown> | null;
  expectedGainPct: number | null;
  status: string;
  account: {
    id: string;
    name: string | null;
  };
  entities: {
    campaign?: { id: string | null; name: string | null };
    adset?: { id: string | null; name: string | null };
    ad?: { id: string | null; name: string | null };
  };
}

export interface SyncInsightsSummary {
  generatedAt: string;
  workspaceId: string;
  platformKey: string;
  period: {
    requestedDays: number;
    startDate: string | null;
    endDate: string | null;
    daysCovered: number;
    dataFreshness: string | null;
  };
  performance: {
    totalSpend: number;
    totalResults: number;
    totalRevenue: number;
    costPerResult: number | null;
    roas: number | null;
    avgDailySpend: number | null;
    avgHealthScore: number | null;
    trend?: {
      recentWindowDays: number;
      recentSpend: number;
      previousSpend: number;
      spendDeltaPct: number | null;
      recentResults: number;
      previousResults: number;
      resultsDeltaPct: number | null;
    };
    topCampaigns: Array<{
      name: string;
      spend: number;
      results: number;
      costPerResult: number | null;
    }>;
    underperformingCampaigns: Array<{
      name: string;
      spend: number;
      results: number;
      costPerResult: number | null;
    }>;
    extra?: {
      ig?: {
        totals: Record<string, number>;
        recent: Record<string, number>;
      };
    };
  };
  counts: {
    totalRecommendations: number;
    bySeverity: Record<string, number>;
    opportunities: number;
    risks: number;
  };
  opportunities: RecommendationInsight[];
  risks: RecommendationInsight[];
  notes: string[];
}

interface GenerateOptions {
  workspaceId: string;
  platformKey: string;
  days: number;
  ctx: SyncContext;
}

function computeDeltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export async function generatePostSyncInsights(options: GenerateOptions): Promise<SyncInsightsSummary> {
  const logger = options.ctx.logger ?? defaultLogger;
  const db = options.ctx.db;

  const generatedAt = new Date().toISOString();
  const notes: string[] = [];

  const workspaceAccounts = await db.query<{
    id: string;
    external_id: string;
    name: string | null;
  }>(
    `
    select id, external_id, name
    from platform_accounts
    where workspace_id = $1
      and platform_key = $2
    `,
    [options.workspaceId, options.platformKey],
  );

  if (workspaceAccounts.rows.length === 0) {
    notes.push('Nenhuma conta vinculada ao workspace para gerar insights.');

    return {
      generatedAt,
      workspaceId: options.workspaceId,
      platformKey: options.platformKey,
      period: {
        requestedDays: options.days,
        startDate: null,
        endDate: null,
        daysCovered: 0,
        dataFreshness: null,
      },
      performance: {
        totalSpend: 0,
        totalResults: 0,
        totalRevenue: 0,
        costPerResult: null,
        roas: null,
        avgDailySpend: null,
        avgHealthScore: null,
        topCampaigns: [],
        underperformingCampaigns: [],
      },
      counts: {
        totalRecommendations: 0,
        bySeverity: {},
        opportunities: 0,
        risks: 0,
      },
      opportunities: [],
      risks: [],
      notes,
    };
  }

  const platformAccountIds = workspaceAccounts.rows.map((row) => row.id);
  const daysWindow = Math.max(1, Math.min(options.days, 90));

  const dailyMetricsResult = await db.query<{
    d: string;
    spend: number | null;
    conversions: number | null;
    conversion_value: number | null;
    impressions: number | null;
    clicks: number | null;
  }>(
    `
    select
      metric_date::text as d,
      sum(spend)::float8 as spend,
      sum(conversions)::float8 as conversions,
      sum(conversion_value)::float8 as conversion_value,
      sum(impressions)::float8 as impressions,
      sum(clicks)::float8 as clicks
    from performance_metrics
    where workspace_id = $1
      and platform_account_id = any($2::uuid[])
      and granularity = 'day'
      and ad_set_id is null
      and metric_date >= (current_date - $3::int)
    group by metric_date
    order by metric_date asc
    `,
    [options.workspaceId, platformAccountIds, daysWindow],
  );

  const spendSeries = dailyMetricsResult.rows.map((row) => Number(row.spend ?? 0));
  const resultSeries = dailyMetricsResult.rows.map((row) => Number(row.conversions ?? 0));
  const revenueSeries = dailyMetricsResult.rows.map((row) => Number(row.conversion_value ?? 0));

  const totalSpend = spendSeries.reduce((acc, value) => acc + value, 0);
  const totalResults = resultSeries.reduce((acc, value) => acc + value, 0);
  const totalRevenue = revenueSeries.reduce((acc, value) => acc + value, 0);
  const costPerResult = totalResults > 0 ? totalSpend / totalResults : null;
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;

  const avgDailySpend = spendSeries.length > 0 ? totalSpend / spendSeries.length : null;

  const trendWindow = Math.min(7, spendSeries.length);
  let trend;
  if (trendWindow > 0) {
    const recentSpend = spendSeries.slice(-trendWindow).reduce((acc, value) => acc + value, 0);
    const previousSpend = spendSeries.slice(-(trendWindow * 2), -trendWindow).reduce((acc, value) => acc + value, 0);
    const recentResults = resultSeries.slice(-trendWindow).reduce((acc, value) => acc + value, 0);
    const previousResults = resultSeries.slice(-(trendWindow * 2), -trendWindow).reduce((acc, value) => acc + value, 0);

    trend = {
      recentWindowDays: trendWindow,
      recentSpend,
      previousSpend,
      spendDeltaPct: computeDeltaPct(recentSpend, previousSpend),
      recentResults,
      previousResults,
      resultsDeltaPct: computeDeltaPct(recentResults, previousResults),
    };
  }

  const topCampaignsResult = await db.query<{
    name: string;
    spend: number;
    conversions: number;
  }>(
    `
    select
      c.name,
      sum(pm.spend)::float8 as spend,
      sum(pm.conversions)::float8 as conversions
    from performance_metrics pm
    join campaigns c on c.id = pm.campaign_id
    where pm.workspace_id = $1
      and pm.platform_account_id = any($2::uuid[])
      and pm.metric_date >= (current_date - $3::int)
    group by c.name
    order by spend desc
    limit 5
    `,
    [options.workspaceId, platformAccountIds, daysWindow],
  );

  const underperformingCampaignsResult = await db.query<{
    name: string;
    spend: number;
    conversions: number;
  }>(
    `
    select
      c.name,
      sum(pm.spend)::float8 as spend,
      sum(pm.conversions)::float8 as conversions
    from performance_metrics pm
    join campaigns c on c.id = pm.campaign_id
    where pm.workspace_id = $1
      and pm.platform_account_id = any($2::uuid[])
      and pm.metric_date >= (current_date - $3::int)
    group by c.name
    having sum(pm.spend) > 0
    order by sum(pm.conversions) asc
    limit 5
    `,
    [options.workspaceId, platformAccountIds, daysWindow],
  );

  const insightsResult = await db.query<{
    id: string;
    rule_id: string;
    severity: Severity;
    status: string;
    title: string;
    explanation: string;
    action_kind: string;
    action_params: Record<string, unknown> | null;
    expected_gain_pct: number | null;
    account_id: string | null;
    campaign_id: string | null;
    ad_set_id: string | null;
    ad_id: string | null;
    created_at: string;
  }>(
    `
    select *
    from ai_insights
    where workspace_id = $1
      and platform_key = $2
      and created_at >= (now() - interval '7 days')
    order by created_at desc
    `,
    [options.workspaceId, options.platformKey],
  );

  const opportunities: RecommendationInsight[] = [];
  const risks: RecommendationInsight[] = [];
  const severityCounts: Record<string, number> = {};

  for (const row of insightsResult.rows) {
    const insight: RecommendationInsight = {
      id: row.id,
      ruleId: row.rule_id,
      date: new Date(row.created_at).toISOString(),
      severity: row.severity,
      title: row.title,
      explanation: row.explanation,
      actionKind: row.action_kind,
      actionParams: row.action_params,
      expectedGainPct: row.expected_gain_pct,
      status: row.status,
      account: { id: row.account_id ?? '', name: null },
      entities: {},
    };

    severityCounts[row.severity] = (severityCounts[row.severity] ?? 0) + 1;

    if (row.campaign_id) {
      insight.entities.campaign = { id: row.campaign_id, name: null };
    }
    if (row.ad_set_id) {
      insight.entities.adset = { id: row.ad_set_id, name: null };
    }
    if (row.ad_id) {
      insight.entities.ad = { id: row.ad_id, name: null };
    }

    if (row.severity === 'low' || row.severity === 'medium') {
      opportunities.push(insight);
    } else {
      risks.push(insight);
    }
  }

  let igExtras: SyncInsightsSummary['performance']['extra'] = undefined;
  if (options.platformKey === 'instagram') {
    const igTotals = await db.query<{
      metric: string;
      total: number;
    }>(
      `
      select metric, sum(value)::float8 as total
      from instagram_user_insights
      where workspace_id = $1
        and recorded_at >= (current_date - $2::int)
      group by metric
      `,
      [options.workspaceId, daysWindow],
    );

    const recentIg = await db.query<{
      metric: string;
      total: number;
    }>(
      `
      select metric, sum(value)::float8 as total
      from instagram_user_insights
      where workspace_id = $1
        and recorded_at >= (current_date - 3)
      group by metric
      `,
      [options.workspaceId],
    );

    const totals: Record<string, number> = {};
    for (const row of igTotals.rows) {
      totals[row.metric] = Number(row.total ?? 0);
    }
    const recent: Record<string, number> = {};
    for (const row of recentIg.rows) {
      recent[row.metric] = Number(row.total ?? 0);
    }

    igExtras = {
      ig: {
        totals,
        recent,
      },
    };
  }

  const summary: SyncInsightsSummary = {
    generatedAt,
    workspaceId: options.workspaceId,
    platformKey: options.platformKey,
    period: {
      requestedDays: options.days,
      startDate: dailyMetricsResult.rows[0]?.d ?? null,
      endDate: dailyMetricsResult.rows.at(-1)?.d ?? null,
      daysCovered: dailyMetricsResult.rows.length,
      dataFreshness: new Date().toISOString(),
    },
    performance: {
      totalSpend,
      totalResults,
      totalRevenue,
      costPerResult,
      roas,
      avgDailySpend,
      avgHealthScore: null,
      trend,
      topCampaigns: topCampaignsResult.rows.map((row) => ({
        name: row.name,
        spend: Number(row.spend ?? 0),
        results: Number(row.conversions ?? 0),
        costPerResult: row.conversions ? Number(row.spend ?? 0) / Number(row.conversions ?? 1) : null,
      })),
      underperformingCampaigns: underperformingCampaignsResult.rows.map((row) => ({
        name: row.name,
        spend: Number(row.spend ?? 0),
        results: Number(row.conversions ?? 0),
        costPerResult: row.conversions ? Number(row.spend ?? 0) / Number(row.conversions ?? 1) : null,
      })),
      extra: igExtras,
    },
    counts: {
      totalRecommendations: insightsResult.rows.length,
      bySeverity: severityCounts,
      opportunities: opportunities.length,
      risks: risks.length,
    },
    opportunities,
    risks,
    notes,
  };

  logger.info('📊 Post-sync insights gerados com sucesso');
  return summary;
}
