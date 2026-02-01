import { subDays } from 'date-fns';
import { getPool } from '../../config/database.js';
import { ensureGrowthMetricsSchema } from './growth-metrics.service.js';
import { MercadoAdsAutomationService } from './ads-automation.service.js';
import { getMercadoLivreCredentials, requestWithAuth } from '../../api/integrations/mercadolivre.js';

const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';
const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const BRAZIL_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const VISITS_FALLBACK_MAX_ITEMS = Math.max(50, Number(process.env.ML_GROWTH_REPORT_VISITS_MAX_ITEMS || 250));
const VISITS_FALLBACK_CONCURRENCY = Math.max(1, Number(process.env.ML_GROWTH_REPORT_VISITS_CONCURRENCY || 4));
const SKU_PLAN_MAX = Math.max(20, Number(process.env.ML_GROWTH_REPORT_SKU_PLANS_MAX || 60));
const SKU_PLAN_MAX_ACTIONS = Math.max(4, Number(process.env.ML_GROWTH_REPORT_SKU_PLAN_ACTIONS_MAX || 6));

const formatBrazilDateKey = (date: Date) => BRAZIL_DATE_FORMATTER.format(date);

const toBrazilDayBoundary = (dateKey: string, endOfDay: boolean) => {
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${dateKey}T${time}-03:00`);
};

type MetricComparison = {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;
};

type ItemMetric = {
  ml_item_id: string;
  sku?: string | null;
  title?: string | null;
  price?: number | null;
  stock?: number | null;
  logistic_type?: string | null;
  status?: string | null;
  visits: number;
  units: number;
  revenue: number;
  conversion: number | null;
  prevVisits?: number;
  prevUnits?: number;
  prevRevenue?: number;
  prevConversion?: number | null;
};

type PeriodReport = {
  days: number;
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  summary: {
    revenue: MetricComparison;
    orders: MetricComparison;
    units: MetricComparison;
    visits: MetricComparison;
    conversion: MetricComparison;
  };
  topVisitDrop: ItemMetric[];
  topConversionDrop: ItemMetric[];
  opportunities: ItemMetric[];
  lowTrafficHighConversion: ItemMetric[];
};

type AdsPeriodReport = {
  days: number;
  range: { from: string; to: string; previousFrom: string; previousTo: string };
  summary: {
    cost: MetricComparison;
    revenue: MetricComparison;
    sales: MetricComparison;
    clicks: MetricComparison;
    impressions: MetricComparison;
    cpc: MetricComparison;
    acos: MetricComparison;
    roas: MetricComparison;
    tacos: MetricComparison;
  };
};

type ActionItem = {
  title: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  category: string;
  items?: string[];
};

type SkuPlan = {
  ml_item_id: string;
  sku?: string | null;
  title?: string | null;
  visits: number;
  units: number;
  revenue: number;
  conversion: number | null;
  prevVisits?: number;
  prevConversion?: number | null;
  price?: number | null;
  stock?: number | null;
  logistic_type?: string | null;
  status?: string | null;
  priority: 'A' | 'B' | 'C' | 'D';
  diagnosis: string;
  actions: string[];
  priceTests?: { current: number; t1: number; t2: number; t3: number } | null;
  flags?: string[];
};

export type GrowthReport = {
  generatedAt: string;
  workspaceId: string;
  executiveSummary: {
    headline: string;
    revenueDeltaPct: number | null;
    mainCauses: string[];
    metrics: {
      revenue: MetricComparison;
      orders: MetricComparison;
      visits: MetricComparison;
      conversion: MetricComparison;
    };
  };
  periods: PeriodReport[];
  ads?: {
    periods: AdsPeriodReport[];
    leaks: Array<{ ml_item_id: string; title?: string | null; cost: number; sales: number; revenue: number }>;
  };
  actions: ActionItem[];
  checklist: string[];
  productOpportunityRanking: ItemMetric[];
  skuPlans: SkuPlan[];
  notes: string[];
};

const compareMetric = (current: number, previous: number): MetricComparison => ({
  current,
  previous,
  delta: current - previous,
  deltaPct: previous > 0 ? (current - previous) / previous : null,
});

const formatPct = (value: number | null, digits = 1) => {
  if (value === null || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
};

const sumMap = (map: Map<string, number>) => {
  let total = 0;
  map.forEach((val) => {
    total += Number(val || 0);
  });
  return total;
};

const sortByDeltaAsc = (a: ItemMetric, b: ItemMetric, key: 'visits' | 'conversion') => {
  const prevA = key === 'visits' ? a.prevVisits || 0 : a.prevConversion || 0;
  const prevB = key === 'visits' ? b.prevVisits || 0 : b.prevConversion || 0;
  const currA = key === 'visits' ? a.visits : a.conversion || 0;
  const currB = key === 'visits' ? b.visits : b.conversion || 0;
  return (currA - prevA) - (currB - prevB);
};

export async function buildMercadoLivreGrowthReport(
  workspaceId: string,
  options: { periods?: number[]; topN?: number } = {},
): Promise<GrowthReport> {
  await ensureGrowthMetricsSchema();

  const periods = options.periods && options.periods.length > 0 ? options.periods : [7, 30, 90];
  const topN = Math.max(5, Math.min(20, Number(options.topN || 10)));

  const pool = getPool();

  const { rows: productRows } = await pool.query(
    `
      select
        id,
        ml_item_id,
        sku,
        title,
        price,
        available_quantity,
        ml_full_stock,
        ml_logistic_type,
        status,
        visits_30d,
        sales_30d,
        revenue_30d
      from products
      where workspace_id = $1 and ml_item_id is not null
    `,
    [workspaceId],
  );

  const productByItemId = new Map<string, any>();
  productRows.forEach((row) => {
    productByItemId.set(String(row.ml_item_id), row);
  });

  const periodReports: PeriodReport[] = [];
  const notes: string[] = [];
  const periodItems = new Map<number, ItemMetric[]>();

  const allProductItemIds = productRows.map((row) => String(row.ml_item_id)).filter(Boolean);

  for (const days of periods) {
    const dateToKey = formatBrazilDateKey(new Date());
    const dateFromKey = formatBrazilDateKey(subDays(new Date(`${dateToKey}T12:00:00-03:00`), days - 1));
    const prevToKey = formatBrazilDateKey(subDays(new Date(`${dateFromKey}T12:00:00-03:00`), 1));
    const prevFromKey = formatBrazilDateKey(subDays(new Date(`${prevToKey}T12:00:00-03:00`), days - 1));

    const currentVisits = await fetchVisitsByItem(workspaceId, dateFromKey, dateToKey, {
      itemIds: allProductItemIds,
      notes,
      label: `${days}d`,
    });
    const prevVisits = await fetchVisitsByItem(workspaceId, prevFromKey, prevToKey, {
      itemIds: allProductItemIds,
      notes,
      label: `prev-${days}d`,
    });

    const currentSales = await fetchSalesByItem(workspaceId, dateFromKey, dateToKey);
    const prevSales = await fetchSalesByItem(workspaceId, prevFromKey, prevToKey);

    const currentVisitsTotal = sumMap(currentVisits);
    const prevVisitsTotal = sumMap(prevVisits);

    const currentTotals = await fetchOrderTotals(workspaceId, dateFromKey, dateToKey, currentVisitsTotal);
    const prevTotals = await fetchOrderTotals(workspaceId, prevFromKey, prevToKey, prevVisitsTotal);

    if (currentVisits.size === 0 && currentSales.size === 0) {
      notes.push(`Sem dados suficientes para ${days} dias (visitas ou vendas não sincronizadas).`);
    }

    const items: ItemMetric[] = [];
    const allItemIds = new Set<string>([
      ...currentVisits.keys(),
      ...prevVisits.keys(),
      ...currentSales.keys(),
      ...prevSales.keys(),
      ...productByItemId.keys(),
    ]);

    for (const itemId of allItemIds) {
      const visits = currentVisits.get(itemId) || 0;
      const prevVisit = prevVisits.get(itemId) || 0;
      const sales = currentSales.get(itemId) || { units: 0, revenue: 0 };
      const prevSale = prevSales.get(itemId) || { units: 0, revenue: 0 };
      const product = productByItemId.get(itemId);

      const conversion = visits > 0 ? sales.units / visits : null;
      const prevConversion = prevVisit > 0 ? prevSale.units / prevVisit : null;

      items.push({
        ml_item_id: itemId,
        sku: product?.sku || null,
        title: product?.title || null,
        price: product?.price ? Number(product.price) : null,
        stock: product?.available_quantity ?? product?.ml_full_stock ?? null,
        logistic_type: product?.ml_logistic_type || null,
        status: product?.status || null,
        visits,
        units: sales.units,
        revenue: sales.revenue,
        conversion,
        prevVisits: prevVisit,
        prevUnits: prevSale.units,
        prevRevenue: prevSale.revenue,
        prevConversion,
      });
    }

    let topVisitDrop = items
      .filter((it) => (it.prevVisits || 0) > 0)
      .sort((a, b) => sortByDeltaAsc(a, b, 'visits'))
      .slice(0, topN);

    if (topVisitDrop.length === 0) {
      topVisitDrop = items
        .filter((it) => it.visits > 0)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, topN);
      const note = `Sem histórico anterior para ${days}d; exibindo itens com mais visitas no período.`;
      if (!notes.includes(note)) {
        notes.push(note);
      }
    }

    let topConversionDrop = items
      .filter((it) => (it.prevConversion || 0) > 0)
      .sort((a, b) => sortByDeltaAsc(a, b, 'conversion'))
      .slice(0, topN);

    if (topConversionDrop.length === 0) {
      topConversionDrop = items
        .filter((it) => it.conversion !== null)
        .sort((a, b) => (a.conversion || 0) - (b.conversion || 0))
        .slice(0, topN);
      const note = `Sem histórico anterior para ${days}d; exibindo itens com pior conversão no período.`;
      if (!notes.includes(note)) {
        notes.push(note);
      }
    }

    const highVisitsThreshold = 50;
    const lowVisitsThreshold = 30;
    const lowConversionThreshold = 0.005;
    const highConversionThreshold = 0.02;

    const opportunities = items
      .filter((it) => it.visits >= highVisitsThreshold && (it.conversion ?? 0) <= lowConversionThreshold)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, topN);

    const lowTrafficHighConversion = items
      .filter((it) => it.visits <= lowVisitsThreshold && (it.conversion ?? 0) >= highConversionThreshold)
      .sort((a, b) => (b.conversion || 0) - (a.conversion || 0))
      .slice(0, topN);

    const summary = {
      revenue: compareMetric(currentTotals.revenue, prevTotals.revenue),
      orders: compareMetric(currentTotals.orders, prevTotals.orders),
      units: compareMetric(currentTotals.units, prevTotals.units),
      visits: compareMetric(currentTotals.visits, prevTotals.visits),
      conversion: compareMetric(
        currentTotals.visits > 0 ? currentTotals.orders / currentTotals.visits : 0,
        prevTotals.visits > 0 ? prevTotals.orders / prevTotals.visits : 0,
      ),
    };

    periodReports.push({
      days,
      range: { from: dateFromKey, to: dateToKey, previousFrom: prevFromKey, previousTo: prevToKey },
      summary,
      topVisitDrop,
      topConversionDrop,
      opportunities,
      lowTrafficHighConversion,
    });

    periodItems.set(days, items);
  }

  const thirtyDay = periodReports.find((p) => p.days === 30) || periodReports[0];
  const executiveSummary = buildExecutiveSummary(thirtyDay);

  let actions = buildActions(thirtyDay);
  const productOpportunityRanking = (thirtyDay?.opportunities || []).slice(0, topN);

  const ads = await buildAdsSection(workspaceId, periodReports, topN);
  const skuPlanBase = periodItems.get(thirtyDay.days) || periodItems.get(periodReports[0]?.days) || [];
  const skuPlans = buildSkuPlans(skuPlanBase, ads?.leaks || []);

  if (ads?.leaks?.length) {
    actions.push({
      title: `Pausar/ajustar ads com custo sem vendas (${ads.leaks.length})`,
      impact: 'high',
      effort: 'low',
      category: 'ads',
      items: ads.leaks.slice(0, 10).map((item) => `${item.title || item.ml_item_id}`),
    });
    actions = prioritizeActions(actions);
  }

  const latestAccountMetrics = await fetchLatestAccountMetrics(workspaceId);
  if (latestAccountMetrics) {
    const responseRate = latestAccountMetrics.response_rate;
    if (typeof responseRate === 'number' && responseRate < 0.8) {
      actions.push({
        title: `Acelerar respostas a perguntas (taxa ${(responseRate * 100).toFixed(1)}%)`,
        impact: 'medium',
        effort: 'low',
        category: 'atendimento',
      });
    }

    const claims = Number(latestAccountMetrics.claims_rate || 0);
    const delays = Number(latestAccountMetrics.delayed_handling_rate || 0);
    const cancels = Number(latestAccountMetrics.cancellations_rate || 0);
    if (claims >= 2 || delays >= 2 || cancels >= 2) {
      actions.push({
        title: 'Reduzir atrasos/cancelamentos para proteger reputacao',
        impact: 'high',
        effort: 'medium',
        category: 'reputacao',
      });
    }

    notes.push(
      `Reputacao atual: ${latestAccountMetrics.reputation_level || '-'} (${latestAccountMetrics.reputation_color || '-'}) | Reclamos ${claims.toFixed(1)}% | Atrasos ${delays.toFixed(1)}% | Cancelamentos ${cancels.toFixed(1)}%.`,
    );
  }

  actions = prioritizeActions(actions);

  const checklist = actions.slice(0, 5).map((action) => action.title);

  return {
    generatedAt: new Date().toISOString(),
    workspaceId,
    executiveSummary,
    periods: periodReports,
    ads,
    actions,
    checklist,
    productOpportunityRanking,
    skuPlans,
    notes,
  };
}

async function fetchVisitsByItem(
  workspaceId: string,
  fromKey: string,
  toKey: string,
  options?: {
    itemIds?: string[];
    notes?: string[];
    label?: string;
  },
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
      select item_id, coalesce(sum(visits), 0) as visits
      from ml_item_visits_daily
      where workspace_id = $1 and visit_date between $2 and $3
      group by item_id
    `,
    [workspaceId, fromKey, toKey],
  );
  const map = new Map<string, number>();
  rows.forEach((row) => {
    map.set(String(row.item_id), Number(row.visits || 0));
  });

  if (map.size > 0) return map;

  if (options?.itemIds && options.itemIds.length > VISITS_FALLBACK_MAX_ITEMS && options?.notes) {
    const note = `Fallback de visitas limitado aos primeiros ${VISITS_FALLBACK_MAX_ITEMS} itens para evitar rate limit.`;
    if (!options.notes.includes(note)) {
      options.notes.push(note);
    }
  }

  let fallback: Map<string, number> = new Map();
  try {
    fallback = await fetchVisitsByItemFromApi(workspaceId, fromKey, toKey, options?.itemIds || []);
  } catch {
    fallback = new Map();
  }
  if (fallback.size > 0) {
    if (options?.notes) {
      const note = `Visitas por item obtidas via API (sem histórico diário) para ${options?.label || `${fromKey} a ${toKey}`}.`;
      if (!options.notes.includes(note)) {
        options.notes.push(note);
      }
    }
    return fallback;
  }

  return map;
}

