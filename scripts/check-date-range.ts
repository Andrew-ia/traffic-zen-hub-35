import 'dotenv/config';
import { getPool } from '../server/config/database';

async function checkDateRange() {
    const pool = getPool();
    const workspaceId = '00000000-0000-0000-0000-000000000010';

    // Simular o que o hook faz (últimos 30 dias)
    const days = 30;
    const offsetDays = 0;

    const since = new Date();
    since.setDate(since.getDate() - days - offsetDays);

    console.log(`📅 Buscando dados desde: ${since.toISOString().slice(0, 10)}`);
    console.log(`📅 Até: ${new Date().toISOString().slice(0, 10)}`);

    const result = await pool.query(`
    SELECT 
      COUNT(*) as total_rows,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(spend) as total_spend,
      SUM(conversions) as total_conversions,
      SUM(conversion_value) as total_conversion_value,
      MIN(metric_date) as earliest_date,
      MAX(metric_date) as latest_date
    FROM vw_performance_daily
    WHERE workspace_id = $1
      AND metric_date >= $2
  `, [workspaceId, since.toISOString().slice(0, 10)]);

    console.log('\n📊 Dados dos últimos 30 dias (via VIEW):');
    console.table(result.rows);

    // Check what the frontend would see
    const frontendQuery = await pool.query(`
    SELECT metric_date, impressions, clicks, spend, conversions
    FROM vw_performance_daily
    WHERE workspace_id = $1
      AND metric_date >= $2
    ORDER BY metric_date DESC
    LIMIT 10
  `, [workspaceId, since.toISOString().slice(0, 10)]);

    console.log('\n📋 Últimos 10 dias de dados:');
    console.table(frontendQuery.rows);

    process.exit(0);
}

checkDateRange();
