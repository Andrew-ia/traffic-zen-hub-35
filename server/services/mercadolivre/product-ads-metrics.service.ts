import { getPool } from '../../config/database.js';
import { requestWithAuth } from '../../api/integrations/mercadolivre.js';
import { MercadoAdsAutomationService } from './ads-automation.service.js';

const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getBrazilDateKey = (date: Date) => {
  const parts = dateTimeFormatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = map.get('year') || '1970';
  const month = map.get('month') || '01';
  const day = map.get('day') || '01';
  return `${year}-${month}-${day}`;
};

const getDateRange = (days: number = 30) => {
  const todayKey = getBrazilDateKey(new Date());
  const [yearStr, monthStr, dayStr] = todayKey.split('-');
  const dateToObj = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 12, 0, 0);
  const dateFromObj = new Date(dateToObj);
  dateFromObj.setDate(dateFromObj.getDate() - (days - 1));
  const fromKey = getBrazilDateKey(dateFromObj);
  return { dateFrom: fromKey, dateTo: todayKey };
};

let schemaReady: Promise<void> | null = null;

export async function ensureProductAdsMetricsSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const pool = getPool();
    await pool.query(`create extension if not exists "pgcrypto";`);
    await pool.query(`
      create table if not exists ml_product_ads_metrics (
        id uuid primary key default gen_random_uuid(),
        workspace_id uuid not null references workspaces(id) on delete cascade,
        ml_item_id text not null,
        ml_ad_id text,
        sku text,
        ml_category_id text,
        is_full boolean,
        price_current numeric(14,2),
        price_category_avg numeric(14,2),
        impressions bigint default 0,
        clicks bigint default 0,
        ctr numeric(10,4),
        conversion_rate numeric(10,4),
        sales integer default 0,
        revenue numeric(14,2) default 0,
        ads_spend numeric(14,2) default 0,
        acos numeric(10,4),
        roas numeric(10,4),
        net_margin numeric(10,4),
        sales_7d integer default 0,
        sales_30d integer default 0,
        days_without_sale integer,
        metric_date date not null default current_date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (workspace_id, ml_item_id, ml_ad_id, metric_date)
      );
    `);
    await pool.query(`
      create index if not exists idx_ml_product_ads_metrics_workspace_date
        on ml_product_ads_metrics (workspace_id, metric_date desc);
    `);
    await pool.query(`
      create index if not exists idx_ml_product_ads_metrics_item
        on ml_product_ads_metrics (workspace_id, ml_item_id);
    `);
    await pool.query(`
      create index if not exists idx_ml_product_ads_metrics_ad
        on ml_product_ads_metrics (workspace_id, ml_ad_id);
    `);
  })();
  return schemaReady;
}

type SalesVelocity = {
  sales7d: number;
  sales30d: number;
  lastSaleAt: Date | null;
};

type ProductRow = {
  id: string;
  ml_item_id: string;
  sku: string | null;
  ml_category_id: string | null;
  price: number | null;
  ml_logistic_type: string | null;
  profit_unit: number | null;
  cost_price: number | null;
  overhead_cost: number | null;
  fixed_fee: number | null;
  cac: number | null;
  sales_30d: number | null;
};

type AdsMetricRow = {
  adId: string;
  itemId: string | null;
  campaignId?: string | null;
  status?: string | null;
  clicks: number;
  prints: number;
  cost: number;
  sales: number;
  revenue: number;
  cpc: number;
  ctr: number;
};

async function loadProductsByItem(workspaceId: string, itemIds?: string[]) {
  const pool = getPool();
  let rows: ProductRow[] = [];
  if (itemIds && itemIds.length) {
    const { rows: data } = await pool.query(
      `
        select id, ml_item_id, sku, ml_category_id, price, ml_logistic_type, profit_unit,
               cost_price, overhead_cost, fixed_fee, cac, sales_30d
        from products
        where workspace_id = $1
          and ml_item_id = any($2::text[])
          and status != 'deleted'
      `,
      [workspaceId, itemIds],
    );
    rows = data as ProductRow[];
  } else {
    const { rows: data } = await pool.query(
      `
        select id, ml_item_id, sku, ml_category_id, price, ml_logistic_type, profit_unit,
               cost_price, overhead_cost, fixed_fee, cac, sales_30d
        from products
        where workspace_id = $1
          and ml_item_id is not null
          and status != 'deleted'
      `,
      [workspaceId],
    );
    rows = data as ProductRow[];
  }

  const map = new Map<string, ProductRow>();
  rows.forEach((row) => {
    if (row.ml_item_id) {
      map.set(String(row.ml_item_id), row);
    }
  });
  return map;
}

