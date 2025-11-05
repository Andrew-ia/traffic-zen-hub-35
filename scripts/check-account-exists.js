#!/usr/bin/env node
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.SUPABASE_DATABASE_URL;
const workspaceId = process.env.VITE_WORKSPACE_ID;
const adAccountId = process.env.META_AD_ACCOUNT_ID;

if (!connectionString || !workspaceId || !adAccountId) {
  console.error('Missing env: SUPABASE_DATABASE_URL, VITE_WORKSPACE_ID, META_AD_ACCOUNT_ID');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  try {
    const select = await client.query(
      `SELECT id, external_id, workspace_id
       FROM platform_accounts
       WHERE platform_key = $1 AND workspace_id = $2 AND external_id = $3`,
      ['meta', workspaceId, adAccountId]
    );

    if (select.rows.length > 0) {
      console.log('✅ Account exists:', select.rows[0]);
      return;
    }

    console.log('ℹ️  Account not found. Creating...');
    const insert = await client.query(
      `INSERT INTO platform_accounts (workspace_id, platform_key, external_id, account_name, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT DO NOTHING
       RETURNING id, external_id`,
      [workspaceId, 'meta', adAccountId, `Ad Account ${adAccountId}`]
    );

    if (insert.rows.length > 0) {
      console.log('✅ Account created:', insert.rows[0]);
    } else {
      console.log('⚠️  Insert did not return a row (may already exist due to conflict). Re-checking...');
      const recheck = await client.query(
        `SELECT id, external_id FROM platform_accounts WHERE platform_key = $1 AND workspace_id = $2 AND external_id = $3`,
        ['meta', workspaceId, adAccountId]
      );
      console.log('Recheck rows:', recheck.rows);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();

