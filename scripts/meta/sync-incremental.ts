#!/usr/bin/env tsx
import { Client } from 'pg';
import process from 'node:process';
import dns from 'node:dns';
import dotenv from 'dotenv';
import { runMetaSync } from '../../supabase/functions/_shared/metaSync.ts';
import type { SyncContext } from '../../supabase/functions/_shared/db.ts';

dotenv.config({ path: '.env.local' });

function assertEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

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
  const args = process.argv.slice(2);
  const daysArg = args.find((arg) => arg.startsWith('--days='));
  const syncDays = daysArg ? Number(daysArg.split('=')[1]) : Number(process.env.SYNC_DAYS ?? 7);
  const campaignsOnly = args.includes('--campaigns-only');
  const metricsOnly = args.includes('--metrics-only');

  const accessToken = assertEnv(process.env.META_ACCESS_TOKEN, 'META_ACCESS_TOKEN');
  const adAccountId = assertEnv(process.env.META_AD_ACCOUNT_ID, 'META_AD_ACCOUNT_ID');
  const workspaceId = assertEnv(process.env.META_WORKSPACE_ID, 'META_WORKSPACE_ID');
  const databaseUrl = assertEnv(process.env.SUPABASE_DATABASE_URL, 'SUPABASE_DATABASE_URL');

  const mode = campaignsOnly ? 'campaigns' : metricsOnly ? 'metrics' : 'all';

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
    const ctx: SyncContext = {
      db: {
        query: (text: string, params?: any[]) => client.query(text, params),
      },
      reportProgress: (progress) => {
        process.stdout.write(`\rProgress: ${progress}%   `);
      },
    };

    await runMetaSync(
      {
        accessToken,
        adAccountId,
        workspaceId,
        days: syncDays,
        type: mode as 'all' | 'campaigns' | 'metrics',
      },
      ctx,
    );

    process.stdout.write('\n');
    console.log('✅ Meta incremental sync finished');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('❌ Meta sync failed', error);
  process.exit(1);
});