async function fetchSalesByItem(workspaceId: string, fromKey: string, toKey: string) {
  const pool = getPool();
  const dateFrom = toBrazilDayBoundary(fromKey, false);
  const dateTo = toBrazilDayBoundary(toKey, true);
  const { rows } = await pool.query(
    `
      select
        oi.item_id,
        coalesce(sum(oi.quantity), 0) as units,
        coalesce(sum(oi.total_amount), 0) as revenue
      from ml_order_items oi
      join ml_orders o
        on o.workspace_id = oi.workspace_id and o.order_id = oi.order_id
      where o.workspace_id = $1
        and o.date_created between $2 and $3
        and lower(o.status) not in ('cancelled','canceled')
      group by oi.item_id
    `,
    [workspaceId, dateFrom, dateTo],
  );
  const map = new Map<string, { units: number; revenue: number }>();
  rows.forEach((row) => {
    map.set(String(row.item_id), {
      units: Number(row.units || 0),
      revenue: Number(row.revenue || 0),
    });
  });
  return map;
}

async function fetchOrderTotals(workspaceId: string, fromKey: string, toKey: string, visitsTotal?: number) {
  const pool = getPool();
  const dateFrom = toBrazilDayBoundary(fromKey, false);
  const dateTo = toBrazilDayBoundary(toKey, true);
  const { rows } = await pool.query(
    `
      select
        count(distinct o.order_id) filter (where lower(o.status) not in ('cancelled','canceled')) as orders,
        coalesce(sum(oi.quantity) filter (where lower(o.status) not in ('cancelled','canceled')), 0) as units,
        coalesce(sum(oi.total_amount) filter (where lower(o.status) not in ('cancelled','canceled')), 0) as revenue
      from ml_orders o
      left join ml_order_items oi
        on oi.workspace_id = o.workspace_id and oi.order_id = o.order_id
      where o.workspace_id = $1
        and o.date_created between $2 and $3
    `,
    [workspaceId, dateFrom, dateTo],
  );

  const orders = Number(rows[0]?.orders || 0);
  const units = Number(rows[0]?.units || 0);
  const revenue = Number(rows[0]?.revenue || 0);
  const visits = typeof visitsTotal === 'number' ? visitsTotal : await fetchVisitsTotal(workspaceId, fromKey, toKey);

  return { orders, units, revenue, visits };
}

