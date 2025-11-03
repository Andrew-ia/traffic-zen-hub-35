#!/usr/bin/env node
/**
 * Atualiza credenciais (Meta) para formato texto puro (JSON) em integration_credentials
 * Usa variáveis do .env.local
 *
 * Uso: node scripts/update-credentials-plaintext.js
 */

import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });

const {
  SUPABASE_DATABASE_URL,
  META_WORKSPACE_ID,
  META_APP_ID,
  META_APP_SECRET,
  META_ACCESS_TOKEN,
  META_AD_ACCOUNT_ID,
} = process.env;

async function main() {
  const missing = [];
  if (!SUPABASE_DATABASE_URL) missing.push('SUPABASE_DATABASE_URL');
  if (!META_WORKSPACE_ID) missing.push('META_WORKSPACE_ID');
  if (!META_APP_ID) missing.push('META_APP_ID');
  if (!META_APP_SECRET) missing.push('META_APP_SECRET');
  if (!META_ACCESS_TOKEN) missing.push('META_ACCESS_TOKEN');
  if (!META_AD_ACCOUNT_ID) missing.push('META_AD_ACCOUNT_ID');

  if (missing.length > 0) {
    console.error('❌ Variáveis ausentes no .env.local:');
    missing.forEach((k) => console.error(`   - ${k}`));
    process.exit(1);
  }

  const client = new Client({ connectionString: SUPABASE_DATABASE_URL });

  const credentials = {
    appId: META_APP_ID,
    appSecret: META_APP_SECRET,
    accessToken: META_ACCESS_TOKEN,
    adAccountId: META_AD_ACCOUNT_ID,
  };

  try {
    await client.connect();
    console.log('🔗 Conectado ao banco de dados');

    const json = JSON.stringify(credentials);

    const result = await client.query(
      `
      INSERT INTO integration_credentials (
        workspace_id,
        platform_key,
        encrypted_credentials,
        encryption_iv
      )
      VALUES ($1, 'meta', $2, '')
      ON CONFLICT (workspace_id, platform_key)
      DO UPDATE SET
        encrypted_credentials = EXCLUDED.encrypted_credentials,
        encryption_iv = EXCLUDED.encryption_iv,
        updated_at = now()
      RETURNING id, workspace_id, platform_key, updated_at
      `,
      [META_WORKSPACE_ID, json]
    );

    const row = result.rows[0];

    console.log('✅ Credenciais Meta atualizadas para texto puro (JSON)');
    console.log(`   ID: ${row.id}`);
    console.log(`   Workspace: ${row.workspace_id}`);
    console.log(`   Platform: ${row.platform_key}`);
    console.log(`   Updated at: ${row.updated_at}`);
  } catch (error) {
    console.error('❌ Erro ao atualizar credenciais:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

