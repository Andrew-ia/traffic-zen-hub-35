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
        lookup: (hostname, options, callback) => dns.lookup(hostname, { ...options, family: 4 }, callback),
    });

    await client.connect();

    try {
        console.log('\n=== WORKSPACE INFO ===');
        const workspaceResult = await client.query(
            'SELECT id, name FROM workspaces WHERE id = $1',
            [workspaceId]
        );
        console.log(workspaceResult.rows);

        console.log('\n=== PLATFORM ACCOUNTS ===');
        const accountsResult = await client.query(
            'SELECT id, name FROM platform_accounts WHERE workspace_id = $1',
            [workspaceId]
        );
        console.log(accountsResult.rows);

        console.log('\n=== CAMPAIGNS BY OBJECTIVE ===');
        const campaignsResult = await client.query(
            `SELECT 
        c.objective,
        COUNT(*) as count,
        array_agg(DISTINCT c.name) as campaign_names
      FROM campaigns c
      JOIN platform_accounts pa ON c.platform_account_id = pa.id
      WHERE pa.workspace_id = $1
      GROUP BY c.objective
      ORDER BY count DESC`,
            [workspaceId]
        );
        console.log(campaignsResult.rows);

        console.log('\n=== PERFORMANCE METRICS SUMMARY (Last 30 days) ===');
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);

        const metricsResult = await client.query(
            `SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT metric_date) as unique_dates,
        MIN(metric_date) as earliest_date,
        MAX(metric_date) as latest_date,
        SUM(spend) as total_spend,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'`,
            [workspaceId, sinceStr]
        );
        console.log(metricsResult.rows);

        console.log('\n=== PERFORMANCE METRICS BY LEVEL (Last 30 days) ===');
        const metricsByLevelResult = await client.query(
            `SELECT 
        CASE 
          WHEN campaign_id IS NULL AND ad_set_id IS NULL AND ad_id IS NULL THEN 'account'
          WHEN ad_set_id IS NULL AND ad_id IS NULL THEN 'campaign'
          WHEN ad_id IS NULL THEN 'adset'
          ELSE 'ad'
        END as level,
        COUNT(*) as count,
        SUM(spend) as total_spend,
        SUM(conversions) as total_conversions
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
      GROUP BY level
      ORDER BY count DESC`,
            [workspaceId, sinceStr]
        );
        console.log(metricsByLevelResult.rows);

        console.log('\n=== AD SETS WITH METRICS (Last 30 days) ===');
        const adSetsResult = await client.query(
            `SELECT 
        c.objective,
        COUNT(DISTINCT pm.ad_set_id) as adset_count,
        SUM(pm.spend) as total_spend,
        SUM(pm.clicks) as total_clicks,
        SUM(pm.conversions) as total_conversions
      FROM performance_metrics pm
      JOIN ad_sets ads ON pm.ad_set_id = ads.id
      JOIN campaigns c ON ads.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND pm.ad_set_id IS NOT NULL
        AND pm.ad_id IS NULL
      GROUP BY c.objective
      ORDER BY total_spend DESC`,
            [workspaceId, sinceStr]
        );
        console.log(adSetsResult.rows);

        console.log('\n=== SAMPLE PERFORMANCE METRICS (Last 5 rows) ===');
        const sampleResult = await client.query(
            `SELECT 
        metric_date,
        campaign_id,
        ad_set_id,
        ad_id,
        spend,
        clicks,
        impressions,
        conversions,
        extra_metrics->'actions' as actions
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= $2
        AND granularity = 'day'
      ORDER BY metric_date DESC, synced_at DESC
      LIMIT 5`,
            [workspaceId, sinceStr]
        );
        console.log(JSON.stringify(sampleResult.rows, null, 2));

        console.log('\n=== CHECKING FOR SALES DATA ===');
        const salesResult = await client.query(
            `SELECT 
        pm.metric_date,
        c.name as campaign_name,
        c.objective,
        pm.spend,
        pm.conversions,
        pm.conversion_value,
        pm.extra_metrics->'actions' as actions,
        pm.extra_metrics->'action_values' as action_values
      FROM performance_metrics pm
      JOIN ad_sets ads ON pm.ad_set_id = ads.id
      JOIN campaigns c ON ads.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND pm.metric_date >= $2
        AND pm.granularity = 'day'
        AND pm.ad_set_id IS NOT NULL
        AND pm.ad_id IS NULL
        AND c.objective IN ('OUTCOME_SALES', 'SALES', 'CONVERSIONS', 'PURCHASE')
      ORDER BY pm.metric_date DESC
      LIMIT 10`,
            [workspaceId, sinceStr]
        );
        console.log(JSON.stringify(salesResult.rows, null, 2));

    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
