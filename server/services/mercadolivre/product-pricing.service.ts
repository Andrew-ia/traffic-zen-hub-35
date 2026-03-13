import { getPool } from '../../config/database.js';
import { ensureRuntimeSchema } from '../../config/runtimeSchema.js';
import { MercadoAdsAutomationService } from './ads-automation.service.js';

const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DEFAULT_ML_FEE_RATE_BY_LISTING_TYPE: Record<string, number> = {
  gold_special: 0.19,
  gold_pro: 0.19,
  gold: 0.19,
  silver: 0.14,
  bronze: 0.09,
  free: 0,
};

let schemaReady: Promise<void> | null = null;

type ProductRow = {
  id: string;
  ml_item_id: string;
  title: string | null;
  price: number | null;
  status: string | null;
  ml_listing_type: string | null;
  cost_price: number | null;
  overhead_cost: number | null;
  fixed_fee: number | null;
  cac: number | null;
  ml_tax_rate: number | null;
};

type ControlRow = {
  id: string;
  workspace_id: string;
  product_id: string | null;
  ml_item_id: string;
  cost_price: number | null;
  shipping_cost: number | null;
  packaging_cost: number | null;
  other_cost: number | null;
  overhead_cost: number | null;
  fixed_fee: number | null;
  payment_fee_rate: number | null;
  ml_fee_rate: number | null;
  cac: number | null;
  target_margin_rate: number | null;
  max_promo_discount_rate: number | null;
  max_ads_spend_daily: number | null;
  min_profit_value: number | null;
  created_at: string;
  updated_at: string;
};

type MetricsRow = {
  snapshot_date: string | null;
  ads_spend_30d: number | string | null;
  ads_sales_30d: number | string | null;
  ads_revenue_30d: number | string | null;
};

export type ProductPricingControlInput = {
  costPrice?: number | null;
  shippingCost?: number | null;
  packagingCost?: number | null;
  otherCost?: number | null;
  overheadCost?: number | null;
  fixedFee?: number | null;
  paymentFeeRate?: number | null;
  mlFeeRate?: number | null;
  cac?: number | null;
  targetMarginRate?: number | null;
  maxPromoDiscountRate?: number | null;
  maxAdsSpendDaily?: number | null;
  minProfitValue?: number | null;
};

export type ProductPricingSummaryItemInput = {
  mlItemId: string;
  price?: number | null;
  listingType?: string | null;
};

export type ProductPricingListItemSummary = {
  mlItemId: string;
  hasControls: boolean;
  costConfigured: boolean;
  costPrice: number | null;
  profitPerUnitCurrentPrice: number | null;
  marginCurrentPrice: number | null;
  estimatedAdsNetProfit30d: number | null;
  avgAdsSpendDaily30d: number;
  maxAdsSpendDaily: number;
  adsLimitExceeded: boolean;
  lossRisk: boolean;
  riskLevel: 'high' | 'medium' | 'low' | 'unknown';
  riskReasons: string[];
};

type ProductPricingOptions = {
  refreshTodaySpend?: boolean;
};

const round = (value: number, digits = 4) => {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
};

const toDateKey = (date: Date) => DATE_FORMATTER.format(date);

const toNumber = (value: any, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const toNumberOrNull = (value: any) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const toOptionalInput = (value: any): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const clampMoney = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
};

const clampRate = (value: number, fallback: number, maxValue = 0.95) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(maxValue, value));
};

const resolveMlFeeRate = (args: {
  controlRate: number | null;
  productRate: number | null;
  listingType: string | null;
}) => {
  if (args.controlRate !== null && Number.isFinite(args.controlRate)) {
    return clampRate(Number(args.controlRate), 0.19);
  }

  if (args.productRate !== null && Number.isFinite(args.productRate)) {
    return clampRate(Number(args.productRate), 0.19);
  }

  const listingTypeKey = String(args.listingType || '').toLowerCase();
  const fallbackByListing = DEFAULT_ML_FEE_RATE_BY_LISTING_TYPE[listingTypeKey];
  if (fallbackByListing !== undefined) {
    return clampRate(fallbackByListing, 0.19);
  }

  return 0.19;
};

