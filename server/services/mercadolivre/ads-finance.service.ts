import { getPool } from '../../config/database.js';
import { requestWithAuth } from './client.js';
import { MercadoAdsAutomationService } from './ads-automation.service.js';

const BILLING_API_BASE = 'https://api.mercadolibre.com/billing/integration';
const ADVERTISING_API_BASE = 'https://api.mercadolibre.com/advertising';
const DEFAULT_SITE_ID = 'MLB';
const BILLING_GROUP = 'ML';
const BILLING_DOCUMENT_TYPE = 'BILL';
const BILLING_RATE_LIMIT_COOLDOWN_MS = Number(process.env.ML_ADS_BILLING_RATE_LIMIT_COOLDOWN_MS || 15 * 60 * 1000);
const OPEN_BILLING_STALE_MS = 30 * 60 * 1000;
const CLOSED_BILLING_STALE_MS = 24 * 60 * 60 * 1000;
const CURRENT_OPERATIONAL_STALE_MS = 30 * 60 * 1000;
const HISTORICAL_OPERATIONAL_STALE_MS = 6 * 60 * 60 * 1000;

export type AdsFinanceChannelKey = 'PRODUCT_ADS' | 'BRAND_ADS' | 'DISPLAY_ADS';

export interface AdsFinanceRange {
  dateFromKey: string;
  dateToKey: string;
  daysCount: number;
}

export interface AdsFinanceChannelSummary {
  key: AdsFinanceChannelKey;
  label: string;
  operationalAmount: number;
  billedAmount: number;
  operationalAvailable: boolean;
  billedAvailable: boolean;
  billedExact: boolean;
}

export interface AdsFinancePeriodSummary {
  key: string;
  dateFrom: string;
  dateTo: string;
  coveredDateTo: string;
  periodStatus: string | null;
  overlapDays: number;
  totalDays: number;
  exact: boolean;
}

export interface AdsFinanceSummary {
  dateFrom: string;
  dateTo: string;
  operationalTotal: number;
  billedTotal: number;
  billedMode: 'exact' | 'estimated' | 'unavailable';
  usedInEstimate: {
    amount: number;
    source: 'billed' | 'operational';
    label: string;
    exact: boolean;
  };
  channels: AdsFinanceChannelSummary[];
  periods: AdsFinancePeriodSummary[];
  notes: string[];
  lastOperationalSyncAt: string | null;
  lastBillingSyncAt: string | null;
}

type BillingPeriodRow = {
  period_key: string;
  period_date_from: string;
  period_date_to: string;
  period_status: string | null;
  last_synced_at: string | null;
};

type BillingDetailRow = {
  line_kind: string;
  channel: AdsFinanceChannelKey | null;
  line_amount: string | number | null;
  created_at: string;
};

type BillingLineRow = {
  period_key: string;
  line_kind: string;
  channel: AdsFinanceChannelKey | null;
  line_amount: string | number | null;
};

type OperationalRow = {
  channel: AdsFinanceChannelKey;
  metric_date: string;
  cost: string | number | null;
  last_synced_at: string | null;
};

type OperationalSyncStatus = {
  available: boolean;
  reason?: string;
};

const CHANNEL_LABELS: Record<AdsFinanceChannelKey, string> = {
  PRODUCT_ADS: 'Product Ads',
  BRAND_ADS: 'Brand Ads',
  DISPLAY_ADS: 'Display Ads',
};

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseRetryAfterMs = (value: unknown) => {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric * 1000;
  }
  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed)) {
    return Math.max(0, parsed - Date.now());
  }
  return null;
};

const parseDateKey = (dateKey: string, endOfDay = false) =>
  new Date(`${dateKey}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}-03:00`);

const formatDateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateKey = () => formatDateKey(new Date());

const enumerateDateKeys = (dateFromKey: string, dateToKey: string) => {
  const keys: string[] = [];
  const current = parseDateKey(dateFromKey);
  const end = parseDateKey(dateToKey);
  while (current.getTime() <= end.getTime()) {
    keys.push(formatDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return keys;
};

const countDaysInclusive = (dateFromKey: string, dateToKey: string) => {
  const start = parseDateKey(dateFromKey);
  const end = parseDateKey(dateToKey);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
};

const rangesOverlap = (aFrom: string, aTo: string, bFrom: string, bTo: string) =>
  aFrom <= bTo && aTo >= bFrom;

const intersectRange = (aFrom: string, aTo: string, bFrom: string, bTo: string) => ({
  from: aFrom > bFrom ? aFrom : bFrom,
  to: aTo < bTo ? aTo : bTo,
});

const classifyBillingChannel = (lineType: string | null, label: string | null): AdsFinanceChannelKey | null => {
  const normalizedType = String(lineType || '').trim().toUpperCase();
  const normalizedLabel = String(label || '').trim().toLowerCase();

  if (
    normalizedType.includes('PADS') ||
    normalizedLabel.includes('product ads')
  ) {
    return 'PRODUCT_ADS';
  }

  if (
    normalizedType.includes('CBADS') ||
    normalizedType.includes('BADS') ||
    normalizedLabel.includes('brand ads')
  ) {
    return 'BRAND_ADS';
  }

  if (
    normalizedType.includes('CDLIT') ||
    normalizedType.includes('DLIT') ||
    normalizedLabel.includes('display ads')
  ) {
    return 'DISPLAY_ADS';
  }

  return null;
};

const classifyBillingDetailChannel = (detailSubType: string | null, label: string | null): AdsFinanceChannelKey | null =>
  classifyBillingChannel(detailSubType, label);

const normalizeAdvertiserList = (response: any): any[] => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.advertisers)) return response.advertisers;
  if (Array.isArray(response.results)) return response.results;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

