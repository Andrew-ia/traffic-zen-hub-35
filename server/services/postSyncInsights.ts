import type { Pool } from 'pg';
import { getPool } from '../config/database.js';

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
        totals: {
          reach: number;
          impressions: number;
          clicks: number;
          profileViews: number;
          accountsEngaged: number;
          totalInteractions: number;
          emailContacts: number;
          phoneCallClicks: number;
          getDirectionsClicks: number;
          textMessageClicks: number;
        };
        recent: {
          impressions: number;
          clicks: number;
          reach: number;
        };
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
  pool?: Pool;
}

function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

function computeDeltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export async function generatePostSyncInsights(options: GenerateOptions): Promise<SyncInsightsSummary> {
  const pool = options.pool ?? getPool();
  const generatedAt = new Date().toISOString();
  const notes: string[] = [];

  const workspaceAccounts = await pool.query<{
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
    [options.workspaceId, options.platformKey]
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

  const accountMap = new Map(workspaceAccounts.rows.map((row) => [row.id, row]));
  const platformAccountIds = workspaceAccounts.rows.map((row) => row.id);

  const daysWindow = Math.max(1, Math.min(options.days, 90));

  const dailyMetricsResult = await pool.query<{
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
      and ad_id is null
      and metric_date >= current_date - ($3::int - 1)
    group by metric_date
    order by metric_date
    `,
    [options.workspaceId, platformAccountIds, daysWindow]
  );

  const dailyMetrics = dailyMetricsResult.rows.map((row) => ({
    date: row.d,
    spend: Number(row.spend ?? 0),
    conversions: Number(row.conversions ?? 0),
    revenue: Number(row.conversion_value ?? 0),
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
  }));

  const startDate = dailyMetrics.length > 0 ? dailyMetrics[0].date : null;
  const endDate = dailyMetrics.length > 0 ? dailyMetrics[dailyMetrics.length - 1].date : null;
  const daysCovered = dailyMetrics.length;

  if (!startDate || !endDate) {
    notes.push('Nenhuma métrica disponível no período selecionado.');
  }

  const totalSpend = dailyMetrics.reduce((acc, row) => acc + row.spend, 0);
  const totalResults = dailyMetrics.reduce((acc, row) => acc + row.conversions, 0);
  const totalRevenue = dailyMetrics.reduce((acc, row) => acc + row.revenue, 0);
  const totalImpressions = dailyMetrics.reduce((acc, row) => acc + row.impressions, 0);
  const totalClicks = dailyMetrics.reduce((acc, row) => acc + row.clicks, 0);

  const costPerResult = totalResults > 0 ? totalSpend / totalResults : null;
  // ROAS deve ser calculado apenas para campanhas com objetivo de vendas
  // Usamos os dados por campanha para somar receita e gasto somente dos objetivos SALES/CONVERSIONS/PURCHASE
  let roas: number | null = null;
  const isSalesObjective = (obj: string | null | undefined) => {
    const o = (obj || '').toUpperCase();
    return (
      o.includes('SALES') ||
      o.includes('PURCHASE') ||
      o.includes('CONVERSIONS') ||
      o === 'OUTCOME_SALES'
    );
  };
  // Nota: ainda não temos campaignStats aqui; roas será recalculado após campaignStats abaixo
  // temporariamente mantém null; depois que campaignStats for populado, atualizamos roas com base nos objetivos
  const avgDailySpend = daysCovered > 0 ? totalSpend / daysCovered : null;
  const avgCtrOverall = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;

  let trend:
    | {
        recentWindowDays: number;
        recentSpend: number;
        previousSpend: number;
        spendDeltaPct: number | null;
        recentResults: number;
        previousResults: number;
        resultsDeltaPct: number | null;
      }
    | undefined;

  if (dailyMetrics.length >= 2) {
    const windowSize = Math.min(3, Math.floor(dailyMetrics.length / 2) || 1);
    const recentSlice = dailyMetrics.slice(-windowSize);
    const previousSlice = dailyMetrics.slice(-windowSize * 2, -windowSize);

    if (previousSlice.length > 0) {
      const recentSpend = recentSlice.reduce((acc, row) => acc + row.spend, 0);
      const previousSpend = previousSlice.reduce((acc, row) => acc + row.spend, 0);
      const recentResults = recentSlice.reduce((acc, row) => acc + row.conversions, 0);
      const previousResults = previousSlice.reduce((acc, row) => acc + row.conversions, 0);

      trend = {
        recentWindowDays: windowSize,
        recentSpend,
        previousSpend,
        spendDeltaPct: computeDeltaPct(recentSpend, previousSpend),
        recentResults,
        previousResults,
        resultsDeltaPct: computeDeltaPct(recentResults, previousResults),
      };
    }
  }

  // Instagram-specific aggregation from extra_metrics
  let performanceExtra: SyncInsightsSummary['performance']['extra'] | undefined = undefined;
  if (options.platformKey.toLowerCase() === 'instagram') {
    const igAggRes = await pool.query<{
      d: string;
      impressions: number | null;
      clicks: number | null;
      reach: number | null;
      profile_views: number | null;
      accounts_engaged: number | null;
      total_interactions: number | null;
      email_contacts: number | null;
      phone_call_clicks: number | null;
      get_directions_clicks: number | null;
      text_message_clicks: number | null;
    }>(
      `
      select
        pm.metric_date::text as d,
        sum(pm.impressions)::float8 as impressions,
        sum(pm.clicks)::float8 as clicks,
        sum((pm.extra_metrics->>'reach')::float8) as reach,
        sum((pm.extra_metrics->>'profile_views')::float8) as profile_views,
        sum((pm.extra_metrics->>'accounts_engaged')::float8) as accounts_engaged,
        sum((pm.extra_metrics->>'total_interactions')::float8) as total_interactions,
        sum((pm.extra_metrics->>'email_contacts')::float8) as email_contacts,
        sum((pm.extra_metrics->>'phone_call_clicks')::float8) as phone_call_clicks,
        sum((pm.extra_metrics->>'get_directions_clicks')::float8) as get_directions_clicks,
        sum((pm.extra_metrics->>'text_message_clicks')::float8) as text_message_clicks
      from performance_metrics pm
      where pm.workspace_id = $1
        and pm.platform_account_id = any($2::uuid[])
        and pm.granularity = 'day'
        and pm.campaign_id is null
        and pm.ad_set_id is null
        and pm.ad_id is null
        and pm.metric_date >= current_date - ($3::int - 1)
      group by pm.metric_date
      order by pm.metric_date
      `,
      [options.workspaceId, platformAccountIds, daysWindow]
    );

    const igAgg = igAggRes.rows || [];
    const totals = igAgg.reduce(
      (acc, r) => {
        acc.reach += Number(r.reach ?? 0);
        acc.impressions += Number(r.impressions ?? 0);
        acc.clicks += Number(r.clicks ?? 0);
        acc.profileViews += Number(r.profile_views ?? 0);
        acc.accountsEngaged += Number(r.accounts_engaged ?? 0);
        acc.totalInteractions += Number(r.total_interactions ?? 0);
        acc.emailContacts += Number(r.email_contacts ?? 0);
        acc.phoneCallClicks += Number(r.phone_call_clicks ?? 0);
        acc.getDirectionsClicks += Number(r.get_directions_clicks ?? 0);
        acc.textMessageClicks += Number(r.text_message_clicks ?? 0);
        return acc;
      },
      {
        reach: 0,
        impressions: 0,
        clicks: 0,
        profileViews: 0,
        accountsEngaged: 0,
        totalInteractions: 0,
        emailContacts: 0,
        phoneCallClicks: 0,
        getDirectionsClicks: 0,
        textMessageClicks: 0,
      }
    );

    const last3 = igAgg.slice(-3);
    const recent = last3.reduce(
      (acc, r) => {
        acc.impressions += Number(r.impressions ?? 0);
        acc.clicks += Number(r.clicks ?? 0);
        acc.reach += Number(r.reach ?? 0);
        return acc;
      },
      { impressions: 0, clicks: 0, reach: 0 }
    );

    performanceExtra = { ig: { totals, recent } };

    if (totalSpend === 0 && totalResults === 0) {
      notes.push('Sincronização Instagram concluída. KPIs de anúncio (gasto, conversões) não se aplicam.');
    }
  }

  const campaignMetricsResult = await pool.query<{
    campaign_id: string;
    campaign_name: string | null;
    campaign_objective: string | null;
    platform_account_id: string;
    spend: number | null;
    conversions: number | null;
    conversion_value: number | null;
    impressions: number | null;
    clicks: number | null;
    avg_ctr: number | null;
    avg_cpc: number | null;
  }>(
    `
    select
      pm.campaign_id,
      c.name as campaign_name,
      c.objective as campaign_objective,
      pm.platform_account_id,
      sum(pm.spend)::float8 as spend,
      sum(pm.conversions)::float8 as conversions,
      sum(pm.conversion_value)::float8 as conversion_value,
      sum(pm.impressions)::float8 as impressions,
      sum(pm.clicks)::float8 as clicks,
      avg(pm.ctr)::float8 as avg_ctr,
      avg(pm.cpc)::float8 as avg_cpc
    from performance_metrics pm
    left join campaigns c on c.id = pm.campaign_id
    where pm.workspace_id = $1
      and pm.platform_account_id = any($2::uuid[])
      and pm.granularity = 'day'
      and pm.ad_set_id is null
      and pm.ad_id is null
      and pm.metric_date >= current_date - ($3::int - 1)
      and pm.campaign_id is not null
    group by pm.campaign_id, c.name, c.objective, pm.platform_account_id
    `,
    [options.workspaceId, platformAccountIds, daysWindow]
  );

  const campaignStats = campaignMetricsResult.rows.map((row) => {
    const spend = Number(row.spend ?? 0);
    const conversions = Number(row.conversions ?? 0);
    const impressions = Number(row.impressions ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const avgCtr = Number(row.avg_ctr ?? (impressions > 0 ? (clicks / impressions) * 100 : 0));

    return {
      campaignId: row.campaign_id,
      name: row.campaign_name ?? 'Campanha sem nome',
      objective: row.campaign_objective ?? null,
      platformAccountId: row.platform_account_id,
      account: accountMap.get(row.platform_account_id),
      spend,
      conversions,
      revenue: Number(row.conversion_value ?? 0),
      impressions,
      clicks,
      avgCtr,
      avgCpc: Number(row.avg_cpc ?? 0),
      costPerResult: conversions > 0 ? spend / conversions : null,
    };
  });

  if (campaignStats.length === 0) {
    notes.push('Nenhuma campanha com gasto registrado no período analisado.');
  }

  const topCampaigns = campaignStats
    .filter((campaign) => campaign.spend > 0)
    .sort(
      (a, b) =>
        b.conversions - a.conversions ||
        b.spend - a.spend
    )
    .slice(0, 3)
    .map((campaign) => ({
      name: campaign.name,
      spend: campaign.spend,
      results: campaign.conversions,
      costPerResult: campaign.costPerResult,
    }));

  const underperformingCampaigns = campaignStats
    .filter((campaign) => campaign.spend > 0)
    .map((campaign) => ({
      ...campaign,
      score:
        campaign.costPerResult !== null
          ? campaign.costPerResult
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((campaign) => ({
      name: campaign.name,
      spend: campaign.spend,
      results: campaign.conversions,
      costPerResult: campaign.costPerResult,
    }));

  const campaignsWithConversions = campaignStats.filter(
    (campaign) => campaign.conversions > 0 && campaign.spend > 0 && campaign.costPerResult !== null
  );

  const totalSpendWithConversions = campaignsWithConversions.reduce((acc, campaign) => acc + campaign.spend, 0);
  const totalConversionsWithConversions = campaignsWithConversions.reduce((acc, campaign) => acc + campaign.conversions, 0);
  const baselineCostPerResult =
    totalConversionsWithConversions > 0 ? totalSpendWithConversions / totalConversionsWithConversions : null;

  if (baselineCostPerResult === null) {
    notes.push('Ainda não há conversões suficientes para comparar custo por resultado entre campanhas.');
  }

  const opportunities: RecommendationInsight[] = [];
  const risks: RecommendationInsight[] = [];
  const severityCount: Record<string, number> = {};
  const seenIds = new Set<string>();

  function registerInsight(target: RecommendationInsight[], insight: RecommendationInsight) {
    if (seenIds.has(insight.id)) {
      return;
    }
    seenIds.add(insight.id);
    target.push(insight);
    severityCount[insight.severity] = (severityCount[insight.severity] || 0) + 1;
  }

  const referenceDate = endDate ?? new Date().toISOString().slice(0, 10);

  if (baselineCostPerResult !== null) {
    const opportunityCandidates = campaignsWithConversions
      .filter((campaign) => {
        const costPerResultCampaign = campaign.costPerResult ?? baselineCostPerResult;
        return costPerResultCampaign <= baselineCostPerResult * 0.85 && campaign.conversions >= 3;
      })
      .sort((a, b) => {
        const costA = a.costPerResult ?? baselineCostPerResult;
        const costB = b.costPerResult ?? baselineCostPerResult;
        return costA - costB;
      })
      .slice(0, 3);

    opportunityCandidates.forEach((campaign) => {
      const accountInfo = campaign.account;
      const costPerResultCampaign = campaign.costPerResult ?? baselineCostPerResult;
      const gainPct =
        baselineCostPerResult > 0
          ? ((baselineCostPerResult - costPerResultCampaign) / baselineCostPerResult) * 100
          : null;

      registerInsight(opportunities, {
        id: `op-${campaign.campaignId}`,
        ruleId: 'JS_OP_LOW_CPR',
        date: referenceDate,
        severity: 'high',
        title: `Escalar campanha ${campaign.name}`,
        explanation: `Custo por resultado ${formatCurrency(costPerResultCampaign)} está ${
          gainPct !== null ? `${Math.round(gainPct)}%` : 'bem'
        } abaixo da média do portfólio (${formatCurrency(baselineCostPerResult)}).`,
        actionKind: 'budget_increase',
        actionParams: { level: 'campaign', recommendation: 'increase_budget_20' },
        expectedGainPct: gainPct !== null ? Math.round(gainPct) : null,
        status: 'open',
        account: {
          id: accountInfo?.external_id ?? campaign.platformAccountId,
          name: accountInfo?.name ?? null,
        },
        entities: {
          campaign: { id: campaign.campaignId, name: campaign.name },
        },
      });
    });
  }

  const averageSpendPerCampaign = campaignStats.length > 0 ? totalSpend / campaignStats.length : 0;
  const highSpendThreshold = Math.max(
    averageSpendPerCampaign * 1.5,
    baselineCostPerResult !== null ? baselineCostPerResult * 2 : 0,
    150
  );

  const spendWithoutResultCandidates = campaignStats
    .filter((campaign) => campaign.spend >= highSpendThreshold && campaign.conversions === 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3);

  spendWithoutResultCandidates.forEach((campaign) => {
    const accountInfo = campaign.account;

    registerInsight(risks, {
      id: `risk-spend-${campaign.campaignId}`,
      ruleId: 'JS_RISK_NO_RESULT',
      date: referenceDate,
      severity: 'high',
      title: `Reavaliar campanha ${campaign.name}`,
      explanation: `Gasto ${formatCurrency(campaign.spend)} sem conversões nos últimos ${daysWindow} dias.`,
      actionKind: 'pause_ad',
      actionParams: { level: 'campaign', reason: 'spend_without_results' },
      expectedGainPct: 100,
      status: 'open',
      account: {
        id: accountInfo?.external_id ?? campaign.platformAccountId,
        name: accountInfo?.name ?? null,
      },
      entities: {
        campaign: { id: campaign.campaignId, name: campaign.name },
      },
    });
  });

  if (avgCtrOverall !== null && avgCtrOverall > 0) {
    const lowCtrCandidates = campaignStats
      .filter(
        (campaign) =>
          campaign.impressions >= 1000 &&
          campaign.avgCtr < avgCtrOverall * 0.5 &&
          campaign.spend > 0
      )
      .sort((a, b) => a.avgCtr - b.avgCtr)
      .slice(0, 3);

    lowCtrCandidates.forEach((campaign) => {
      const accountInfo = campaign.account;

      registerInsight(risks, {
        id: `risk-ctr-${campaign.campaignId}`,
        ruleId: 'JS_RISK_LOW_CTR',
        date: referenceDate,
        severity: 'medium',
        title: `Rotacionar criativos - ${campaign.name}`,
        explanation: `CTR ${campaign.avgCtr.toFixed(2)}% está abaixo da média do portfólio (${avgCtrOverall.toFixed(
          2
        )}%).`,
        actionKind: 'rotate_creative',
        actionParams: { level: 'campaign', reason: 'ctr_below_average' },
        expectedGainPct: 8,
        status: 'open',
        account: {
          id: accountInfo?.external_id ?? campaign.platformAccountId,
          name: accountInfo?.name ?? null,
        },
        entities: {
          campaign: { id: campaign.campaignId, name: campaign.name },
        },
      });
    });
  }

  if (opportunities.length === 0) {
    notes.push('Nenhuma oportunidade de escala identificada. Monitore novamente após novos resultados.');
  }

  if (risks.length === 0) {
    notes.push('Nenhum risco crítico detectado neste período.');
  }

  const totalRecommendations = opportunities.length + risks.length;

  // Após termos os dados por campanha, calculamos o ROAS apenas para objetivos de vendas
  const salesCampaigns = campaignStats.filter((c) => isSalesObjective(c.objective));
  const salesSpend = salesCampaigns.reduce((acc, c) => acc + c.spend, 0);
  const salesRevenue = salesCampaigns.reduce((acc, c) => acc + c.revenue, 0);
  if (salesSpend > 0 && salesRevenue > 0) {
    roas = salesRevenue / salesSpend;
  } else {
    roas = null;
  }

  if (roas === null) {
    notes.push('ROAS não aplicável: não há campanhas de vendas com receita no período.');
  }

  return {
    generatedAt,
    workspaceId: options.workspaceId,
    platformKey: options.platformKey,
    period: {
      requestedDays: options.days,
      startDate,
      endDate,
      daysCovered,
      dataFreshness: endDate,
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
      topCampaigns,
      underperformingCampaigns,
      extra: performanceExtra,
    },
    counts: {
      totalRecommendations,
      bySeverity: severityCount,
      opportunities: opportunities.length,
      risks: risks.length,
    },
    opportunities,
    risks,
    notes,
  };
}
