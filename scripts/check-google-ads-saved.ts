import { getPool } from '../server/config/database.js';

async function checkGoogleAdsData() {
    const pool = getPool();

    const result = await pool.query(`
    SELECT 
      campaign_id_google,
      campaign_name,
      metric_date,
      impressions,
      clicks,
      ROUND(cost_micros/1000000.0, 2) as cost_brl,
      conversions,
      synced_at
    FROM ads_spend_google 
    WHERE workspace_id = $1 
    ORDER BY metric_date DESC 
    LIMIT 10
  `, ['00000000-0000-0000-0000-000000000010']);

    console.log('\n📊 Últimos registros do Google Ads salvos no banco:');
    console.log('═'.repeat(80));
    console.table(result.rows);

    const summary = await pool.query(`
    SELECT 
      COUNT(*) as total_records,
      COUNT(DISTINCT campaign_id_google) as total_campaigns,
      MIN(metric_date) as first_date,
      MAX(metric_date) as last_date,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      ROUND(SUM(cost_micros)/1000000.0, 2) as total_cost_brl
    FROM ads_spend_google 
    WHERE workspace_id = $1
  `, ['00000000-0000-0000-0000-000000000010']);

    console.log('\n📈 Resumo dos dados:');
    console.log('═'.repeat(80));
    console.table(summary.rows);

    process.exit(0);
}

checkGoogleAdsData();