async function loadSalesVelocity(workspaceId: string) {
  const pool = getPool();
  const map = new Map<string, SalesVelocity>();

  try {
    const { rows } = await pool.query(
      `
        select
          oi.item_id,
          coalesce(sum(case when o.date_created >= (now() - interval '7 days') then oi.quantity else 0 end), 0) as sales_7d,
          coalesce(sum(case when o.date_created >= (now() - interval '30 days') then oi.quantity else 0 end), 0) as sales_30d,
          max(o.date_created) as last_sale_at
        from ml_order_items oi
        join ml_orders o
          on o.workspace_id = oi.workspace_id and o.order_id = oi.order_id
        where oi.workspace_id = $1
          and lower(o.status) not in ('cancelled','canceled')
        group by oi.item_id
      `,
      [workspaceId],
    );

    rows.forEach((row) => {
      map.set(String(row.item_id), {
        sales7d: Number(row.sales_7d || 0),
        sales30d: Number(row.sales_30d || 0),
        lastSaleAt: row.last_sale_at ? new Date(row.last_sale_at) : null,
      });
    });
  } catch (err) {
    console.warn('[ML Product Ads Metrics] Falha ao carregar vendas 7d/30d (ml_orders):', err);
  }

  return map;
}

async function loadAdsFallback(workspaceId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `
      select ml_ad_id, ml_item_id
      from ml_ads_campaign_products
      where workspace_id = $1
        and ml_ad_id is not null
    `,
    [workspaceId],
  );
  return rows.map((row: any) => ({
    adId: String(row.ml_ad_id),
    itemId: row.ml_item_id ? String(row.ml_item_id) : null,
  }));
}

async function fetchCategoryAvgPrice(
  workspaceId: string,
  categoryId: string,
  cache: Map<string, number | null>,
) {
  if (!categoryId) return null;
  if (cache.has(categoryId)) return cache.get(categoryId) ?? null;

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `select price
       from ml_products
       where category_id = $1 and price is not null
       order by sold_quantity desc nulls last
       limit 30`,
      [categoryId],
    );
    const prices = rows
      .map((row: any) => Number(row.price || 0))
      .filter((price: number) => Number.isFinite(price) && price > 0);
    if (prices.length >= 5) {
      const avg = prices.reduce((acc: number, val: number) => acc + val, 0) / prices.length;
      cache.set(categoryId, avg);
      return avg;
    }
  } catch (err: any) {
    console.warn('[ML Product Ads Metrics] Falha ao usar cache local de categoria:', categoryId, err?.message || err);
  }

  try {
    const data = await requestWithAuth<any>(
      workspaceId,
      `${MERCADO_LIVRE_API_BASE}/sites/MLB/search`,
      {
        params: {
          category: categoryId,
          limit: 30,
          sort: 'sold_quantity_desc',
        },
      },
    );
    const results = data?.results || [];
    const prices = results
      .map((item: any) => Number(item?.price || 0))
      .filter((price: number) => Number.isFinite(price) && price > 0);
    const avg = prices.length ? prices.reduce((acc: number, val: number) => acc + val, 0) / prices.length : null;
    cache.set(categoryId, avg);
    return avg;
  } catch (err: any) {
    const status = err?.response?.status || err?.status;
    if (status === 401 || status === 403) {
      try {
        const url = new URL(`${MERCADO_LIVRE_API_BASE}/sites/MLB/search`);
        url.searchParams.set('category', categoryId);
        url.searchParams.set('limit', '30');
        url.searchParams.set('sort', 'sold_quantity_desc');
        const resp = await fetch(url.toString());
        if (resp.ok) {
          const data = await resp.json();
          const results = data?.results || [];
          const prices = results
            .map((item: any) => Number(item?.price || 0))
            .filter((price: number) => Number.isFinite(price) && price > 0);
          const avg = prices.length ? prices.reduce((acc: number, val: number) => acc + val, 0) / prices.length : null;
          cache.set(categoryId, avg);
          return avg;
        }
      } catch (fallbackErr: any) {
        console.warn('[ML Product Ads Metrics] Fallback público falhou (categoria):', categoryId, fallbackErr?.message || fallbackErr);
      }
    }
    console.warn('[ML Product Ads Metrics] Falha ao calcular preço médio da categoria:', categoryId, err?.message || err);
    cache.set(categoryId, null);
    return null;
  }
}

