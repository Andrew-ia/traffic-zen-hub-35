#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { SUPABASE_DATABASE_URL, META_WORKSPACE_ID } = process.env;

async function main() {
    const client = new Client({ connectionString: SUPABASE_DATABASE_URL });
    await client.connect();

    try {
        console.log('\n=== Verificando dados do Meta Ads ===\n');

        // 1. Verificar campanhas
        const campaigns = await client.query(`
      SELECT 
        c.name,
        c.objective,
        c.status,
        COUNT(DISTINCT pm.metric_date) as days_with_data
      FROM campaigns c
      LEFT JOIN performance_metrics pm ON pm.campaign_id = c.id AND pm.granularity = 'day'
      WHERE c.workspace_id = $1
        AND c.platform_account_id IN (
          SELECT id FROM platform_accounts 
          WHERE workspace_id = $1 AND platform_key = 'meta'
        )
      GROUP BY c.id, c.name, c.objective, c.status
      ORDER BY c.name
      LIMIT 10
    `, [META_WORKSPACE_ID]);

        console.log('📊 Campanhas:');
        campaigns.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.objective}) - Status: ${row.status} - Dias com dados: ${row.days_with_data}`);
        });

        // 2. Verificar métricas agregadas dos últimos 7 dias
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
            AND pm.metric_date >= CURRENT_DATE - 7
            AND pm.metric_date < CURRENT_DATE
        ) t WHERE rn = 1
      )
      SELECT
        SUM(spend)::float8 as total_spend,
        SUM(impressions)::float8 as total_impressions,
        SUM(clicks)::float8 as total_clicks,
        SUM(reach)::float8 as total_reach,
        COUNT(DISTINCT campaign_id) as campaign_count,
        COUNT(DISTINCT metric_date) as date_count
      FROM pm_dedup
    `, [META_WORKSPACE_ID]);

        console.log('\n💰 Métricas agregadas (últimos 7 dias):');
        const m = metrics.rows[0];
        console.log(`  - Investimento: R$ ${Number(m.total_spend || 0).toFixed(2)}`);
        console.log(`  - Impressões: ${Number(m.total_impressions || 0).toLocaleString('pt-BR')}`);
        console.log(`  - Cliques: ${Number(m.total_clicks || 0).toLocaleString('pt-BR')}`);
        console.log(`  - Alcance: ${Number(m.total_reach || 0).toLocaleString('pt-BR')}`);
        console.log(`  - Campanhas: ${m.campaign_count}`);
        console.log(`  - Dias com dados: ${m.date_count}`);

        // 3. Verificar dados por campanha (últimos 7 dias)
        const campaignMetrics = await client.query(`
      WITH pm_dedup AS (
        SELECT * FROM (
          SELECT
            pm.*,
            c.name as campaign_name,
            c.objective,
            ROW_NUMBER() OVER (
              PARTITION BY pm.platform_account_id, pm.campaign_id, pm.metric_date
              ORDER BY pm.synced_at DESC NULLS LAST
            ) as rn
          FROM performance_metrics pm
          JOIN campaigns c ON c.id = pm.campaign_id
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
        campaign_name,
        objective,
        SUM(spend)::float8 as spend,
        SUM(impressions)::float8 as impressions,
        SUM(clicks)::float8 as clicks,
        SUM(reach)::float8 as reach,
        COUNT(DISTINCT metric_date) as days
      FROM pm_dedup
      GROUP BY campaign_id, campaign_name, objective
      ORDER BY spend DESC
      LIMIT 10
    `, [META_WORKSPACE_ID]);

        console.log('\n📈 Top 10 campanhas por investimento (últimos 7 dias):');
        campaignMetrics.rows.forEach(row => {
            console.log(`  - ${row.campaign_name} (${row.objective})`);
            console.log(`    Investimento: R$ ${Number(row.spend || 0).toFixed(2)}`);
            console.log(`    Impressões: ${Number(row.impressions || 0).toLocaleString('pt-BR')}`);
            console.log(`    Cliques: ${Number(row.clicks || 0).toLocaleString('pt-BR')}`);
            console.log(`    Alcance: ${Number(row.reach || 0).toLocaleString('pt-BR')}`);
            console.log(`    Dias: ${row.days}`);
            console.log('');
        });

        // 4. Verificar actions (conversões) nos extra_metrics
        const actions = await client.query(`
      WITH pm_dedup AS (
        SELECT * FROM (
          SELECT
            pm.*,
            c.name as campaign_name,
            c.objective,
            ROW_NUMBER() OVER (
              PARTITION BY pm.platform_account_id, pm.campaign_id, pm.metric_date
              ORDER BY pm.synced_at DESC NULLS LAST
            ) as rn
          FROM performance_metrics pm
          JOIN campaigns c ON c.id = pm.campaign_id
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
      ),
      actions_expanded AS (
        SELECT
          campaign_name,
          objective,
          metric_date,
          action->>'action_type' as action_type,
          (action->>'value')::numeric as value
        FROM pm_dedup
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(extra_metrics->'actions', '[]'::jsonb)) as action
      )
      SELECT
        campaign_name,
        objective,
        action_type,
        SUM(value)::float8 as total_value
      FROM actions_expanded
      GROUP BY campaign_name, objective, action_type
      HAVING SUM(value) > 0
      ORDER BY campaign_name, total_value DESC
      LIMIT 50
    `, [META_WORKSPACE_ID]);

        console.log('\n🎯 Actions/Conversões por campanha (últimos 7 dias):');
        let currentCampaign = '';
        actions.rows.forEach(row => {
            if (row.campaign_name !== currentCampaign) {
                currentCampaign = row.campaign_name;
                console.log(`\n  ${row.campaign_name} (${row.objective}):`);
            }
            console.log(`    - ${row.action_type}: ${Number(row.total_value || 0).toLocaleString('pt-BR')}`);
        });

    } finally {
        await client.end();
    }
}

main().catch(console.error);
