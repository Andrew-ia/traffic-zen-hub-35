#!/usr/bin/env node
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.SUPABASE_DATABASE_URL
});

async function checkAllSources() {
  try {
    await client.connect();
    console.log('🔍 Verificando TODAS as fontes de dados...\n');

    // 1. Check ads_spend_google
    console.log('1️⃣ Checando ads_spend_google (Google Ads)...');
    const googleData = await client.query(`
      SELECT
        MIN(metric_date) as earliest,
        MAX(metric_date) as latest,
        COUNT(*) as records,
        COUNT(DISTINCT campaign_id_google) as campaigns,
        ROUND(SUM(cost_micros)/1000000::numeric, 2) as total_spend_brl
      FROM ads_spend_google
      WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c';
    `);
    console.table(googleData.rows);

    // 2. Check meta_ads_insights (if exists)
    try {
      console.log('\n2️⃣ Checando meta_ads_insights (Meta)...');
      const metaInsights = await client.query(`
        SELECT
          MIN(date_start::date) as earliest,
          MAX(date_stop::date) as latest,
          COUNT(*) as records,
          COUNT(DISTINCT campaign_id) as campaigns
        FROM meta_ads_insights
        WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
        LIMIT 1;
      `);
      console.table(metaInsights.rows);
    } catch (e) {
      console.log('   ⚠️  Tabela meta_ads_insights não existe\n');
    }

    // 3. Check performance_metrics
    console.log('3️⃣ Checando performance_metrics (consolidado)...');
    const perfMetrics = await client.query(`
      SELECT
        MIN(metric_date) as earliest,
        MAX(metric_date) as latest,
        COUNT(*) as records,
        COUNT(DISTINCT campaign_id) as campaigns
      FROM performance_metrics
      WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c';
    `);
    console.table(perfMetrics.rows);

    // 4. List all tables with metrics
    console.log('\n4️⃣ Todas as tabelas relacionadas a métricas:');
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND (
          table_name LIKE '%metric%'
          OR table_name LIKE '%insight%'
          OR table_name LIKE '%ads%'
          OR table_name LIKE '%performance%'
        )
      ORDER BY table_name;
    `);
    console.log('   Tabelas encontradas:', tables.rows.map(r => r.table_name).join(', '));

    console.log('\n📊 Resumo:');
    if (googleData.rows[0].records > 0) {
      console.log('✅ Google Ads tem dados!');
      console.log(`   Período: ${googleData.rows[0].earliest} até ${googleData.rows[0].latest}`);
      console.log(`   Total investido: R$ ${googleData.rows[0].total_spend_brl}`);
    }

    if (perfMetrics.rows[0].records > 0) {
      console.log('✅ performance_metrics tem dados!');
    } else {
      console.log('⚠️  performance_metrics está VAZIA');
      console.log('   A view v_campaign_kpi depende desta tabela!');
      console.log('');
      console.log('💡 Solução: Execute a sincronização para popular performance_metrics:');
      console.log('   npm run server:sync-meta');
      console.log('   npm run server:sync-google');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

checkAllSources();