const computePricing = (input: {
  currentPrice: number;
  costPrice: number;
  shippingCost: number;
  packagingCost: number;
  otherCost: number;
  overheadCost: number;
  fixedFee: number;
  cac: number;
  mlFeeRate: number;
  paymentFeeRate: number;
  targetMarginRate: number;
  maxPromoDiscountRate: number;
  maxAdsSpendDaily: number;
  minProfitValue: number;
  adsSpend30d: number;
  adsSales30d: number;
  adsRevenue30d: number;
  todayAdsSpend: number | null;
}) => {
  const variableRate = clampRate(input.mlFeeRate + input.paymentFeeRate, 0.23, 0.99);

  const totalUnitCost =
    input.costPrice +
    input.shippingCost +
    input.packagingCost +
    input.otherCost +
    input.overheadCost +
    input.fixedFee +
    input.cac;

  const denominatorBreakEven = 1 - variableRate;
  const breakEvenPrice = denominatorBreakEven > 0
    ? totalUnitCost / denominatorBreakEven
    : null;

  const denominatorTarget = 1 - variableRate - input.targetMarginRate;
  const targetPrice = denominatorTarget > 0
    ? totalUnitCost / denominatorTarget
    : null;

  const minPriceForMinProfit = denominatorBreakEven > 0
    ? (totalUnitCost + input.minProfitValue) / denominatorBreakEven
    : null;

  const floorByProfit = [breakEvenPrice, minPriceForMinProfit]
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .reduce<number | null>((acc, value) => {
      if (acc === null) return value;
      return Math.max(acc, value);
    }, null);

  const minPriceByPromoPolicy = input.currentPrice > 0
    ? input.currentPrice * (1 - input.maxPromoDiscountRate)
    : null;

  let minimumPromotionPrice: number | null = null;
  if (floorByProfit !== null && minPriceByPromoPolicy !== null) {
    minimumPromotionPrice = Math.max(floorByProfit, minPriceByPromoPolicy);
  } else {
    minimumPromotionPrice = floorByProfit ?? minPriceByPromoPolicy;
  }

  const maxPromoDiscountAllowedRate =
    input.currentPrice > 0 && minimumPromotionPrice !== null
      ? Math.max(0, Math.min(1, 1 - minimumPromotionPrice / input.currentPrice))
      : null;

  const maxPromoDiscountAllowedValue =
    input.currentPrice > 0 && minimumPromotionPrice !== null
      ? Math.max(0, input.currentPrice - minimumPromotionPrice)
      : null;

  const profitPerUnitCurrentPrice =
    input.currentPrice > 0
      ? (input.currentPrice * (1 - variableRate)) - totalUnitCost
      : null;

  const marginCurrentPrice =
    input.currentPrice > 0 && profitPerUnitCurrentPrice !== null
      ? profitPerUnitCurrentPrice / input.currentPrice
      : null;

  const avgAdsSpendDaily30d = input.adsSpend30d / 30;
  const avgAdsSalesDaily30d = input.adsSales30d / 30;
  const avgAdsRevenueDaily30d = input.adsRevenue30d / 30;

  const estimatedAdsNetProfit30d =
    profitPerUnitCurrentPrice !== null
      ? (profitPerUnitCurrentPrice * input.adsSales30d) - input.adsSpend30d
      : null;

  const estimatedAdsNetMargin30d =
    input.adsRevenue30d > 0 && estimatedAdsNetProfit30d !== null
      ? estimatedAdsNetProfit30d / input.adsRevenue30d
      : null;

  const estimatedAdsGrossProfitDaily =
    profitPerUnitCurrentPrice !== null
      ? profitPerUnitCurrentPrice * avgAdsSalesDaily30d
      : null;

  const estimatedAdsNetProfitDaily =
    estimatedAdsNetProfit30d !== null
      ? estimatedAdsNetProfit30d / 30
      : null;

  const adsSpendDailyReference = input.todayAdsSpend !== null
    ? input.todayAdsSpend
    : avgAdsSpendDaily30d;

  const adsLimitExceeded = input.maxAdsSpendDaily > 0
    ? adsSpendDailyReference > input.maxAdsSpendDaily
    : false;

  const adsLimitUsageRate = input.maxAdsSpendDaily > 0
    ? adsSpendDailyReference / input.maxAdsSpendDaily
    : null;

  return {
    variableRate: round(variableRate, 6),
    totalUnitCost: round(totalUnitCost, 2),
    breakEvenPrice: breakEvenPrice === null ? null : round(breakEvenPrice, 2),
    targetPrice: targetPrice === null ? null : round(targetPrice, 2),
    minPriceForMinProfit: minPriceForMinProfit === null ? null : round(minPriceForMinProfit, 2),
    minPriceByPromoPolicy: minPriceByPromoPolicy === null ? null : round(minPriceByPromoPolicy, 2),
    minimumPromotionPrice: minimumPromotionPrice === null ? null : round(minimumPromotionPrice, 2),
    maxPromoDiscountAllowedRate: maxPromoDiscountAllowedRate === null ? null : round(maxPromoDiscountAllowedRate, 6),
    maxPromoDiscountAllowedValue: maxPromoDiscountAllowedValue === null ? null : round(maxPromoDiscountAllowedValue, 2),
    profitPerUnitCurrentPrice: profitPerUnitCurrentPrice === null ? null : round(profitPerUnitCurrentPrice, 2),
    marginCurrentPrice: marginCurrentPrice === null ? null : round(marginCurrentPrice, 6),
    avgAdsSpendDaily30d: round(avgAdsSpendDaily30d, 2),
    avgAdsSalesDaily30d: round(avgAdsSalesDaily30d, 4),
    avgAdsRevenueDaily30d: round(avgAdsRevenueDaily30d, 2),
    estimatedAdsGrossProfitDaily: estimatedAdsGrossProfitDaily === null ? null : round(estimatedAdsGrossProfitDaily, 2),
    estimatedAdsNetProfitDaily: estimatedAdsNetProfitDaily === null ? null : round(estimatedAdsNetProfitDaily, 2),
    estimatedAdsNetProfit30d: estimatedAdsNetProfit30d === null ? null : round(estimatedAdsNetProfit30d, 2),
    estimatedAdsNetMargin30d: estimatedAdsNetMargin30d === null ? null : round(estimatedAdsNetMargin30d, 6),
    adsSpendDailyReference: round(adsSpendDailyReference, 2),
    adsLimitExceeded,
    adsLimitUsageRate: adsLimitUsageRate === null ? null : round(adsLimitUsageRate, 6),
  };
};

