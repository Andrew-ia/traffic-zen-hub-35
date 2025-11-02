import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

const workspaceId = process.env.VITE_WORKSPACE_ID;

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPercent(value) {
  const num = Number(value) || 0;
  return `${num.toFixed(2)}%`;
}

async function analyzeOptimizationOpportunities() {
  console.log('🎯 ANÁLISE DE OPORTUNIDADES DE OTIMIZAÇÃO\n');
  console.log('='.repeat(80));

  try {
    // 1. Campanhas com alto gasto mas baixa performance
    console.log('\n💰 1. CAMPANHAS COM ALTO GASTO E BAIXA PERFORMANCE');
    console.log('-'.repeat(80));

    const inefficientCampaigns = await pool.query(`
      WITH campaign_performance AS (
        SELECT
          c.id,
          c.name,
          c.objective,
          c.status,
          SUM(pm.spend) as total_spend,
          SUM(pm.impressions) as total_impressions,
          SUM(pm.clicks) as total_clicks,
          AVG(pm.ctr) as avg_ctr,
          AVG(pm.cpc) as avg_cpc,
          COUNT(DISTINCT pm.metric_date) as days_active
        FROM campaigns c
        JOIN performance_metrics pm ON pm.campaign_id = c.id
        WHERE c.workspace_id = $1
          AND pm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
          AND c.status = 'active'
        GROUP BY c.id, c.name, c.objective, c.status
        HAVING SUM(pm.spend) > 100
      )
      SELECT *
      FROM campaign_performance
      WHERE avg_ctr < 1.0 OR avg_cpc > 5.0
      ORDER BY total_spend DESC
      LIMIT 5
    `, [workspaceId]);

    if (inefficientCampaigns.rows.length > 0) {
      console.log('⚠️  Campanhas que precisam de atenção:\n');
      inefficientCampaigns.rows.forEach(camp => {
        console.log(`📊 ${camp.name}`);
        console.log(`   Objetivo: ${camp.objective}`);
        console.log(`   Gasto (30d): ${formatCurrency(camp.total_spend)}`);
        console.log(`   CTR médio: ${formatPercent(camp.avg_ctr)} ${camp.avg_ctr < 0.5 ? '🔴 MUITO BAIXO' : camp.avg_ctr < 1.0 ? '⚠️  BAIXO' : '✅'}`);
        console.log(`   CPC médio: ${formatCurrency(camp.avg_cpc)} ${camp.avg_cpc > 5 ? '🔴 MUITO ALTO' : camp.avg_cpc > 3 ? '⚠️  ALTO' : '✅'}`);
        console.log(`   Dias ativos: ${camp.days_active}`);

        // Recomendações
        console.log(`\n   💡 RECOMENDAÇÕES:`);
        if (camp.avg_ctr < 0.5) {
          console.log(`      • CTR muito baixo - Revise criativos e copy`);
          console.log(`      • Teste novas imagens/vídeos mais chamativas`);
          console.log(`      • Revise segmentação de público (pode estar muito ampla)`);
        }
        if (camp.avg_cpc > 5) {
          console.log(`      • CPC alto - Considere ajustar lances`);
          console.log(`      • Teste públicos mais específicos`);
          console.log(`      • Avalie se o objetivo da campanha está adequado`);
        }
        console.log('');
      });
    } else {
      console.log('✅ Nenhuma campanha ativa com performance preocupante');
    }

    // 2. Ad Sets com melhor performance (para escalar)
    console.log('\n🚀 2. AD SETS COM MELHOR PERFORMANCE (OPORTUNIDADES DE ESCALA)');
    console.log('-'.repeat(80));

    const topPerformers = await pool.query(`
      WITH adset_performance AS (
        SELECT
          a.id,
          a.name,
          c.name as campaign_name,
          c.objective,
          SUM(pm.spend) as total_spend,
          SUM(pm.clicks) as total_clicks,
          AVG(pm.ctr) as avg_ctr,
          AVG(pm.cpc) as avg_cpc,
          SUM(pm.impressions) as total_impressions,
          -- Conversões (actions)
          SUM(
            CASE
              WHEN pm.extra_metrics->'actions' IS NOT NULL THEN
                (
                  SELECT SUM((action->>'value')::numeric)
                  FROM jsonb_array_elements(pm.extra_metrics->'actions') AS action
                  WHERE action->>'action_type' IN (
                    'onsite_conversion.messaging_conversation_started_7d',
                    'link_click',
                    'lead',
                    'purchase'
                  )
                )
              ELSE 0
            END
          ) as total_conversions
        FROM ad_sets a
        JOIN campaigns c ON c.id = a.campaign_id
        JOIN performance_metrics pm ON pm.ad_set_id = a.id
        WHERE c.workspace_id = $1
          AND pm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
          AND a.status = 'active'
        GROUP BY a.id, a.name, c.name, c.objective
        HAVING SUM(pm.spend) > 50 AND SUM(pm.clicks) > 20
      )
      SELECT *
      FROM adset_performance
      WHERE avg_ctr > 1.5 AND avg_cpc < 3.0
      ORDER BY total_conversions DESC, avg_ctr DESC
      LIMIT 5
    `, [workspaceId]);

    if (topPerformers.rows.length > 0) {
      console.log('🌟 Ad Sets com excelente performance:\n');
      topPerformers.rows.forEach((adset, idx) => {
        console.log(`${idx + 1}. ${adset.name}`);
        console.log(`   Campanha: ${adset.campaign_name}`);
        console.log(`   CTR: ${formatPercent(adset.avg_ctr)} ✅`);
        console.log(`   CPC: ${formatCurrency(adset.avg_cpc)} ✅`);
        console.log(`   Conversões: ${Math.floor(adset.total_conversions)}`);
        console.log(`   Gasto: ${formatCurrency(adset.total_spend)}`);
        console.log(`\n   💡 AÇÃO: Considere AUMENTAR orçamento deste ad set!\n`);
      });
    } else {
      console.log('Nenhum ad set com performance destacada nos últimos 30 dias');
    }

    // 3. Análise por plataforma
    console.log('\n📱 3. PERFORMANCE POR PLATAFORMA');
    console.log('-'.repeat(80));

    const platformPerformance = await pool.query(`
      WITH platform_stats AS (
        SELECT
          CASE
            WHEN a.targeting->'publisher_platforms' ? 'whatsapp' THEN 'WhatsApp'
            WHEN a.targeting->'publisher_platforms' ? 'instagram'
              AND NOT a.targeting->'publisher_platforms' ? 'facebook' THEN 'Instagram'
            WHEN a.targeting->'publisher_platforms' ? 'facebook' THEN 'Facebook'
            WHEN a.targeting->'publisher_platforms' ? 'messenger' THEN 'Messenger'
            WHEN a.destination_type ILIKE '%whatsapp%' THEN 'WhatsApp'
            ELSE 'Outros'
          END as platform,
          SUM(pm.spend) as total_spend,
          SUM(pm.impressions) as total_impressions,
          SUM(pm.clicks) as total_clicks,
          AVG(pm.ctr) as avg_ctr,
          AVG(pm.cpc) as avg_cpc
        FROM performance_metrics pm
        JOIN ad_sets a ON a.id = pm.ad_set_id
        JOIN campaigns c ON c.id = pm.campaign_id
        WHERE c.workspace_id = $1
          AND pm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY platform
      )
      SELECT *
      FROM platform_stats
      WHERE total_spend > 10
      ORDER BY total_spend DESC
    `, [workspaceId]);

    if (platformPerformance.rows.length > 0) {
      console.log('Comparativo de performance por plataforma:\n');

      // Find best performers
      const bestCTR = Math.max(...platformPerformance.rows.map(p => p.avg_ctr));
      const bestCPC = Math.min(...platformPerformance.rows.map(p => p.avg_cpc));

      platformPerformance.rows.forEach(plat => {
        const isBestCTR = plat.avg_ctr === bestCTR;
        const isBestCPC = plat.avg_cpc === bestCPC;

        console.log(`${plat.platform.padEnd(20)} | Gasto: ${formatCurrency(plat.total_spend).padEnd(12)} | CTR: ${formatPercent(plat.avg_ctr).padEnd(8)} ${isBestCTR ? '👑' : '  '} | CPC: ${formatCurrency(plat.avg_cpc).padEnd(10)} ${isBestCPC ? '👑' : '  '}`);
      });

      const winner = platformPerformance.rows.find(p => p.avg_ctr === bestCTR);
      if (winner) {
        console.log(`\n   💡 ${winner.platform} está com melhor CTR - considere investir mais nesta plataforma!`);
      }
    }

    // 4. Horários com melhor performance
    console.log('\n⏰ 4. ANÁLISE TEMPORAL - ÚLTIMOS 7 DIAS');
    console.log('-'.repeat(80));

    const dailyPerformance = await pool.query(`
      SELECT
        metric_date::date as day,
        TO_CHAR(metric_date, 'Day') as day_name,
        SUM(spend) as daily_spend,
        SUM(clicks) as daily_clicks,
        SUM(impressions) as daily_impressions,
        AVG(ctr) as avg_ctr,
        SUM(
          CASE
            WHEN extra_metrics->'actions' IS NOT NULL THEN
              (
                SELECT SUM((action->>'value')::numeric)
                FROM jsonb_array_elements(extra_metrics->'actions') AS action
                WHERE action->>'action_type' IN (
                  'onsite_conversion.messaging_conversation_started_7d',
                  'link_click',
                  'lead'
                )
              )
            ELSE 0
          END
        ) as daily_conversions
      FROM performance_metrics pm
      JOIN campaigns c ON c.id = pm.campaign_id
      WHERE c.workspace_id = $1
        AND metric_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY metric_date, day_name
      ORDER BY metric_date DESC
    `, [workspaceId]);

    if (dailyPerformance.rows.length > 0) {
      console.log('Performance dos últimos 7 dias:\n');
      dailyPerformance.rows.forEach(day => {
        const convRate = day.daily_clicks > 0 ? (day.daily_conversions / day.daily_clicks * 100) : 0;
        console.log(`${day.day_name.trim().padEnd(12)} ${day.day.toLocaleDateString('pt-BR').padEnd(12)} | Conversões: ${Math.floor(day.daily_conversions).toString().padEnd(4)} | CTR: ${formatPercent(day.avg_ctr).padEnd(8)} | Conv Rate: ${formatPercent(convRate)}`);
      });

      const bestDay = dailyPerformance.rows.reduce((best, current) =>
        current.daily_conversions > best.daily_conversions ? current : best
      );
      console.log(`\n   💡 Melhor dia: ${bestDay.day_name.trim()} com ${Math.floor(bestDay.daily_conversions)} conversões`);
    }

    // 5. Campanhas que precisam de atenção urgente
    console.log('\n🚨 5. ALERTAS E AÇÕES URGENTES');
    console.log('-'.repeat(80));

    const alerts = [];

    // Check campaigns spending without results
    const wastefulCampaigns = await pool.query(`
      SELECT
        c.name,
        SUM(pm.spend) as spend,
        SUM(pm.clicks) as clicks
      FROM campaigns c
      JOIN performance_metrics pm ON pm.campaign_id = c.id
      WHERE c.workspace_id = $1
        AND c.status = 'active'
        AND pm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY c.id, c.name
      HAVING SUM(pm.spend) > 100 AND SUM(pm.clicks) < 10
    `, [workspaceId]);

    if (wastefulCampaigns.rows.length > 0) {
      alerts.push({
        severity: '🔴 CRÍTICO',
        message: `${wastefulCampaigns.rows.length} campanha(s) gastando sem resultados`,
        action: 'PAUSAR ou revisar urgentemente',
        campaigns: wastefulCampaigns.rows
      });
    }

    // Check campaigns with declining performance
    const decliningCampaigns = await pool.query(`
      WITH recent_vs_previous AS (
        SELECT
          c.id,
          c.name,
          SUM(CASE WHEN pm.metric_date >= CURRENT_DATE - INTERVAL '3 days' THEN pm.clicks ELSE 0 END) as recent_clicks,
          SUM(CASE WHEN pm.metric_date < CURRENT_DATE - INTERVAL '3 days'
                   AND pm.metric_date >= CURRENT_DATE - INTERVAL '6 days' THEN pm.clicks ELSE 0 END) as previous_clicks
        FROM campaigns c
        JOIN performance_metrics pm ON pm.campaign_id = c.id
        WHERE c.workspace_id = $1
          AND c.status = 'active'
          AND pm.metric_date >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY c.id, c.name
      )
      SELECT * FROM recent_vs_previous
      WHERE previous_clicks > 20 AND recent_clicks < previous_clicks * 0.5
    `, [workspaceId]);

    if (decliningCampaigns.rows.length > 0) {
      alerts.push({
        severity: '⚠️  ATENÇÃO',
        message: `${decliningCampaigns.rows.length} campanha(s) com queda de performance`,
        action: 'Revisar criativos e públicos',
        campaigns: decliningCampaigns.rows
      });
    }

    if (alerts.length > 0) {
      alerts.forEach(alert => {
        console.log(`\n${alert.severity}: ${alert.message}`);
        console.log(`   Ação recomendada: ${alert.action}`);
        alert.campaigns.forEach(camp => {
          console.log(`   • ${camp.name}`);
        });
      });
    } else {
      console.log('✅ Nenhum alerta crítico no momento');
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 RESUMO EXECUTIVO');
    console.log('='.repeat(80));
    console.log(`
✅ Performance geral: ${inefficientCampaigns.rows.length === 0 ? 'BOA' : 'PRECISA ATENÇÃO'}
🚀 Oportunidades de escala: ${topPerformers.rows.length} ad sets
🎯 Campanhas que precisam otimização: ${inefficientCampaigns.rows.length}
🚨 Alertas urgentes: ${alerts.length}

💡 PRÓXIMOS PASSOS:
${topPerformers.rows.length > 0 ? `   1. Aumentar orçamento dos ${topPerformers.rows.length} ad sets de melhor performance\n` : ''}${inefficientCampaigns.rows.length > 0 ? `   2. Revisar e otimizar ${inefficientCampaigns.rows.length} campanha(s) com baixa performance\n` : ''}${alerts.length > 0 ? `   3. Tomar ação urgente em ${alerts.length} alerta(s)\n` : ''}   4. Continuar monitorando métricas diariamente
    `);

  } catch (error) {
    console.error('\n❌ Erro na análise:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

analyzeOptimizationOpportunities();