const buildDailyMetricMap = (series: Array<{ x?: string; y?: number }> | undefined) => {
  const map = new Map<string, number>();
  (series || []).forEach((entry) => {
    const dateKey = String(entry?.x || '').trim();
    if (!dateKey) return;
    map.set(dateKey, toNumber(entry?.y, 0));
  });
  return map;
};

export class MercadoLivreAdsFinanceService {
  private readonly adsAutomation = new MercadoAdsAutomationService();
  private readonly billingSyncInFlight = new Map<string, Promise<void>>();
  private readonly billingRateLimitedUntil = new Map<string, number>();

  async ensureSchema() {
    const pool = getPool();
    await pool.query(`
      create table if not exists ml_ads_operational_daily (
        id uuid primary key default gen_random_uuid(),
        workspace_id uuid not null,
        channel text not null,
        metric_date date not null,
        advertiser_id text,
        currency_id text not null default 'BRL',
        cost numeric(14,2) not null default 0,
        revenue numeric(14,2) not null default 0,
        clicks integer not null default 0,
        prints integer not null default 0,
        units integer not null default 0,
        raw_payload jsonb,
        last_synced_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (workspace_id, channel, metric_date)
      );

      create index if not exists idx_ml_ads_operational_daily_workspace_date
        on ml_ads_operational_daily (workspace_id, metric_date desc);

      create index if not exists idx_ml_ads_operational_daily_workspace_channel
        on ml_ads_operational_daily (workspace_id, channel, metric_date desc);

      create table if not exists ml_ads_billing_periods (
        id uuid primary key default gen_random_uuid(),
        workspace_id uuid not null,
        period_key date not null,
        period_date_from date not null,
        period_date_to date not null,
        period_status text,
        expiration_date date,
        debt_expiration_date date,
        currency_id text not null default 'BRL',
        total_amount numeric(14,2) not null default 0,
        unpaid_amount numeric(14,2) not null default 0,
        total_collected numeric(14,2) not null default 0,
        total_debt numeric(14,2) not null default 0,
        raw_payload jsonb,
        last_synced_at timestamptz not null default now(),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (workspace_id, period_key)
      );

      create index if not exists idx_ml_ads_billing_periods_workspace_dates
        on ml_ads_billing_periods (workspace_id, period_date_from desc, period_date_to desc);

      create table if not exists ml_ads_billing_summary_lines (
        id uuid primary key default gen_random_uuid(),
        workspace_id uuid not null,
        period_key date not null,
        line_kind text not null,
        line_type text,
        line_label text not null,
        line_amount numeric(14,2) not null default 0,
        group_id integer,
        group_description text,
        channel text,
        raw_payload jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (workspace_id, period_key, line_kind, line_type, line_label)
      );

      create index if not exists idx_ml_ads_billing_summary_lines_workspace_period
        on ml_ads_billing_summary_lines (workspace_id, period_key);

      create index if not exists idx_ml_ads_billing_summary_lines_workspace_channel
        on ml_ads_billing_summary_lines (workspace_id, channel, period_key);

      create table if not exists ml_ads_billing_detail_lines (
        id uuid primary key default gen_random_uuid(),
        workspace_id uuid not null,
        period_key date not null,
        billing_detail_id text not null,
        line_kind text not null,
        line_type text,
        line_label text,
        line_amount numeric(14,2) not null default 0,
        created_at timestamptz not null,
        channel text,
        raw_payload jsonb,
        synced_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (workspace_id, period_key, billing_detail_id)
      );

      create index if not exists idx_ml_ads_billing_detail_lines_workspace_created
        on ml_ads_billing_detail_lines (workspace_id, created_at desc);

      create index if not exists idx_ml_ads_billing_detail_lines_workspace_channel
        on ml_ads_billing_detail_lines (workspace_id, channel, created_at desc);
    `);
  }