async function fetchTodayAdsSpend(workspaceId: string, mlItemId: string) {
  const adsService = new MercadoAdsAutomationService();
  const todayKey = toDateKey(new Date());

  try {
    const metrics = await adsService.fetchAdsMetricsByAd(workspaceId, {
      dateFrom: todayKey,
      dateTo: todayKey,
    });

    if (metrics.error) {
      return {
        value: null,
        error: metrics.error.message,
      };
    }

    const spend = metrics.rows
      .filter((row) => row.itemId && String(row.itemId) === mlItemId)
      .reduce((acc, row) => acc + Number(row.cost || 0), 0);

    return {
      value: round(spend, 2),
      error: null,
    };
  } catch (error: any) {
    return {
      value: null,
      error: error?.message || 'failed_to_fetch_today_ads_spend',
    };
  }
}

export async function listProductPricingSummariesForItems(
  workspaceId: string,
  items: ProductPricingSummaryItemInput[],
) {
  await ensureProductPricingSchema();

  const normalizedItemsById = new Map<string, ProductPricingSummaryItemInput>();
  for (const entry of items || []) {
    const mlItemId = String(entry?.mlItemId || '').trim().toUpperCase();
    if (!mlItemId || normalizedItemsById.has(mlItemId)) continue;
    normalizedItemsById.set(mlItemId, {
      mlItemId,
      price: entry?.price ?? null,
      listingType: entry?.listingType ?? null,
    });
  }

  if (normalizedItemsById.size === 0) {
    return new Map<string, ProductPricingListItemSummary>();
  }

  const pool = getPool();
  const itemIds = Array.from(normalizedItemsById.keys());

  type MetricsByItemRow = {
    ml_item_id: string;
    ads_spend_30d: number | string | null;
    ads_sales_30d: number | string | null;
    ads_revenue_30d: number | string | null;
  };

  const [productsRes, controlsRes, metricsRes] = await Promise.all([
    pool.query<ProductRow>(
      `select
         id,
         ml_item_id,
         title,
         price,
         status,
         ml_listing_type,
         cost_price,
         overhead_cost,
         fixed_fee,
         cac,
         ml_tax_rate
       from products
       where workspace_id = $1
         and ml_item_id = any($2::text[])`,
      [workspaceId, itemIds],
    ),
    pool.query<ControlRow>(
      `select *
       from ml_product_pricing_controls
       where workspace_id = $1
         and ml_item_id = any($2::text[])`,
      [workspaceId, itemIds],
    ),
    pool.query<MetricsByItemRow>(
      `
        with latest as (
          select max(metric_date) as metric_date
          from ml_product_ads_metrics
          where workspace_id = $1
        )
        select
          m.ml_item_id,
          coalesce(sum(m.ads_spend), 0) as ads_spend_30d,
          coalesce(sum(m.sales), 0) as ads_sales_30d,
          coalesce(sum(m.revenue), 0) as ads_revenue_30d
        from ml_product_ads_metrics m
        join latest l
          on l.metric_date is not null
         and m.metric_date = l.metric_date
        where m.workspace_id = $1
          and m.ml_item_id = any($2::text[])
        group by m.ml_item_id
      `,
      [workspaceId, itemIds],
    ),
  ]);

  const productByItem = new Map<string, ProductRow>();
  for (const row of productsRes.rows) {
    const itemId = String(row.ml_item_id || '').trim().toUpperCase();
    if (!itemId) continue;
    productByItem.set(itemId, row);
  }

  const controlByItem = new Map<string, ControlRow>();
  for (const row of controlsRes.rows) {
    const itemId = String(row.ml_item_id || '').trim().toUpperCase();
    if (!itemId) continue;
    controlByItem.set(itemId, row);
  }

  const metricsByItem = new Map<string, MetricsByItemRow>();
  for (const row of metricsRes.rows) {
    const itemId = String(row.ml_item_id || '').trim().toUpperCase();
    if (!itemId) continue;
    metricsByItem.set(itemId, row);
  }

  const summaries = new Map<string, ProductPricingListItemSummary>();

  for (const [mlItemId, itemInput] of normalizedItemsById.entries()) {
    const product = productByItem.get(mlItemId) || null;
    const control = controlByItem.get(mlItemId) || null;
    const metrics = metricsByItem.get(mlItemId) || null;

    const costPriceRaw = control?.cost_price ?? toNumberOrNull(product?.cost_price);
    const controls = {
      costPrice: clampMoney(toNumber(costPriceRaw, 0)),
      shippingCost: clampMoney(toNumber(control?.shipping_cost, 0)),
      packagingCost: clampMoney(toNumber(control?.packaging_cost, 0)),
      otherCost: clampMoney(toNumber(control?.other_cost, 0)),
      overheadCost: clampMoney(toNumber(control?.overhead_cost ?? product?.overhead_cost, 0)),
      fixedFee: clampMoney(toNumber(control?.fixed_fee ?? product?.fixed_fee, 0)),
      paymentFeeRate: clampRate(toNumber(control?.payment_fee_rate, 0.04), 0.04),
      mlFeeRate: resolveMlFeeRate({
        controlRate: toNumberOrNull(control?.ml_fee_rate),
        productRate: toNumberOrNull(product?.ml_tax_rate),
        listingType: itemInput.listingType || product?.ml_listing_type || null,
      }),
      cac: clampMoney(toNumber(control?.cac ?? product?.cac, 0)),
      targetMarginRate: clampRate(toNumber(control?.target_margin_rate, 0.2), 0.2),
      maxPromoDiscountRate: clampRate(toNumber(control?.max_promo_discount_rate, 0.15), 0.15, 1),
      maxAdsSpendDaily: clampMoney(toNumber(control?.max_ads_spend_daily, 0)),
      minProfitValue: clampMoney(toNumber(control?.min_profit_value, 0)),
    };

    const adsSpend30d = clampMoney(toNumber(metrics?.ads_spend_30d, 0));
    const adsSales30d = clampMoney(toNumber(metrics?.ads_sales_30d, 0));
    const adsRevenue30d = clampMoney(toNumber(metrics?.ads_revenue_30d, 0));

    const calculations = computePricing({
      currentPrice: clampMoney(toNumber(itemInput.price ?? product?.price, 0)),
      costPrice: controls.costPrice,
      shippingCost: controls.shippingCost,
      packagingCost: controls.packagingCost,
      otherCost: controls.otherCost,
      overheadCost: controls.overheadCost,
      fixedFee: controls.fixedFee,
      cac: controls.cac,
      mlFeeRate: controls.mlFeeRate,
      paymentFeeRate: controls.paymentFeeRate,
      targetMarginRate: controls.targetMarginRate,
      maxPromoDiscountRate: controls.maxPromoDiscountRate,
      maxAdsSpendDaily: controls.maxAdsSpendDaily,
      minProfitValue: controls.minProfitValue,
      adsSpend30d,
      adsSales30d,
      adsRevenue30d,
      todayAdsSpend: null,
    });

    const unitProfit = calculations.profitPerUnitCurrentPrice;
    const adsNetProfit30d = calculations.estimatedAdsNetProfit30d;
    const costConfigured = costPriceRaw !== null;
    const lossRisk = (unitProfit !== null && unitProfit < 0) || (adsNetProfit30d !== null && adsNetProfit30d < 0);

    const riskReasons: string[] = [];
    if (!costConfigured) riskReasons.push('cost_missing');
    if (unitProfit !== null && unitProfit < 0) riskReasons.push('unit_loss');
    if (adsNetProfit30d !== null && adsNetProfit30d < 0) riskReasons.push('ads_net_loss_30d');
    if (controls.maxAdsSpendDaily > 0 && calculations.adsLimitExceeded) riskReasons.push('ads_limit_exceeded');

    let riskLevel: ProductPricingListItemSummary['riskLevel'] = 'low';
    if (!costConfigured) {
      riskLevel = 'unknown';
    } else if (lossRisk) {
      riskLevel = 'high';
    } else if (controls.maxAdsSpendDaily > 0 && calculations.adsLimitExceeded) {
      riskLevel = 'medium';
    }

    summaries.set(mlItemId, {
      mlItemId,
      hasControls: Boolean(control),
      costConfigured,
      costPrice: costConfigured ? round(controls.costPrice, 2) : null,
      profitPerUnitCurrentPrice: unitProfit,
      marginCurrentPrice: calculations.marginCurrentPrice,
      estimatedAdsNetProfit30d: adsNetProfit30d,
      avgAdsSpendDaily30d: calculations.avgAdsSpendDaily30d,
      maxAdsSpendDaily: round(controls.maxAdsSpendDaily, 2),
      adsLimitExceeded: calculations.adsLimitExceeded,
      lossRisk,
      riskLevel,
      riskReasons,
    });
  }

  return summaries;
}

