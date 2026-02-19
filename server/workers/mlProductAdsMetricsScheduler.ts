import { getPool } from '../config/database.js';
import {
  ensureProductAdsMetricsSchema,
  hasProductAdsMetrics,
  syncProductAdsMetricsForWorkspace,
} from '../services/mercadolivre/product-ads-metrics.service.js';

const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';

const ENABLED = String(process.env.ML_PRODUCT_ADS_METRICS_ENABLED || 'true').toLowerCase() !== 'false';
const CHECK_INTERVAL_MS = Math.max(1, Number(process.env.ML_PRODUCT_ADS_METRICS_INTERVAL_MINUTES || 60)) * 60 * 1000;
const DAILY_HOUR = Number(process.env.ML_PRODUCT_ADS_METRICS_DAILY_HOUR || 3);
const DAILY_MINUTE = Number(process.env.ML_PRODUCT_ADS_METRICS_DAILY_MINUTE || 30);
const SNAPSHOT_DAYS = Math.max(1, Number(process.env.ML_PRODUCT_ADS_METRICS_DAYS || 30));

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

export function startMLProductAdsMetricsScheduler() {
  if (!ENABLED) {
    console.log('[ML Product Ads Metrics] Scheduler disabled');
    return;
  }

  console.log('[ML Product Ads Metrics] Scheduler started');
  checkAndRun();
  setInterval(checkAndRun, CHECK_INTERVAL_MS);
}

async function checkAndRun() {
  const now = new Date();
  const { hour, minute } = getBrazilParts(now);
  if (hour === DAILY_HOUR && minute === DAILY_MINUTE) {
    await runDailySync();
  }
}

async function runDailySync() {
  await ensureProductAdsMetricsSchema();
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
    console.error('[ML Product Ads Metrics] Failed to load workspaces:', err);
    return;
  }

  if (!workspaces.length) return;

  const dateKey = getBrazilDateKey(new Date());

  for (const row of workspaces) {
    const workspaceId = String(row.workspace_id);
    try {
      const already = await hasProductAdsMetrics(workspaceId, dateKey);
      if (already) continue;
      await syncProductAdsMetricsForWorkspace(workspaceId, { date: dateKey, days: SNAPSHOT_DAYS });
      console.log(`[ML Product Ads Metrics] Snapshot ok for workspace ${workspaceId} (${dateKey})`);
    } catch (err) {
      console.error(`[ML Product Ads Metrics] Snapshot failed for workspace ${workspaceId}:`, err);
    }
  }
}