  async getSummary(workspaceId: string, range: AdsFinanceRange): Promise<AdsFinanceSummary> {
    await this.ensureSchema();

    const todayDateKey = getTodayDateKey();
    const billingPeriods = await this.syncBillingPeriods(workspaceId, range);
    const operationalStatus = await this.syncOperationalDaily(workspaceId, range);
    const operationalRows = await this.loadOperationalRows(workspaceId, range);
    const billingDetailRows = billingPeriods.length
      ? await this.loadBillingDetailRows(workspaceId, range)
      : [];
    const billingSummaryRows = billingPeriods.length
      ? await this.loadBillingLines(workspaceId, billingPeriods.map((period) => period.period_key))
      : [];

    const operationalMap = new Map<AdsFinanceChannelKey, Map<string, number>>();
    let lastOperationalSyncAt: string | null = null;
    operationalRows.forEach((row) => {
      const channelMap = operationalMap.get(row.channel) || new Map<string, number>();
      channelMap.set(row.metric_date, toNumber(row.cost, 0));
      operationalMap.set(row.channel, channelMap);
      if (!lastOperationalSyncAt || (row.last_synced_at && row.last_synced_at > lastOperationalSyncAt)) {
        lastOperationalSyncAt = row.last_synced_at;
      }
    });

    const billedByChannel = new Map<AdsFinanceChannelKey, number>();
    const hasAdBonuses = billingDetailRows.some((row) => row.channel && row.line_kind !== 'charge' && toNumber(row.line_amount, 0) !== 0);
    const hasExactBillingDetails = billingDetailRows.length > 0;

    if (hasExactBillingDetails) {
      billingDetailRows.forEach((row) => {
        if (row.line_kind !== 'charge') return;
        if (!row.channel) return;
        billedByChannel.set(row.channel, roundMoney((billedByChannel.get(row.channel) || 0) + toNumber(row.line_amount, 0)));
      });
    } else {
      for (const channelKey of Object.keys(CHANNEL_LABELS) as AdsFinanceChannelKey[]) {
        const estimatedAmount = this.estimateBilledAmountFromSummary(
          billingSummaryRows,
          channelKey,
          billingPeriods,
          operationalMap.get(channelKey),
          range,
          todayDateKey,
        );
        billedByChannel.set(channelKey, estimatedAmount);
      }
    }

    const channels: AdsFinanceChannelSummary[] = (Object.keys(CHANNEL_LABELS) as AdsFinanceChannelKey[]).map((channelKey) => {
      const operationalAmount = roundMoney(this.sumOperationalRange(operationalMap.get(channelKey), range.dateFromKey, range.dateToKey));
      const billedAmount = roundMoney(billedByChannel.get(channelKey) || 0);
      const billedAvailable = billingPeriods.length > 0;
      const billedExact = billedAvailable && hasExactBillingDetails;

      return {
        key: channelKey,
        label: CHANNEL_LABELS[channelKey],
        operationalAmount: roundMoney(operationalAmount),
        billedAmount: roundMoney(billedAmount),
        operationalAvailable: operationalStatus.get(channelKey)?.available ?? false,
        billedAvailable,
        billedExact: billedAvailable ? billedExact : false,
      };
    });

    const operationalTotal = roundMoney(channels.reduce((sum, channel) => sum + channel.operationalAmount, 0));
    const billedAvailable = billingPeriods.length > 0;
    const billedTotal = roundMoney(channels.reduce((sum, channel) => sum + channel.billedAmount, 0));
    const billedMode: AdsFinanceSummary['billedMode'] = !billedAvailable
      ? 'unavailable'
      : hasExactBillingDetails
        ? 'exact'
        : 'estimated';

    const notes: string[] = [];
    if (billedMode === 'estimated') {
      notes.push('Ads faturado caiu no modo estimado porque o billing detalhado por data nao estava disponivel no momento. O valor foi proporcionalizado pelo ciclo de cobranca.');
    }
    if (!operationalStatus.get('DISPLAY_ADS')?.available) {
      notes.push('Display Ads nao possui custo operacional disponivel via API nesta conta. O canal aparece apenas no faturamento.');
    }
    if (!billingPeriods.length) {
      notes.push('Nenhum ciclo de faturamento de publicidade encontrado para o intervalo selecionado.');
    }
    if (hasAdBonuses) {
      notes.push('Bonificacoes e cancelamentos de Ads foram persistidos separadamente e nao entram no valor de Ads faturado exibido neste card.');
    }

    const lastBillingSyncAt = billingPeriods.reduce<string | null>((latest, period) => {
      if (!latest || (period.last_synced_at && period.last_synced_at > latest)) {
        return period.last_synced_at;
      }
      return latest;
    }, null);

    const usedInEstimate = billedAvailable
      ? {
          amount: billedTotal,
          source: 'billed' as const,
          label: billedMode === 'exact' ? 'Ads faturado' : 'Ads faturado (estimado)',
          exact: billedMode === 'exact',
        }
      : {
          amount: operationalTotal,
          source: 'operational' as const,
          label: 'Ads operacional',
          exact: false,
        };

    const periods: AdsFinancePeriodSummary[] = billingPeriods.map((period) => {
      const billedWindowDateTo = String(period.period_status || '').toUpperCase() === 'OPEN'
        ? [period.period_date_to, todayDateKey].sort()[0]
        : period.period_date_to;
      const overlap = intersectRange(range.dateFromKey, range.dateToKey, period.period_date_from, billedWindowDateTo);
      const exact = range.dateFromKey <= period.period_date_from && range.dateToKey >= billedWindowDateTo;
      return {
        key: period.period_key,
        dateFrom: period.period_date_from,
        dateTo: period.period_date_to,
        coveredDateTo: billedWindowDateTo,
        periodStatus: period.period_status,
        overlapDays: countDaysInclusive(overlap.from, overlap.to),
        totalDays: countDaysInclusive(period.period_date_from, billedWindowDateTo),
        exact,
      };
    });

    return {
      dateFrom: range.dateFromKey,
      dateTo: range.dateToKey,
      operationalTotal,
      billedTotal,
      billedMode,
      usedInEstimate,
      channels,
      periods,
      notes,
      lastOperationalSyncAt,
      lastBillingSyncAt,
    };
  }

