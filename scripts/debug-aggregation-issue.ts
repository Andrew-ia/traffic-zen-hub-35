#!/usr/bin/env tsx
import { Client } from 'pg';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config({ path: '.env.local' });

function parseDatabaseConfig(databaseUrl: string) {
    const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//, 'http://');
    const parsed = new URL(normalized);
    return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 5432,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, ''),
    };
}

async function main() {
    const databaseUrl = process.env.SUPABASE_DATABASE_URL;
    const workspaceId = process.env.META_WORKSPACE_ID;

    if (!databaseUrl || !workspaceId) {
        throw new Error('Missing SUPABASE_DATABASE_URL or META_WORKSPACE_ID');
    }

    const needsSsl = /supabase\.co/.test(databaseUrl);
    const dbConfig = parseDatabaseConfig(databaseUrl);
    const client = new Client({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
        database: dbConfig.database,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        lookup: (hostname: any, options: any, callback: any) => dns.lookup(hostname, { ...options, family: 4 }, callback),
    });

    await client.connect();

    try {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);

        console.log('\n=== ANÁLISE DE DUPLICAÇÃO DE MÉTRICAS ===\n');
        console.log(`Período: ${sinceStr} até hoje\n`);

        // 1. Total por nível
        console.log('1. TOTAL DE GASTO POR NÍVEL:');
        const byLevel = await client.query(
            `SELECT 
        CASE 
          WHEN campaign_id IS NULL AND ad_set_id IS NULL AND ad_id IS NULL THEN 'account'
          WHEN ad_set_id IS NULL AND ad_id IS NULL THEN 'campaign'
          WHEN ad_id IS NULL THEN 'adset'
          ELSE 'ad'
        END as level,
        COUNT(*) as count,
        SUM(spend) as total_spend,
        COUNT(DISTINCT metric_date) as unique_dates,
        COUNT(DISTINCT campaign_id) as unique_campaigns
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
      GROUP BY level
      ORDER BY total_spend DESC`,
            [workspaceId, sinceStr]
        );
        console.table(byLevel.rows);

        // 2. Verificar se há duplicação para a mesma data
        console.log('\n2. VERIFICAR DUPLICAÇÃO POR DATA:');
        const duplicates = await client.query(
            `SELECT 
        metric_date,
        campaign_id,
        ad_set_id,
        ad_id,
        COUNT(*) as count,
        array_agg(DISTINCT spend) as different_spends,
        array_agg(DISTINCT synced_at) as sync_times
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
      GROUP BY metric_date, campaign_id, ad_set_id, ad_id
      HAVING COUNT(*) > 1
      ORDER BY metric_date DESC, count DESC
      LIMIT 10`,
            [workspaceId, sinceStr]
        );
        console.log(`Encontradas ${duplicates.rows.length} combinações duplicadas`);
        if (duplicates.rows.length > 0) {
            console.table(duplicates.rows);
        }

        // 3. Total correto (apenas um nível por vez)
        console.log('\n3. TOTAL CORRETO (SEM DUPLICAÇÃO):');

        // Opção A: Apenas account level
        const accountOnly = await client.query(
            `SELECT 
        'account' as level,
        SUM(spend) as total_spend
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
        AND campaign_id IS NULL 
        AND ad_set_id IS NULL 
        AND ad_id IS NULL`,
            [workspaceId, sinceStr]
        );

        // Opção B: Apenas campaign level
        const campaignOnly = await client.query(
            `SELECT 
        'campaign' as level,
        SUM(spend) as total_spend
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
        AND ad_set_id IS NULL 
        AND ad_id IS NULL
        AND campaign_id IS NOT NULL`,
            [workspaceId, sinceStr]
        );

        // Opção C: Apenas adset level
        const adsetOnly = await client.query(
            `SELECT 
        'adset' as level,
        SUM(spend) as total_spend
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
        AND ad_id IS NULL
        AND ad_set_id IS NOT NULL`,
            [workspaceId, sinceStr]
        );

        // Opção D: Apenas ad level
        const adOnly = await client.query(
            `SELECT 
        'ad' as level,
        SUM(spend) as total_spend
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
        AND ad_id IS NOT NULL`,
            [workspaceId, sinceStr]
        );

        console.table([
            ...accountOnly.rows,
            ...campaignOnly.rows,
            ...adsetOnly.rows,
            ...adOnly.rows
        ]);

        // 4. Verificar campanhas de vendas especificamente
        console.log('\n4. CAMPANHAS DE VENDAS (SALES):');
        const salesCampaigns = await client.query(
            `SELECT 
        c.name as campaign_name,
        c.objective,
        CASE 
          WHEN pm.campaign_id IS NULL AND pm.ad_set_id IS NULL AND pm.ad_id IS NULL THEN 'account'
          WHEN pm.ad_set_id IS NULL AND pm.ad_id IS NULL THEN 'campaign'
          WHEN pm.ad_id IS NULL THEN 'adset'
          ELSE 'ad'
        END as level,
        COUNT(*) as metric_count,
        SUM(pm.spend) as total_spend,
        COUNT(DISTINCT pm.metric_date) as unique_dates
      FROM performance_metrics pm
      JOIN campaigns c ON pm.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND c.objective IN ('OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE')
      GROUP BY c.name, c.objective, level
      ORDER BY total_spend DESC`,
            [workspaceId, sinceStr]
        );
        console.table(salesCampaigns.rows);

        // 5. Exemplo de uma data específica
        console.log('\n5. EXEMPLO DE UMA DATA ESPECÍFICA (última data):');
        const latestDate = await client.query(
            `SELECT MAX(metric_date) as latest FROM performance_metrics 
       WHERE workspace_id = $1 AND metric_date >= $2`,
            [workspaceId, sinceStr]
        );

        if (latestDate.rows[0]?.latest) {
            const sampleDate = latestDate.rows[0].latest;
            const sampleData = await client.query(
                `SELECT 
          metric_date,
          CASE 
            WHEN campaign_id IS NULL AND ad_set_id IS NULL AND ad_id IS NULL THEN 'account'
            WHEN ad_set_id IS NULL AND ad_id IS NULL THEN 'campaign'
            WHEN ad_id IS NULL THEN 'adset'
            ELSE 'ad'
          END as level,
          campaign_id,
          ad_set_id,
          ad_id,
          spend,
          impressions,
          clicks
        FROM performance_metrics
        WHERE workspace_id = $1
          AND metric_date = $2
          AND granularity = 'day'
        ORDER BY spend DESC
        LIMIT 20`,
                [workspaceId, sampleDate]
            );
            console.log(`\nData: ${sampleDate}`);
            console.table(sampleData.rows);

            const totalByLevel = await client.query(
                `SELECT 
          CASE 
            WHEN campaign_id IS NULL AND ad_set_id IS NULL AND ad_id IS NULL THEN 'account'
            WHEN ad_set_id IS NULL AND ad_id IS NULL THEN 'campaign'
            WHEN ad_id IS NULL THEN 'adset'
            ELSE 'ad'
          END as level,
          SUM(spend) as total_spend
        FROM performance_metrics
        WHERE workspace_id = $1
          AND metric_date = $2
          AND granularity = 'day'
        GROUP BY level`,
                [workspaceId, sampleDate]
            );
            console.log(`\nTotal por nível na data ${sampleDate}:`);
            console.table(totalByLevel.rows);
        }

    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