const calcNetMargin = (profitUnit: number | null, price: number | null, sales: number, revenue: number, adsSpend: number) => {
  const profit = Number(profitUnit || 0);
  const priceVal = Number(price || 0);
  if (revenue > 0 && sales > 0) {
    return (profit * sales - adsSpend) / revenue;
  }
  if (priceVal > 0) {
    return profit / priceVal;
  }
  return null;
};

export async function syncProductAdsMetricsForWorkspace(
  workspaceId: string,
  options: { date?: string; days?: number } = {},
) {
  await ensureProductAdsMetricsSchema();
  const pool = getPool();
  const dateKey = options.date || getBrazilDateKey(new Date());
  const { dateFrom, dateTo } = getDateRange(options.days || 30);
  const adsAutomation = new MercadoAdsAutomationService();

  const { rows: adsRows, error: adsError } = await adsAutomation.fetchAdsMetricsByAd(workspaceId, {
    dateFrom,
    dateTo,
  });

  let adsMetrics: AdsMetricRow[] = adsRows;
  if (!adsMetrics.length) {
    const fallback = await loadAdsFallback(workspaceId);
    adsMetrics = fallback.map((row) => ({
      adId: row.adId,
      itemId: row.itemId,
      clicks: 0,
      prints: 0,
      cost: 0,
      sales: 0,
      revenue: 0,
      cpc: 0,
      ctr: 0,
    }));
  }

  const itemIds = Array.from(new Set(adsMetrics.map((row) => row.itemId).filter(Boolean))) as string[];
  const productsByItem = await loadProductsByItem(workspaceId, itemIds);
  const salesVelocity = await loadSalesVelocity(workspaceId);
  const categoryAvgCache = new Map<string, number | null>();

  const now = new Date();
  const rowsToInsert = [];

  for (const ad of adsMetrics) {
    const itemId = ad.itemId ? String(ad.itemId) : null;
    if (!itemId) continue;
    const product = productsByItem.get(itemId);
    const sales = Number(ad.sales || 0);
    const revenue = Number(ad.revenue || 0);
    const impressions = Number(ad.prints || 0);
    const clicks = Number(ad.clicks || 0);
    const adsSpend = Number(ad.cost || 0);
    const ctr = impressions > 0 ? clicks / impressions : null;
    const conversionRate = clicks > 0 ? sales / clicks : null;
    const acos = revenue > 0 ? adsSpend / revenue : null;
    const roas = adsSpend > 0 ? revenue / adsSpend : null;

    const categoryId = product?.ml_category_id || null;
    const avgCategoryPrice = categoryId
      ? await fetchCategoryAvgPrice(workspaceId, String(categoryId), categoryAvgCache)
      : null;

    const velocity = salesVelocity.get(itemId);
    const sales7d = velocity?.sales7d ?? 0;
    const sales30d = velocity?.sales30d ?? (product?.sales_30d ? Number(product.sales_30d) : 0);
    const lastSaleAt = velocity?.lastSaleAt || null;
    const daysWithoutSale = lastSaleAt
      ? Math.max(0, Math.floor((now.getTime() - lastSaleAt.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    const priceCurrent = product?.price != null ? Number(product.price) : null;
    const profitUnit = product?.profit_unit != null ? Number(product.profit_unit) : null;
    const netMargin = calcNetMargin(profitUnit, priceCurrent, sales, revenue, adsSpend);
    const isFull = product?.ml_logistic_type === 'fulfillment';

    rowsToInsert.push({
      workspaceId,
      itemId,
      adId: ad.adId || null,
      sku: product?.sku || null,
      categoryId,
      isFull,
      priceCurrent,
      priceCategoryAvg: avgCategoryPrice,
      impressions,
      clicks,
      ctr,
      conversionRate,
      sales,
      revenue,
      adsSpend,
      acos,
      roas,
      netMargin,
      sales7d,
      sales30d,
      daysWithoutSale,
      metricDate: dateKey,
    });
  }

  if (!rowsToInsert.length && adsError) {
    return {
      success: false,
      date: dateKey,
      count: 0,
      adsMetricsError: adsError || null,
    };
  }

  await pool.query(
    `delete from ml_product_ads_metrics where workspace_id = $1 and metric_date = $2`,
    [workspaceId, dateKey],
  );

  for (const row of rowsToInsert) {
    await pool.query(
      `
        insert into ml_product_ads_metrics (
          workspace_id, ml_item_id, ml_ad_id, sku, ml_category_id, is_full,
          price_current, price_category_avg, impressions, clicks, ctr, conversion_rate,
          sales, revenue, ads_spend, acos, roas, net_margin,
          sales_7d, sales_30d, days_without_sale, metric_date, updated_at
        ) values (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, now()
        )
      `,
      [
        row.workspaceId,
        row.itemId,
        row.adId,
        row.sku,
        row.categoryId,
        row.isFull,
        row.priceCurrent,
        row.priceCategoryAvg,
        row.impressions,
        row.clicks,
        row.ctr,
        row.conversionRate,
        row.sales,
        row.revenue,
        row.adsSpend,
        row.acos,
        row.roas,
        row.netMargin,
        row.sales7d,
        row.sales30d,
        row.daysWithoutSale,
        row.metricDate,
      ],
    );
  }

  return {
    success: true,
    date: dateKey,
    count: rowsToInsert.length,
    adsMetricsError: adsError || null,
  };
}

export async function listProductAdsMetricsForWorkspace(
  workspaceId: string,
  options: { date?: string; page?: number; limit?: number } = {},
) {
  await ensureProductAdsMetricsSchema();
  const pool = getPool();
  let dateKey = options.date;

  if (!dateKey) {
    const { rows } = await pool.query(
      `select max(metric_date) as metric_date from ml_product_ads_metrics where workspace_id = $1`,
      [workspaceId],
    );
    dateKey = rows[0]?.metric_date ? String(rows[0].metric_date) : null;
  }

  if (!dateKey) {
    return {
      date: null,
      items: [],
      total: 0,
      page: 1,
      limit: options.limit || 50,
      summary: null,
    };
  }

  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(200, Math.max(1, Number(options.limit || 50)));
  const offset = (page - 1) * limit;

  const { rows: items } = await pool.query(
    `
      select *
      from ml_product_ads_metrics
      where workspace_id = $1 and metric_date = $2
      order by revenue desc nulls last, ads_spend desc nulls last
      limit $3 offset $4
    `,
    [workspaceId, dateKey, limit, offset],
  );

  const { rows: countRows } = await pool.query(
    `
      select count(*)::int as total
      from ml_product_ads_metrics
      where workspace_id = $1 and metric_date = $2
    `,
    [workspaceId, dateKey],
  );

  const { rows: summaryRows } = await pool.query(
    `
      select
        coalesce(sum(impressions), 0) as impressions,
        coalesce(sum(clicks), 0) as clicks,
        coalesce(sum(sales), 0) as sales,
        coalesce(sum(revenue), 0) as revenue,
        coalesce(sum(ads_spend), 0) as ads_spend
      from ml_product_ads_metrics
      where workspace_id = $1 and metric_date = $2
    `,
    [workspaceId, dateKey],
  );

  const total = Number(countRows[0]?.total || 0);
  return {
    date: dateKey,
    items,
    total,
    page,
    limit,
    summary: summaryRows[0] || null,
  };
}

export async function hasProductAdsMetrics(workspaceId: string, dateKey: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `select 1 from ml_product_ads_metrics where workspace_id = $1 and metric_date = $2 limit 1`,
    [workspaceId, dateKey],
  );
  return rows.length > 0;
}