export async function ensureProductPricingSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = ensureRuntimeSchema(
    'Mercado Livre product pricing controls',
    {
      tables: ['ml_product_pricing_controls'],
      columns: {
        ml_product_pricing_controls: [
          'id',
          'workspace_id',
          'product_id',
          'ml_item_id',
          'cost_price',
          'shipping_cost',
          'packaging_cost',
          'other_cost',
          'overhead_cost',
          'fixed_fee',
          'payment_fee_rate',
          'ml_fee_rate',
          'cac',
          'target_margin_rate',
          'max_promo_discount_rate',
          'max_ads_spend_daily',
          'min_profit_value',
          'created_at',
          'updated_at',
        ],
      },
    },
    async () => {
      const pool = getPool();
      await pool.query(`create extension if not exists "pgcrypto";`);
      await pool.query(`
        create table if not exists ml_product_pricing_controls (
          id uuid primary key default gen_random_uuid(),
          workspace_id uuid not null references workspaces(id) on delete cascade,
          product_id uuid references products(id) on delete set null,
          ml_item_id text not null,
          cost_price numeric(14,2),
          shipping_cost numeric(14,2) not null default 0,
          packaging_cost numeric(14,2) not null default 0,
          other_cost numeric(14,2) not null default 0,
          overhead_cost numeric(14,2) not null default 0,
          fixed_fee numeric(14,2) not null default 0,
          payment_fee_rate numeric(8,4) not null default 0.04,
          ml_fee_rate numeric(8,4),
          cac numeric(14,2) not null default 0,
          target_margin_rate numeric(8,4) not null default 0.20,
          max_promo_discount_rate numeric(8,4) not null default 0.15,
          max_ads_spend_daily numeric(14,2) not null default 0,
          min_profit_value numeric(14,2) not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (workspace_id, ml_item_id),
          constraint ml_product_pricing_controls_payment_fee_chk check (payment_fee_rate >= 0 and payment_fee_rate < 1),
          constraint ml_product_pricing_controls_ml_fee_chk check (ml_fee_rate is null or (ml_fee_rate >= 0 and ml_fee_rate < 1)),
          constraint ml_product_pricing_controls_target_margin_chk check (target_margin_rate >= 0 and target_margin_rate < 1),
          constraint ml_product_pricing_controls_max_promo_chk check (max_promo_discount_rate >= 0 and max_promo_discount_rate <= 1)
        );
      `);
      await pool.query(`
        create index if not exists idx_ml_product_pricing_controls_workspace
          on ml_product_pricing_controls (workspace_id, updated_at desc);
      `);
      await pool.query(`
        create index if not exists idx_ml_product_pricing_controls_item
          on ml_product_pricing_controls (workspace_id, ml_item_id);
      `);
    },
  );

  return schemaReady;
}

