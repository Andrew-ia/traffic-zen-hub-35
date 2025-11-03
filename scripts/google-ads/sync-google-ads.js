#!/usr/bin/env node
/**
 * Script de sincronização do Google Ads
 *
 * Sincroniza campanhas, grupos de anúncios e métricas do Google Ads
 *
 * Uso:
 * node scripts/google-ads/sync-google-ads.js --days 30
 */

import { GoogleAdsApi } from 'google-ads-api';
import { Client } from 'pg';
import process from 'node:process';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

// Parse arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const SYNC_DAYS = daysArg ? Number(daysArg.split('=')[1]) : 30;

const {
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  SUPABASE_DATABASE_URL,
  META_WORKSPACE_ID,
} = process.env;

// Validar env vars
function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

assertEnv(GOOGLE_ADS_CUSTOMER_ID, 'GOOGLE_ADS_CUSTOMER_ID');
assertEnv(GOOGLE_ADS_DEVELOPER_TOKEN, 'GOOGLE_ADS_DEVELOPER_TOKEN');
assertEnv(GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID');
assertEnv(GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET');
assertEnv(SUPABASE_DATABASE_URL, 'SUPABASE_DATABASE_URL');
assertEnv(META_WORKSPACE_ID, 'META_WORKSPACE_ID');

const workspaceId = META_WORKSPACE_ID;
const customerId = GOOGLE_ADS_CUSTOMER_ID;

console.log('\n🚀 Iniciando sincronização do Google Ads');
console.log(`📅 Período: últimos ${SYNC_DAYS} dias`);
console.log(`🏢 Customer ID: ${customerId}`);
console.log(`🆔 Workspace: ${workspaceId}\n`);

// Initialize Google Ads API client
const client = new GoogleAdsApi({
  client_id: GOOGLE_CLIENT_ID,
  client_secret: GOOGLE_CLIENT_SECRET,
  developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
});

// For first time, we need to get refresh token
// This will be done via OAuth flow in the backend
// For now, we'll use the customer ID directly

let customer;
try {
  const customerConfig = {
    customer_id: customerId,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN || undefined,
  };

  if (GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    customerConfig.login_customer_id = GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  }

  customer = client.Customer(customerConfig);
} catch (error) {
  console.error('❌ Erro ao inicializar cliente Google Ads:', error.message);
  console.log('\n⚠️  ATENÇÃO: Você precisa obter um Refresh Token primeiro!');
  console.log('Execute o fluxo OAuth para obter o refresh token.\n');
  process.exit(1);
}

// Connect to database
const db = new Client({ connectionString: SUPABASE_DATABASE_URL });

async function main() {
  try {
    await db.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Step 0: Ensure integration and platform account exist
    await ensureGoogleAdsSetup();

    // Step 1: Sync campaigns
    await syncCampaigns();

    // Step 2: Sync metrics
    await syncMetrics();

    console.log('\n✅ Sincronização concluída com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro na sincronização:', error);
    throw error;
  } finally {
    await db.end();
  }
}

/**
 * Ensure Google Ads integration and platform account exist
 */
async function ensureGoogleAdsSetup() {
  console.log('🔧 Verificando configuração do Google Ads...');

  // Check if workspace_integration exists
  const integrationResult = await db.query(
    `SELECT id FROM workspace_integrations
     WHERE workspace_id = $1 AND platform_key = 'google_ads'
     LIMIT 1`,
    [workspaceId]
  );

  let integrationId;

  if (integrationResult.rows.length === 0) {
    // Create workspace_integration
    const newIntegration = await db.query(
      `INSERT INTO workspace_integrations (
        workspace_id, platform_key, status, auth_type, metadata
      ) VALUES ($1, 'google_ads', 'active', 'oauth2', $2)
      RETURNING id`,
      [
        workspaceId,
        JSON.stringify({
          customer_id: customerId,
          developer_token: '***',
        }),
      ]
    );
    integrationId = newIntegration.rows[0].id;
    console.log('   ✅ Integração Google Ads criada');
  } else {
    integrationId = integrationResult.rows[0].id;
    console.log('   ✅ Integração Google Ads encontrada');
  }

  // Check if platform_account exists
  const accountResult = await db.query(
    `SELECT id FROM platform_accounts
     WHERE workspace_id = $1 AND platform_key = 'google_ads' AND external_id = $2
     LIMIT 1`,
    [workspaceId, customerId]
  );

  if (accountResult.rows.length === 0) {
    // Fetch account name from Google Ads
    let accountName = 'Google Ads Account';
    try {
      const accountQuery = `
        SELECT customer.id, customer.descriptive_name
        FROM customer
        LIMIT 1
      `;
      const accountInfo = await customer.query(accountQuery);
      if (accountInfo && accountInfo.length > 0) {
        accountName = accountInfo[0].customer.descriptive_name;
      }
    } catch (error) {
      console.log('   ⚠️  Não foi possível buscar nome da conta');
    }

    // Create platform_account
    await db.query(
      `INSERT INTO platform_accounts (
        workspace_id, integration_id, platform_key, external_id, name, status, currency
      ) VALUES ($1, $2, 'google_ads', $3, $4, 'active', 'BRL')`,
      [workspaceId, integrationId, customerId, accountName]
    );
    console.log('   ✅ Conta da plataforma criada:', accountName);
  } else {
    console.log('   ✅ Conta da plataforma encontrada');
  }

  console.log('');
}

/**
 * Sync campaigns from Google Ads
 */
async function syncCampaigns() {
  console.log('📥 Sincronizando campanhas do Google Ads...');

  // Get platform_account_id
  const accountResult = await db.query(
    `SELECT id FROM platform_accounts
     WHERE workspace_id = $1 AND platform_key = 'google_ads' AND external_id = $2
     LIMIT 1`,
    [workspaceId, customerId]
  );

  if (accountResult.rows.length === 0) {
    throw new Error('Platform account não encontrada. Execute ensureGoogleAdsSetup primeiro.');
  }

  const platformAccountId = accountResult.rows[0].id;

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `;

  try {
    const campaigns = await customer.query(query);

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️  Nenhuma campanha encontrada');
      return;
    }

    console.log(`✅ ${campaigns.length} campanhas encontradas`);

    for (const campaign of campaigns) {
      const campaignData = campaign.campaign;

      // Check if campaign exists
      const existingCampaign = await db.query(
        `SELECT id FROM campaigns
         WHERE workspace_id = $1
         AND platform_account_id = $2
         AND external_id = $3
         LIMIT 1`,
        [workspaceId, platformAccountId, String(campaignData.id)]
      );

      const status = mapGoogleStatus(campaignData.status);
      const dailyBudget = null; // We'll fetch budget separately if needed

      if (existingCampaign.rows.length === 0) {
        // Insert new campaign
        await db.query(
          `INSERT INTO campaigns (
            workspace_id,
            platform_account_id,
            external_id,
            name,
            status,
            source,
            daily_budget,
            start_date,
            end_date,
            settings
          ) VALUES ($1, $2, $3, $4, $5, 'synced', $6, $7, $8, $9::jsonb)`,
          [
            workspaceId,
            platformAccountId,
            String(campaignData.id),
            campaignData.name,
            status,
            dailyBudget,
            null, // start_date - not available in simplified query
            null, // end_date - not available in simplified query
            JSON.stringify({
              platform: 'google',
              advertising_channel_type: campaignData.advertising_channel_type,
            }),
          ]
        );
        console.log(`   ➕ Criada: ${campaignData.name}`);
      } else {
        // Update existing campaign
        await db.query(
          `UPDATE campaigns
           SET name = $1, status = $2, daily_budget = $3,
               start_date = $4, end_date = $5, last_synced_at = NOW()
           WHERE id = $6`,
          [
            campaignData.name,
            status,
            dailyBudget,
            null, // start_date
            null, // end_date
            existingCampaign.rows[0].id,
          ]
        );
        console.log(`   🔄 Atualizada: ${campaignData.name}`);
      }
    }

    console.log('💾 Campanhas sincronizadas\n');
  } catch (error) {
    console.error('❌ Erro ao sincronizar campanhas:', error.message);
    if (error.errors && error.errors.length > 0) {
      console.error('Detalhes do erro:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

/**
 * Sync metrics from Google Ads
 */
async function syncMetrics() {
  console.log(`📊 Sincronizando métricas dos últimos ${SYNC_DAYS} dias...`);

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.search_impression_share,
      metrics.search_rank_lost_impression_share
    FROM campaign
    WHERE segments.date DURING LAST_${SYNC_DAYS}_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC, campaign.name
  `;

  try {
    const results = await customer.query(query);

    console.log(`✅ ${results.length} registros de métricas encontrados`);

    let inserted = 0;
    let updated = 0;

    // Get platform_account_id for performance_metrics
    const accountResult = await db.query(
      `SELECT id FROM platform_accounts
       WHERE workspace_id = $1 AND platform_key = 'google_ads' AND external_id = $2
       LIMIT 1`,
      [workspaceId, customerId]
    );
    const platformAccountId = accountResult.rows[0]?.id;

    for (const row of results) {
      const campaign = row.campaign;
      const metrics = row.metrics;
      const date = row.segments.date;

      // Check if metric already exists in ads_spend_google
      const existing = await db.query(
        `SELECT id FROM ads_spend_google
         WHERE workspace_id = $1
         AND customer_id = $2
         AND campaign_id_google = $3
         AND metric_date = $4
         LIMIT 1`,
        [workspaceId, customerId, String(campaign.id), date]
      );

      const metricData = {
        workspace_id: workspaceId,
        customer_id: customerId,
        campaign_id_google: String(campaign.id),
        campaign_name: campaign.name,
        campaign_status: campaign.status,
        metric_date: date,
        impressions: Number(metrics.impressions || 0),
        clicks: Number(metrics.clicks || 0),
        cost_micros: Number(metrics.cost_micros || 0),
        conversions: Number(metrics.conversions || 0),
        conversions_value: Number(metrics.conversions_value || 0),
        ctr: Number(metrics.ctr || 0),
        average_cpc: Number(metrics.average_cpc || 0),
        extra_metrics: JSON.stringify({
          search_impression_share: metrics.search_impression_share || null,
          search_rank_lost_impression_share: metrics.search_rank_lost_impression_share || null,
        }),
        currency: 'BRL',
      };

      if (existing.rows.length === 0) {
        // Insert new metric
        await db.query(
          `INSERT INTO ads_spend_google (
            workspace_id, customer_id, campaign_id_google, campaign_name, campaign_status,
            metric_date, impressions, clicks, cost_micros, conversions, conversions_value,
            ctr, average_cpc, extra_metrics, currency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            metricData.workspace_id,
            metricData.customer_id,
            metricData.campaign_id_google,
            metricData.campaign_name,
            metricData.campaign_status,
            metricData.metric_date,
            metricData.impressions,
            metricData.clicks,
            metricData.cost_micros,
            metricData.conversions,
            metricData.conversions_value,
            metricData.ctr,
            metricData.average_cpc,
            metricData.extra_metrics,
            metricData.currency,
          ]
        );
        inserted++;
      } else {
        // Update existing metric
        await db.query(
          `UPDATE ads_spend_google
           SET impressions = $1, clicks = $2, cost_micros = $3,
               conversions = $4, conversions_value = $5, ctr = $6,
               average_cpc = $7, synced_at = NOW()
           WHERE id = $8`,
          [
            metricData.impressions,
            metricData.clicks,
            metricData.cost_micros,
            metricData.conversions,
            metricData.conversions_value,
            metricData.ctr,
            metricData.average_cpc,
            existing.rows[0].id,
          ]
        );
        updated++;
      }

      // Also sync to performance_metrics table
      if (platformAccountId) {
        await syncToPerformanceMetrics(
          workspaceId,
          platformAccountId,
          String(campaign.id),
          date,
          metricData
        );
      }
    }

    console.log(`💾 Métricas sincronizadas: ${inserted} novas, ${updated} atualizadas\n`);
  } catch (error) {
    console.error('❌ Erro ao sincronizar métricas:', error.message);
    throw error;
  }
}

/**
 * Sync metrics to performance_metrics table
 */
async function syncToPerformanceMetrics(
  workspaceId,
  platformAccountId,
  campaignExternalId,
  date,
  metricData
) {
  // Get campaign_id by external_id
  const campaignResult = await db.query(
    `SELECT c.id
     FROM campaigns c
     JOIN platform_accounts pa ON c.platform_account_id = pa.id
     WHERE pa.platform_key = 'google_ads'
     AND c.external_id = $1
     LIMIT 1`,
    [campaignExternalId]
  );

  if (campaignResult.rows.length === 0) {
    console.log(`   ⚠️  Campaign not found for external_id: ${campaignExternalId}`);
    return;
  }

  const campaignId = campaignResult.rows[0].id;

  // Check if metric already exists in performance_metrics
  const existing = await db.query(
    `SELECT id FROM performance_metrics
     WHERE workspace_id = $1
     AND platform_account_id = $2
     AND campaign_id = $3
     AND metric_date = $4
     AND granularity = 'day'
     LIMIT 1`,
    [workspaceId, platformAccountId, campaignId, date]
  );

  const spend = parseFloat((metricData.cost_micros / 1000000.0).toFixed(2));
  const ctr = parseFloat((metricData.ctr * 100).toFixed(4));
  const cpc = parseFloat((metricData.average_cpc / 1000000.0).toFixed(2));
  const cpm = metricData.impressions > 0
    ? parseFloat((spend / metricData.impressions * 1000).toFixed(2))
    : 0;

  if (existing.rows.length === 0) {
    // Insert
    await db.query(
      `INSERT INTO performance_metrics (
        workspace_id,
        platform_account_id,
        campaign_id,
        granularity,
        metric_date,
        currency,
        impressions,
        clicks,
        spend,
        cpm,
        cpc,
        ctr,
        conversions,
        conversion_value,
        synced_at
      ) VALUES ($1, $2, $3, 'day', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        workspaceId,
        platformAccountId,
        campaignId,
        date,
        metricData.currency || 'BRL',
        metricData.impressions,
        metricData.clicks,
        spend,
        cpm,
        cpc,
        ctr,
        Math.floor(metricData.conversions || 0),
        metricData.conversions_value || 0
      ]
    );
  } else {
    // Update
    await db.query(
      `UPDATE performance_metrics
       SET impressions = $1,
           clicks = $2,
           spend = $3,
           cpm = $4,
           cpc = $5,
           ctr = $6,
           conversions = $7,
           conversion_value = $8,
           synced_at = NOW()
       WHERE id = $9`,
      [
        metricData.impressions,
        metricData.clicks,
        spend,
        cpm,
        cpc,
        ctr,
        Math.floor(metricData.conversions || 0),
        metricData.conversions_value || 0,
        existing.rows[0].id
      ]
    );
  }
}

/**
 * Map Google Ads status to our status
 */
function mapGoogleStatus(googleStatus) {
  console.log(`   🔍 Mapeando status: "${googleStatus}" (tipo: ${typeof googleStatus})`);

  // Google Ads API pode retornar tanto strings quanto números (enums)
  // Enum values: UNSPECIFIED = 0, UNKNOWN = 1, ENABLED = 2, PAUSED = 3, REMOVED = 4
  const statusMap = {
    // String values
    'ENABLED': 'active',
    'PAUSED': 'paused',
    'REMOVED': 'archived',
    'UNKNOWN': 'draft',
    'UNSPECIFIED': 'draft',
    // Enum numeric values
    0: 'draft',  // UNSPECIFIED
    1: 'draft',  // UNKNOWN
    2: 'active', // ENABLED
    3: 'paused', // PAUSED
    4: 'archived', // REMOVED
  };

  const mapped = statusMap[googleStatus] || 'draft';
  console.log(`   ➡️  Status mapeado: "${mapped}"`);

  return mapped;
}

// Run
main().catch((error) => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
