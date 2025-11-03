#!/usr/bin/env node
/**
 * Valida dados específicos das campanhas de Engajamento e WhatsApp
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

async function checkEngagementCampaigns() {
  console.log('\n🎯 ANÁLISE DAS CAMPANHAS DE ENGAJAMENTO E WHATSAPP\n');
  console.log('=' .repeat(80));

  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  // 1. Buscar campanhas de Engajamento
  console.log('\n1️⃣  CAMPANHAS DE ENGAJAMENTO (Live)\n');

  const { data: engagementCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, objective')
    .eq('workspace_id', WORKSPACE_ID)
    .or('objective.eq.OUTCOME_ENGAGEMENT,objective.eq.POST_ENGAGEMENT,objective.eq.VIDEO_VIEWS,name.ilike.%live%,name.ilike.%engajamento%')
    .order('created_at', { ascending: false });

  console.log(`📺 Total de campanhas de engajamento: ${engagementCampaigns?.length || 0}\n`);

  if (engagementCampaigns && engagementCampaigns.length > 0) {
    for (const campaign of engagementCampaigns.slice(0, 10)) {
      // Buscar métricas da campanha
      const { data: metrics } = await supabase
        .from('performance_metrics')
        .select('impressions, clicks, conversions, spend, extra_metrics')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('campaign_id', campaign.id)
        .is('ad_set_id', null)
        .is('ad_id', null)
        .gte('metric_date', sinceIso);

      const totals = metrics?.reduce((acc, m) => ({
        impressions: acc.impressions + (Number(m.impressions) || 0),
        clicks: acc.clicks + (Number(m.clicks) || 0),
        conversions: acc.conversions + (Number(m.conversions) || 0),
        spend: acc.spend + (Number(m.spend) || 0),
        conversationsStarted: acc.conversationsStarted + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0),
        messagingConnections: acc.messagingConnections + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'onsite_conversion.messaging_first_reply')?.value || 0),
        postEngagements: acc.postEngagements + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'post_engagement')?.value || 0),
        videoViews: acc.videoViews + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'video_view')?.value || 0),
      }), {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        conversationsStarted: 0,
        messagingConnections: 0,
        postEngagements: 0,
        videoViews: 0,
      }) || { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversationsStarted: 0, messagingConnections: 0, postEngagements: 0, videoViews: 0 };

      const status = campaign.status === 'active' ? '✅ ATIVA' : campaign.status === 'paused' ? '⏸️  PAUSADA' : '📝 ' + campaign.status?.toUpperCase();

      console.log(`${status} | ${campaign.name}`);
      console.log(`   Objetivo: ${campaign.objective}`);
      console.log(`   💰 Gasto: R$ ${totals.spend.toFixed(2)}`);
      console.log(`   👁️  Impressões: ${totals.impressions.toLocaleString('pt-BR')}`);
      console.log(`   👆 Cliques: ${totals.clicks.toLocaleString('pt-BR')}`);
      if (totals.postEngagements > 0) {
        console.log(`   ❤️  Engajamentos: ${totals.postEngagements.toLocaleString('pt-BR')}`);
      }
      if (totals.videoViews > 0) {
        console.log(`   📺 Visualizações de vídeo: ${totals.videoViews.toLocaleString('pt-BR')}`);
      }
      if (totals.conversationsStarted > 0) {
        console.log(`   💬 Conversas iniciadas: ${totals.conversationsStarted}`);
      }
      if (totals.messagingConnections > 0) {
        console.log(`   🔗 Conexões de mensagem: ${totals.messagingConnections}`);
      }
      console.log('');
    }
  }

  // 2. Buscar campanhas de WhatsApp/Leads
  console.log('\n2️⃣  CAMPANHAS DE WHATSAPP/LEADS\n');

  const { data: whatsappCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, objective')
    .eq('workspace_id', WORKSPACE_ID)
    .or('objective.eq.OUTCOME_LEADS,objective.eq.MESSAGES,name.ilike.%whatsapp%,name.ilike.%leads%,name.ilike.%mensagem%')
    .order('created_at', { ascending: false });

  console.log(`💚 Total de campanhas de WhatsApp/Leads: ${whatsappCampaigns?.length || 0}\n`);

  if (whatsappCampaigns && whatsappCampaigns.length > 0) {
    for (const campaign of whatsappCampaigns.slice(0, 10)) {
      // Buscar métricas da campanha
      const { data: metrics } = await supabase
        .from('performance_metrics')
        .select('impressions, clicks, conversions, spend, extra_metrics')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('campaign_id', campaign.id)
        .is('ad_set_id', null)
        .is('ad_id', null)
        .gte('metric_date', sinceIso);

      const totals = metrics?.reduce((acc, m) => ({
        impressions: acc.impressions + (Number(m.impressions) || 0),
        clicks: acc.clicks + (Number(m.clicks) || 0),
        conversions: acc.conversions + (Number(m.conversions) || 0),
        spend: acc.spend + (Number(m.spend) || 0),
        conversationsStarted: acc.conversationsStarted + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0),
        messagingConnections: acc.messagingConnections + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'onsite_conversion.messaging_first_reply')?.value || 0),
        leads: acc.leads + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'lead')?.value || 0),
      }), {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        conversationsStarted: 0,
        messagingConnections: 0,
        leads: 0,
      }) || { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversationsStarted: 0, messagingConnections: 0, leads: 0 };

      const status = campaign.status === 'active' ? '✅ ATIVA' : campaign.status === 'paused' ? '⏸️  PAUSADA' : '📝 ' + campaign.status?.toUpperCase();

      console.log(`${status} | ${campaign.name}`);
      console.log(`   Objetivo: ${campaign.objective}`);
      console.log(`   💰 Gasto: R$ ${totals.spend.toFixed(2)}`);
      console.log(`   👁️  Impressões: ${totals.impressions.toLocaleString('pt-BR')}`);
      console.log(`   👆 Cliques: ${totals.clicks.toLocaleString('pt-BR')}`);
      console.log(`   💬 Conversas iniciadas: ${totals.conversationsStarted}`);
      if (totals.messagingConnections > 0) {
        console.log(`   🔗 Conexões de mensagem: ${totals.messagingConnections}`);
      }
      if (totals.leads > 0) {
        console.log(`   📋 Leads (formulário): ${totals.leads}`);
      }
      if (totals.conversationsStarted > 0) {
        const cpl = totals.spend / totals.conversationsStarted;
        console.log(`   💵 Custo por conversa: R$ ${cpl.toFixed(2)}`);
      }
      console.log('');
    }
  }

  // 3. Resumo consolidado
  console.log('\n3️⃣  RESUMO CONSOLIDADO\n');

  const allCampaignIds = [
    ...(engagementCampaigns?.map(c => c.id) || []),
    ...(whatsappCampaigns?.map(c => c.id) || [])
  ];

  const uniqueCampaignIds = [...new Set(allCampaignIds)];

  const { data: allMetrics } = await supabase
    .from('performance_metrics')
    .select('impressions, clicks, conversions, spend, extra_metrics')
    .eq('workspace_id', WORKSPACE_ID)
    .in('campaign_id', uniqueCampaignIds)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .gte('metric_date', sinceIso);

  const consolidated = allMetrics?.reduce((acc, m) => ({
    impressions: acc.impressions + (Number(m.impressions) || 0),
    clicks: acc.clicks + (Number(m.clicks) || 0),
    conversions: acc.conversions + (Number(m.conversions) || 0),
    spend: acc.spend + (Number(m.spend) || 0),
    conversationsStarted: acc.conversationsStarted + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d')?.value || 0),
    messagingConnections: acc.messagingConnections + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'onsite_conversion.messaging_first_reply')?.value || 0),
    postEngagements: acc.postEngagements + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'post_engagement')?.value || 0),
    videoViews: acc.videoViews + Number(m.extra_metrics?.actions?.find(a => a.action_type === 'video_view')?.value || 0),
  }), {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    spend: 0,
    conversationsStarted: 0,
    messagingConnections: 0,
    postEngagements: 0,
    videoViews: 0,
  }) || { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversationsStarted: 0, messagingConnections: 0, postEngagements: 0, videoViews: 0 };

  console.log('📊 TOTAIS (Campanhas de Engajamento + WhatsApp):');
  console.log(`   💰 Investimento total: R$ ${consolidated.spend.toFixed(2)}`);
  console.log(`   👁️  Total de impressões: ${consolidated.impressions.toLocaleString('pt-BR')}`);
  console.log(`   👆 Total de cliques: ${consolidated.clicks.toLocaleString('pt-BR')}`);
  console.log(`   ❤️  Total de engajamentos: ${consolidated.postEngagements.toLocaleString('pt-BR')}`);
  console.log(`   📺 Total de visualizações: ${consolidated.videoViews.toLocaleString('pt-BR')}`);
  console.log(`   💬 Total de conversas iniciadas: ${consolidated.conversationsStarted}`);
  console.log(`   🔗 Total de conexões de mensagem: ${consolidated.messagingConnections}`);

  if (consolidated.conversationsStarted > 0) {
    const avgCostPerConvo = consolidated.spend / consolidated.conversationsStarted;
    console.log(`\n   💵 Custo médio por conversa: R$ ${avgCostPerConvo.toFixed(2)}`);
  }

  if (consolidated.clicks > 0) {
    const ctr = (consolidated.clicks / consolidated.impressions) * 100;
    const cpc = consolidated.spend / consolidated.clicks;
    console.log(`\n   📈 CTR: ${ctr.toFixed(2)}%`);
    console.log(`   💵 CPC médio: R$ ${cpc.toFixed(2)}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Análise concluída!\n');
}

checkEngagementCampaigns()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Erro:', err.message);
    console.error(err);
    process.exit(1);
  });
