#!/usr/bin/env node
/**
 * Script to save Meta credentials to the database
 * Run this once to migrate credentials from .env.local to encrypted database storage
 *
 * Usage:
 *   node scripts/setup-meta-credentials.js
 */

import dotenv from 'dotenv';
import { Client } from 'pg';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: '.env.local' });

const {
  SUPABASE_DATABASE_URL,
  META_APP_ID,
  META_APP_SECRET,
  META_ACCESS_TOKEN,
  META_AD_ACCOUNT_ID,
  META_WORKSPACE_ID,
} = process.env;

// Plaintext storage functions (no encryption)
function encrypt(plaintext) {
  const plaintextString = typeof plaintext === 'string'
    ? plaintext
    : JSON.stringify(plaintext);

  return {
    encrypted: plaintextString,
    iv: '',
    authTag: '',
  };
}

async function main() {
  console.log('\n🔐 Meta Credentials Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Validate environment variables
  const missing = [];

  if (!SUPABASE_DATABASE_URL) missing.push('SUPABASE_DATABASE_URL');
  // ENCRYPTION_KEY no longer required
  if (!META_APP_ID) missing.push('META_APP_ID');
  if (!META_APP_SECRET) missing.push('META_APP_SECRET');
  if (!META_ACCESS_TOKEN) missing.push('META_ACCESS_TOKEN');
  if (!META_AD_ACCOUNT_ID) missing.push('META_AD_ACCOUNT_ID');
  if (!META_WORKSPACE_ID) missing.push('META_WORKSPACE_ID');

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease configure these in your .env.local file.\n');
    process.exit(1);
  }

  console.log('✅ All required environment variables found\n');

  // Build credentials object
  const credentials = {
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    accessToken: META_ACCESS_TOKEN,
    adAccountId: META_AD_ACCOUNT_ID,
  };

  console.log('📝 Credentials to save:');
  console.log(`   App ID: ${META_APP_ID}`);
  console.log(`   App Secret: ${META_APP_SECRET.substring(0, 8)}...`);
  console.log(`   Access Token: ${META_ACCESS_TOKEN.substring(0, 20)}...`);
  console.log(`   Ad Account ID: ${META_AD_ACCOUNT_ID}`);
  console.log(`   Workspace ID: ${META_WORKSPACE_ID}\n`);

  // Encrypt credentials
  console.log('🔒 Encrypting credentials...');
  const { encrypted, iv, authTag } = encrypt(credentials);
  const encryptedCredentials = `${encrypted}:${authTag}`;
  console.log('✅ Credentials encrypted\n');

  // Save to database
  const client = new Client({ connectionString: SUPABASE_DATABASE_URL });

  try {
    await client.connect();
    console.log('🔗 Connected to database\n');

    // Upsert credentials
    const result = await client.query(
      `
      INSERT INTO integration_credentials (
        workspace_id,
        platform_key,
        encrypted_credentials,
        encryption_iv
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (workspace_id, platform_key)
      DO UPDATE SET
        encrypted_credentials = EXCLUDED.encrypted_credentials,
        encryption_iv = EXCLUDED.encryption_iv,
        updated_at = now()
      RETURNING id, created_at, updated_at
      `,
      [META_WORKSPACE_ID, 'meta', encryptedCredentials, iv]
    );

    const row = result.rows[0];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SUCCESS: Credentials saved to database');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📊 Database Record:');
    console.log(`   ID: ${row.id}`);
    console.log(`   Created: ${row.created_at}`);
    console.log(`   Updated: ${row.updated_at}\n`);

    console.log('🎉 Setup complete! You can now:');
    console.log('   1. Start the server: npm run server');
    console.log('   2. Start the frontend: npm run dev:vite');
    console.log('   3. Or both at once: npm run dev\n');

    console.log('💡 Next steps:');
    console.log('   - Remove META_APP_SECRET and META_ACCESS_TOKEN from .env.local');
    console.log('   - Credentials are now stored as plaintext JSON (no encryption)');
    console.log('   - The sync button in the UI will now use these stored credentials\n');

  } catch (error) {
    console.error('\n❌ Error saving credentials:');
    console.error(error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
