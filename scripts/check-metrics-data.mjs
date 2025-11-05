#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.SUPABASE_DATABASE_URL
});

async function checkData() {
  try {
    await client.connect();
    console.log('🔍 Verificando dados de performance_metrics...\n');

    const workspaceId = process.env.META_WORKSPACE_ID || process.env.WORKSPACE_ID || process.env.SUPABASE_WORKSPACE_ID;
    if (!workspaceId) {
      throw new Error('Missing workspace id env. Set META_WORKSPACE_ID or WORKSPACE_ID in .env.local');
    }

    // Resolve Meta platform accounts for the workspace
    const accountRes = await client.query(
      `SELECT array_agg(id)::uuid[] as account_ids
       FROM platform_accounts
       WHERE workspace_id = $1 AND platform_key = 'meta'`,
      [workspaceId]
    );
    const accountIds = accountRes.rows[0]?.account_ids || [];

    // Check date range of available data
    const dateRange = await client.query(
      `SELECT
        MIN(metric_date) as earliest_date,
        MAX(metric_date) as latest_date,
        COUNT(*) as total_records,
        COUNT(DISTINCT campaign_id) as num_campaigns
       FROM performance_metrics
       WHERE workspace_id = $1
         AND platform_account_id = ANY($2)
         AND granularity = 'day'`,
      [workspaceId, accountIds]
    );

    console.log('📅 Intervalo de dados:');
    console.table(dateRange.rows);

    // Check recent data
    const recentData = await client.query(
      `WITH candidates AS (
         SELECT 3 AS priority,
                COALESCE(pm.campaign_id, s.campaign_id) AS cid,
                pm.metric_date,
                pm.spend,
                pm.clicks,
                pm.impressions
         FROM performance_metrics pm
         JOIN ads a ON a.id = pm.ad_id
         JOIN ad_sets s ON s.id = a.ad_set_id
         WHERE pm.workspace_id = $1
           AND pm.platform_account_id = ANY($2)
           AND pm.granularity = 'day'
           AND pm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
           AND pm.ad_id IS NOT NULL
         UNION ALL
         SELECT 2 AS priority,
                COALESCE(pm.campaign_id, s.campaign_id) AS cid,
                pm.metric_date,
                pm.spend,
                pm.clicks,
                pm.impressions
         FROM performance_metrics pm
         JOIN ad_sets s ON s.id = pm.ad_set_id
         WHERE pm.workspace_id = $1
           AND pm.platform_account_id = ANY($2)
           AND pm.granularity = 'day'
           AND pm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
           AND pm.ad_id IS NULL AND pm.ad_set_id IS NOT NULL
         UNION ALL
         SELECT 1 AS priority,
                pm.campaign_id AS cid,
                pm.metric_date,
                pm.spend,
                pm.clicks,
                pm.impressions
         FROM performance_metrics pm
         WHERE pm.workspace_id = $1
           AND pm.platform_account_id = ANY($2)
           AND pm.granularity = 'day'
           AND pm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
           AND pm.ad_id IS NULL AND pm.ad_set_id IS NULL
       ),
       pm AS (
         SELECT DISTINCT ON (cid, metric_date)
                cid,
                metric_date,
                spend,
                clicks,
                impressions
         FROM candidates
         WHERE cid IS NOT NULL
         ORDER BY cid, metric_date, priority DESC
       )
       SELECT pm.metric_date,
              COUNT(DISTINCT cid) AS num_campaigns,
              SUM(spend) AS total_spend,
              SUM(clicks) AS total_clicks,
              SUM(impressions) AS total_impressions
       FROM pm
       GROUP BY pm.metric_date
       ORDER BY pm.metric_date DESC`,
      [workspaceId, accountIds]
    );

    console.log('\n📊 Dados dos últimos 7 dias:');
    if (recentData.rows.length > 0) {
      console.table(recentData.rows);
    } else {
      console.log('❌ Nenhum dado encontrado nos últimos 7 dias\n');

      // Check if there's any data at all
      const anyData = await client.query(
        `SELECT metric_date, COUNT(*) as records
         FROM performance_metrics
         WHERE workspace_id = $1
         ORDER BY metric_date DESC
         LIMIT 5`,
        [workspaceId]
      );

      if (anyData.rows.length > 0) {
        console.log('💡 Dados mais recentes disponíveis:');
        console.table(anyData.rows);
        console.log('\n⚠️  Os dados estão desatualizados!');
        console.log('   Execute a sincronização:');
        console.log('   npm run server:sync-meta');
      } else {
        console.log('❌ Nenhum dado encontrado na tabela performance_metrics!');
        console.log('   Execute a sincronização inicial.');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkData();
