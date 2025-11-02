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

// Parse arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const SYNC_DAYS = daysArg ? Number(daysArg.split('=')[1]) : 30;

const {
  GOOGLE_ADS_CUSTOMER_ID,
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
  customer = client.Customer({
    customer_id: customerId,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN || undefined,
  });
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
 * Sync campaigns from Google Ads
 */
async function syncCampaigns() {
  console.log('📥 Sincronizando campanhas do Google Ads...');

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY campaign.name
  `;

  try {
    const campaigns = await customer.query(query);

    console.log(`✅ ${campaigns.length} campanhas encontradas`);

    for (const campaign of campaigns) {
      const campaignData = campaign.campaign;

      // Check if campaign exists
      const existingCampaign = await db.query(
        `SELECT id FROM campaigns
         WHERE workspace_id = $1
         AND platform_account_id IS NULL
         AND external_id = $2
         LIMIT 1`,
        [workspaceId, String(campaignData.id)]
      );

      const status = mapGoogleStatus(campaignData.status);
      const dailyBudget = campaignData.resource_name.includes('campaign_budget')
        ? Number(campaign.campaign_budget?.amount_micros || 0) / 1000000
        : null;

      if (existingCampaign.rows.length === 0) {
        // Insert new campaign
        await db.query(
          `INSERT INTO campaigns (
            workspace_id,
            external_id,
            name,
            status,
            source,
            daily_budget,
            start_date,
            end_date,
            settings
          ) VALUES ($1, $2, $3, $4, 'synced', $5, $6, $7, $8::jsonb)`,
          [
            workspaceId,
            String(campaignData.id),
            campaignData.name,
            status,
            dailyBudget,
            campaignData.start_date || null,
            campaignData.end_date || null,
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
            campaignData.start_date || null,
            campaignData.end_date || null,
            existingCampaign.rows[0].id,
          ]
        );
        console.log(`   🔄 Atualizada: ${campaignData.name}`);
      }
    }

    console.log('💾 Campanhas sincronizadas\n');
  } catch (error) {
    console.error('❌ Erro ao sincronizar campanhas:', error.message);
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
      metrics.average_cpc
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

    for (const row of results) {
      const campaign = row.campaign;
      const metrics = row.metrics;
      const date = row.segments.date;

      // Check if metric already exists
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
        currency: 'BRL',
      };

      if (existing.rows.length === 0) {
        // Insert new metric
        await db.query(
          `INSERT INTO ads_spend_google (
            workspace_id, customer_id, campaign_id_google, campaign_name, campaign_status,
            metric_date, impressions, clicks, cost_micros, conversions, conversions_value,
            ctr, average_cpc, currency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
    }

    console.log(`💾 Métricas sincronizadas: ${inserted} novas, ${updated} atualizadas\n`);
  } catch (error) {
    console.error('❌ Erro ao sincronizar métricas:', error.message);
    throw error;
  }
}

/**
 * Map Google Ads status to our status
 */
function mapGoogleStatus(googleStatus) {
  const statusMap = {
    'ENABLED': 'active',
    'PAUSED': 'paused',
    'REMOVED': 'archived',
    'UNKNOWN': 'draft',
    'UNSPECIFIED': 'draft',
  };
  return statusMap[googleStatus] || 'draft';
}

// Run
main().catch((error) => {
  console.error('💥 Erro fatal:', error);
  process.exit(1);
});
