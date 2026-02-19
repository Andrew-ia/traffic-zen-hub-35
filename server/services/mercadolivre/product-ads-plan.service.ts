import { getPool } from '../../config/database.js';
import { MercadoAdsAutomationService } from './ads-automation.service.js';

type RangeKey = 'd7' | 'd14' | 'd30';

type RangeMetrics = {
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  revenue: number;
  ctr: number | null;
  cpc: number | null;
  roas: number | null;
  acos: number | null;
  cvr: number | null;
};

type ItemReport = {
  itemId: string;
  sku: string | null;
  title: string | null;
  campaignId: string | null;
  campaignName: string | null;
  curve: string | null;
  price: number | null;
  categoryId: string | null;
  isFull: boolean | null;
  stock: number | null;
  status: string | null;
  lifetimeSales: number | null;
  ranges: Record<RangeKey, RangeMetrics>;
  label: string;
  action: string;
  reason: string;
  trendOk: boolean | null;
  dataStatus: 'ok' | 'insufficient';
};

type Percentiles = {
  ctr: { p25: number | null; p50: number | null; p75: number | null };
  cpc: { p25: number | null; p50: number | null; p75: number | null };
  cvr: { p25: number | null; p50: number | null; p75: number | null };
};

const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toDateKey = (date: Date) => DATE_FORMATTER.format(date);

const getDateRange = (days: number) => {
  const dateToKey = toDateKey(new Date());
  const [yearStr, monthStr, dayStr] = dateToKey.split('-');
  const dateToObj = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 12, 0, 0);
  const dateFromObj = new Date(dateToObj);
  dateFromObj.setDate(dateFromObj.getDate() - (days - 1));
  return { dateFrom: toDateKey(dateFromObj), dateTo: dateToKey };
};