export async function upsertProductPricingControl(
  workspaceId: string,
  mlItemId: string,
  input: ProductPricingControlInput,
) {
  await ensureProductPricingSchema();
  const normalizedItemId = String(mlItemId || '').trim().toUpperCase();
  if (!normalizedItemId) {
    throw new Error('ml_item_id_required');
  }

  const pool = getPool();

  const [productRes, controlRes] = await Promise.all([
    pool.query<ProductRow>(
      `select
         id,
         ml_item_id,
         title,
         price,
         status,
         ml_listing_type,
         cost_price,
         overhead_cost,
         fixed_fee,
         cac,
         ml_tax_rate
       from products
       where workspace_id = $1 and ml_item_id = $2
       limit 1`,
      [workspaceId, normalizedItemId],
    ),
    pool.query<ControlRow>(
      `select *
       from ml_product_pricing_controls
       where workspace_id = $1 and ml_item_id = $2
       limit 1`,
      [workspaceId, normalizedItemId],
    ),
  ]);

  const product = productRes.rows[0] || null;
  const existing = controlRes.rows[0] || null;

  const costPriceInput = toOptionalInput(input.costPrice);
  const mlFeeInput = toOptionalInput(input.mlFeeRate);

  const costPrice = costPriceInput !== undefined
    ? costPriceInput
    : (existing?.cost_price ?? toNumberOrNull(product?.cost_price));

  const shippingCostInput = toOptionalInput(input.shippingCost);
  const shippingCost = clampMoney(
    shippingCostInput !== undefined
      ? toNumber(shippingCostInput, 0)
      : toNumber(existing?.shipping_cost, 0),
  );

  const packagingCostInput = toOptionalInput(input.packagingCost);
  const packagingCost = clampMoney(
    packagingCostInput !== undefined
      ? toNumber(packagingCostInput, 0)
      : toNumber(existing?.packaging_cost, 0),
  );

  const otherCostInput = toOptionalInput(input.otherCost);
  const otherCost = clampMoney(
    otherCostInput !== undefined
      ? toNumber(otherCostInput, 0)
      : toNumber(existing?.other_cost, 0),
  );

  const overheadCostInput = toOptionalInput(input.overheadCost);
  const overheadCost = clampMoney(
    overheadCostInput !== undefined
      ? toNumber(overheadCostInput, 0)
      : toNumber(existing?.overhead_cost ?? product?.overhead_cost, 0),
  );

  const fixedFeeInput = toOptionalInput(input.fixedFee);
  const fixedFee = clampMoney(
    fixedFeeInput !== undefined
      ? toNumber(fixedFeeInput, 0)
      : toNumber(existing?.fixed_fee ?? product?.fixed_fee, 0),
  );

  const paymentFeeRateInput = toOptionalInput(input.paymentFeeRate);
  const paymentFeeRate = clampRate(
    paymentFeeRateInput !== undefined
      ? toNumber(paymentFeeRateInput, 0.04)
      : toNumber(existing?.payment_fee_rate, 0.04),
    0.04,
  );

  const mlFeeRate = mlFeeInput === undefined
    ? existing?.ml_fee_rate ?? null
    : (mlFeeInput === null ? null : clampRate(Number(mlFeeInput), 0.19));

  const cacInput = toOptionalInput(input.cac);
  const cac = clampMoney(
    cacInput !== undefined
      ? toNumber(cacInput, 0)
      : toNumber(existing?.cac ?? product?.cac, 0),
  );

  const targetMarginRateInput = toOptionalInput(input.targetMarginRate);
  const targetMarginRate = clampRate(
    targetMarginRateInput !== undefined
      ? toNumber(targetMarginRateInput, 0.2)
      : toNumber(existing?.target_margin_rate, 0.2),
    0.2,
  );

  const maxPromoDiscountRateInput = toOptionalInput(input.maxPromoDiscountRate);
  const maxPromoDiscountRate = clampRate(
    maxPromoDiscountRateInput !== undefined
      ? toNumber(maxPromoDiscountRateInput, 0.15)
      : toNumber(existing?.max_promo_discount_rate, 0.15),
    0.15,
    1,
  );

  const maxAdsSpendDailyInput = toOptionalInput(input.maxAdsSpendDaily);
  const maxAdsSpendDaily = clampMoney(
    maxAdsSpendDailyInput !== undefined
      ? toNumber(maxAdsSpendDailyInput, 0)
      : toNumber(existing?.max_ads_spend_daily, 0),
  );

  const minProfitValueInput = toOptionalInput(input.minProfitValue);
  const minProfitValue = clampMoney(
    minProfitValueInput !== undefined
      ? toNumber(minProfitValueInput, 0)
      : toNumber(existing?.min_profit_value, 0),
  );

  await pool.query(
    `
      insert into ml_product_pricing_controls (
        workspace_id,
        product_id,
        ml_item_id,
        cost_price,
        shipping_cost,
        packaging_cost,
        other_cost,
        overhead_cost,
        fixed_fee,
        payment_fee_rate,
        ml_fee_rate,
        cac,
        target_margin_rate,
        max_promo_discount_rate,
        max_ads_spend_daily,
        min_profit_value,
        updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, now()
      )
      on conflict (workspace_id, ml_item_id) do update set
        product_id = excluded.product_id,
        cost_price = excluded.cost_price,
        shipping_cost = excluded.shipping_cost,
        packaging_cost = excluded.packaging_cost,
        other_cost = excluded.other_cost,
        overhead_cost = excluded.overhead_cost,
        fixed_fee = excluded.fixed_fee,
        payment_fee_rate = excluded.payment_fee_rate,
        ml_fee_rate = excluded.ml_fee_rate,
        cac = excluded.cac,
        target_margin_rate = excluded.target_margin_rate,
        max_promo_discount_rate = excluded.max_promo_discount_rate,
        max_ads_spend_daily = excluded.max_ads_spend_daily,
        min_profit_value = excluded.min_profit_value,
        updated_at = now()
    `,
    [
      workspaceId,
      product?.id || existing?.product_id || null,
      normalizedItemId,
      costPrice,
      shippingCost,
      packagingCost,
      otherCost,
      overheadCost,
      fixedFee,
      paymentFeeRate,
      mlFeeRate,
      cac,
      targetMarginRate,
      maxPromoDiscountRate,
      maxAdsSpendDaily,
      minProfitValue,
    ],
  );

  return getProductPricingControlForItem(workspaceId, normalizedItemId, {
    refreshTodaySpend: false,
  });
}

