#!/usr/bin/env node
/**
 * Análise específica das campanhas ATIVAS e com gasto nos últimos 30 dias
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = process.env.VITE_WORKSPACE_ID;
const DAYS = 30;

async function checkActiveCampaigns() {
  console.log('\n🚀 CAMPANHAS ATIVAS (Últimos 30 dias)\n');
  console.log('='.repeat(80));

  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  // Buscar campanhas com gasto nos últimos 30 dias
  const { data: metricsWithSpend } = await supabase
    .from('performance_metrics')
    .select('campaign_id')
    .eq('workspace_id', WORKSPACE_ID)
    .not('campaign_id', 'is', null)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .gt('spend', 0)
    .gte('metric_date', sinceIso);

  const activeCampaignIds = [...new Set(metricsWithSpend?.map(m => m.campaign_id))];

  console.log(`\n📊 Campanhas com gasto nos últimos 30 dias: ${activeCampaignIds.length}\n`);

  if (activeCampaignIds.length === 0) {
    console.log('⚠️  Nenhuma campanha com gasto encontrada.\n');
    return;
  }

  // Buscar detalhes das campanhas
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, objective')
    .in('id', activeCampaignIds);

  // Para cada campanha, buscar métricas detalhadas
  for (const campaign of campaigns || []) {
    const { data: metrics } = await supabase
      .from('performance_metrics')
      .select('metric_date, impressions, clicks, conversions, spend, extra_metrics')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('campaign_id', campaign.id)
      .is('ad_set_id', null)
      .is('ad_id', null)
      .gte('metric_date', sinceIso)
      .order('metric_date', { ascending: true });

    const totals = {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      spend: 0,
      conversationsStarted: 0,
      messagingConnections: 0,
      postEngagements: 0,
      videoViews: 0,
      linkClicks: 0,
      landingPageViews: 0,
    };

    metrics?.forEach(m => {
      totals.impressions += Number(m.impressions) || 0;
      totals.clicks += Number(m.clicks) || 0;
      totals.conversions += Number(m.conversions) || 0;
      totals.spend += Number(m.spend) || 0;

      const actions = m.extra_metrics?.actions || [];
      actions.forEach(action => {
        const value = Number(action.value) || 0;
        switch (action.action_type) {
          case 'onsite_conversion.messaging_conversation_started_7d':
            totals.conversationsStarted += value;
            break;
          case 'onsite_conversion.messaging_first_reply':
            totals.messagingConnections += value;
            break;
          case 'post_engagement':
            totals.postEngagements += value;
            break;
          case 'video_view':
            totals.videoViews += value;
            break;
          case 'link_click':
            totals.linkClicks += value;
            break;
          case 'landing_page_view':
          case 'omni_landing_page_view':
            totals.landingPageViews += value;
            break;
        }
      });
    });

    const status = campaign.status === 'active' ? '✅ ATIVA' : '⏸️  PAUSADA';
    const isEngagement = ['OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', 'VIDEO_VIEWS'].includes(campaign.objective);
    const isWhatsApp = ['OUTCOME_LEADS', 'MESSAGES'].includes(campaign.objective);

    let icon = '📢';
    if (isEngagement) icon = '📺';
    if (isWhatsApp) icon = '💚';

    console.log(`${icon} ${status} | ${campaign.name}`);
    console.log(`   Objetivo: ${campaign.objective || 'N/A'}`);
    console.log(`   💰 Investimento: R$ ${totals.spend.toFixed(2)}`);
    console.log(`   👁️  Impressões: ${totals.impressions.toLocaleString('pt-BR')}`);
    console.log(`   👆 Cliques: ${totals.clicks.toLocaleString('pt-BR')}`);

    if (totals.clicks > 0) {
      const ctr = (totals.clicks / totals.impressions) * 100;
      const cpc = totals.spend / totals.clicks;
      console.log(`   📊 CTR: ${ctr.toFixed(2)}% | CPC: R$ ${cpc.toFixed(2)}`);
    }

    if (totals.conversationsStarted > 0) {
      const cpl = totals.spend / totals.conversationsStarted;
      console.log(`   💬 Conversas iniciadas: ${totals.conversationsStarted} (CPL: R$ ${cpl.toFixed(2)})`);
    }

    if (totals.messagingConnections > 0) {
      console.log(`   🔗 Conexões de mensagem: ${totals.messagingConnections}`);
    }

    if (totals.postEngagements > 0) {
      console.log(`   ❤️  Engajamentos: ${totals.postEngagements.toLocaleString('pt-BR')}`);
    }

    if (totals.videoViews > 0) {
      console.log(`   🎬 Visualizações de vídeo: ${totals.videoViews.toLocaleString('pt-BR')}`);
    }

    if (totals.linkClicks > 0) {
      console.log(`   🔗 Cliques em links: ${totals.linkClicks.toLocaleString('pt-BR')}`);
    }

    if (totals.landingPageViews > 0) {
      console.log(`   📄 Visualizações de landing page: ${totals.landingPageViews.toLocaleString('pt-BR')}`);
    }

    console.log('');
  }

  // Resumo por objetivo
  console.log('\n📈 RESUMO POR OBJETIVO\n');

  const byObjective = {};

  for (const campaign of campaigns || []) {
    const obj = campaign.objective || 'Outros';

    const { data: metrics } = await supabase
      .from('performance_metrics')
      .select('impressions, clicks, spend, extra_metrics')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('campaign_id', campaign.id)
      .is('ad_set_id', null)
      .is('ad_id', null)
      .gte('metric_date', sinceIso);

    if (!byObjective[obj]) {
      byObjective[obj] = {
        count: 0,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversationsStarted: 0,
      };
    }

    byObjective[obj].count++;

    metrics?.forEach(m => {
      byObjective[obj].spend += Number(m.spend) || 0;
      byObjective[obj].impressions += Number(m.impressions) || 0;
      byObjective[obj].clicks += Number(m.clicks) || 0;

      const actions = m.extra_metrics?.actions || [];
      actions.forEach(action => {
        if (action.action_type === 'onsite_conversion.messaging_conversation_started_7d') {
          byObjective[obj].conversationsStarted += Number(action.value) || 0;
        }
      });
    });
  }

  Object.entries(byObjective)
    .sort((a, b) => b[1].spend - a[1].spend)
    .forEach(([objective, data]) => {
      console.log(`${objective}:`);
      console.log(`   ${data.count} campanha(s)`);
      console.log(`   R$ ${data.spend.toFixed(2)} investidos`);
      console.log(`   ${data.impressions.toLocaleString('pt-BR')} impressões`);
      console.log(`   ${data.clicks.toLocaleString('pt-BR')} cliques`);
      if (data.conversationsStarted > 0) {
        console.log(`   ${data.conversationsStarted} conversas iniciadas`);
      }
      console.log('');
    });

  console.log('='.repeat(80));
  console.log('\n✅ Análise concluída!\n');
}

checkActiveCampaigns()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Erro:', err.message);
    console.error(err);
    process.exit(1);
  });