  private async syncBillingPeriods(workspaceId: string, range: AdsFinanceRange) {
    const periods = await this.fetchBillingPeriodsFromApi(workspaceId, range);
    const relevant = periods.filter((period) =>
      rangesOverlap(period.period.date_from, period.period.date_to, range.dateFromKey, range.dateToKey),
    );

    for (const period of relevant) {
      await this.upsertBillingPeriodMeta(workspaceId, period);
      const needsSync = await this.needsBillingSummarySync(workspaceId, period.key, period.period_status);
      if (!needsSync) continue;
      try {
        await this.syncBillingPeriodData(workspaceId, period.key);
      } catch (err: any) {
        console.warn('[ML Ads Finance] Falha ao sincronizar billing data:', period.key, err?.message || err);
      }
    }

    const pool = getPool();
    const { rows } = await pool.query<BillingPeriodRow>(
      `
        select period_key::text, period_date_from::text, period_date_to::text, period_status, last_synced_at::text
        from ml_ads_billing_periods
        where workspace_id = $1
          and period_date_from <= $3::date
          and period_date_to >= $2::date
        order by period_date_from asc
      `,
      [workspaceId, range.dateFromKey, range.dateToKey],
    );
    return rows;
  }

  private getBillingSyncKey(workspaceId: string, periodKey: string) {
    return `${workspaceId}:${periodKey}`;
  }

  private getBillingRateLimitUntil(workspaceId: string, periodKey: string) {
    const key = this.getBillingSyncKey(workspaceId, periodKey);
    const until = this.billingRateLimitedUntil.get(key) || 0;
    if (until > Date.now()) return until;
    this.billingRateLimitedUntil.delete(key);
    return 0;
  }

  private setBillingRateLimitCooldown(workspaceId: string, periodKey: string, err: any) {
    const retryAfterMs = parseRetryAfterMs(err?.response?.headers?.['retry-after']);
    const cooldownMs = Math.max(retryAfterMs || 0, BILLING_RATE_LIMIT_COOLDOWN_MS);
    const until = Date.now() + cooldownMs;
    const key = this.getBillingSyncKey(workspaceId, periodKey);
    this.billingRateLimitedUntil.set(key, until);
    return until;
  }

  private async syncBillingPeriodData(workspaceId: string, periodKey: string) {
    const key = this.getBillingSyncKey(workspaceId, periodKey);
    const rateLimitedUntil = this.getBillingRateLimitUntil(workspaceId, periodKey);
    if (rateLimitedUntil) {
      const waitMinutes = Math.max(1, Math.ceil((rateLimitedUntil - Date.now()) / 60000));
      console.warn(`[ML Ads Finance] Pulando billing ${periodKey} por cooldown de rate limit (${waitMinutes} min restantes).`);
      return;
    }

    const inFlight = this.billingSyncInFlight.get(key);
    if (inFlight) {
      await inFlight;
      return;
    }

    const syncPromise = (async () => {
      try {
        await this.syncBillingPeriodSummary(workspaceId, periodKey);
        await this.syncBillingPeriodDetails(workspaceId, periodKey);
        this.billingRateLimitedUntil.delete(key);
      } catch (err: any) {
        if (Number(err?.response?.status) === 429) {
          const until = this.setBillingRateLimitCooldown(workspaceId, periodKey, err);
          const waitMinutes = Math.max(1, Math.ceil((until - Date.now()) / 60000));
          console.warn(`[ML Ads Finance] Billing ${periodKey} entrou em cooldown por rate limit (${waitMinutes} min).`);
        }
        throw err;
      } finally {
        this.billingSyncInFlight.delete(key);
      }
    })();

    this.billingSyncInFlight.set(key, syncPromise);
    await syncPromise;
  }

  private async fetchBillingPeriodsFromApi(workspaceId: string, range: AdsFinanceRange) {
    const results: any[] = [];
    let offset = 0;
    const limit = 12;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
      const response = await requestWithAuth<any>(
        workspaceId,
        `${BILLING_API_BASE}/monthly/periods`,
        {
          params: {
            group: BILLING_GROUP,
            document_type: BILLING_DOCUMENT_TYPE,
            limit,
            offset,
          },
        },
      );
      const page = Array.isArray(response?.results) ? response.results : [];
      total = Number(response?.total || page.length || 0);
      results.push(...page);
      if (page.length < limit) break;

      const oldest = page[page.length - 1];
      const oldestDateTo = String(oldest?.period?.date_to || '');
      if (oldestDateTo && oldestDateTo < range.dateFromKey) {
        break;
      }
      offset += limit;
    }

