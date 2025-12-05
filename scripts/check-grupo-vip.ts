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
    const databaseUrl = process.env.SUPABASE_DATABASE_URL!;
    const workspaceId = process.env.META_WORKSPACE_ID!;

    const needsSsl = /supabase\.co/.test(databaseUrl);
    const dbConfig = parseDatabaseConfig(databaseUrl);
    const client = new Client({
        ...dbConfig,
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
        lookup: (hostname: any, options: any, callback: any) => dns.lookup(hostname, { ...options, family: 4 }, callback),
    });

    await client.connect();

    try {
        console.log('\n=== CAMPANHA "GRUPO VIP VERMEZZO" ===\n');

        const result = await client.query(`
      SELECT 
        c.name,
        c.objective,
        pm.metric_date,
        pm.spend,
        pm.conversions,
        pm.conversion_value,
        pm.extra_metrics->'actions' as actions,
        pm.extra_metrics->'action_values' as action_values,
        CASE 
          WHEN pm.campaign_id IS NULL AND pm.ad_set_id IS NULL AND pm.ad_id IS NULL THEN 'account'
          WHEN pm.ad_set_id IS NULL AND pm.ad_id IS NULL THEN 'campaign'
          WHEN pm.ad_id IS NULL THEN 'adset'
          ELSE 'ad'
        END as level
      FROM performance_metrics pm
      JOIN campaigns c ON pm.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND c.name = 'GRUPO VIP VERMEZZO'
      ORDER BY pm.metric_date DESC, level
    `, [workspaceId]);

        console.table(result.rows);

        console.log('\n=== DETALHES DAS AÇÕES ===\n');
        result.rows.forEach((row, idx) => {
            console.log(`\n[${idx}] ${row.name} - ${row.metric_date} (${row.level}):`);
            console.log('  Spend:', row.spend);
            console.log('  Conversions:', row.conversions);
            console.log('  Conversion Value:', row.conversion_value);
            if (row.actions) {
                console.log('  Actions:', JSON.stringify(row.actions, null, 2));
            }
            if (row.action_values) {
                console.log('  Action Values:', JSON.stringify(row.action_values, null, 2));
            }
        });

    } finally {
        await client.end();
    }
}

main().catch(console.error);
