import dotenv from 'dotenv';
import { getPool } from '../../server/config/database.js';
import { ensureGrowthMetricsSchema } from '../../server/services/mercadolivre/growth-metrics.service.js';
import { getMercadoLivreCredentials, requestWithAuth } from '../../server/api/integrations/mercadolivre.js';
import { syncMercadoLivreOrders } from '../../server/services/mercadolivre/analytics-30d.service.js';

dotenv.config({ path: '.env.local' });

const MERCADO_LIVRE_API_BASE = 'https://api.mercadolibre.com';
const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const args = process.argv.slice(2);
const getArg = (key: string, fallback?: string) => {
  const idx = args.findIndex((arg) => arg === key);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
};

const DAYS = Math.max(1, Number(getArg('--days', process.env.ML_GROWTH_BACKFILL_DAYS || '90')));
const DATE_FROM = getArg('--from', process.env.ML_GROWTH_BACKFILL_FROM);
const DATE_TO = getArg('--to', process.env.ML_GROWTH_BACKFILL_TO);
const INCLUDE_TODAY = String(getArg('--include-today', process.env.ML_GROWTH_BACKFILL_INCLUDE_TODAY || '')).toLowerCase() === 'true';
const VISITS_CONCURRENCY = Math.max(1, Number(getArg('--concurrency', process.env.ML_GROWTH_BACKFILL_CONCURRENCY || '2')));
const VISITS_SLEEP_MS = Math.max(0, Number(getArg('--sleep-ms', process.env.ML_GROWTH_BACKFILL_SLEEP_MS || '300')));
const RECENT_FIRST = String(getArg('--recent-first', process.env.ML_GROWTH_BACKFILL_RECENT_FIRST || 'true')).toLowerCase() !== 'false';
const MAX_ITEMS_RAW = Number(getArg('--max-items', process.env.ML_GROWTH_BACKFILL_MAX_ITEMS || '0'));
const MAX_ITEMS = Number.isFinite(MAX_ITEMS_RAW) ? MAX_ITEMS_RAW : 0;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatBrazilDateKey = (date: Date) => dateFormatter.format(date);
const parseBrazilDateKey = (dateKey: string) => new Date(`${dateKey}T12:00:00-03:00`);

const toBrazilDayBoundary = (dateKey: string, endOfDay: boolean) => {
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return new Date(`${dateKey}T${time}-03:00`);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getItemIds(workspaceId: string, userId: string) {
  const ids: string[] = [];
  const seen = new Set<string>();
  const statuses = ['active', 'paused'];

  for (const status of statuses) {
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
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
        if (MAX_ITEMS > 0 && ids.length >= MAX_ITEMS) break;
      }
      offset += 50;
      const total = Number(resp?.paging?.total || 0);
      if (results.length < 50 || offset >= total || (MAX_ITEMS > 0 && ids.length >= MAX_ITEMS)) {
        hasMore = false;
      }
    }
    if (MAX_ITEMS > 0 && ids.length >= MAX_ITEMS) break;
  }

  return ids;
}

async function fetchVisitsForDay(
  workspaceId: string,
  itemId: string,
  dateKey: string,
  retries = 4,
) {
  try {
    const payload = await requestWithAuth<any>(
      workspaceId,
      `${MERCADO_LIVRE_API_BASE}/items/${itemId}/visits`,
      { params: { date_from: dateKey, date_to: dateKey } },
    );
    return Number(payload?.total_visits ?? payload?.total ?? 0);
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 429 && retries > 0) {
      const backoff = (5 - retries) * 1000;
      await sleep(backoff);
      return fetchVisitsForDay(workspaceId, itemId, dateKey, retries - 1);
    }
    throw err;
  }
}

