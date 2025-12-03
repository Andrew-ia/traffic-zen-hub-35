import 'dotenv/config';
import { getPool } from '../server/config/database';

async function checkPerformanceData() {
    const pool = getPool();
    const workspaceId = '00000000-0000-0000-0000-000000000010';

    // Check raw performance_metrics table
    const rawData = await pool.query(`
    SELECT 
      COUNT(*) as total_rows,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(spend) as total_spend,
      SUM(conversions) as total_conversions,
      MIN(metric_date) as earliest_date,
      MAX(metric_date) as latest_date
    FROM performance_metrics
    WHERE workspace_id = $1
  `, [workspaceId]);

    console.log('📊 Dados RAW da tabela performance_metrics:');
    console.table(rawData.rows);

    // Check aggregated data (workspace level only)
    const aggregatedData = await pool.query(`
    SELECT 
      COUNT(*) as total_rows,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(spend) as total_spend,
      SUM(conversions) as total_conversions,
      MIN(metric_date) as earliest_date,
      MAX(metric_date) as latest_date
    FROM performance_metrics
    WHERE workspace_id = $1
      AND campaign_id IS NULL
      AND ad_set_id IS NULL
      AND ad_id IS NULL
  `, [workspaceId]);

    console.log('\n📊 Dados AGREGADOS (nível workspace - NULL IDs):');
    console.table(aggregatedData.rows);

    // Check view data
    const viewData = await pool.query(`
    SELECT 
      COUNT(*) as total_rows,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(spend) as total_spend,
      SUM(conversions) as total_conversions,
      MIN(metric_date) as earliest_date,
      MAX(metric_date) as latest_date
    FROM vw_performance_daily
    WHERE workspace_id = $1
  `, [workspaceId]);

    console.log('\n📊 Dados da VIEW vw_performance_daily:');
    console.table(viewData.rows);

    // Sample of recent data
    const sampleData = await pool.query(`
    SELECT metric_date, impressions, clicks, spend, conversions, campaign_id, ad_set_id, ad_id
    FROM performance_metrics
    WHERE workspace_id = $1
    ORDER BY metric_date DESC
    LIMIT 10
  `, [workspaceId]);

    console.log('\n📋 Amostra dos últimos 10 registros:');
    console.table(sampleData.rows);

    process.exit(0);
}

checkPerformanceData();
