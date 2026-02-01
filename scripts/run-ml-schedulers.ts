import dotenv from 'dotenv';
import { startFullAnalyticsScheduler } from '../server/workers/fullAnalyticsScheduler.js';
import { startAdsWeeklyReportScheduler } from '../server/workers/adsWeeklyReportScheduler.js';
import { startMercadoLivreDailySummaryScheduler } from '../server/workers/mlDailySummaryScheduler.js';
import { startMercadoLivreGrowthMetricsScheduler } from '../server/workers/mlGrowthMetricsScheduler.js';

dotenv.config({ path: '.env.local' });
process.env.TZ = process.env.SERVER_TIMEZONE || process.env.TZ || 'America/Sao_Paulo';

const hasDbUrl = Boolean(
  process.env.SUPABASE_POOLER_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL,
);

if (!hasDbUrl) {
  console.error('Missing database URL (SUPABASE_POOLER_URL, SUPABASE_DATABASE_URL, or DATABASE_URL)');
  process.exit(1);
}

console.log('Starting Mercado Livre schedulers (local worker)...');
startFullAnalyticsScheduler();
startAdsWeeklyReportScheduler();
startMercadoLivreDailySummaryScheduler();
startMercadoLivreGrowthMetricsScheduler();
console.log('Schedulers running. Keep this process alive.');
