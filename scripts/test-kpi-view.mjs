#!/usr/bin/env node
/**
 * Test script to verify v_campaign_kpi view is working
 */
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.SUPABASE_DATABASE_URL
});

async function testView() {
  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Test 1: Check if view exists
    console.log('📋 Teste 1: Verificando se a view existe...');
    const viewCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_views
        WHERE schemaname = 'public'
        AND viewname = 'v_campaign_kpi'
      ) as exists;
    `);

    if (viewCheck.rows[0].exists) {
      console.log('✅ View v_campaign_kpi existe!\n');
    } else {
      console.log('❌ View v_campaign_kpi NÃO existe!\n');
      process.exit(1);
    }

    // Test 2: Count total rows
    console.log('📊 Teste 2: Contando registros...');
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM v_campaign_kpi
      WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
        AND metric_date >= CURRENT_DATE - INTERVAL '30 days';
    `);
    console.log(`   Total de registros (últimos 30 dias): ${countResult.rows[0].total}\n`);

    // Test 3: Sample data
    console.log('📄 Teste 3: Buscando dados de exemplo...');
    const sampleData = await client.query(`
      SELECT
        campaign_id,
        objective,
        result_label,
        SUM(result_value) as total_results,
        SUM(spend) as total_spend,
        ROUND(AVG(cost_per_result)::numeric, 2) as avg_cost,
        MAX(roas) as max_roas
      FROM v_campaign_kpi
      WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
        AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
        AND campaign_id IS NOT NULL
      GROUP BY campaign_id, objective, result_label
      ORDER BY total_spend DESC
      LIMIT 5;
    `);

    if (sampleData.rows.length > 0) {
      console.log('✅ Dados encontrados:\n');
      console.table(sampleData.rows);
    } else {
      console.log('⚠️  Nenhum dado encontrado nos últimos 30 dias.');
      console.log('   Isso é normal se:');
      console.log('   - As campanhas não tiveram gasto recente');
      console.log('   - A sincronização ainda não foi executada');
      console.log('   - As métricas estão em outro período\n');
    }

    // Test 4: Group by result_label
    console.log('📈 Teste 4: Métricas por tipo de resultado...');
    const byLabel = await client.query(`
      SELECT
        result_label,
        COUNT(DISTINCT campaign_id) as num_campaigns,
        SUM(result_value) as total_results,
        SUM(spend) as total_spend
      FROM v_campaign_kpi
      WHERE workspace_id = '67bdea74-50a7-485f-813b-4090c9ddb98c'
        AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY result_label
      ORDER BY total_spend DESC;
    `);

    if (byLabel.rows.length > 0) {
      console.log('✅ Distribuição por tipo de resultado:\n');
      console.table(byLabel.rows);
    } else {
      console.log('⚠️  Sem dados agregados\n');
    }

    console.log('🎉 Testes concluídos!');
    console.log('');
    console.log('📌 Próximos passos:');
    console.log('   1. Recarregue a página do TrafficPro (F5)');
    console.log('   2. Vá para /campaigns');
    console.log('   3. Verifique se as colunas mostram dados');
    console.log('');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testView();
