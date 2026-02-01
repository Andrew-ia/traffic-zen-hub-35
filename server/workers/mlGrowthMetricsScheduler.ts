import { getPool } from '../config/database.js';
import { getMercadoLivreCredentials, requestWithAuth } from '../api/integrations/mercadolivre.js';
import { syncMercadoLivreOrders } from '../services/mercadolivre/analytics-30d.service.js';
import { ensureGrowthMetricsSchema } from '../services/mercadolivre/growth-metrics.service.js';

const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const ENABLED = String(process.env.ML_GROWTH_METRICS_ENABLED || 'true').toLowerCase() !== 'false';
const CHECK_INTERVAL_MS = Math.max(1, Number(process.env.ML_GROWTH_SYNC_INTERVAL_MINUTES || 60)) * 60 * 1000;
const HOURLY_SYNC_DAYS = Math.max(1, Number(process.env.ML_GROWTH_HOURLY_DAYS || 2));
const HOURLY_LOOKBACK_HOURS = Math.max(1, Number(process.env.ML_GROWTH_HOURLY_LOOKBACK_HOURS || 48));
const DAILY_HOUR = Number(process.env.ML_GROWTH_DAILY_HOUR || 2);
const DAILY_MINUTE = Number(process.env.ML_GROWTH_DAILY_MINUTE || 10);
const VISITS_MAX_ITEMS = Math.max(1, Number(process.env.ML_DAILY_VISITS_MAX_ITEMS || 500));
const VISITS_CONCURRENCY = Math.max(1, Number(process.env.ML_DAILY_VISITS_CONCURRENCY || 5));
const VISITS_STATUSES = String(process.env.ML_DAILY_VISITS_STATUSES || 'active,paused')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const getBrazilParts = (date: Date) => {
  const parts = dateTimeFormatter.formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: map.get('year') || '1970',
    month: map.get('month') || '01',
    day: map.get('day') || '01',
    hour: Number(map.get('hour') || 0),
    minute: Number(map.get('minute') || 0),
  };
};

