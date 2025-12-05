#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { SUPABASE_DATABASE_URL, META_WORKSPACE_ID } = process.env;

async function main() {
    const client = new Client({ connectionString: SUPABASE_DATABASE_URL });
    await client.connect();

    try {
        console.log('\n=== Comparando queries ===\n');

        // Query 1: Simples (como no check-date-filters.ts)
        const simple = await client.query(`
      WITH pm_dedup AS (
        SELECT * FROM (
          SELECT
            pm.*,
            ROW_NUMBER() OVER (
              PARTITION BY pm.platform_account_id, pm.campaign_id, pm.metric_date
              ORDER BY pm.synced_at DESC NULLS LAST
            ) as rn
          FROM performance_metrics pm
          WHERE pm.workspace_id = $1
            AND pm.platform_account_id IN (
              SELECT id FROM platform_accounts 
              WHERE workspace_id = $1 AND platform_key = 'meta'
            )
            AND pm.granularity = 'day'
            AND pm.ad_set_id IS NULL
            AND pm.ad_id IS NULL
            AND pm.metric_date >= CURRENT_DATE - 7
            AND pm.metric_date < CURRENT_DATE
        ) t WHERE rn = 1
      )
      SELECT
        SUM(spend)::float8 as total_spend,
        SUM(impressions)::float8 as total_impressions,
        SUM(clicks)::float8 as total_clicks,
        COUNT(DISTINCT campaign_id) as campaign_count,
        COUNT(*) as row_count
      FROM pm_dedup
    `, [META_WORKSPACE_ID]);

        console.log('📊 Query Simples (performance_metrics direto):');
        const s = simple.rows[0];
        console.log(`  - Investimento: R$ ${Number(s.total_spend || 0).toFixed(2)}`);
        console.log(`  - Impressões: ${Number(s.total_impressions || 0).toLocaleString('pt-BR')}`);
        console.log(`  - Cliques: ${Number(s.total_clicks || 0).toLocaleString('pt-BR')}`);
        console.log(`  - Campanhas: ${s.campaign_count}`);
        console.log(`  - Total de linhas: ${s.row_count}`);

        // Query 2: Com v_campaign_kpi (como no endpoint)
        const kpi = await client.query(`
      WITH kpi_raw AS (
        SELECT
          kpi.campaign_id,
          kpi.metric_date,
          kpi.spend,
          kpi.result_value,
          kpi.revenue,
          kpi.roas
        FROM v_campaign_kpi kpi
        WHERE kpi.workspace_id = $1
          AND kpi.platform_account_id IN (
            SELECT id FROM platform_accounts 
            WHERE workspace_id = $1 AND platform_key = 'meta'
          )
          AND kpi.metric_date >= CURRENT_DATE - 7
          AND kpi.metric_date < CURRENT_DATE
          AND kpi.ad_set_id IS NULL
          AND kpi.ad_id IS NULL
      ),
      kpi_data AS (
        SELECT DISTINCT ON (campaign_id, metric_date)
          campaign_id,
          metric_date,
          spend,
          result_value,
          revenue,
          roas
        FROM kpi_raw
        ORDER BY campaign_id, metric_date, spend DESC NULLS LAST
      )
      SELECT
        SUM(spend)::float8 as total_spend,
        COUNT(DISTINCT campaign_id) as campaign_count,
        COUNT(*) as row_count
      FROM kpi_data
    `, [META_WORKSPACE_ID]);

        console.log('\n📊 Query com v_campaign_kpi:');
        const k = kpi.rows[0];
        console.log(`  - Investimento: R$ ${Number(k.total_spend || 0).toFixed(2)}`);
        console.log(`  - Campanhas: ${k.campaign_count}`);
        console.log(`  - Total de linhas: ${k.row_count}`);

        // Query 3: Verificar quais campanhas estão sendo incluídas
        console.log('\n📋 Campanhas incluídas na query simples:');
        const simpleCampaigns = await client.query(`
      WITH pm_dedup AS (
        SELECT * FROM (
          SELECT
            pm.*,
            c.name as campaign_name,
            ROW_NUMBER() OVER (
              PARTITION BY pm.platform_account_id, pm.campaign_id, pm.metric_date
              ORDER BY pm.synced_at DESC NULLS LAST
            ) as rn
          FROM performance_metrics pm
          LEFT JOIN campaigns c ON c.id = pm.campaign_id
          WHERE pm.workspace_id = $1
            AND pm.platform_account_id IN (
              SELECT id FROM platform_accounts 
              WHERE workspace_id = $1 AND platform_key = 'meta'
            )
            AND pm.granularity = 'day'
            AND pm.ad_set_id IS NULL
            AND pm.ad_id IS NULL
            AND pm.metric_date >= CURRENT_DATE - 7
            AND pm.metric_date < CURRENT_DATE
        ) t WHERE rn = 1
      )
      SELECT
        COALESCE(campaign_name, '[ACCOUNT LEVEL]') as campaign_name,
        campaign_id,
        COUNT(*) as days,
        SUM(spend)::float8 as spend
      FROM pm_dedup
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
    `, [META_WORKSPACE_ID]);

        simpleCampaigns.rows.forEach(row => {
            console.log(`  - ${row.campaign_name}: R$ ${Number(row.spend || 0).toFixed(2)} (${row.days} dias)`);
        });

        console.log('\n📋 Campanhas incluídas na query com v_campaign_kpi:');
        const kpiCampaigns = await client.query(`
      WITH kpi_raw AS (
        SELECT
          kpi.campaign_id,
          kpi.metric_date,
          kpi.spend,
          c.name as campaign_name
        FROM v_campaign_kpi kpi
        LEFT JOIN campaigns c ON c.id = kpi.campaign_id
        WHERE kpi.workspace_id = $1
          AND kpi.platform_account_id IN (
            SELECT id FROM platform_accounts 
            WHERE workspace_id = $1 AND platform_key = 'meta'
          )
          AND kpi.metric_date >= CURRENT_DATE - 7
          AND kpi.metric_date < CURRENT_DATE
          AND kpi.ad_set_id IS NULL
          AND kpi.ad_id IS NULL
      ),
      kpi_data AS (
        SELECT DISTINCT ON (campaign_id, metric_date)
          campaign_id,
          campaign_name,
          metric_date,
          spend
        FROM kpi_raw
        ORDER BY campaign_id, metric_date, spend DESC NULLS LAST
      )
      SELECT
        COALESCE(campaign_name, '[ACCOUNT LEVEL]') as campaign_name,
        campaign_id,
        COUNT(*) as days,
        SUM(spend)::float8 as spend
      FROM kpi_data
      GROUP BY campaign_id, campaign_name
      ORDER BY spend DESC
    `, [META_WORKSPACE_ID]);

        kpiCampaigns.rows.forEach(row => {
            console.log(`  - ${row.campaign_name}: R$ ${Number(row.spend || 0).toFixed(2)} (${row.days} dias)`);
        });

    } finally {
        await client.end();
    }
}

main().catch(console.error);