export async function getProductPricingControlForItem(
  workspaceId: string,
  mlItemId: string,
  options: ProductPricingOptions = {},
) {
  await ensureProductPricingSchema();

  const normalizedItemId = String(mlItemId || '').trim().toUpperCase();
  if (!normalizedItemId) {
    throw new Error('ml_item_id_required');
  }

  const pool = getPool();

  const [productRes, controlRes, metricsRes] = await Promise.all([
    pool.query<ProductRow>(
      `select
         id,
         ml_item_id,
         title,
         price,
         status,
         ml_listing_type,
         cost_price,
         overhead_cost,
         fixed_fee,
         cac,
         ml_tax_rate
       from products
       where workspace_id = $1 and ml_item_id = $2
       limit 1`,
      [workspaceId, normalizedItemId],
    ),
    pool.query<ControlRow>(
      `select *
       from ml_product_pricing_controls
       where workspace_id = $1 and ml_item_id = $2
       limit 1`,
      [workspaceId, normalizedItemId],
    ),
    pool.query<MetricsRow>(
      `
        with latest as (
          select max(metric_date) as metric_date
          from ml_product_ads_metrics
          where workspace_id = $1
        )
        select
          latest.metric_date as snapshot_date,
          coalesce(sum(m.ads_spend), 0) as ads_spend_30d,
          coalesce(sum(m.sales), 0) as ads_sales_30d,
          coalesce(sum(m.revenue), 0) as ads_revenue_30d
        from latest
        left join ml_product_ads_metrics m
          on m.workspace_id = $1
         and m.metric_date = latest.metric_date
         and m.ml_item_id = $2
        group by latest.metric_date
      `,
      [workspaceId, normalizedItemId],
    ),
  ]);

  const product = productRes.rows[0] || null;
  const control = controlRes.rows[0] || null;
  const metrics = metricsRes.rows[0] || {
    snapshot_date: null,
    ads_spend_30d: 0,
    ads_sales_30d: 0,
    ads_revenue_30d: 0,
  };

  const controls = {
    costPrice: control?.cost_price ?? toNumberOrNull(product?.cost_price),
    shippingCost: clampMoney(toNumber(control?.shipping_cost, 0)),
    packagingCost: clampMoney(toNumber(control?.packaging_cost, 0)),
    otherCost: clampMoney(toNumber(control?.other_cost, 0)),
    overheadCost: clampMoney(toNumber(control?.overhead_cost ?? product?.overhead_cost, 0)),
    fixedFee: clampMoney(toNumber(control?.fixed_fee ?? product?.fixed_fee, 0)),
    paymentFeeRate: clampRate(toNumber(control?.payment_fee_rate, 0.04), 0.04),
    mlFeeRate: resolveMlFeeRate({
      controlRate: toNumberOrNull(control?.ml_fee_rate),
      productRate: toNumberOrNull(product?.ml_tax_rate),
      listingType: product?.ml_listing_type || null,
    }),
    cac: clampMoney(toNumber(control?.cac ?? product?.cac, 0)),
    targetMarginRate: clampRate(toNumber(control?.target_margin_rate, 0.2), 0.2),
    maxPromoDiscountRate: clampRate(toNumber(control?.max_promo_discount_rate, 0.15), 0.15, 1),
    maxAdsSpendDaily: clampMoney(toNumber(control?.max_ads_spend_daily, 0)),
    minProfitValue: clampMoney(toNumber(control?.min_profit_value, 0)),
    updatedAt: control?.updated_at || null,
  };

  const adsSpend30d = clampMoney(toNumber(metrics.ads_spend_30d, 0));
  const adsSales30d = clampMoney(toNumber(metrics.ads_sales_30d, 0));
  const adsRevenue30d = clampMoney(toNumber(metrics.ads_revenue_30d, 0));

  let todayAdsSpend: number | null = null;
  let todayAdsError: string | null = null;

  if (options.refreshTodaySpend) {
    const today = await fetchTodayAdsSpend(workspaceId, normalizedItemId);
    todayAdsSpend = today.value;
    todayAdsError = today.error;
  }

  const calculations = computePricing({
    currentPrice: clampMoney(toNumber(product?.price, 0)),
    costPrice: clampMoney(toNumber(controls.costPrice, 0)),
    shippingCost: controls.shippingCost,
    packagingCost: controls.packagingCost,
    otherCost: controls.otherCost,
    overheadCost: controls.overheadCost,
    fixedFee: controls.fixedFee,
    cac: controls.cac,
    mlFeeRate: controls.mlFeeRate,
    paymentFeeRate: controls.paymentFeeRate,
    targetMarginRate: controls.targetMarginRate,
    maxPromoDiscountRate: controls.maxPromoDiscountRate,
    maxAdsSpendDaily: controls.maxAdsSpendDaily,
    minProfitValue: controls.minProfitValue,
    adsSpend30d,
    adsSales30d,
    adsRevenue30d,
    todayAdsSpend,
  });

  return {
    item: {
      productId: product?.id || control?.product_id || null,
      mlItemId: normalizedItemId,
      title: product?.title || null,
      status: product?.status || null,
      listingType: product?.ml_listing_type || null,
      price: product?.price !== null && product?.price !== undefined ? round(Number(product.price), 2) : null,
    },
    controls,
    metrics: {
      snapshotDate: metrics.snapshot_date || null,
      adsSpend30d: round(adsSpend30d, 2),
      adsSales30d: round(adsSales30d, 4),
      adsRevenue30d: round(adsRevenue30d, 2),
      todayAdsSpend,
      todayAdsError,
    },
    calculations,
    serverDate: toDateKey(new Date()),
  };
}