const getBrazilDateKey = (date: Date) => {
  const parts = getBrazilParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const toBrazilDayBoundary = (dateKey: string, endOfDay: boolean) => {
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${dateKey}T${time}-03:00`);
};


export function startMercadoLivreGrowthMetricsScheduler() {
  if (!ENABLED) {
    console.log('[ML Growth Metrics] Scheduler disabled');
    return;
  }

  console.log('[ML Growth Metrics] Scheduler started');
  checkAndRun();
  setInterval(checkAndRun, CHECK_INTERVAL_MS);
}

async function checkAndRun() {
  const now = new Date();
  const { hour, minute } = getBrazilParts(now);

  if (minute === 0) {
    await runHourlySync();
  }

  if (hour === DAILY_HOUR && minute === DAILY_MINUTE) {
    await runDailySync();
  }
}

async function runHourlySync() {
  await ensureGrowthMetricsSchema();
  const pool = getPool();
  let workspaces: Array<{ workspace_id: string }> = [];

  try {
    const res = await pool.query(
      `select distinct workspace_id
       from integration_credentials
       where platform_key = $1`,
      ['mercadolivre'],
    );
    workspaces = res.rows || [];
  } catch (err) {
    console.error('[ML Growth Metrics] Failed to load workspaces:', err);
    return;
  }

  for (const row of workspaces) {
    const workspaceId = String(row.workspace_id);
    try {
      await syncMercadoLivreOrders(workspaceId, HOURLY_SYNC_DAYS);
      await upsertHourlyMetrics(workspaceId);
      console.log(`[ML Growth Metrics] Hourly sync ok for workspace ${workspaceId}`);
    } catch (err) {
      console.error(`[ML Growth Metrics] Hourly sync failed for workspace ${workspaceId}:`, err);
    }
  }
}

async function runDailySync() {
  await ensureGrowthMetricsSchema();
  const pool = getPool();
  let workspaces: Array<{ workspace_id: string }> = [];

  try {
    const res = await pool.query(
      `select distinct workspace_id
       from integration_credentials
       where platform_key = $1`,
      ['mercadolivre'],
    );
    workspaces = res.rows || [];
  } catch (err) {
    console.error('[ML Growth Metrics] Failed to load workspaces (daily):', err);
    return;
  }

  if (!workspaces.length) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = getBrazilDateKey(yesterday);

  for (const row of workspaces) {
    const workspaceId = String(row.workspace_id);
    try {
      const already = await hasDailyMetrics(workspaceId, dateKey);
      if (already) continue;

      const credentials = await getMercadoLivreCredentials(workspaceId);
      const userId = credentials?.userId || (credentials as any)?.user_id;
      if (!userId) {
        console.warn(`[ML Growth Metrics] Workspace ${workspaceId} sem credenciais`);
        continue;
      }

      await syncDailyVisits(workspaceId, String(userId), dateKey);
      await upsertDailyAccountMetrics(workspaceId, String(userId), dateKey);
      console.log(`[ML Growth Metrics] Daily metrics ok for workspace ${workspaceId} (${dateKey})`);
    } catch (err) {
      console.error(`[ML Growth Metrics] Daily metrics failed for workspace ${workspaceId}:`, err);
    }
  }
}

async function hasDailyMetrics(workspaceId: string, dateKey: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `select 1 from ml_account_metrics_daily where workspace_id = $1 and metric_date = $2 limit 1`,
    [workspaceId, dateKey],
  );
  return rows.length > 0;
}

async function upsertHourlyMetrics(workspaceId: string) {
  const pool = getPool();
  const dateTo = new Date();
  const dateFrom = new Date(dateTo.getTime() - HOURLY_LOOKBACK_HOURS * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `
      select
        date_trunc('hour', o.date_created) as metric_hour,
        count(distinct o.order_id) filter (where lower(o.status) not in ('cancelled','canceled')) as orders,
        coalesce(sum(oi.quantity) filter (where lower(o.status) not in ('cancelled','canceled')), 0) as units,
        coalesce(sum(oi.total_amount) filter (where lower(o.status) not in ('cancelled','canceled')), 0) as revenue
      from ml_orders o
      left join ml_order_items oi
        on oi.workspace_id = o.workspace_id and oi.order_id = o.order_id
      where o.workspace_id = $1
        and o.date_created between $2 and $3
      group by metric_hour
    `,
    [workspaceId, dateFrom, dateTo],
  );

  for (const row of rows) {
    await pool.query(
      `
        insert into ml_sales_hourly (
          workspace_id, metric_hour, orders, units, revenue, updated_at
        ) values ($1, $2, $3, $4, $5, now())
        on conflict (workspace_id, metric_hour) do update set
          orders = excluded.orders,
          units = excluded.units,
          revenue = excluded.revenue,
          updated_at = now()
      `,
      [
        workspaceId,
        row.metric_hour,
        Number(row.orders || 0),
        Number(row.units || 0),
        Number(row.revenue || 0),
      ],
    );
  }
}

async function syncDailyVisits(workspaceId: string, userId: string, dateKey: string) {
  const pool = getPool();
  const itemIds = await fetchItemIds(workspaceId, userId, VISITS_MAX_ITEMS);
  if (itemIds.length === 0) return;

  let index = 0;
  const concurrency = Math.max(1, Math.min(VISITS_CONCURRENCY, itemIds.length));

  const worker = async () => {
    while (index < itemIds.length) {
      const itemId = itemIds[index++];
      if (!itemId) continue;
      try {
        const data = await requestWithAuth<any>(
          workspaceId,
          `${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`,
          { params: { date_from: dateKey, date_to: dateKey } },
        );
        const visits = Number(data?.total_visits ?? data?.total ?? 0);
        await pool.query(
          `
            insert into ml_item_visits_daily (
              workspace_id, item_id, visit_date, visits, updated_at
            ) values ($1, $2, $3, $4, now())
            on conflict (workspace_id, item_id, visit_date) do update set
              visits = excluded.visits,
              updated_at = now()
          `,
          [workspaceId, itemId, dateKey, visits],
        );
      } catch (err) {
        console.warn(`[ML Growth Metrics] Falha visitas item ${itemId}:`, err);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function fetchItemIds(workspaceId: string, userId: string, limit: number) {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const status of VISITS_STATUSES) {
    let offset = 0;
    let hasMore = true;
    while (hasMore && ids.length < limit) {
      try {
        const resp = await requestWithAuth<any>(
          workspaceId,
          `${MERCADO_LIVRE_API_BASE}/users/${userId}/items/search`,
          { params: { status, limit: 50, offset } },
        );
        const results: string[] = resp?.results || [];
        for (const id of results) {
          if (!seen.has(id)) {
            ids.push(id);
            seen.add(id);
          }
          if (ids.length >= limit) break;
        }
        offset += 50;
        const total = Number(resp?.paging?.total || 0);
        if (results.length < 50 || offset >= total) {
          hasMore = false;
        }
      } catch (err) {
        console.warn(`[ML Growth Metrics] Falha ao buscar itens (${status}):`, err);
        hasMore = false;
      }
    }
  }

  return ids.slice(0, limit);
}

async function upsertDailyAccountMetrics(workspaceId: string, userId: string, dateKey: string) {
  const pool = getPool();
  const dateFrom = toBrazilDayBoundary(dateKey, false);
  const dateTo = toBrazilDayBoundary(dateKey, true);

  const { rows: orderRows } = await pool.query(
    `
      select
        count(distinct o.order_id) filter (where lower(o.status) not in ('cancelled','canceled')) as orders,
        count(distinct o.order_id) filter (where lower(o.status) in ('cancelled','canceled')) as canceled_orders,
        coalesce(sum(oi.quantity) filter (where lower(o.status) not in ('cancelled','canceled')), 0) as units,
        coalesce(sum(oi.total_amount) filter (where lower(o.status) not in ('cancelled','canceled')), 0) as revenue,
        coalesce(sum(oi.total_amount) filter (where lower(o.status) in ('cancelled','canceled')), 0) as canceled_revenue
      from ml_orders o
      left join ml_order_items oi
        on oi.workspace_id = o.workspace_id and oi.order_id = o.order_id
      where o.workspace_id = $1
        and o.date_created between $2 and $3
    `,
    [workspaceId, dateFrom, dateTo],
  );

  const orders = Number(orderRows[0]?.orders || 0);
  const units = Number(orderRows[0]?.units || 0);
  const revenue = Number(orderRows[0]?.revenue || 0);
  const canceledOrders = Number(orderRows[0]?.canceled_orders || 0);
  const canceledRevenue = Number(orderRows[0]?.canceled_revenue || 0);

  const { rows: visitRows } = await pool.query(
    `select coalesce(sum(visits), 0) as visits
     from ml_item_visits_daily
     where workspace_id = $1 and visit_date = $2`,
    [workspaceId, dateKey],
  );
  const visits = Number(visitRows[0]?.visits || 0);

  let responseRate: number | null = null;
  try {
    const questions = await requestWithAuth<any>(
      workspaceId,
      `${MERCADO_LIVRE_API_BASE}/questions/search`,
      { params: { seller_id: userId, limit: 50, sort: 'date_created_desc' } },
    );
    const list = questions?.questions || [];
    if (list.length > 0) {
      const answered = list.filter((q: any) => q?.status === 'ANSWERED').length;
      responseRate = answered / list.length;
    }
  } catch (err) {
    console.warn('[ML Growth Metrics] Falha ao buscar perguntas:', err);
  }

  let reputationLevel: string | null = null;
  let reputationColor: string | null = null;
  let claimsRate: number | null = null;
  let delayedHandlingRate: number | null = null;
  let cancellationsRate: number | null = null;

  try {
    const user = await requestWithAuth<any>(
      workspaceId,
      `${MERCADO_LIVRE_API_BASE}/users/${userId}`,
    );
    const rep = user?.seller_reputation || {};
    reputationLevel = rep?.power_seller_status || null;
    const levelId = String(rep?.level_id || '').toUpperCase();
    if (levelId.includes('GREEN')) reputationColor = 'Verde';
    else if (levelId.includes('YELLOW')) reputationColor = 'Amarelo';
    else if (levelId.includes('ORANGE')) reputationColor = 'Laranja';
    else if (levelId.includes('RED')) reputationColor = 'Vermelho';
    else reputationColor = 'Cinza';

    const metrics = rep?.metrics || {};
    claimsRate = metrics?.claims?.rate ? Number(metrics.claims.rate) * 100 : null;
    delayedHandlingRate = metrics?.delayed_handling_time?.rate ? Number(metrics.delayed_handling_time.rate) * 100 : null;
    cancellationsRate = metrics?.cancellations?.rate ? Number(metrics.cancellations.rate) * 100 : null;
  } catch (err) {
    console.warn('[ML Growth Metrics] Falha ao buscar reputacao:', err);
  }

  await pool.query(
    `
      insert into ml_account_metrics_daily (
        workspace_id, metric_date, visits, orders, units, revenue,
        canceled_orders, canceled_revenue, response_rate,
        reputation_level, reputation_color, claims_rate, delayed_handling_rate, cancellations_rate,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
      on conflict (workspace_id, metric_date) do update set
        visits = excluded.visits,
        orders = excluded.orders,
        units = excluded.units,
        revenue = excluded.revenue,
        canceled_orders = excluded.canceled_orders,
        canceled_revenue = excluded.canceled_revenue,
        response_rate = excluded.response_rate,
        reputation_level = excluded.reputation_level,
        reputation_color = excluded.reputation_color,
        claims_rate = excluded.claims_rate,
        delayed_handling_rate = excluded.delayed_handling_rate,
        cancellations_rate = excluded.cancellations_rate,
        updated_at = now()
    `,
    [
      workspaceId,
      dateKey,
      visits,
      orders,
      units,
      revenue,
      canceledOrders,
      canceledRevenue,
      responseRate,
      reputationLevel,
      reputationColor,
      claimsRate,
      delayedHandlingRate,
      cancellationsRate,
    ],
  );
}
