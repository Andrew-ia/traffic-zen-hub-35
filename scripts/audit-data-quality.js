import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

const workspaceId = process.env.VITE_WORKSPACE_ID;

async function auditDataQuality() {
  console.log('🔍 AUDITORIA DE QUALIDADE DOS DADOS\n');
  console.log('='.repeat(60));

  try {
    // 1. Check for campaigns without metrics
    console.log('\n📊 1. Campanhas sem métricas');
    console.log('-'.repeat(60));
    const campaignsWithoutMetrics = await pool.query(`
      SELECT c.id, c.name, c.objective, c.status
      FROM campaigns c
      LEFT JOIN performance_metrics pm ON pm.campaign_id = c.id
      WHERE c.workspace_id = $1
        AND pm.id IS NULL
      ORDER BY c.created_at DESC
    `, [workspaceId]);

    if (campaignsWithoutMetrics.rows.length > 0) {
      console.log(`⚠️  Encontradas ${campaignsWithoutMetrics.rows.length} campanhas sem métricas:`);
      campaignsWithoutMetrics.rows.forEach(row => {
        console.log(`   - ${row.name} (${row.objective || 'sem objetivo'}) - Status: ${row.status}`);
      });
    } else {
      console.log('✅ Todas as campanhas têm métricas');
    }

    // 2. Check for ad sets without platform detection
    console.log('\n📱 2. Ad Sets com plataforma "other" (não detectada)');
    console.log('-'.repeat(60));
    const adSetsOther = await pool.query(`
      SELECT
        a.id,
        a.name,
        c.name as campaign_name,
        c.objective,
        a.targeting->'publisher_platforms' as platforms,
        a.destination_type,
        a.promoted_object
      FROM ad_sets a
      JOIN campaigns c ON c.id = a.campaign_id
      WHERE c.workspace_id = $1
        AND (
          a.targeting->'publisher_platforms' IS NULL
          OR jsonb_array_length(a.targeting->'publisher_platforms') = 0
        )
        AND a.destination_type IS NULL
      ORDER BY c.created_at DESC
      LIMIT 10
    `, [workspaceId]);

    if (adSetsOther.rows.length > 0) {
      console.log(`⚠️  ${adSetsOther.rows.length} ad sets sem detecção de plataforma:`);
      adSetsOther.rows.forEach(row => {
        console.log(`\n   Ad Set: ${row.name}`);
        console.log(`   Campanha: ${row.campaign_name} (${row.objective || 'sem objetivo'})`);
        console.log(`   Platforms: ${row.platforms || 'não definido'}`);
        console.log(`   Destination: ${row.destination_type || 'não definido'}`);
      });
    } else {
      console.log('✅ Todos os ad sets têm plataforma detectada');
    }

    // 3. Check for metrics with zero impressions but spend
    console.log('\n💰 3. Métricas com gasto mas sem impressões');
    console.log('-'.repeat(60));
    const weirdMetrics = await pool.query(`
      SELECT
        c.name as campaign_name,
        a.name as ad_set_name,
        pm.metric_date,
        pm.spend,
        pm.impressions,
        pm.clicks
      FROM performance_metrics pm
      JOIN campaigns c ON c.id = pm.campaign_id
      LEFT JOIN ad_sets a ON a.id = pm.ad_set_id
      WHERE pm.workspace_id = $1
        AND pm.spend > 0
        AND (pm.impressions = 0 OR pm.impressions IS NULL)
        AND pm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY pm.spend DESC
      LIMIT 10
    `, [workspaceId]);

    if (weirdMetrics.rows.length > 0) {
      console.log(`⚠️  ${weirdMetrics.rows.length} registros com gasto sem impressões:`);
      weirdMetrics.rows.forEach(row => {
        console.log(`   - ${row.campaign_name} / ${row.ad_set_name || 'N/A'}`);
        console.log(`     Data: ${row.metric_date}, Gasto: R$ ${row.spend}, Impressões: ${row.impressions || 0}`);
      });
    } else {
      console.log('✅ Nenhuma inconsistência de gasto/impressões');
    }

    // 4. Check conversion metrics consistency
    console.log('\n🎯 4. Consistência de métricas de conversão');
    console.log('-'.repeat(60));
    const conversionCheck = await pool.query(`
      SELECT
        c.name as campaign_name,
        c.objective,
        COUNT(DISTINCT pm.id) as total_metrics,
        COUNT(DISTINCT CASE
          WHEN pm.extra_metrics->'actions' IS NOT NULL
          THEN pm.id
        END) as metrics_with_actions,
        SUM(pm.spend) as total_spend
      FROM campaigns c
      LEFT JOIN performance_metrics pm ON pm.campaign_id = c.id
      WHERE c.workspace_id = $1
        AND pm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.id, c.name, c.objective
      ORDER BY total_spend DESC
    `, [workspaceId]);

    console.log('Campanhas e suas métricas de ação:');
    conversionCheck.rows.forEach(row => {
      const actionRate = row.total_metrics > 0
        ? ((row.metrics_with_actions / row.total_metrics) * 100).toFixed(1)
        : 0;
      const status = actionRate > 80 ? '✅' : actionRate > 50 ? '⚠️ ' : '❌';
      console.log(`\n${status} ${row.campaign_name}`);
      console.log(`   Objetivo: ${row.objective || 'não definido'}`);
      console.log(`   Métricas totais: ${row.total_metrics}`);
      console.log(`   Com actions: ${row.metrics_with_actions} (${actionRate}%)`);
      console.log(`   Gasto total: R$ ${parseFloat(row.total_spend || 0).toFixed(2)}`);
    });

    // 5. Check for duplicate metrics
    console.log('\n🔄 5. Verificação de métricas duplicadas');
    console.log('-'.repeat(60));
    const duplicates = await pool.query(`
      SELECT
        campaign_id,
        ad_set_id,
        metric_date,
        granularity,
        COUNT(*) as count,
        array_agg(id) as metric_ids,
        array_agg(synced_at) as synced_times
      FROM performance_metrics
      WHERE workspace_id = $1
        AND metric_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY campaign_id, ad_set_id, metric_date, granularity
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `, [workspaceId]);

    if (duplicates.rows.length > 0) {
      console.log(`⚠️  ${duplicates.rows.length} grupos de métricas duplicadas encontradas:`);
      duplicates.rows.forEach(row => {
        console.log(`\n   Data: ${row.metric_date}, Duplicatas: ${row.count}x`);
        console.log(`   IDs: ${row.metric_ids.slice(0, 3).join(', ')}${row.count > 3 ? '...' : ''}`);
        console.log(`   Últimas sincronizações: ${row.synced_times.slice(0, 2).join(', ')}`);
      });
      console.log('\n   ℹ️  Duplicatas são normais se vieram de múltiplas sincronizações.');
      console.log('      O sistema usa synced_at para determinar qual usar.');
    } else {
      console.log('✅ Nenhuma duplicata encontrada');
    }

    // 6. Platform distribution
    console.log('\n📊 6. Distribuição por plataforma (últimos 30 dias)');
    console.log('-'.repeat(60));
    const platformDist = await pool.query(`
      WITH platform_detection AS (
        SELECT
          a.id,
          a.name,
          c.objective,
          CASE
            WHEN a.targeting->'publisher_platforms' ? 'whatsapp' THEN 'WhatsApp'
            WHEN a.targeting->'publisher_platforms' ? 'instagram'
              AND NOT a.targeting->'publisher_platforms' ? 'facebook' THEN 'Instagram'
            WHEN a.targeting->'publisher_platforms' ? 'facebook' THEN 'Facebook'
            WHEN a.targeting->'publisher_platforms' ? 'messenger' THEN 'Messenger'
            WHEN a.targeting->'publisher_platforms' ? 'audience_network' THEN 'Audience Network'
            WHEN a.destination_type ILIKE '%whatsapp%' THEN 'WhatsApp (via destination_type)'
            WHEN a.destination_type ILIKE '%messenger%' THEN 'Messenger (via destination_type)'
            ELSE 'Outros'
          END as platform
        FROM ad_sets a
        JOIN campaigns c ON c.id = a.campaign_id
        WHERE c.workspace_id = $1
      )
      SELECT
        platform,
        COUNT(*) as ad_set_count,
        array_agg(DISTINCT objective) as objectives
      FROM platform_detection
      GROUP BY platform
      ORDER BY ad_set_count DESC
    `, [workspaceId]);

    platformDist.rows.forEach(row => {
      console.log(`${row.platform.padEnd(35)} ${row.ad_set_count} ad sets`);
      console.log(`   Objetivos: ${row.objectives.filter(Boolean).join(', ') || 'N/A'}`);
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMO DA AUDITORIA');
    console.log('='.repeat(60));

    const issues = [];
    if (campaignsWithoutMetrics.rows.length > 0) {
      issues.push(`${campaignsWithoutMetrics.rows.length} campanhas sem métricas`);
    }
    if (adSetsOther.rows.length > 0) {
      issues.push(`${adSetsOther.rows.length} ad sets sem plataforma detectada`);
    }
    if (weirdMetrics.rows.length > 0) {
      issues.push(`${weirdMetrics.rows.length} métricas com inconsistências`);
    }

    if (issues.length > 0) {
      console.log('\n⚠️  Problemas encontrados:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('\n💡 Recomendação: Execute uma nova sincronização para corrigir.');
    } else {
      console.log('\n✅ Nenhum problema crítico encontrado!');
      console.log('   Os dados parecem estar consistentes.');
    }

  } catch (error) {
    console.error('\n❌ Erro na auditoria:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

auditDataQuality();
