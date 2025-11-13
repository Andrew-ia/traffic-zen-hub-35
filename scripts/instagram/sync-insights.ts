#!/usr/bin/env tsx
import { Client } from 'pg';
import process from 'node:process';
import dns from 'node:dns';
import dotenv from 'dotenv';
import { runInstagramSync } from '../../supabase/functions/_shared/instagramSync.ts';
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
  const igUserId = assertEnv(process.env.IG_USER_ID, 'IG_USER_ID');
  const accessToken = assertEnv(process.env.IG_ACCESS_TOKEN, 'IG_ACCESS_TOKEN');
  const workspaceId = assertEnv(process.env.IG_WORKSPACE_ID, 'IG_WORKSPACE_ID');
  const databaseUrl = assertEnv(process.env.SUPABASE_DATABASE_URL, 'SUPABASE_DATABASE_URL');
  const days = Number(process.env.SYNC_DAYS ?? 7);

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
      reportProgress: (progress) => process.stdout.write(`\rProgress: ${progress}%   `),
    };

    await runInstagramSync(
      {
        igUserId,
        accessToken,
        workspaceId,
        days,
      },
      ctx,
    );

    process.stdout.write('\n');
    console.log('✅ Instagram sync finished');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('❌ Instagram sync failed', error);
  process.exit(1);
});
