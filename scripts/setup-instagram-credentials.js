#!/usr/bin/env node

/**
 * Setup Instagram credentials script
 *
 * This script helps you configure Instagram integration by:
 * 1. Creating the integration and platform_account records
 * 2. Encrypting and storing the credentials securely
 *
 * Usage:
 *   node scripts/setup-instagram-credentials.js
 *
 * Required environment variables:
 * - IG_USER_ID: Instagram Business Account ID
 * - IG_ACCESS_TOKEN: Meta Access Token (same as Meta Ads)
 * - IG_WORKSPACE_ID: Workspace ID (default: 00000000-0000-0000-0000-000000000010)
 * - SUPABASE_DATABASE_URL: Database connection string
 * - ENCRYPTION_KEY: Key for encrypting credentials
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const { Client } = pg;

// Get environment variables
const IG_USER_ID = process.env.IG_USER_ID || process.env.VITE_IG_USER_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || process.env.VITE_META_ACCESS_TOKEN;
const IG_WORKSPACE_ID = process.env.IG_WORKSPACE_ID || process.env.META_WORKSPACE_ID || process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';
const SUPABASE_DATABASE_URL =
  process.env.SUPABASE_POOLER_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL;
// ENCRYPTION_KEY no longer needed - using plaintext storage

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function setupInstagramCredentials() {
  const client = new Client({
    connectionString: assertEnv(
      SUPABASE_DATABASE_URL,
      'SUPABASE_POOLER_URL or SUPABASE_DATABASE_URL or DATABASE_URL'
    ),
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    const igUserId = assertEnv(IG_USER_ID, 'IG_USER_ID or VITE_IG_USER_ID');
    const accessToken = assertEnv(IG_ACCESS_TOKEN, 'IG_ACCESS_TOKEN or META_ACCESS_TOKEN');
    const workspaceId = assertEnv(IG_WORKSPACE_ID, 'IG_WORKSPACE_ID');
    // ENCRYPTION_KEY check removed - no longer needed

    console.log('📋 Configuration:');
    console.log(`   Workspace ID: ${workspaceId}`);
    console.log(`   IG User ID: ${igUserId}`);
    console.log(`   Access Token: ${accessToken.substring(0, 20)}...\n`);

    // 1. Create platform entry if it doesn't exist
    console.log('📝 Creating platform entry...');
    await client.query(
      `
      INSERT INTO platforms (key, display_name, category)
      VALUES ('instagram', 'Instagram Insights', 'analytics')
      ON CONFLICT (key) DO NOTHING
      `
    );

    // 2. Create workspace integration
    console.log('📝 Creating workspace integration...');
    const integrationResult = await client.query(
      `
      INSERT INTO workspace_integrations (workspace_id, platform_key, status)
      VALUES ($1, 'instagram', 'active')
      ON CONFLICT (workspace_id, platform_key) DO UPDATE SET
        status = 'active',
        updated_at = now()
      RETURNING id
      `,
      [workspaceId]
    );

    const integrationId = integrationResult.rows[0].id;

    // 3. Encrypt and store credentials
    console.log('🔐 Encrypting and storing credentials...');

    // Import encryption service
    const { encryptCredentials } = await import('../server/services/encryption.ts');

    const credentials = {
      igUserId,
      accessToken,
    };

    const { encrypted_credentials, encryption_iv } = encryptCredentials(credentials);

    // Store encrypted credentials
    await client.query(
      `
      INSERT INTO integration_credentials (
        workspace_id,
        platform_key,
        encrypted_credentials,
        encryption_iv
      ) VALUES ($1, 'instagram', $2, $3)
      ON CONFLICT (workspace_id, platform_key) DO UPDATE SET
        encrypted_credentials = $2,
        encryption_iv = $3,
        updated_at = now()
      `,
      [workspaceId, encrypted_credentials, encryption_iv]
    );
    console.log('✅ Credentials encrypted and stored\n');

    // 4. Create or update platform account
    console.log('📝 Creating platform account...');

    // First, check if account exists
    const existingAccount = await client.query(
      `SELECT id FROM platform_accounts
       WHERE workspace_id = $1 AND platform_key = 'instagram'`,
      [workspaceId]
    );

    if (existingAccount.rows.length > 0) {
      // Update existing account
      await client.query(
        `UPDATE platform_accounts
         SET external_id = $1, integration_id = $2, status = 'active', updated_at = now()
         WHERE workspace_id = $3 AND platform_key = 'instagram'`,
        [igUserId, integrationId, workspaceId]
      );
      console.log('✅ Platform account updated\n');
    } else {
      // Create new account
      await client.query(
        `INSERT INTO platform_accounts (
          workspace_id, integration_id, platform_key, external_id, name, status
         ) VALUES ($1, $2, 'instagram', $3, 'Instagram Business Account', 'active')`,
        [workspaceId, integrationId, igUserId]
      );
      console.log('✅ Platform account created\n');
    }

    console.log('🎉 Instagram credentials setup complete!\n');
    console.log('Next steps:');
    console.log('1. Restart your dev server (npm run dev)');
    console.log('2. Go to the Integrations page in your app');
    console.log('3. Click "Configurar Instagram" to view the credentials');
    console.log('4. Go to the Instagram page (/instagram) to view your insights');
    console.log('5. Run a sync to fetch data: POST /api/integrations/simple-sync with:');
    console.log('   { "platformKey": "instagram", "days": 7, "type": "all" }\n');

  } catch (error) {
    console.error('\n❌ Error setting up Instagram credentials:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Run the script
setupInstagramCredentials();
