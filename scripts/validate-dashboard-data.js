#!/usr/bin/env node
/**
 * Valida os dados exibidos no Dashboard
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

async function validateDashboard() {
  console.log('\n📊 VALIDAÇÃO DOS DADOS DO DASHBOARD\n');
  console.log(`Workspace ID: ${WORKSPACE_ID}`);
  console.log(`Período: Últimos ${DAYS} dias\n`);

  const since = new Date();
  since.setDate(since.getDate() - DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  console.log(`Data inicial: ${sinceIso}\n`);
  console.log('=' .repeat(80));

  // 1. Performance Metrics (totais agregados)
  console.log('\n1️⃣  PERFORMANCE METRICS (Totais Agregados)\n');

  const { data: aggregatedMetrics, error: aggError } = await supabase
    .from('performance_metrics')
    .select('metric_date, impressions, clicks, conversions, spend, conversion_value, roas, extra_metrics')
    .eq('workspace_id', WORKSPACE_ID)
    .is('campaign_id', null)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .gte('metric_date', sinceIso)
    .order('metric_date', { ascending: true });

  if (aggError) {
    console.error('❌ Erro ao buscar métricas agregadas:', aggError.message);
  } else {
    console.log(`Total de registros agregados: ${aggregatedMetrics?.length || 0}`);

    if (aggregatedMetrics && aggregatedMetrics.length > 0) {
      const totals = aggregatedMetrics.reduce((acc, row) => ({
        impressions: acc.impressions + (Number(row.impressions) || 0),
        clicks: acc.clicks + (Number(row.clicks) || 0),
        conversions: acc.conversions + (Number(row.conversions) || 0),
        spend: acc.spend + (Number(row.spend) || 0),
        conversionValue: acc.conversionValue + (Number(row.conversion_value) || 0),
      }), { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversionValue: 0 });

      const roas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;

      console.log('\n📈 Totais calculados:');
      console.log(`   Impressões: ${totals.impressions.toLocaleString('pt-BR')}`);
      console.log(`   Cliques: ${totals.clicks.toLocaleString('pt-BR')}`);
      console.log(`   Conversões: ${totals.conversions.toLocaleString('pt-BR')}`);
      console.log(`   Gasto: R$ ${totals.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   Valor de Conversão: R$ ${totals.conversionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   ROAS: ${roas.toFixed(2)}x`);

      console.log('\n📅 Primeiros 5 dias:');
      aggregatedMetrics.slice(0, 5).forEach(row => {
        console.log(`   ${row.metric_date}: ${Number(row.impressions || 0).toLocaleString('pt-BR')} imp, ${Number(row.clicks || 0).toLocaleString('pt-BR')} clicks, R$ ${Number(row.spend || 0).toFixed(2)} gasto`);
      });
    }
  }

  // 2. Campanhas por status
  console.log('\n\n2️⃣  CAMPANHAS POR STATUS\n');

  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, objective, source')
    .eq('workspace_id', WORKSPACE_ID);

  if (campaignsError) {
    console.error('❌ Erro ao buscar campanhas:', campaignsError.message);
  } else {
    const statusCounts = campaigns?.reduce((acc, c) => {
      const status = (c.status || 'unknown').toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('📊 Campanhas por status:');
    Object.entries(statusCounts || {}).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    const objectiveCounts = campaigns?.reduce((acc, c) => {
      const obj = c.objective || 'unknown';
      acc[obj] = (acc[obj] || 0) + 1;
      return acc;
    }, {});

    console.log('\n🎯 Campanhas por objetivo:');
    Object.entries(objectiveCounts || {}).forEach(([obj, count]) => {
      console.log(`   ${obj}: ${count}`);
    });

    console.log(`\n📱 Total de campanhas: ${campaigns?.length || 0}`);
  }

  // 3. Performance por campanha (últimos 30 dias)
  console.log('\n\n3️⃣  PERFORMANCE POR CAMPANHA (Top 10)\n');

  const { data: campaignMetrics, error: campError } = await supabase
    .from('performance_metrics')
    .select('campaign_id, impressions, clicks, conversions, spend, conversion_value')
    .eq('workspace_id', WORKSPACE_ID)
    .not('campaign_id', 'is', null)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .gte('metric_date', sinceIso);

  if (campError) {
    console.error('❌ Erro ao buscar métricas por campanha:', campError.message);
  } else {
    const campaignTotals = {};

    campaignMetrics?.forEach(row => {
      if (!campaignTotals[row.campaign_id]) {
        campaignTotals[row.campaign_id] = {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spend: 0,
          conversionValue: 0,
        };
      }
      campaignTotals[row.campaign_id].impressions += Number(row.impressions) || 0;
      campaignTotals[row.campaign_id].clicks += Number(row.clicks) || 0;
      campaignTotals[row.campaign_id].conversions += Number(row.conversions) || 0;
      campaignTotals[row.campaign_id].spend += Number(row.spend) || 0;
      campaignTotals[row.campaign_id].conversionValue += Number(row.conversion_value) || 0;
    });

    const campaignsMap = campaigns?.reduce((acc, c) => {
      acc[c.id] = c;
      return acc;
    }, {}) || {};

    const topCampaigns = Object.entries(campaignTotals)
      .sort((a, b) => b[1].spend - a[1].spend)
      .slice(0, 10);

    console.log('💰 Top 10 campanhas por gasto:\n');
    topCampaigns.forEach(([id, metrics], index) => {
      const campaign = campaignsMap[id];
      const roas = metrics.spend > 0 ? metrics.conversionValue / metrics.spend : 0;
      console.log(`${index + 1}. ${campaign?.name || id}`);
      console.log(`   Objetivo: ${campaign?.objective || 'N/A'} | Status: ${campaign?.status || 'N/A'}`);
      console.log(`   Impressões: ${metrics.impressions.toLocaleString('pt-BR')} | Cliques: ${metrics.clicks.toLocaleString('pt-BR')}`);
      console.log(`   Gasto: R$ ${metrics.spend.toFixed(2)} | Conversões: ${metrics.conversions}`);
      console.log(`   ROAS: ${roas.toFixed(2)}x\n`);
    });
  }

  // 4. Ad Sets e Ads
  console.log('\n4️⃣  AD SETS E ANÚNCIOS\n');

  // Ad sets não tem workspace_id diretamente, busca via campaign
  const campaignIds = campaigns?.map(c => c.id) || [];

  const { data: adSets, error: adSetsError } = campaignIds.length > 0 ? await supabase
    .from('ad_sets')
    .select('id, name, status, campaign_id')
    .in('campaign_id', campaignIds) : { data: [], error: null };

  const adSetIds = adSets?.map(as => as.id) || [];

  const { data: ads, error: adsError } = adSetIds.length > 0 ? await supabase
    .from('ads')
    .select('id, name, status, ad_set_id')
    .in('ad_set_id', adSetIds) : { data: [], error: null };

  if (adSetsError) {
    console.error('❌ Erro ao buscar ad sets:', adSetsError.message);
  } else {
    console.log(`📦 Total de Ad Sets: ${adSets?.length || 0}`);

    const adSetsByStatus = adSets?.reduce((acc, as) => {
      const status = (as.status || 'unknown').toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('   Status:');
    Object.entries(adSetsByStatus || {}).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
  }

  if (adsError) {
    console.error('❌ Erro ao buscar anúncios:', adsError.message);
  } else {
    console.log(`\n📢 Total de Anúncios: ${ads?.length || 0}`);

    const adsByStatus = ads?.reduce((acc, ad) => {
      const status = (ad.status || 'unknown').toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    console.log('   Status:');
    Object.entries(adsByStatus || {}).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });
  }

  // 5. Última sincronização
  console.log('\n\n5️⃣  ÚLTIMA SINCRONIZAÇÃO\n');

  const { data: lastSync, error: syncError } = await supabase
    .from('performance_metrics')
    .select('synced_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('synced_at', { ascending: false })
    .limit(1);

  if (syncError) {
    console.error('❌ Erro ao buscar última sincronização:', syncError.message);
  } else if (lastSync && lastSync.length > 0) {
    const lastSyncDate = new Date(lastSync[0].synced_at);
    const now = new Date();
    const diffMinutes = Math.floor((now - lastSyncDate) / 1000 / 60);

    console.log(`⏰ Última sincronização: ${lastSyncDate.toLocaleString('pt-BR')}`);
    console.log(`   (há ${diffMinutes} minutos)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Validação concluída!\n');
}

validateDashboard()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Erro na validação:', err.message);
    process.exit(1);
  });