async function fetchVisitsTotal(workspaceId: string, fromKey: string, toKey: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
      select coalesce(sum(visits), 0) as visits
      from ml_item_visits_daily
      where workspace_id = $1 and visit_date between $2 and $3
    `,
    [workspaceId, fromKey, toKey],
  );
  return Number(rows[0]?.visits || 0);
}

async function fetchVisitsByItemFromApi(
  workspaceId: string,
  fromKey: string,
  toKey: string,
  itemIds: string[],
) {
  const unique = Array.from(new Set(itemIds.filter(Boolean)));
  if (unique.length === 0) return new Map<string, number>();

  const limited = unique.slice(0, VISITS_FALLBACK_MAX_ITEMS);
  const concurrency = Math.min(VISITS_FALLBACK_CONCURRENCY, limited.length);
  const results = new Map<string, number>();

  let index = 0;
  const worker = async () => {
    while (index < limited.length) {
      const itemId = limited[index++];
      try {
        const data = await requestWithAuth<any>(
          workspaceId,
          `${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`,
          { params: { date_from: fromKey, date_to: toKey } },
        );
        const visits = Number(data?.total_visits ?? data?.total ?? 0);
        results.set(itemId, visits);
      } catch {
        // Best effort: ignore item failures to keep report running
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function fetchLatestAccountMetrics(workspaceId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `select *
     from ml_account_metrics_daily
     where workspace_id = $1
     order by metric_date desc
     limit 1`,
    [workspaceId],
  );
  return rows[0] || null;
}

function buildExecutiveSummary(period: PeriodReport) {
  const revenueDeltaPct = period.summary.revenue.deltaPct;
  const headline = revenueDeltaPct === null
    ? 'Resumo executivo sem base histórica suficiente.'
    : `Receita ${formatPct(revenueDeltaPct)} nos últimos ${period.days} dias.`;

  const causes: string[] = [];
  if ((period.summary.visits.deltaPct || 0) <= -0.2) {
    causes.push(`Queda de tráfego (${formatPct(period.summary.visits.deltaPct)})`);
  }
  if ((period.summary.conversion.deltaPct || 0) <= -0.2) {
    causes.push(`Queda de conversão (${formatPct(period.summary.conversion.deltaPct)})`);
  }
  if ((period.summary.orders.deltaPct || 0) <= -0.2) {
    causes.push(`Pedidos em baixa (${formatPct(period.summary.orders.deltaPct)})`);
  }
  if (causes.length === 0) {
    causes.push('Sem queda expressiva detectada; revisar mix de produtos e campanhas.');
  }

  return {
    headline,
    revenueDeltaPct,
    mainCauses: causes.slice(0, 3),
    metrics: {
      revenue: period.summary.revenue,
      orders: period.summary.orders,
      visits: period.summary.visits,
      conversion: period.summary.conversion,
    },
  };
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

function buildSkuPlans(
  items: ItemMetric[],
  adsLeaks: Array<{ ml_item_id: string; title?: string | null; cost: number; sales: number; revenue: number }>,
) {
  const fullNoSalesInStock = items.filter((item) =>
    item.logistic_type === 'fulfillment' &&
    (item.stock ?? 0) > 0 &&
    (item.units || 0) === 0,
  );
  const inStockOnly = items.filter((item) => (item.stock ?? 0) > 0);
  const sourceItems = fullNoSalesInStock.length > 0
    ? fullNoSalesInStock
    : (inStockOnly.length > 0 ? inStockOnly : items);

  const leakMap = new Map<string, { cost: number; sales: number }>();
  adsLeaks.forEach((leak) => leakMap.set(String(leak.ml_item_id), { cost: leak.cost, sales: leak.sales }));

  const priorityRank: Record<SkuPlan['priority'], number> = { A: 1, B: 2, C: 3, D: 4 };

  const plans = sourceItems.map((item) => {
    const actions: string[] = [];
    const flags: string[] = [];
    let priority: SkuPlan['priority'] = 'D';

    const addAction = (text: string) => {
      if (actions.length >= SKU_PLAN_MAX_ACTIONS) return;
      if (!actions.includes(text)) actions.push(text);
    };
    const bumpPriority = (level: SkuPlan['priority']) => {
      if (priorityRank[level] < priorityRank[priority]) priority = level;
    };

    const visits = item.visits || 0;
    const units = item.units || 0;
    const conversion = item.conversion ?? (visits > 0 ? units / visits : null);

    const addListingBasics = () => {
      addAction('Trocar foto principal (fundo branco, produto centralizado, sem texto)');
      addAction('Adicionar foto de escala/uso real + 1 foto de detalhe');
      addAction('Revisar título (palavra-chave + material + benefício, 60-65 caracteres)');
      addAction('Completar atributos obrigatórios da categoria');
      addAction('Revisar descrição com bullets (material, medidas, garantia, conteúdo)');
    };

    if (item.status && item.status !== 'active') {
      flags.push('Anuncio pausado');
      addAction('Reativar anuncio e revisar configuracoes');
      bumpPriority('B');
    }

    if (typeof item.stock === 'number') {
      if (item.stock <= 0) {
        flags.push('Sem estoque');
        addAction('Repor estoque e reativar anuncio');
        bumpPriority('A');
      } else if (item.stock <= 3) {
        addAction('Repor estoque (baixo)');
      }
    }

    if (item.logistic_type && item.logistic_type !== 'fulfillment') {
      addAction('Avaliar ML Full/Flex para ganhar prazo e ranking');
    }

    if (item.prevVisits && visits < item.prevVisits * 0.7) {
      addAction('Recuperar ranking (queda de visitas > 30%)');
      bumpPriority('B');
    }

    if (visits >= 50 && units === 0) {
      addListingBasics();
      addAction('Teste de preco sequencial (7 dias ou 100 visitas)');
      bumpPriority('A');
    } else if (visits >= 20 && units === 0) {
      addAction('Revisar título/SEO e fotos principais');
      addAction('Teste de preco (T1/T2/T3)');
      bumpPriority('B');
    } else if (visits > 0 && conversion !== null && conversion < 0.005) {
      addListingBasics();
      bumpPriority('A');
    } else if (visits < 20 && units === 0) {
      addAction('Ajustar SEO/título para aumentar impressões');
      addAction('Ads leve com orçamento controlado (apenas termos relevantes)');
      bumpPriority('C');
    } else if (conversion !== null && conversion >= 0.02 && visits < 50) {
      addAction('Escalar trafego (ads/promo)');
      bumpPriority('B');
    }

    const leak = leakMap.get(String(item.ml_item_id));
    if (leak && leak.cost > 0 && leak.sales <= 0) {
      addAction('Pausar/ajustar ads sem vendas (cortar termos sem conversão)');
      bumpPriority('B');
    }

    if (actions.length === 0) {
      addAction('Manter e monitorar; testar variacao/kit');
    }

    const priceTests = item.price && (units === 0 && visits >= 20)
      ? {
        current: roundPrice(item.price),
        t1: roundPrice(item.price * 0.93),
        t2: roundPrice(item.price * 0.88),
        t3: roundPrice(item.price * 0.85),
      }
      : null;

    const stockLabel = typeof item.stock === 'number' ? `estoque ${item.stock}` : 'estoque n/d';
    const convLabel = conversion !== null ? formatPct(conversion, 2) : '—';
    const diagnosis = `${visits} visitas / ${units} vendas (conv ${convLabel}), ${stockLabel}.`;

    return {
      ml_item_id: item.ml_item_id,
      sku: item.sku || null,
      title: item.title || null,
      visits,
      units,
      revenue: item.revenue || 0,
      conversion,
      prevVisits: item.prevVisits,
      prevConversion: item.prevConversion ?? null,
      price: item.price ?? null,
      stock: item.stock ?? null,
      logistic_type: item.logistic_type ?? null,
      status: item.status ?? null,
      priority,
      diagnosis,
      actions,
      priceTests,
      flags,
    };
  });

  return plans
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.visits - a.visits)
    .slice(0, SKU_PLAN_MAX);
}

function buildActions(period: PeriodReport): ActionItem[] {
  const actions: ActionItem[] = [];

  const stockouts = period.opportunities.filter((it) => (it.stock ?? 0) <= 0);
  if (stockouts.length > 0) {
    actions.push({
      title: `Repor estoque dos itens com oportunidade (${stockouts.length})`,
      impact: 'high',
      effort: 'medium',
      category: 'estoque',
      items: stockouts.slice(0, 10).map((it) => `${it.sku || it.ml_item_id} - ${it.title || ''}`.trim()),
    });
  }

  if (period.opportunities.length > 0) {
    actions.push({
      title: `Otimizar anúncios com alta visita e baixa conversão (${period.opportunities.length})`,
      impact: 'high',
      effort: 'medium',
      category: 'conversao',
      items: period.opportunities.slice(0, 10).map((it) => `${it.sku || it.ml_item_id} - ${it.title || ''}`.trim()),
    });
  }

  const nonFull = period.opportunities.filter((it) => it.logistic_type && it.logistic_type !== 'fulfillment');
  if (nonFull.length > 0) {
    actions.push({
      title: `Avaliar envio Full/Flex nos itens com demanda (${nonFull.length})`,
      impact: 'medium',
      effort: 'high',
      category: 'envio',
      items: nonFull.slice(0, 10).map((it) => `${it.sku || it.ml_item_id} - ${it.title || ''}`.trim()),
    });
  }

  if (period.lowTrafficHighConversion.length > 0) {
    actions.push({
      title: `Escalar tráfego nos itens com boa conversão (${period.lowTrafficHighConversion.length})`,
      impact: 'medium',
      effort: 'low',
      category: 'trafego',
      items: period.lowTrafficHighConversion.slice(0, 10).map((it) => `${it.sku || it.ml_item_id} - ${it.title || ''}`.trim()),
    });
  }

  if ((period.summary.visits.deltaPct || 0) <= -0.2) {
    actions.push({
      title: 'Rever SEO (título/atributos) e reativar campanhas para recuperar visitas.',
      impact: 'high',
      effort: 'medium',
      category: 'trafego',
    });
  }

  if ((period.summary.conversion.deltaPct || 0) <= -0.2) {
    actions.push({
      title: 'Revisar preço, fotos e proposta de valor nos anúncios com queda de conversão.',
      impact: 'high',
      effort: 'medium',
      category: 'conversao',
    });
  }

  return prioritizeActions(actions);
}

function prioritizeActions(actions: ActionItem[]) {
  const impactScore = { high: 3, medium: 2, low: 1 } as const;
  const effortScore = { low: 1, medium: 2, high: 3 } as const;
  return actions.sort((a, b) => {
    const scoreA = impactScore[a.impact] * 10 - effortScore[a.effort];
    const scoreB = impactScore[b.impact] * 10 - effortScore[b.effort];
    return scoreB - scoreA;
  });
}

async function buildAdsSection(
  workspaceId: string,
  periodReports: PeriodReport[],
  topN: number,
) {
  const credentials = await getMercadoLivreCredentials(workspaceId);
  if (!credentials?.userId && !(credentials as any)?.user_id) return undefined;

  const adsService = new MercadoAdsAutomationService();
  const adsPeriods: AdsPeriodReport[] = [];

  for (const period of periodReports) {
    const { from, to, previousFrom, previousTo } = period.range;
    try {
      const current = await adsService.getAdsMetricsSummary(workspaceId, from, to);
      const previous = await adsService.getAdsMetricsSummary(workspaceId, previousFrom, previousTo);
      if (!current?.summary || !previous?.summary) continue;

      const currentSummary = current.summary;
      const prevSummary = previous.summary;

      const cost = Number(currentSummary.cost || 0);
      const revenue = Number(currentSummary.revenue || 0);
      const sales = Number(currentSummary.units || 0);
      const clicks = Number(currentSummary.clicks || 0);
      const impressions = Number(currentSummary.prints || 0);
      const cpc = clicks > 0 ? cost / clicks : 0;
      const acos = revenue > 0 ? cost / revenue : 0;
      const roas = cost > 0 ? revenue / cost : 0;
      const totalRevenueBase = period.summary.revenue.current || 0;
      const tacos = totalRevenueBase > 0 ? cost / totalRevenueBase : 0;

      const prevCost = Number(prevSummary.cost || 0);
      const prevRevenue = Number(prevSummary.revenue || 0);
      const prevSales = Number(prevSummary.units || 0);
      const prevClicks = Number(prevSummary.clicks || 0);
      const prevImpressions = Number(prevSummary.prints || 0);
      const prevCpc = prevClicks > 0 ? prevCost / prevClicks : 0;
      const prevAcos = prevRevenue > 0 ? prevCost / prevRevenue : 0;
      const prevRoas = prevCost > 0 ? prevRevenue / prevCost : 0;
      const prevRevenueBase = period.summary.revenue.previous || 0;
      const prevTacos = prevRevenueBase > 0 ? prevCost / prevRevenueBase : 0;

      adsPeriods.push({
        days: period.days,
        range: { from, to, previousFrom, previousTo },
        summary: {
          cost: compareMetric(cost, prevCost),
          revenue: compareMetric(revenue, prevRevenue),
          sales: compareMetric(sales, prevSales),
          clicks: compareMetric(clicks, prevClicks),
          impressions: compareMetric(impressions, prevImpressions),
          cpc: compareMetric(cpc, prevCpc),
          acos: compareMetric(acos, prevAcos),
          roas: compareMetric(roas, prevRoas),
          tacos: compareMetric(tacos, prevTacos),
        },
      });
    } catch (err) {
      // Ads metrics optional; ignore errors
      continue;
    }
  }

  let leaks: Array<{ ml_item_id: string; title?: string | null; cost: number; sales: number; revenue: number }> = [];

  try {
    const itemIds = Array.from(
      new Set(
        periodReports
          .flatMap((p) => p.opportunities.map((it) => it.ml_item_id))
          .filter(Boolean),
      ),
    );
    if (itemIds.length > 0) {
      const thirty = periodReports.find((p) => p.days === 30) || periodReports[0];
      const range = thirty?.range;
      if (range) {
        const metrics = await adsService.getAdsMetricsByItem(workspaceId, itemIds, range.from, range.to);
        if (metrics?.metrics) {
          const { rows: productRows } = await getPool().query(
            `select ml_item_id, title from products where workspace_id = $1 and ml_item_id = any($2)`,
            [workspaceId, itemIds],
          );
          const titleMap = new Map<string, string>();
          productRows.forEach((row: any) => {
            titleMap.set(String(row.ml_item_id), row.title);
          });

          leaks = Array.from(metrics.metrics.entries())
            .map(([itemId, m]) => ({
              ml_item_id: itemId,
              title: titleMap.get(itemId) || null,
              cost: m.cost,
              sales: m.sales,
              revenue: m.revenue,
            }))
            .filter((row) => row.cost > 0 && row.sales === 0)
            .sort((a, b) => b.cost - a.cost)
            .slice(0, topN);
        }
      }
    }
  } catch {
    leaks = [];
  }

  return { periods: adsPeriods, leaks };
}

export function renderGrowthReportMarkdown(report: GrowthReport) {
  const lines: string[] = [];
  lines.push(`# Relatorio Executivo Mercado Livre`);
  lines.push(`Gerado em: ${new Date(report.generatedAt).toLocaleString('pt-BR')}`);
  lines.push('');
  lines.push(`**Resumo executivo:** ${report.executiveSummary.headline}`);
  lines.push('');
  lines.push('Principais causas:');
  report.executiveSummary.mainCauses.forEach((cause) => lines.push(`- ${cause}`));
  lines.push('');

  const summary = report.executiveSummary.metrics;
  lines.push('**Resumo (periodo base):**');
  lines.push(`- Receita: ${formatPct(summary.revenue.deltaPct)} (${summary.revenue.current.toFixed(2)})`);
  lines.push(`- Pedidos: ${formatPct(summary.orders.deltaPct)} (${summary.orders.current})`);
  lines.push(`- Visitas: ${formatPct(summary.visits.deltaPct)} (${summary.visits.current})`);
  lines.push(`- Conversao: ${formatPct(summary.conversion.deltaPct)} (${formatPct(summary.conversion.current, 2)})`);
  lines.push('');

  report.periods.forEach((period) => {
    lines.push(`## Periodo ${period.days}d (${period.range.from} a ${period.range.to})`);
    lines.push(`Comparacao: ${period.range.previousFrom} a ${period.range.previousTo}`);
    lines.push('');
    lines.push('Top 10 itens: maior queda de visitas');
    lines.push('| SKU | Item | Visitas (atual) | Visitas (prev) | Delta |');
    lines.push('| --- | --- | --- | --- | --- |');
    period.topVisitDrop.forEach((item) => {
      const delta = (item.visits - (item.prevVisits || 0));
      lines.push(`| ${item.sku || '-'} | ${item.title || item.ml_item_id} | ${item.visits} | ${item.prevVisits || 0} | ${delta} |`);
    });
    lines.push('');
    lines.push('Top 10 itens: maior queda de conversao');
    lines.push('| SKU | Item | Conv (atual) | Conv (prev) | Delta |');
    lines.push('| --- | --- | --- | --- | --- |');
    period.topConversionDrop.forEach((item) => {
      const curr = item.conversion || 0;
      const prev = item.prevConversion || 0;
      lines.push(`| ${item.sku || '-'} | ${item.title || item.ml_item_id} | ${formatPct(curr, 2)} | ${formatPct(prev, 2)} | ${formatPct(curr - prev, 2)} |`);
    });
    lines.push('');
    lines.push('Top 10 itens: maior oportunidade (visitas altas + conversao baixa)');
    lines.push('| SKU | Item | Visitas | Conversao |');
    lines.push('| --- | --- | --- | --- |');
    period.opportunities.forEach((item) => {
      lines.push(`| ${item.sku || '-'} | ${item.title || item.ml_item_id} | ${item.visits} | ${formatPct(item.conversion || 0, 2)} |`);
    });
    lines.push('');
  });

  lines.push('## Plano por SKU (Full, sem vendas)');
  lines.push('_Filtro: Full + estoque > 0 + 0 vendas. Se vazio, mostra itens com estoque._');
  if (report.skuPlans.length === 0) {
    lines.push('Sem dados suficientes para plano por SKU.');
    lines.push('');
  } else {
    lines.push('| Prioridade | SKU | Item | Diagnostico | Acoes | Preco |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    report.skuPlans.forEach((plan) => {
      const actions = plan.actions.join('; ');
      const price = plan.priceTests
        ? `${plan.priceTests.current.toFixed(2)} -> T1 ${plan.priceTests.t1.toFixed(2)} -> T2 ${plan.priceTests.t2.toFixed(2)} -> T3 ${plan.priceTests.t3.toFixed(2)}`
        : '-';
      lines.push(`| ${plan.priority} | ${plan.sku || '-'} | ${plan.title || plan.ml_item_id} | ${plan.diagnosis} | ${actions} | ${price} |`);
    });
    lines.push('');
  }

  if (report.ads?.periods?.length) {
    lines.push('## Ads');
    report.ads.periods.forEach((ads) => {
      lines.push(`Periodo Ads ${ads.days}d (${ads.range.from} a ${ads.range.to})`);
      lines.push(`- Custo: ${formatPct(ads.summary.cost.deltaPct)} | ACOS: ${formatPct(ads.summary.acos.deltaPct)} | TACOS: ${formatPct(ads.summary.tacos.deltaPct)}`);
      lines.push(`- Receita Ads: ${formatPct(ads.summary.revenue.deltaPct)} | ROAS: ${formatPct(ads.summary.roas.deltaPct)}`);
    });
    if (report.ads.leaks?.length) {
      lines.push('');
      lines.push('Vazamento de verba (ads com custo e sem vendas):');
      report.ads.leaks.forEach((item) => {
        lines.push(`- ${item.title || item.ml_item_id}: custo ${item.cost.toFixed(2)}`);
      });
    }
    lines.push('');
  }

  lines.push('## Acoes priorizadas (impacto x esforco)');
  report.actions.forEach((action) => {
    lines.push(`- [${action.impact}/${action.effort}] ${action.title}`);
  });
  lines.push('');

  lines.push('## Checklist do que fazer hoje');
  report.checklist.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  if (report.notes.length > 0) {
    lines.push('## Observacoes');
    report.notes.forEach((note) => lines.push(`- ${note}`));
    lines.push('');
  }

  return lines.join('\n');
}

