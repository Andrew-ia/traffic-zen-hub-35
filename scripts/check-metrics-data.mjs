#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.SUPABASE_DATABASE_URL
});

async function checkData() {
  try {
    await client.connect();
    console.log('🔍 Verificando dados de performance_metrics...\n');

    // Check date range of available data
    const dateRange = await client.query(`
      SELECT
        MIN(metric_date) as earliest_date,
        MAX(metric_date) as latest_date,
        COUNT(*) as total_records,
        COUNT(DISTINCT campaign_id) as num_campaigns
      FROM performance_metrics
      WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
        AND campaign_id IS NOT NULL;
    `);

    console.log('📅 Intervalo de dados:');
    console.table(dateRange.rows);

    // Check recent data
    const recentData = await client.query(`
      SELECT
        pm.metric_date,
        COUNT(DISTINCT pm.campaign_id) as num_campaigns,
        SUM(pm.spend) as total_spend,
        SUM(pm.clicks) as total_clicks,
        SUM(pm.impressions) as total_impressions
      FROM performance_metrics pm
      WHERE pm.workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
        AND pm.campaign_id IS NOT NULL
        AND pm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY pm.metric_date
      ORDER BY pm.metric_date DESC;
    `);

    console.log('\n📊 Dados dos últimos 7 dias:');
    if (recentData.rows.length > 0) {
      console.table(recentData.rows);
    } else {
      console.log('❌ Nenhum dado encontrado nos últimos 7 dias\n');

      // Check if there's any data at all
      const anyData = await client.query(`
        SELECT metric_date, COUNT(*) as records
        FROM performance_metrics
        WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
        GROUP BY metric_date
        ORDER BY metric_date DESC
        LIMIT 5;
      `);

      if (anyData.rows.length > 0) {
        console.log('💡 Dados mais recentes disponíveis:');
        console.table(anyData.rows);
        console.log('\n⚠️  Os dados estão desatualizados!');
        console.log('   Execute a sincronização:');
        console.log('   npm run server:sync-meta');
      } else {
        console.log('❌ Nenhum dado encontrado na tabela performance_metrics!');
        console.log('   Execute a sincronização inicial.');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkData();