    return results;
  }

  private async upsertBillingPeriodMeta(workspaceId: string, period: any) {
    const pool = getPool();
    await pool.query(
      `
        insert into ml_ads_billing_periods (
          workspace_id,
          period_key,
          period_date_from,
          period_date_to,
          period_status,
          expiration_date,
          debt_expiration_date,
          total_amount,
          unpaid_amount,
          updated_at
        ) values ($1, $2::date, $3::date, $4::date, $5, $6::date, $7::date, $8, $9, now())
        on conflict (workspace_id, period_key) do update set
          period_date_from = excluded.period_date_from,
          period_date_to = excluded.period_date_to,
          period_status = excluded.period_status,
          expiration_date = excluded.expiration_date,
          debt_expiration_date = excluded.debt_expiration_date,
          total_amount = excluded.total_amount,
          unpaid_amount = excluded.unpaid_amount,
          updated_at = now()
      `,
      [
        workspaceId,
        String(period?.key || ''),
        String(period?.period?.date_from || ''),
        String(period?.period?.date_to || ''),
        period?.period_status || null,
        period?.expiration_date || null,
        period?.debt_expiration_date || null,
        toNumber(period?.amount, 0),
        toNumber(period?.unpaid_amount, 0),
      ],
    );
  }

  private async needsBillingSummarySync(workspaceId: string, periodKey: string, periodStatus: string | null) {
    const pool = getPool();
    const { rows } = await pool.query<{ last_synced_at: string | null; lines_count: string | number; detail_count: string | number }>(
      `
        select
          p.last_synced_at::text,
          coalesce(count(distinct l.id), 0) as lines_count,
          coalesce(count(distinct d.id), 0) as detail_count
        from ml_ads_billing_periods p
        left join ml_ads_billing_summary_lines l
          on l.workspace_id = p.workspace_id
         and l.period_key = p.period_key
        left join ml_ads_billing_detail_lines d
          on d.workspace_id = p.workspace_id
         and d.period_key = p.period_key
        where p.workspace_id = $1
          and p.period_key = $2::date
        group by p.last_synced_at
      `,
      [workspaceId, periodKey],
    );

    const row = rows[0];
    if (!row) return true;
    const linesCount = Number(row.lines_count || 0);
    const detailCount = Number(row.detail_count || 0);
    if (linesCount === 0) return true;
    if (detailCount === 0) return true;
    const lastSyncedAt = row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
    const staleMs = String(periodStatus || '').toUpperCase() === 'OPEN'
      ? OPEN_BILLING_STALE_MS
      : CLOSED_BILLING_STALE_MS;
    return !lastSyncedAt || (Date.now() - lastSyncedAt) > staleMs;
  }

  private async syncBillingPeriodSummary(workspaceId: string, periodKey: string) {
    const response = await requestWithAuth<any>(
      workspaceId,
      `${BILLING_API_BASE}/periods/key/${periodKey}/summary/details`,
      {
        params: {
          group: BILLING_GROUP,
          document_type: BILLING_DOCUMENT_TYPE,
        },
      },
    );

    const period = response?.period || {};
    const billIncludes = response?.bill_includes || {};
    const paymentCollected = response?.payment_collected || {};
    const charges = Array.isArray(billIncludes?.charges) ? billIncludes.charges : [];
    const bonuses = Array.isArray(billIncludes?.bonuses) ? billIncludes.bonuses : [];
    const lines = [
      ...charges.map((line: any) => ({ kind: 'charge', line })),
      ...bonuses.map((line: any) => ({ kind: 'bonus', line })),
    ];

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');

      await client.query(
        `
          insert into ml_ads_billing_periods (
            workspace_id,
            period_key,
            period_date_from,
            period_date_to,
            period_status,
            expiration_date,
            currency_id,
            total_amount,
            unpaid_amount,
            total_collected,
            total_debt,
            raw_payload,
            last_synced_at,
            updated_at
          ) values (
            $1,
            $2::date,
            $3::date,
            $4::date,
            null,
            $5::date,
            $6,
            $7,
            0,
            $8,
            $9,
            $10::jsonb,
            now(),
            now()
          )
          on conflict (workspace_id, period_key) do update set
            period_date_from = excluded.period_date_from,
            period_date_to = excluded.period_date_to,
            period_status = coalesce(excluded.period_status, ml_ads_billing_periods.period_status),
            expiration_date = excluded.expiration_date,
            currency_id = excluded.currency_id,
            total_amount = excluded.total_amount,
            total_collected = excluded.total_collected,
            total_debt = excluded.total_debt,
            raw_payload = excluded.raw_payload,
            updated_at = now()
        `,
        [
          workspaceId,
          periodKey,
          String(period?.date_from || periodKey),
          String(period?.date_to || periodKey),
          period?.expiration_date || null,
          response?.currency_id || 'BRL',
          toNumber(billIncludes?.total_amount, 0),
          toNumber(paymentCollected?.total_collected, 0),
          toNumber(paymentCollected?.total_debt, 0),
          JSON.stringify(response),
        ],
      );

      await client.query(
        `delete from ml_ads_billing_summary_lines where workspace_id = $1 and period_key = $2::date`,
        [workspaceId, periodKey],
      );

      for (const entry of lines) {
        const line = entry.line || {};
        const channel = classifyBillingChannel(line?.type || null, line?.label || null);
        await client.query(
          `
            insert into ml_ads_billing_summary_lines (
              workspace_id,
              period_key,
              line_kind,
              line_type,
              line_label,
              line_amount,
              group_id,
              group_description,
              channel,
              raw_payload,
              updated_at
            ) values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())
          `,
          [
            workspaceId,
            periodKey,
            entry.kind,
            line?.type || null,
            line?.label || line?.type || 'Linha sem descricao',
            toNumber(line?.amount, 0),
            line?.group_id ?? null,
            line?.group_description || null,
            channel,
            JSON.stringify(line),
          ],
        );
      }

      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  private async syncBillingPeriodDetails(workspaceId: string, periodKey: string) {
    const limit = 150;
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    const results: any[] = [];

    while (offset < total) {
      const response = await requestWithAuth<any>(
        workspaceId,
        `${BILLING_API_BASE}/periods/key/${periodKey}/group/${BILLING_GROUP}/details`,
        {
          params: {
            document_type: BILLING_DOCUMENT_TYPE,
            limit,
            offset,
          },
        },
      );

      const page = Array.isArray(response?.results) ? response.results : [];
      total = Number(response?.total || page.length || 0);
      results.push(...page);
      if (page.length < limit) break;
      offset += limit;
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `delete from ml_ads_billing_detail_lines where workspace_id = $1 and period_key = $2::date`,
        [workspaceId, periodKey],
      );

      for (const entry of results) {
        const chargeInfo = entry?.charge_info || {};
        const detailId = String(chargeInfo?.detail_id || '').trim();
        const createdAt = String(chargeInfo?.creation_date_time || '').trim();
        if (!detailId || !createdAt) continue;

        const lineType = String(chargeInfo?.detail_sub_type || '').trim() || null;
        const lineLabel = String(chargeInfo?.transaction_detail || '').trim() || null;
        const lineKind = String(chargeInfo?.detail_type || '').trim().toLowerCase() === 'charge' ? 'charge' : 'bonus';
        const channel = classifyBillingDetailChannel(lineType, lineLabel);

        await client.query(
          `
            insert into ml_ads_billing_detail_lines (
              workspace_id,
              period_key,
              billing_detail_id,
              line_kind,
              line_type,
              line_label,
              line_amount,
              created_at,
              channel,
              raw_payload,
              synced_at,
              updated_at
            ) values ($1, $2::date, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::jsonb, now(), now())
          `,
          [
            workspaceId,
            periodKey,
            detailId,
            lineKind,
            lineType,
            lineLabel,
            toNumber(chargeInfo?.detail_amount, 0),
            createdAt,
            channel,
            JSON.stringify(entry),
          ],
        );
      }

      await client.query(
        `
          update ml_ads_billing_periods
          set last_synced_at = now(), updated_at = now()
          where workspace_id = $1 and period_key = $2::date
        `,
        [workspaceId, periodKey],
      );

      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  private async syncOperationalDaily(workspaceId: string, range: AdsFinanceRange) {
    const statusMap = new Map<AdsFinanceChannelKey, OperationalSyncStatus>();

    const productNeedsRefresh = await this.needsOperationalRefresh(workspaceId, 'PRODUCT_ADS', range);
    if (productNeedsRefresh) {
      try {
        await this.syncProductAdsDaily(workspaceId, range);
      } catch (err: any) {
        console.warn('[ML Ads Finance] Falha ao sincronizar Product Ads:', err?.message || err);
      }
    }
    statusMap.set('PRODUCT_ADS', {
      available: await this.hasOperationalCoverage(workspaceId, 'PRODUCT_ADS', range),
    });

    const brandNeedsRefresh = await this.needsOperationalRefresh(workspaceId, 'BRAND_ADS', range);
    if (brandNeedsRefresh) {
      try {
        await this.syncBrandAdsDaily(workspaceId, range);
      } catch (err: any) {
        console.warn('[ML Ads Finance] Falha ao sincronizar Brand Ads:', err?.message || err);
      }
    }
    statusMap.set('BRAND_ADS', {
      available: await this.hasOperationalCoverage(workspaceId, 'BRAND_ADS', range),
    });

    statusMap.set('DISPLAY_ADS', {
      available: false,
      reason: 'display_ads_permission_unavailable',
    });

    return statusMap;
  }

  private async needsOperationalRefresh(workspaceId: string, channel: AdsFinanceChannelKey, range: AdsFinanceRange) {
    const pool = getPool();
    const expectedDays = countDaysInclusive(range.dateFromKey, range.dateToKey);
    const { rows } = await pool.query<{ day_count: string | number; last_synced_at: string | null }>(
      `
        select
          count(distinct metric_date) as day_count,
          max(last_synced_at)::text as last_synced_at
        from ml_ads_operational_daily
        where workspace_id = $1
          and channel = $2
          and metric_date >= $3::date
          and metric_date <= $4::date
      `,
      [workspaceId, channel, range.dateFromKey, range.dateToKey],
    );
    const row = rows[0];
    const dayCount = Number(row?.day_count || 0);
    if (dayCount < expectedDays) return true;

    const lastSyncedAt = row?.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
    if (!lastSyncedAt) return true;

    const staleMs = range.dateToKey >= formatDateKey(new Date())
      ? CURRENT_OPERATIONAL_STALE_MS
      : HISTORICAL_OPERATIONAL_STALE_MS;
    return (Date.now() - lastSyncedAt) > staleMs;
  }

  private async hasOperationalCoverage(workspaceId: string, channel: AdsFinanceChannelKey, range: AdsFinanceRange) {
    const pool = getPool();
    const { rows } = await pool.query<{ day_count: string | number }>(
      `
        select count(distinct metric_date) as day_count
        from ml_ads_operational_daily
        where workspace_id = $1
          and channel = $2
          and metric_date >= $3::date
          and metric_date <= $4::date
      `,
      [workspaceId, channel, range.dateFromKey, range.dateToKey],
    );
    return Number(rows[0]?.day_count || 0) > 0;
  }

  private async syncProductAdsDaily(workspaceId: string, range: AdsFinanceRange) {
    const metrics = await this.adsAutomation.getCampaignMetrics(workspaceId, {
      dateFrom: range.dateFromKey,
      dateTo: range.dateToKey,
    });
    if (!metrics) return;

    const dailyMap = new Map(
      (metrics.daily || []).map((row) => [
        String(row.date),
        {
          cost: toNumber(row.cost, 0),
          revenue: toNumber(row.revenue, 0),
          clicks: toNumber(row.clicks, 0),
          prints: toNumber(row.prints, 0),
          units: toNumber(row.units, 0),
        },
      ]),
    );

    await this.upsertOperationalRows(workspaceId, 'PRODUCT_ADS', null, enumerateDateKeys(range.dateFromKey, range.dateToKey).map((dateKey) => {
      const day = dailyMap.get(dateKey);
      return {
        metricDate: dateKey,
        cost: day?.cost || 0,
        revenue: day?.revenue || 0,
        clicks: day?.clicks || 0,
        prints: day?.prints || 0,
        units: day?.units || 0,
        rawPayload: day || null,
      };
    }));
  }

  private async syncBrandAdsDaily(workspaceId: string, range: AdsFinanceRange) {
    const advertiser = await this.resolveAdvertiserByProduct(workspaceId, 'BADS');
    if (!advertiser) return;

    const response = await requestWithAuth<any>(
      workspaceId,
      `${ADVERTISING_API_BASE}/advertisers/${advertiser.advertiserId}/brand_ads/campaigns/metrics`,
      {
        params: {
          date_from: range.dateFromKey,
          date_to: range.dateToKey,
          aggregation_type: 'total',
        },
        headers: { 'api-version': '1' },
      },
    );

    const dashboard = response?.dashboard || {};
    const costMap = buildDailyMetricMap(dashboard?.consumed_budget);
    const revenueMap = buildDailyMetricMap(dashboard?.attribution_order_amount);
    const clicksMap = buildDailyMetricMap(dashboard?.clicks);
    const printsMap = buildDailyMetricMap(dashboard?.prints);
    const unitsMap = buildDailyMetricMap(dashboard?.attribution_order_conversions);

    await this.upsertOperationalRows(workspaceId, 'BRAND_ADS', advertiser.advertiserId, enumerateDateKeys(range.dateFromKey, range.dateToKey).map((dateKey) => ({
      metricDate: dateKey,
      cost: costMap.get(dateKey) || 0,
      revenue: revenueMap.get(dateKey) || 0,
      clicks: clicksMap.get(dateKey) || 0,
      prints: printsMap.get(dateKey) || 0,
      units: unitsMap.get(dateKey) || 0,
      rawPayload: {
        consumed_budget: costMap.get(dateKey) || 0,
        attribution_order_amount: revenueMap.get(dateKey) || 0,
        clicks: clicksMap.get(dateKey) || 0,
        prints: printsMap.get(dateKey) || 0,
        attribution_order_conversions: unitsMap.get(dateKey) || 0,
      },
    })));
  }

  private async resolveAdvertiserByProduct(workspaceId: string, productId: string) {
    const apiVersions = ['1', '2'];
    for (const apiVersion of apiVersions) {
      try {
        const response = await requestWithAuth<any>(
          workspaceId,
          `${ADVERTISING_API_BASE}/advertisers`,
          {
            params: { product_id: productId },
            headers: { 'api-version': apiVersion },
          },
        );
        const list = normalizeAdvertiserList(response);
        const advertiser = list[0];
        if (!advertiser) continue;
        return {
          advertiserId: String(
            advertiser?.advertiser_id || advertiser?.advertiserId || advertiser?.id || '',
          ).trim(),
          siteId: String(advertiser?.site_id || advertiser?.siteId || DEFAULT_SITE_ID).trim() || DEFAULT_SITE_ID,
        };
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403 || status === 404) continue;
        throw err;
      }
    }
    return null;
  }

  private async upsertOperationalRows(
    workspaceId: string,
    channel: AdsFinanceChannelKey,
    advertiserId: string | null,
    rows: Array<{
      metricDate: string;
      cost: number;
      revenue: number;
      clicks: number;
      prints: number;
      units: number;
      rawPayload: unknown;
    }>,
  ) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const row of rows) {
        await client.query(
          `
            insert into ml_ads_operational_daily (
              workspace_id,
              channel,
              metric_date,
              advertiser_id,
              currency_id,
              cost,
              revenue,
              clicks,
              prints,
              units,
              raw_payload,
              last_synced_at,
              updated_at
            ) values ($1, $2, $3::date, $4, 'BRL', $5, $6, $7, $8, $9, $10::jsonb, now(), now())
            on conflict (workspace_id, channel, metric_date) do update set
              advertiser_id = excluded.advertiser_id,
              cost = excluded.cost,
              revenue = excluded.revenue,
              clicks = excluded.clicks,
              prints = excluded.prints,
              units = excluded.units,
              raw_payload = excluded.raw_payload,
              last_synced_at = now(),
              updated_at = now()
          `,
          [
            workspaceId,
            channel,
            row.metricDate,
            advertiserId,
            roundMoney(row.cost),
            roundMoney(row.revenue),
            Math.round(row.clicks),
            Math.round(row.prints),
            Math.round(row.units),
            JSON.stringify(row.rawPayload),
          ],
        );
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  private async loadOperationalRows(workspaceId: string, range: AdsFinanceRange) {
    const pool = getPool();
    const { rows } = await pool.query<OperationalRow>(
      `
        select channel, metric_date::text, cost, last_synced_at::text
        from ml_ads_operational_daily
        where workspace_id = $1
          and metric_date >= $2::date
          and metric_date <= $3::date
      `,
      [workspaceId, range.dateFromKey, range.dateToKey],
    );
    return rows;
  }

  private async loadBillingDetailRows(workspaceId: string, range: AdsFinanceRange) {
    const pool = getPool();
    const { rows } = await pool.query<BillingDetailRow>(
      `
        select line_kind, channel, line_amount, created_at::text
        from ml_ads_billing_detail_lines
        where workspace_id = $1
          and created_at >= $2::timestamptz
          and created_at < ($3::date + interval '1 day')
      `,
      [workspaceId, `${range.dateFromKey}T00:00:00-03:00`, range.dateToKey],
    );
    return rows;
  }

  private async loadBillingLines(workspaceId: string, periodKeys: string[]) {
    if (!periodKeys.length) return [];
    const pool = getPool();
    const { rows } = await pool.query<BillingLineRow>(
      `
        select period_key::text, line_kind, channel, line_amount
        from ml_ads_billing_summary_lines
        where workspace_id = $1
          and period_key = any($2::date[])
      `,
      [workspaceId, periodKeys],
    );
    return rows;
  }

  private estimateBilledAmountFromSummary(
    billingRows: BillingLineRow[],
    channelKey: AdsFinanceChannelKey,
    billingPeriods: BillingPeriodRow[],
    operationalChannelMap: Map<string, number> | undefined,
    range: AdsFinanceRange,
    todayDateKey: string,
  ) {
    let billedAmount = 0;

    for (const period of billingPeriods) {
      const periodChannelAmount = billingRows
        .filter((row) => row.period_key === period.period_key && row.channel === channelKey && row.line_kind === 'charge')
        .reduce((sum, row) => sum + toNumber(row.line_amount, 0), 0);

      if (!periodChannelAmount) continue;

      const billedWindowDateTo = String(period.period_status || '').toUpperCase() === 'OPEN'
        ? [period.period_date_to, todayDateKey].sort()[0]
        : period.period_date_to;
      const fullBilledWindowCovered =
        range.dateFromKey <= period.period_date_from &&
        range.dateToKey >= billedWindowDateTo;

      if (fullBilledWindowCovered) {
        billedAmount += periodChannelAmount;
        continue;
      }

      const overlap = intersectRange(range.dateFromKey, range.dateToKey, period.period_date_from, billedWindowDateTo);
      const totalDays = countDaysInclusive(period.period_date_from, billedWindowDateTo);
      const overlapDays = countDaysInclusive(overlap.from, overlap.to);
      const fullOperational = this.sumOperationalRange(operationalChannelMap, period.period_date_from, billedWindowDateTo);
      const overlapOperational = this.sumOperationalRange(operationalChannelMap, overlap.from, overlap.to);
      const hasFullOperationalCoverage = this.hasOperationalCoverageForWindow(
        operationalChannelMap,
        period.period_date_from,
        billedWindowDateTo,
      );
      const ratio = hasFullOperationalCoverage && fullOperational > 0
        ? Math.max(0, Math.min(1, overlapOperational / fullOperational))
        : Math.max(0, Math.min(1, overlapDays / totalDays));
      billedAmount += periodChannelAmount * ratio;
    }

    return roundMoney(billedAmount);
  }

  private sumOperationalRange(channelMap: Map<string, number> | undefined, dateFromKey: string, dateToKey: string) {
    if (!channelMap || channelMap.size === 0) return 0;
    let total = 0;
    for (const dateKey of enumerateDateKeys(dateFromKey, dateToKey)) {
      total += toNumber(channelMap.get(dateKey), 0);
    }
    return roundMoney(total);
  }

  private hasOperationalCoverageForWindow(channelMap: Map<string, number> | undefined, dateFromKey: string, dateToKey: string) {
    if (!channelMap || channelMap.size === 0) return false;
    const expectedDates = enumerateDateKeys(dateFromKey, dateToKey);
    return expectedDates.every((dateKey) => channelMap.has(dateKey));
  }
}
