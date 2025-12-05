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
        const result = await client.query(`
      SELECT 
        c.name,
        c.objective,
        pm.metric_date,
        pm.spend,
        CASE 
          WHEN pm.campaign_id IS NULL AND pm.ad_set_id IS NULL AND pm.ad_id IS NULL THEN 'account'
          WHEN pm.ad_set_id IS NULL AND pm.ad_id IS NULL THEN 'campaign'
          WHEN pm.ad_id IS NULL THEN 'adset'
          ELSE 'ad'
        END as level
      FROM performance_metrics pm
      JOIN campaigns c ON pm.campaign_id = c.id
      WHERE pm.workspace_id = $1
        AND c.name = 'Lançamento Produto X'
      ORDER BY pm.metric_date DESC
    `, [workspaceId]);

        console.log('\n=== CAMPANHA "Lançamento Produto X" ===\n');
        console.table(result.rows);

        const total = result.rows.reduce((sum, row) => sum + Number(row.spend), 0);
        console.log(`\nTotal gasto: R$ ${total.toFixed(2)}`);

    } finally {
        await client.end();
    }
}

main().catch(console.error);