const round = (value: number, digits = 4) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const buildMetrics = (impressions: number, clicks: number, spend: number, sales: number, revenue: number): RangeMetrics => {
  const ctr = impressions > 0 ? clicks / impressions : null;
  const cpc = clicks > 0 ? spend / clicks : null;
  const roas = spend > 0 ? revenue / spend : null;
  const acos = revenue > 0 ? spend / revenue : null;
  const cvr = clicks > 0 ? sales / clicks : null;
  return {
    impressions,
    clicks,
    spend,
    sales,
    revenue,
    ctr,
    cpc,
    roas,
    acos,
    cvr,
  };
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  const weight = idx - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const buildPercentiles = (items: ItemReport[]): Percentiles => {
  const ctrs: number[] = [];
  const cpcs: number[] = [];
  const cvrs: number[] = [];

  for (const item of items) {
    const d30 = item.ranges.d30;
    if (d30.impressions >= 100 && d30.ctr !== null) ctrs.push(d30.ctr);
    if (d30.clicks >= 20 && d30.cpc !== null) cpcs.push(d30.cpc);
    if (d30.clicks >= 30 && d30.cvr !== null) cvrs.push(d30.cvr);
  }

  return {
    ctr: {
      p25: percentile(ctrs, 0.25),
      p50: percentile(ctrs, 0.5),
      p75: percentile(ctrs, 0.75),
    },
    cpc: {
      p25: percentile(cpcs, 0.25),
      p50: percentile(cpcs, 0.5),
      p75: percentile(cpcs, 0.75),
    },
    cvr: {
      p25: percentile(cvrs, 0.25),
      p50: percentile(cvrs, 0.5),
      p75: percentile(cvrs, 0.75),
    },
  };
};

const formatPercent = (value: number | null) => (value === null ? '-' : `${round(value * 100, 2)}%`);
const formatMoney = (value: number | null) => (value === null ? '-' : `R$ ${round(value, 2).toFixed(2)}`);
const formatNumber = (value: number | null) => (value === null ? '-' : round(value, 2).toFixed(2));

const trendIsOk = (d7: RangeMetrics, d30: RangeMetrics) => {
  if ((d7.acos === null && d7.roas === null) || (d30.acos === null && d30.roas === null)) return null;
  if (d7.roas !== null && d30.roas !== null) return d7.roas >= d30.roas * 0.9;
  if (d7.acos !== null && d30.acos !== null) return d7.acos <= d30.acos * 1.1;
  return null;
};

const classifyItem = (item: ItemReport, percentiles: Percentiles) => {
  const d7 = item.ranges.d7;
  const d30 = item.ranges.d30;
  const trendOk = trendIsOk(d7, d30);

  const ctrOk = d30.ctr !== null
    ? d30.ctr >= Math.max(percentiles.ctr.p50 || 0, 0.003)
    : false;
  const ctrLow = d30.ctr !== null
    ? d30.ctr <= Math.min(percentiles.ctr.p25 || 0.002, 0.002)
    : false;

  const cvrLow = d30.cvr !== null
    ? d30.cvr <= Math.max(percentiles.cvr.p25 || 0, 0.005)
    : false;
  const cpcHigh = d30.cpc !== null
    ? d30.cpc >= (percentiles.cpc.p75 || d30.cpc)
    : false;
  const cpcAcceptable = d30.cpc !== null
    ? d30.cpc <= (percentiles.cpc.p50 || d30.cpc) * 1.2
    : true;

  const hasDelivery = d30.impressions > 0 || d30.clicks > 0 || d30.spend > 0 || d30.sales > 0 || d30.revenue > 0;
  if (!hasDelivery) {
    return {
      label: 'DADOS INSUFICIENTES',
      action: 'Coletar dados (sem entrega no periodo).',
      reason: 'Sem entrega ou sem metricas no periodo.',
      trendOk,
      dataStatus: 'insufficient' as const,
    };
  }

  if (item.stock !== null && item.stock <= 0) {
    return {
      label: 'PAUSAR',
      action: 'Pausar no Ads ate recompor estoque.',
      reason: 'Sem estoque disponivel.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (d30.sales === 0 && (d30.clicks >= 60 || d30.spend >= 40)) {
    return {
      label: 'PAUSAR',
      action: 'Pausar no Ads e testar no organico.',
      reason: `0 vendas com ${d30.clicks} cliques e ${formatMoney(d30.spend)} de gasto.`,
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (d30.acos !== null && d30.acos > 0.6 && d30.sales < 2) {
    return {
      label: 'PAUSAR',
      action: 'Pausar no Ads e revisar demanda.',
      reason: `ACOS alto (${formatPercent(d30.acos)}) com pouca venda.`,
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (item.lifetimeSales !== null && item.lifetimeSales === 0 && d30.sales === 0 && (d30.clicks > 0 || d30.spend > 0)) {
    return {
      label: 'PAUSAR',
      action: 'Pausar no Ads e validar demanda no organico.',
      reason: 'Produto sem vendas historicas com gasto em Ads.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (d30.clicks >= 30 && ctrOk && cvrLow) {
    return {
      label: 'REFORMULAR',
      action: 'Revisar titulo/foto/preco/categoria e proposta do anuncio.',
      reason: 'CTR ok, mas conversao baixa.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (d30.clicks >= 20 && ctrLow && cpcHigh) {
    return {
      label: 'REFORMULAR',
      action: 'Revisar criativo, titulo e categoria (CTR baixo + CPC alto).',
      reason: 'CTR baixo com CPC alto indica problema de atratividade.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  const escalarCore = d30.sales >= 5 && ((d30.roas !== null && d30.roas >= 4) || (d30.acos !== null && d30.acos <= 0.25));
  if (escalarCore && cpcAcceptable && trendOk === true) {
    return {
      label: 'ESCALAR',
      action: 'Aumentar +10% a +20% o limite/orcamento e monitorar 7 dias.',
      reason: 'Performance consistente com ROAS/ACOS saudavel.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (escalarCore && (trendOk === false || trendOk === null)) {
    return {
      label: 'MANTER',
      action: 'Manter e reavaliar tendencia 7d antes de escalar.',
      reason: 'Bom resultado, mas tendencia recente nao confirma.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (d30.sales >= 2 && ((d30.roas !== null && d30.roas >= 3 && d30.roas < 4) || (d30.acos !== null && d30.acos >= 0.25 && d30.acos <= 0.33))) {
    return {
      label: 'MANTER',
      action: 'Manter e testar ajustes leves se CTR bom e conversao baixa.',
      reason: 'Performance adequada para manter.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  if (d30.sales > 0 && ((d30.roas !== null && d30.roas < 3) || (d30.acos !== null && d30.acos > 0.33))) {
    return {
      label: 'REDUZIR',
      action: 'Reduzir exposicao e mover para campanha de teste se necessario.',
      reason: 'Vende, mas ROAS/ACOS ainda ruim.',
      trendOk,
      dataStatus: 'ok' as const,
    };
  }

  return {
    label: 'MANTER',
    action: 'Manter e coletar mais dados.',
    reason: 'Sem sinal forte para escalar ou pausar.',
    trendOk,
    dataStatus: 'ok' as const,
  };
};

const buildKey = (campaignId: string | null, itemId: string) => `${campaignId || 'unknown'}|${itemId}`;

export async function buildProductAdsPlan(workspaceId: string) {
  const pool = getPool();
  const adsAutomation = new MercadoAdsAutomationService();

  const ranges: Record<RangeKey, { dateFrom: string; dateTo: string }> = {
    d7: getDateRange(7),
    d14: getDateRange(14),
    d30: getDateRange(30),
  };

  const metricsByRange: Record<RangeKey, Map<string, RangeMetrics>> = {
    d7: new Map(),
    d14: new Map(),
    d30: new Map(),
  };
  const campaignById = new Map<string, { name: string; curve: string | null }>();

  try {
    const campaigns = await adsAutomation.listCampaigns(workspaceId);
    for (const campaign of campaigns.campaigns || []) {
      if (!campaign.ml_campaign_id) continue;
      campaignById.set(String(campaign.ml_campaign_id), {
        name: campaign.name || `Campanha ${campaign.ml_campaign_id}`,
        curve: campaign.curve || null,
      });
    }
  } catch (err) {
    console.warn('[ML Ads Plan] Falha ao listar campanhas:', err);
  }

  const errors: Array<{ range: RangeKey; message: string }> = [];

  for (const rangeKey of Object.keys(ranges) as RangeKey[]) {
    const { dateFrom, dateTo } = ranges[rangeKey];
    const { rows, error } = await adsAutomation.fetchAdsMetricsByAd(workspaceId, { dateFrom, dateTo });
    if (error) {
      errors.push({ range: rangeKey, message: error.message });
    }
    const map = new Map<string, { impressions: number; clicks: number; spend: number; sales: number; revenue: number }>();
    for (const row of rows) {
      if (!row.itemId) continue;
      const key = buildKey(row.campaignId ? String(row.campaignId) : null, String(row.itemId));
      const current = map.get(key) || { impressions: 0, clicks: 0, spend: 0, sales: 0, revenue: 0 };
      current.impressions += Number(row.prints || 0);
      current.clicks += Number(row.clicks || 0);
      current.spend += Number(row.cost || 0);
      current.sales += Number(row.sales || 0);
      current.revenue += Number(row.revenue || 0);
      map.set(key, current);
    }
    for (const [key, val] of map.entries()) {
      metricsByRange[rangeKey].set(
        key,
        buildMetrics(val.impressions, val.clicks, val.spend, val.sales, val.revenue),
      );
    }
  }

  const { rows: products } = await pool.query(
    `select ml_item_id, sku, title, price, ml_category_id, ml_logistic_type, available_quantity, status, sold_quantity
     from products
     where workspace_id = $1 and ml_item_id is not null and status != 'deleted'`,
    [workspaceId],
  );
  const productByItem = new Map<string, any>();
  for (const row of products) {
    productByItem.set(String(row.ml_item_id), row);
  }

  const allKeys = new Set<string>();
  (['d7', 'd14', 'd30'] as RangeKey[]).forEach((key) => {
    for (const mapKey of metricsByRange[key].keys()) allKeys.add(mapKey);
  });

  const items: ItemReport[] = [];
  for (const key of allKeys) {
    const [campaignIdRaw, itemId] = key.split('|');
    const campaignId = campaignIdRaw === 'unknown' ? null : campaignIdRaw;
    const product = productByItem.get(itemId);
    const rangesData: Record<RangeKey, RangeMetrics> = {
      d7: metricsByRange.d7.get(key) || buildMetrics(0, 0, 0, 0, 0),
      d14: metricsByRange.d14.get(key) || buildMetrics(0, 0, 0, 0, 0),
      d30: metricsByRange.d30.get(key) || buildMetrics(0, 0, 0, 0, 0),
    };

    const campaignMeta = campaignId ? campaignById.get(campaignId) : null;

    items.push({
      itemId,
      sku: product?.sku || null,
      title: product?.title || null,
      campaignId,
      campaignName: campaignMeta?.name || (campaignId ? `Campanha ${campaignId}` : null),
      curve: campaignMeta?.curve || null,
      price: product?.price != null ? Number(product.price) : null,
      categoryId: product?.ml_category_id || null,
      isFull: product?.ml_logistic_type ? String(product.ml_logistic_type) === 'fulfillment' : null,
      stock: product?.available_quantity != null ? Number(product.available_quantity) : null,
      status: product?.status || null,
      lifetimeSales: product?.sold_quantity != null ? Number(product.sold_quantity) : null,
      ranges: rangesData,
      label: 'DADOS INSUFICIENTES',
      action: 'Coletar dados.',
      reason: 'Sem classificacao ainda.',
      trendOk: null,
      dataStatus: 'insufficient',
    });
  }

  const percentiles = buildPercentiles(items);

  for (const item of items) {
    const decision = classifyItem(item, percentiles);
    item.label = decision.label;
    item.action = decision.action;
    item.reason = decision.reason;
    item.trendOk = decision.trendOk;
    item.dataStatus = decision.dataStatus;
  }

  const totals = items.reduce(
    (acc, item) => {
      const d30 = item.ranges.d30;
      acc.impressions += d30.impressions;
      acc.clicks += d30.clicks;
      acc.spend += d30.spend;
      acc.sales += d30.sales;
      acc.revenue += d30.revenue;
      return acc;
    },
    { impressions: 0, clicks: 0, spend: 0, sales: 0, revenue: 0 },
  );

  const summary = {
    roas: totals.spend > 0 ? totals.revenue / totals.spend : null,
    acos: totals.revenue > 0 ? totals.spend / totals.revenue : null,
    totals,
    counts: items.reduce<Record<string, number>>((acc, item) => {
      acc[item.label] = (acc[item.label] || 0) + 1;
      return acc;
    }, {}),
  };

  const itemsSortedByRevenue = [...items].sort((a, b) => b.ranges.d30.revenue - a.ranges.d30.revenue);
  const topScale = items.filter((i) => i.label === 'ESCALAR').sort((a, b) => b.ranges.d30.revenue - a.ranges.d30.revenue).slice(0, 10);
  const topPause = items.filter((i) => i.label === 'PAUSAR').sort((a, b) => b.ranges.d30.spend - a.ranges.d30.spend).slice(0, 20);
  const reformular = items.filter((i) => i.label === 'REFORMULAR').sort((a, b) => b.ranges.d30.clicks - a.ranges.d30.clicks);

  const campaigns = new Map<string, { id: string; name: string; curve: string | null; items: ItemReport[] }>();
  for (const item of items) {
    const id = item.campaignId || 'unknown';
    const name = item.campaignName || (item.campaignId ? `Campanha ${item.campaignId}` : 'Sem campanha');
    const curve = item.curve || null;
    if (!campaigns.has(id)) {
      campaigns.set(id, { id, name, curve, items: [] });
    }
    campaigns.get(id)!.items.push(item);
  }

  const campaignList = Array.from(campaigns.values()).map((campaign) => {
    campaign.items.sort((a, b) => b.ranges.d30.revenue - a.ranges.d30.revenue);
    return campaign;
  }).sort((a, b) => {
    const spendA = a.items.reduce((acc, item) => acc + item.ranges.d30.spend, 0);
    const spendB = b.items.reduce((acc, item) => acc + item.ranges.d30.spend, 0);
    return spendB - spendA;
  });

  const biggestOpportunity = itemsSortedByRevenue.find((item) => item.label === 'REFORMULAR') || itemsSortedByRevenue[0] || null;

  return {
    generatedAt: new Date().toISOString(),
    ranges,
    summary,
    percentiles,
    campaigns: campaignList,
    topScale,
    topPause,
    reformular,
    biggestOpportunity,
    errors,
  };
}

export function renderProductAdsPlanMarkdown(plan: Awaited<ReturnType<typeof buildProductAdsPlan>>) {
  const { summary, campaigns, topScale, topPause, reformular, biggestOpportunity, percentiles } = plan;

  const winners = topScale.length;
  const pauses = topPause.length;
  const biggest = biggestOpportunity
    ? `${biggestOpportunity.itemId} ${biggestOpportunity.title || ''}`.trim()
    : 'n/a';

  const lines: string[] = [];
  lines.push('**Resumo executivo**');
  lines.push(`- ROAS geral (30d): ${formatNumber(summary.roas)}`);
  lines.push(`- ACOS geral (30d): ${formatPercent(summary.acos)}`);
  lines.push(`- Itens vencedores (ESCALAR): ${winners}`);
  lines.push(`- Itens a cortar (PAUSAR): ${pauses}`);
  lines.push(`- Maior oportunidade: ${biggest}`);
  lines.push('');

  for (const campaign of campaigns) {
    const label = campaign.curve ? `Curva ${campaign.curve}` : 'Sem curva';
    lines.push(`**Campanha ${campaign.name} (${label})**`);
    lines.push('| item_id | titulo | impressões | cliques | CTR | gasto | CPC | vendas_ads | receita_ads | ROAS | ACOS | label | ação recomendada |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const item of campaign.items) {
      const d30 = item.ranges.d30;
      lines.push(
        `| ${item.itemId} | ${item.title || '-'} | ${d30.impressions} | ${d30.clicks} | ${formatPercent(d30.ctr)} | ${formatMoney(d30.spend)} | ${formatMoney(d30.cpc)} | ${d30.sales} | ${formatMoney(d30.revenue)} | ${formatNumber(d30.roas)} | ${formatPercent(d30.acos)} | ${item.label} | ${item.action} |`,
      );
    }
    lines.push('');
  }

  lines.push('**Top 10 para escalar**');
  if (topScale.length === 0) {
    lines.push('- Nenhum item qualificado para escalar no periodo.');
  } else {
    for (const item of topScale) {
      const d30 = item.ranges.d30;
      lines.push(`- ${item.itemId} | ${item.title || '-'} | ROAS ${formatNumber(d30.roas)} | ACOS ${formatPercent(d30.acos)} | Sugestao: +10% a +20% no orcamento.`);
    }
  }
  lines.push('');

  lines.push('**Top 20 para pausar**');
  if (topPause.length === 0) {
    lines.push('- Nenhum item qualificado para pausar no periodo.');
  } else {
    for (const item of topPause) {
      const d30 = item.ranges.d30;
      lines.push(`- ${item.itemId} | ${item.title || '-'} | ${item.reason} | ${d30.clicks} cliques, ${formatMoney(d30.spend)} gasto.`);
    }
  }
  lines.push('');

  lines.push('**Reformular**');
  if (reformular.length === 0) {
    lines.push('- Nenhum item qualificado para reformulacao no periodo.');
  } else {
    for (const item of reformular) {
      const d30 = item.ranges.d30;
      const issue = item.reason;
      lines.push(`- ${item.itemId} | ${item.title || '-'} | ${issue} | CTR ${formatPercent(d30.ctr)} | CVR ${formatPercent(d30.cvr)}.`);
    }
  }
  lines.push('');

  lines.push('**Regra automatica (playbook 7 dias)**');
  lines.push('- Revisar 2x por semana (segunda e quinta), sempre com janela de 7d e 30d lado a lado.');
  lines.push('- Escalar no maximo 20% por ajuste e aguardar 7 dias antes de novo ajuste.');
  lines.push('- Pausar: 0 vendas + 60 cliques ou gasto >= R$ 40 em 30d.');
  lines.push('- Reduzir: ROAS < 3 ou ACOS > 33% com vendas.');
  lines.push('- Reformular: CTR >= p50 e CVR <= p25 (problema de conversao).');
  lines.push('- Manter: ROAS entre 3 e 4 ou ACOS 25%-33%.');
  lines.push('');

  lines.push('**Observacoes de qualidade**');
  lines.push(`- Percentis usados: CTR p50 ${formatPercent(percentiles.ctr.p50)}, CPC p50 ${formatMoney(percentiles.cpc.p50)}, CVR p25 ${formatPercent(percentiles.cvr.p25)}.`);

  return lines.join('\n');
}
