#!/usr/bin/env node
/**
 * Script para inserir secrets no Supabase Vault automaticamente
 *
 * Lê do .env.local e insere no Vault via SQL
 *
 * Uso: node scripts/setup-vault-secrets.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  META_APP_ID,
  META_APP_SECRET,
  META_ACCESS_TOKEN,
  META_AD_ACCOUNT_ID,
  META_WORKSPACE_ID,
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function upsertSecret(name, value) {
  if (!value) {
    console.log(`⏭️  Pulando ${name} (valor vazio)`);
    return;
  }

  const { error } = await supabase.rpc('insert_secret', {
    secret_name: name,
    secret_value: value,
  });

  if (error) {
    console.error(`❌ Erro ao inserir ${name}:`, error.message);
  } else {
    console.log(`✅ ${name} inserido com sucesso`);
  }
}

async function main() {
  console.log('🔐 CONFIGURANDO SUPABASE VAULT\n');

  // Meta Ads
  console.log('📱 Configurando secrets Meta Ads...');
  await upsertSecret('meta_app_id', META_APP_ID);
  await upsertSecret('meta_app_secret', META_APP_SECRET);
  await upsertSecret('meta_access_token', META_ACCESS_TOKEN);
  await upsertSecret('meta_ad_account_id', META_AD_ACCOUNT_ID);

  // Google Ads
  console.log('\n🔍 Configurando secrets Google Ads...');
  await upsertSecret('google_ads_customer_id', GOOGLE_ADS_CUSTOMER_ID);
  await upsertSecret('google_ads_developer_token', GOOGLE_ADS_DEVELOPER_TOKEN);
  await upsertSecret('google_client_id', GOOGLE_CLIENT_ID);
  await upsertSecret('google_client_secret', GOOGLE_CLIENT_SECRET);
  await upsertSecret('google_ads_refresh_token', GOOGLE_ADS_REFRESH_TOKEN);

  // Workspace padrão
  console.log('\n🏢 Configurando workspace...');
  await upsertSecret('default_workspace_id', META_WORKSPACE_ID);

  console.log('\n✅ Configuração do Vault concluída!\n');
  console.log('📝 Próximos passos:');
  console.log('1. Verifique os secrets no Dashboard: Project Settings > Vault');
  console.log('2. As Edge Functions agora vão buscar credenciais do Vault');
  console.log('3. Após confirmar que funciona, remova secrets do .env.local\n');
}

main().catch(console.error);
