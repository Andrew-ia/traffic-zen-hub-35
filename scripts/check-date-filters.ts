#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { SUPABASE_DATABASE_URL, META_WORKSPACE_ID } = process.env;

async function main() {
    const client = new Client({ connectionString: SUPABASE_DATABASE_URL });
    await client.connect();

    try {
        console.log('\n=== Verificando filtro de data ===\n');

        // Verificar range de datas disponíveis
        const dateRange = await client.query(`
      SELECT 
        MIN(metric_date) as min_date,
        MAX(metric_date) as max_date,
        COUNT(DISTINCT metric_date) as total_days
      FROM performance_metrics
      WHERE workspace_id = $1
        AND platform_account_id IN (
          SELECT id FROM platform_accounts 
          WHERE workspace_id = $1 AND platform_key = 'meta'
        )
        AND granularity = 'day'
    `, [META_WORKSPACE_ID]);

        console.log('📅 Range de datas disponíveis:');
        console.log(`  - Data mínima: ${dateRange.rows[0].min_date}`);
        console.log(`  - Data máxima: ${dateRange.rows[0].max_date}`);
        console.log(`  - Total de dias: ${dateRange.rows[0].total_days}`);

        // Testar diferentes filtros de data
        const filters = [7, 30];

        for (const days of filters) {
            console.log(`\n📊 Métricas com filtro de ${days} dias:`);

            const metrics = await client.query(`
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
              AND pm.metric_date >= CURRENT_DATE - $2::int
              AND pm.metric_date < CURRENT_DATE
          ) t WHERE rn = 1
        )
        SELECT
          SUM(spend)::float8 as total_spend,
          SUM(impressions)::float8 as total_impressions,
          SUM(clicks)::float8 as total_clicks,
          SUM(reach)::float8 as total_reach,
          COUNT(DISTINCT campaign_id) as campaign_count,
          COUNT(DISTINCT metric_date) as date_count,
          MIN(metric_date) as min_date,
          MAX(metric_date) as max_date
        FROM pm_dedup
      `, [META_WORKSPACE_ID, days]);

            const m = metrics.rows[0];
            console.log(`  - Investimento: R$ ${Number(m.total_spend || 0).toFixed(2)}`);
            console.log(`  - Impressões: ${Number(m.total_impressions || 0).toLocaleString('pt-BR')}`);
            console.log(`  - Cliques: ${Number(m.total_clicks || 0).toLocaleString('pt-BR')}`);
            console.log(`  - Alcance: ${Number(m.total_reach || 0).toLocaleString('pt-BR')}`);
            console.log(`  - Campanhas: ${m.campaign_count}`);
            console.log(`  - Dias com dados: ${m.date_count}`);
            console.log(`  - Data mínima: ${m.min_date}`);
            console.log(`  - Data máxima: ${m.max_date}`);
        }

        // Verificar se há duplicatas
        console.log('\n🔍 Verificando duplicatas:');
        const duplicates = await client.query(`
      SELECT 
        campaign_id,
        metric_date,
        COUNT(*) as count,
        ARRAY_AGG(synced_at ORDER BY synced_at DESC) as synced_dates,
        ARRAY_AGG(spend ORDER BY synced_at DESC) as spend_values
      FROM performance_metrics
      WHERE workspace_id = $1
        AND platform_account_id IN (
          SELECT id FROM platform_accounts 
          WHERE workspace_id = $1 AND platform_key = 'meta'
        )
        AND granularity = 'day'
        AND ad_set_id IS NULL
        AND ad_id IS NULL
        AND metric_date >= CURRENT_DATE - 7
      GROUP BY campaign_id, metric_date
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `, [META_WORKSPACE_ID]);

        if (duplicates.rows.length > 0) {
            console.log(`  ⚠️  Encontradas ${duplicates.rows.length} duplicatas!`);
            duplicates.rows.forEach(row => {
                console.log(`    - Campaign ID: ${row.campaign_id}, Date: ${row.metric_date}, Count: ${row.count}`);
                console.log(`      Spend values: ${row.spend_values.join(', ')}`);
            });
        } else {
            console.log('  ✅ Nenhuma duplicata encontrada');
        }

    } finally {
        await client.end();
    }
}

main().catch(console.error);
