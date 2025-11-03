#!/usr/bin/env node
/**
 * Script de migração de credenciais do .env.local para integration_credentials (criptografado)
 *
 * Uso: node scripts/migrate-credentials.js
 */

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carrega .env.local
dotenv.config({ path: '.env.local' });

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  ENCRYPTION_KEY,
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ENCRYPTION_KEY) {
  console.error('❌ Erro: Variáveis SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ENCRYPTION_KEY são obrigatórias');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Criptografa dados usando AES-256-GCM
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted + authTag.toString('hex'),
    iv: iv.toString('hex')
  };
}

/**
 * Migra credenciais Meta para integration_credentials
 */
async function migrateMeta() {
  if (!META_APP_ID || !META_APP_SECRET || !META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID || !META_WORKSPACE_ID) {
    console.log('⏭️  Pulando Meta: credenciais não encontradas no .env.local');
    return;
  }

  console.log('\n📱 Migrando credenciais Meta...');

  // Primeiro, garante que existe uma integração
  const { data: existingIntegration } = await supabase
    .from('workspace_integrations')
    .select('id')
    .eq('workspace_id', META_WORKSPACE_ID)
    .eq('platform_key', 'meta')
    .single();

  let integrationId = existingIntegration?.id;

  if (!integrationId) {
    console.log('  Criando workspace_integration para Meta...');
    const { data: newIntegration, error: intError } = await supabase
      .from('workspace_integrations')
      .insert({
        workspace_id: META_WORKSPACE_ID,
        platform_key: 'meta',
        is_active: true,
        status: 'connected',
      })
      .select('id')
      .single();

    if (intError) {
      console.error('  ❌ Erro ao criar integração:', intError);
      return;
    }
    integrationId = newIntegration.id;
  }

  // Cria platform_account se não existir
  const { data: existingAccount } = await supabase
    .from('platform_accounts')
    .select('id')
    .eq('workspace_id', META_WORKSPACE_ID)
    .eq('platform_key', 'meta')
    .eq('external_id', META_AD_ACCOUNT_ID)
    .single();

  let accountId = existingAccount?.id;

  if (!accountId) {
    console.log('  Criando platform_account...');
    const { data: newAccount, error: accError } = await supabase
      .from('platform_accounts')
      .insert({
        workspace_id: META_WORKSPACE_ID,
        platform_key: 'meta',
        external_id: META_AD_ACCOUNT_ID,
        account_name: `Ad Account ${META_AD_ACCOUNT_ID}`,
        is_active: true,
      })
      .select('id')
      .single();

    if (accError) {
      console.error('  ❌ Erro ao criar account:', accError);
      return;
    }
    accountId = newAccount.id;
  }

  // Prepara credenciais para criptografar
  const credentials = {
    app_id: META_APP_ID,
    app_secret: META_APP_SECRET,
    access_token: META_ACCESS_TOKEN,
    ad_account_id: META_AD_ACCOUNT_ID,
    token_expires_at: null, // Meta tokens não expiram por padrão, mas vamos rastrear
  };

  const { encrypted, iv } = encrypt(JSON.stringify(credentials));

  // Verifica se já existe credential
  const { data: existingCred } = await supabase
    .from('integration_credentials')
    .select('id')
    .eq('integration_id', integrationId)
    .single();

  if (existingCred) {
    console.log('  Atualizando credenciais existentes...');
    const { error } = await supabase
      .from('integration_credentials')
      .update({
        encrypted_credentials: encrypted,
        encryption_iv: iv,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingCred.id);

    if (error) {
      console.error('  ❌ Erro ao atualizar:', error);
      return;
    }
  } else {
    console.log('  Inserindo novas credenciais...');
    const { error } = await supabase
      .from('integration_credentials')
      .insert({
        integration_id: integrationId,
        encrypted_credentials: encrypted,
        encryption_iv: iv,
      });

    if (error) {
      console.error('  ❌ Erro ao inserir:', error);
      return;
    }
  }

  console.log('  ✅ Credenciais Meta migradas com sucesso!');
  console.log(`     Workspace ID: ${META_WORKSPACE_ID}`);
  console.log(`     Integration ID: ${integrationId}`);
  console.log(`     Platform Account ID: ${accountId}`);
}

/**
 * Migra credenciais Google Ads
 */
async function migrateGoogleAds() {
  if (!GOOGLE_ADS_CUSTOMER_ID || !GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.log('⏭️  Pulando Google Ads: credenciais não encontradas no .env.local');
    return;
  }

  console.log('\n🔍 Migrando credenciais Google Ads...');

  // Usa mesmo workspace do Meta
  const workspaceId = META_WORKSPACE_ID;

  const { data: existingIntegration } = await supabase
    .from('workspace_integrations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('platform_key', 'google_ads')
    .single();

  let integrationId = existingIntegration?.id;

  if (!integrationId) {
    console.log('  Criando workspace_integration para Google Ads...');
    const { data: newIntegration, error: intError } = await supabase
      .from('workspace_integrations')
      .insert({
        workspace_id: workspaceId,
        platform_key: 'google_ads',
        is_active: true,
        status: 'connected',
      })
      .select('id')
      .single();

    if (intError) {
      console.error('  ❌ Erro ao criar integração:', intError);
      return;
    }
    integrationId = newIntegration.id;
  }

  const credentials = {
    customer_id: GOOGLE_ADS_CUSTOMER_ID,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN || null,
  };

  const { encrypted, iv } = encrypt(JSON.stringify(credentials));

  const { data: existingCred } = await supabase
    .from('integration_credentials')
    .select('id')
    .eq('integration_id', integrationId)
    .single();

  if (existingCred) {
    console.log('  Atualizando credenciais existentes...');
    const { error } = await supabase
      .from('integration_credentials')
      .update({
        encrypted_credentials: encrypted,
        encryption_iv: iv,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingCred.id);

    if (error) {
      console.error('  ❌ Erro ao atualizar:', error);
      return;
    }
  } else {
    console.log('  Inserindo novas credenciais...');
    const { error } = await supabase
      .from('integration_credentials')
      .insert({
        integration_id: integrationId,
        encrypted_credentials: encrypted,
        encryption_iv: iv,
      });

    if (error) {
      console.error('  ❌ Erro ao inserir:', error);
      return;
    }
  }

  console.log('  ✅ Credenciais Google Ads migradas com sucesso!');
  console.log(`     Integration ID: ${integrationId}`);
}

/**
 * Main
 */
async function main() {
  console.log('🔐 MIGRAÇÃO DE CREDENCIAIS PARA SUPABASE\n');
  console.log('Este script vai migrar as credenciais do .env.local para o Supabase,');
  console.log('armazenando-as de forma criptografada (AES-256-GCM).\n');

  await migrateMeta();
  await migrateGoogleAds();

  console.log('\n✅ Migração concluída!\n');
  console.log('📝 PRÓXIMOS PASSOS:\n');
  console.log('1. Verifique no Supabase se as credenciais foram salvas corretamente');
  console.log('   (Tabela: integration_credentials)');
  console.log('\n2. Atualize os scripts de sincronização para buscar credenciais do banco');
  console.log('   em vez do .env.local');
  console.log('\n3. APÓS CONFIRMAR QUE TUDO FUNCIONA, remova as linhas sensíveis do .env.local:');
  console.log('   - META_APP_SECRET');
  console.log('   - META_ACCESS_TOKEN');
  console.log('   - GOOGLE_ADS_DEVELOPER_TOKEN');
  console.log('   - GOOGLE_CLIENT_SECRET');
  console.log('   - GOOGLE_ADS_REFRESH_TOKEN');
  console.log('\n⚠️  IMPORTANTE: Faça backup do .env.local antes de remover!');
}

main().catch(console.error);
