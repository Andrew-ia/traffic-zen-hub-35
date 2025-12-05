#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { SUPABASE_DATABASE_URL, META_WORKSPACE_ID } = process.env;

async function main() {
    const client = new Client({ connectionString: SUPABASE_DATABASE_URL });
    await client.connect();

    try {
        console.log('\n=== Verificando dados de ACCOUNT LEVEL ===\n');

        // Dados diretos de performance_metrics
        console.log('📊 Dados de performance_metrics (ACCOUNT LEVEL):');
        const pm = await client.query(`
      SELECT 
        metric_date,
        COUNT(*) as row_count,
        SUM(spend)::float8 as spend,
        ARRAY_AGG(synced_at ORDER BY synced_at DESC) as synced_dates
      FROM performance_metrics
      WHERE workspace_id = $1
        AND platform_account_id IN (
          SELECT id FROM platform_accounts 
          WHERE workspace_id = $1 AND platform_key = 'meta'
        )
        AND granularity = 'day'
        AND campaign_id IS NULL
        AND ad_set_id IS NULL
        AND ad_id IS NULL
        AND metric_date >= CURRENT_DATE - 7
        AND metric_date < CURRENT_DATE
      GROUP BY metric_date
      ORDER BY metric_date DESC
    `, [META_WORKSPACE_ID]);

        pm.rows.forEach(row => {
            console.log(`  ${row.metric_date}: R$ ${Number(row.spend || 0).toFixed(2)} (${row.row_count} rows)`);
        });

        // Dados da view v_campaign_kpi
        console.log('\n📊 Dados de v_campaign_kpi (ACCOUNT LEVEL):');
        const kpi = await client.query(`
      SELECT 
        metric_date,
        COUNT(*) as row_count,
        SUM(spend)::float8 as spend
      FROM v_campaign_kpi
      WHERE workspace_id = $1
        AND platform_account_id IN (
          SELECT id FROM platform_accounts 
          WHERE workspace_id = $1 AND platform_key = 'meta'
        )
        AND campaign_id IS NULL
        AND ad_set_id IS NULL
        AND ad_id IS NULL
        AND metric_date >= CURRENT_DATE - 7
        AND metric_date < CURRENT_DATE
      GROUP BY metric_date
      ORDER BY metric_date DESC
    `, [META_WORKSPACE_ID]);

        kpi.rows.forEach(row => {
            console.log(`  ${row.metric_date}: R$ ${Number(row.spend || 0).toFixed(2)} (${row.row_count} rows)`);
        });

        // Comparar totais
        const pmTotal = pm.rows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
        const kpiTotal = kpi.rows.reduce((sum, row) => sum + Number(row.spend || 0), 0);

        console.log(`\n📊 Totais:`);
        console.log(`  - performance_metrics: R$ ${pmTotal.toFixed(2)} (${pm.rows.length} dias)`);
        console.log(`  - v_campaign_kpi: R$ ${kpiTotal.toFixed(2)} (${kpi.rows.length} dias)`);
        console.log(`  - Diferença: R$ ${(pmTotal - kpiTotal).toFixed(2)}`);

    } finally {
        await client.end();
    }
}

main().catch(console.error);
