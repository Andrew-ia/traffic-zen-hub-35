#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.SUPABASE_DATABASE_URL;
const workspaceId = process.env.VITE_WORKSPACE_ID;

if (!connectionString || !workspaceId) {
  console.error('Missing env: SUPABASE_DATABASE_URL, VITE_WORKSPACE_ID');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  try {
    const res = await client.query(
      `SELECT id, name, external_id, created_at
       FROM platform_accounts
       WHERE platform_key = $1 AND workspace_id = $2
       ORDER BY created_at DESC
       LIMIT 10`,
      ['meta', workspaceId]
    );

    console.log('\n📋 Meta platform_accounts (latest 10):\n');
    for (const row of res.rows) {
      console.log(`- id: ${row.id} | name: ${row.name ?? '—'} | external_id: ${row.external_id}`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

