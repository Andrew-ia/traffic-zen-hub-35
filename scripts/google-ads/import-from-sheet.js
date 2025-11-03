#!/usr/bin/env node
/**
 * Script para importar dados do Google Sheets para o banco
 *
 * Uso:
 * node scripts/google-ads/import-from-sheet.js --url=URL_DA_PLANILHA
 */

import { google } from 'googleapis';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
  SUPABASE_DATABASE_URL,
  META_WORKSPACE_ID,
} = process.env;

// Parse arguments
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));

if (!urlArg) {
  console.error('❌ Erro: URL da planilha não fornecida');
  console.log('\nUso:');
  console.log('node scripts/google-ads/import-from-sheet.js --url=URL_DA_PLANILHA\n');
  process.exit(1);
}

const sheetUrl = urlArg.split('=')[1];
const spreadsheetId = extractSpreadsheetId(sheetUrl);

if (!spreadsheetId) {
  console.error('❌ URL inválida. Use uma URL do Google Sheets');
  process.exit(1);
}

console.log('\n📥 Importando dados do Google Sheets\n');
console.log(`📊 Planilha: ${spreadsheetId}`);
console.log(`🆔 Workspace: ${META_WORKSPACE_ID}\n`);

const workspaceId = META_WORKSPACE_ID;

function extractSpreadsheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function main() {
  try {
    // Step 1: Authenticate with Google
    console.log('🔐 Autenticando no Google...');

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      'http://localhost:3002/oauth2callback'
    );

    oauth2Client.setCredentials({
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    console.log('✅ Autenticado!\n');

    // Step 2: Read data from sheet
    console.log('📖 Lendo dados da planilha...');

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: 'Metricas Diarias!A2:L', // Skip header row
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('⚠️  Nenhum dado encontrado na planilha');
      return;
    }

    console.log(`✅ ${rows.length} registros encontrados\n`);

    // Step 3: Connect to database
    console.log('🔌 Conectando ao banco de dados...');

    const db = new Client({ connectionString: SUPABASE_DATABASE_URL });
    await db.connect();

    console.log('✅ Conectado!\n');

    // Step 4: Import data
    console.log('💾 Importando dados...');

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        const [
          date,
          campaignIdGoogle,
          campaignName,
          campaignStatus,
          impressions,
          clicks,
          cost,
          conversions,
          conversionsValue,
          ctr,
          cpc,
          customerId,
        ] = row;

        // Check if record exists
        const existing = await db.query(
          `SELECT id FROM ads_spend_google
           WHERE workspace_id = $1
           AND customer_id = $2
           AND campaign_id_google = $3
           AND metric_date = $4
           LIMIT 1`,
          [workspaceId, customerId, campaignIdGoogle, date]
        );

        const costMicros = Math.round(parseFloat(cost || 0) * 1000000);
        const avgCpcMicros = Math.round(parseFloat(cpc || 0) * 1000000);

        if (existing.rows.length === 0) {
          // Insert
          await db.query(
            `INSERT INTO ads_spend_google (
              workspace_id, customer_id, campaign_id_google, campaign_name, campaign_status,
              metric_date, impressions, clicks, cost_micros, conversions, conversions_value,
              ctr, average_cpc, currency
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              workspaceId,
              customerId,
              campaignIdGoogle,
              campaignName,
              campaignStatus,
              date,
              parseInt(impressions || 0),
              parseInt(clicks || 0),
              costMicros,
              parseFloat(conversions || 0),
              parseFloat(conversionsValue || 0),
              parseFloat(ctr || 0) / 100, // Convert from % to decimal
              parseFloat(cpc || 0),
              'BRL',
            ]
          );
          inserted++;
        } else {
          // Update
          await db.query(
            `UPDATE ads_spend_google
             SET impressions = $1, clicks = $2, cost_micros = $3,
                 conversions = $4, conversions_value = $5, ctr = $6,
                 average_cpc = $7, synced_at = NOW()
             WHERE id = $8`,
            [
              parseInt(impressions || 0),
              parseInt(clicks || 0),
              costMicros,
              parseFloat(conversions || 0),
              parseFloat(conversionsValue || 0),
              parseFloat(ctr || 0) / 100,
              parseFloat(cpc || 0),
              existing.rows[0].id,
            ]
          );
          updated++;
        }
      } catch (error) {
        console.error(`   ❌ Erro na linha: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Importação concluída!`);
    console.log(`   ➕ ${inserted} novos registros`);
    console.log(`   🔄 ${updated} registros atualizados`);
    if (errors > 0) {
      console.log(`   ❌ ${errors} erros`);
    }

    // Step 5: Verify data
    console.log('\n🔍 Verificando dados importados...');

    const result = await db.query(
      `SELECT
         COUNT(*) as total,
         MIN(metric_date) as primeira_data,
         MAX(metric_date) as ultima_data,
         SUM(impressions) as total_impressoes,
         SUM(clicks) as total_cliques,
         SUM(cost_micros) / 1000000 as total_gasto
       FROM ads_spend_google
       WHERE workspace_id = $1`,
      [workspaceId]
    );

    const stats = result.rows[0];

    console.log(`\n📊 Resumo dos dados:`);
    console.log(`   Total de registros: ${stats.total}`);
    console.log(`   Período: ${stats.primeira_data} a ${stats.ultima_data}`);
    console.log(`   Total de impressões: ${parseInt(stats.total_impressoes || 0).toLocaleString()}`);
    console.log(`   Total de cliques: ${parseInt(stats.total_cliques || 0).toLocaleString()}`);
    console.log(`   Total gasto: R$ ${parseFloat(stats.total_gasto || 0).toFixed(2)}`);

    await db.end();

    console.log('\n🎉 Tudo pronto! Dados do Google Ads importados com sucesso!\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    if (error.errors) {
      console.error('Detalhes:', error.errors);
    }
    process.exit(1);
  }
}

main();