export function renderGrowthReportHtml(report: GrowthReport) {
  const title = 'Relatorio Executivo Mercado Livre';
  const summary = report.executiveSummary;
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const sections = report.periods.map((period) => {
    const visitRows = period.topVisitDrop
      .map((item) => `<tr><td>${item.sku || '-'}</td><td>${item.title || item.ml_item_id}</td><td>${item.visits}</td><td>${item.prevVisits || 0}</td><td>${item.visits - (item.prevVisits || 0)}</td></tr>`)
      .join('');
    const conversionRows = period.topConversionDrop
      .map((item) => {
        const curr = item.conversion || 0;
        const prev = item.prevConversion || 0;
        return `<tr><td>${item.sku || '-'}</td><td>${item.title || item.ml_item_id}</td><td>${formatPct(curr, 2)}</td><td>${formatPct(prev, 2)}</td><td>${formatPct(curr - prev, 2)}</td></tr>`;
      })
      .join('');
    const oppRows = period.opportunities
      .map((item) => `<tr><td>${item.sku || '-'}</td><td>${item.title || item.ml_item_id}</td><td>${item.visits}</td><td>${formatPct(item.conversion || 0, 2)}</td></tr>`)
      .join('');
    return `
      <section>
        <h2>Periodo ${period.days}d (${period.range.from} a ${period.range.to})</h2>
        <p>Comparacao: ${period.range.previousFrom} a ${period.range.previousTo}</p>
        <h3>Top 10 itens: maior queda de visitas</h3>
        <table><thead><tr><th>SKU</th><th>Item</th><th>Visitas</th><th>Prev</th><th>Delta</th></tr></thead><tbody>${visitRows}</tbody></table>
        <h3>Top 10 itens: maior queda de conversao</h3>
        <table><thead><tr><th>SKU</th><th>Item</th><th>Conv</th><th>Prev</th><th>Delta</th></tr></thead><tbody>${conversionRows}</tbody></table>
        <h3>Top 10 itens: maior oportunidade</h3>
        <table><thead><tr><th>SKU</th><th>Item</th><th>Visitas</th><th>Conv</th></tr></thead><tbody>${oppRows}</tbody></table>
      </section>
    `;
  }).join('');

  const skuPlanSection = report.skuPlans.length
    ? `
      <section>
        <h2>Plano por SKU (Full, sem vendas)</h2>
        <p>Filtro: Full + estoque &gt; 0 + 0 vendas. Se vazio, mostra itens com estoque.</p>
        <table>
          <thead>
            <tr>
              <th>Prioridade</th>
              <th>SKU</th>
              <th>Item</th>
              <th>Diagnostico</th>
              <th>Acoes</th>
              <th>Preco</th>
            </tr>
          </thead>
          <tbody>
            ${report.skuPlans.map((plan) => {
              const actions = plan.actions.join('; ');
              const price = plan.priceTests
                ? `${plan.priceTests.current.toFixed(2)} → T1 ${plan.priceTests.t1.toFixed(2)} → T2 ${plan.priceTests.t2.toFixed(2)} → T3 ${plan.priceTests.t3.toFixed(2)}`
                : '-';
              return `<tr><td>${plan.priority}</td><td>${plan.sku || '-'}</td><td>${plan.title || plan.ml_item_id}</td><td>${plan.diagnosis}</td><td>${actions}</td><td>${price}</td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </section>
    `
    : `
      <section>
        <h2>Plano por SKU (Full, sem vendas)</h2>
        <p>Sem dados suficientes para plano por SKU.</p>
      </section>
    `;

  const adsSection = report.ads?.periods?.length
    ? `
      <section>
        <h2>Ads</h2>
        ${report.ads.periods.map((ads) => `
          <div>
            <h3>Periodo ${ads.days}d</h3>
            <p>Custo: ${formatPct(ads.summary.cost.deltaPct)} | ACOS: ${formatPct(ads.summary.acos.deltaPct)} | TACOS: ${formatPct(ads.summary.tacos.deltaPct)}</p>
            <p>Receita Ads: ${formatPct(ads.summary.revenue.deltaPct)} | ROAS: ${formatPct(ads.summary.roas.deltaPct)}</p>
          </div>
        `).join('')}
        ${report.ads.leaks?.length ? `
          <h3>Vazamento de verba</h3>
          <ul>${report.ads.leaks.map((item) => `<li>${item.title || item.ml_item_id} (custo ${formatCurrency(item.cost)})</li>`).join('')}</ul>
        ` : ''}
      </section>
    ` : '';

  const actionsHtml = report.actions
    .map((action) => `<li>[${action.impact}/${action.effort}] ${action.title}</li>`)
    .join('');

  const checklistHtml = report.checklist.map((item) => `<li>${item}</li>`).join('');
  const notesHtml = report.notes.length ? `<section><h2>Observacoes</h2><ul>${report.notes.map((n) => `<li>${n}</li>`).join('')}</ul></section>` : '';

  return `
    <!doctype html>
    <html lang="pt-br">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        body { font-family: 'Space Grotesk', 'Segoe UI', sans-serif; margin: 24px; color: #111827; }
        h1, h2, h3 { margin: 16px 0 8px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 12px; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
        th { background: #f9fafb; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p><strong>Gerado em:</strong> ${new Date(report.generatedAt).toLocaleString('pt-BR')}</p>
      <section>
        <h2>Resumo executivo</h2>
        <p>${summary.headline}</p>
        <ul>${summary.mainCauses.map((c) => `<li>${c}</li>`).join('')}</ul>
        <p><strong>Receita:</strong> ${formatPct(summary.metrics.revenue.deltaPct)} | <strong>Pedidos:</strong> ${formatPct(summary.metrics.orders.deltaPct)} | <strong>Visitas:</strong> ${formatPct(summary.metrics.visits.deltaPct)} | <strong>Conversao:</strong> ${formatPct(summary.metrics.conversion.deltaPct)}</p>
      </section>
      ${sections}
      ${skuPlanSection}
      ${adsSection}
      <section>
        <h2>Acoes priorizadas</h2>
        <ul>${actionsHtml}</ul>
      </section>
      <section>
        <h2>Checklist do que fazer hoje</h2>
        <ul>${checklistHtml}</ul>
      </section>
      ${notesHtml}
    </body>
    </html>
  `;
}