async function backfillVisitsForDate(workspaceId: string, itemIds: string[], dateKey: string) {
  const pool = getPool();
  let index = 0;
  const total = itemIds.length;
  const concurrency = Math.min(VISITS_CONCURRENCY, total);

  const worker = async () => {
    while (index < total) {
      const itemId = itemIds[index++];
      try {
        const visits = await fetchVisitsForDay(workspaceId, itemId, dateKey);
        await pool.query(
          `
            insert into ml_item_visits_daily (
              workspace_id, item_id, visit_date, visits, updated_at
            ) values ($1,$2,$3,$4, now())
            on conflict (workspace_id, item_id, visit_date) do update set
              visits = excluded.visits,
              updated_at = now()
          `,
          [workspaceId, itemId, dateKey, visits],
        );
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 429) {
          console.warn(`[Backfill] Rate limit para item ${itemId} em ${dateKey}, retomando com atraso.`);
          await sleep(2000);
        } else {
          console.warn(`[Backfill] Falha visitas item ${itemId} em ${dateKey}`);
        }
      } finally {
        if (VISITS_SLEEP_MS > 0) {
          await sleep(VISITS_SLEEP_MS);
        }
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function upsertDailyAccountMetrics(workspaceId: string, dateKey: string, userId: string, includeReputation: boolean) {
  const pool = getPool();
  const dateFrom = toBrazilDayBoundary(dateKey, false);
  const dateTo = toBrazilDayBoundary(dateKey, true);

  const { rows } = await pool.query(
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

  const orders = Number(rows[0]?.orders || 0);
  const units = Number(rows[0]?.units || 0);
  const revenue = Number(rows[0]?.revenue || 0);
  const canceledOrders = Number(rows[0]?.canceled_orders || 0);
  const canceledRevenue = Number(rows[0]?.canceled_revenue || 0);

  const { rows: visitRows } = await pool.query(
    `select coalesce(sum(visits), 0) as visits
     from ml_item_visits_daily
     where workspace_id = $1 and visit_date = $2`,
    [workspaceId, dateKey],
  );
  const visits = Number(visitRows[0]?.visits || 0);

  let responseRate: number | null = null;
  let reputationLevel: string | null = null;
  let reputationColor: string | null = null;
  let claimsRate: number | null = null;
  let delayedHandlingRate: number | null = null;
  let cancellationsRate: number | null = null;

  if (includeReputation) {
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
    } catch (error) {
      // Ignore reputation question failures during backfill.
      void error;
    }

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
    } catch (error) {
      // Ignore reputation fetch failures during backfill.
      void error;
    }
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

async function run() {
  const workspaceId =
    process.env.WORKSPACE_ID ||
    process.env.MERCADO_LIVRE_DEFAULT_WORKSPACE_ID ||
    process.env.VITE_WORKSPACE_ID;

  if (!workspaceId) {
    console.error('Workspace ID não encontrado. Defina WORKSPACE_ID ou MERCADO_LIVRE_DEFAULT_WORKSPACE_ID.');
    process.exit(1);
  }

  await ensureGrowthMetricsSchema();

  const creds = await getMercadoLivreCredentials(String(workspaceId));
  const userId = creds?.userId || (creds as any)?.user_id;
  if (!userId) {
    console.error('Credenciais do Mercado Livre não encontradas.');
    process.exit(1);
  }

  let endDate = new Date();
  if (DATE_TO) {
    endDate = parseBrazilDateKey(DATE_TO);
  } else if (!INCLUDE_TODAY) {
    endDate.setDate(endDate.getDate() - 1);
  }
  let startDate = new Date(endDate);
  if (DATE_FROM) {
    startDate = parseBrazilDateKey(DATE_FROM);
  } else {
    startDate.setDate(startDate.getDate() - (DAYS - 1));
  }

  if (startDate > endDate) {
    console.error('Data inicial maior que data final. Verifique --from e --to.');
    process.exit(1);
  }

  const rangeLabel = DATE_FROM || DATE_TO
    ? `${formatBrazilDateKey(startDate)} -> ${formatBrazilDateKey(endDate)}`
    : `ultimos ${DAYS} dias`;

  const todayKey = formatBrazilDateKey(new Date());
  const ordersDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const shouldSyncOrders = !DATE_TO || formatBrazilDateKey(endDate) === todayKey;

  console.log(`🔄 Backfill pedidos (${rangeLabel})...`);
  if (shouldSyncOrders) {
    await syncMercadoLivreOrders(String(workspaceId), ordersDays);
  } else {
    console.log('↪️  Intervalo historico detectado, pulando sync de pedidos.');
  }

  console.log('🔎 Buscando itens do vendedor...');
  const itemIds = await getItemIds(String(workspaceId), String(userId));
  console.log(`Itens encontrados: ${itemIds.length}`);

  const dates: string[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(formatBrazilDateKey(new Date(d)));
  }

  const visitDates = RECENT_FIRST ? [...dates].reverse() : dates;
  for (const dateKey of visitDates) {
    console.log(`📅 ${dateKey}: visitas`);
    await backfillVisitsForDate(String(workspaceId), itemIds, dateKey);
  }

  for (let i = 0; i < dates.length; i += 1) {
    const dateKey = dates[i];
    const includeRep = i === dates.length - 1;
    await upsertDailyAccountMetrics(String(workspaceId), dateKey, String(userId), includeRep);
  }

  console.log('✅ Backfill concluido.');
}

run().catch((err) => {
  console.error('Backfill falhou:', err);
  process.exit(1);
});
