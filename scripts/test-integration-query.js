#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Client } = pg;

async function testQuery() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const workspaceId = '00000000-0000-0000-0000-000000000010';

    // Test the exact query that useIntegrationOverview uses
    console.log('Testing workspace_integrations query...');
    const { rows: integrations } = await client.query(
      `
      SELECT
        wi.id,
        wi.platform_key,
        wi.status,
        wi.last_synced_at,
        wi.updated_at,
        wi.metadata,
        p.category as platform_category,
        p.display_name as platform_display_name
      FROM workspace_integrations wi
      LEFT JOIN platforms p ON wi.platform_key = p.key
      WHERE wi.workspace_id = $1
      `,
      [workspaceId]
    );

    console.log(`Found ${integrations.length} integrations:`);
    console.log(JSON.stringify(integrations, null, 2));

    console.log('\nTesting platform_accounts query...');
    const { rows: accounts } = await client.query(
      `
      SELECT id, platform_key, name, status, last_synced_at
      FROM platform_accounts
      WHERE workspace_id = $1
      `,
      [workspaceId]
    );

    console.log(`Found ${accounts.length} platform accounts:`);
    console.log(JSON.stringify(accounts, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testQuery();
