#!/usr/bin/env node
/**
 * Relatório completo das campanhas Meta com dados no Supabase
 * - Fonte: view v_campaign_kpi (dia a dia)
 * - Saída: resumo do portfólio, top campanhas por investimento e por resultado
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKSPACE_ID = process.env.VITE_WORKSPACE_ID;

if (!supabaseUrl || !supabaseKey || !WORKSPACE_ID) {
  console.error('Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_WORKSPACE_ID');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatBRL(n) {
  return `R$ ${Number(n || 0).toFixed(2)}`;
}

function sum(arr) { return arr.reduce((a, b) => a + (Number(b) || 0), 0); }

async function analyzeMetaCampaigns() {
  console.log('\n📊 Análise de Campanhas Meta (todas com dados)\n');
  console.log('='.repeat(100));

  // Carregar linhas da view v_campaign_kpi
  const { data: rows, error } = await supabase
    .from('v_campaign_kpi')
    .select('campaign_id, metric_date, spend, revenue, result_label, result_value, roas, platform_key, workspace_id')
    .eq('platform_key', 'meta')
    .eq('workspace_id', WORKSPACE_ID)
    .not('campaign_id', 'is', null);

  if (error) {
    console.error('Erro ao consultar v_campaign_kpi:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('⚠️ Nenhum dado encontrado em v_campaign_kpi para Meta.');
    process.exit(0);
  }

  // Agregar por campanha
  /** @type {Record<string, any>} */
  const byCampaign = {};

  for (const r of rows) {
    const cid = r.campaign_id;
    if (!byCampaign[cid]) {
      byCampaign[cid] = {
        campaign_id: cid,
        spend: 0,
        revenue: 0,
        results: { Leads: 0, Conversas: 0, Cliques: 0, Engajamentos: 0, Views: 0, Compras: 0, Resultados: 0 },
        roasValues: [],
        firstDate: r.metric_date,
        lastDate: r.metric_date,
      };
    }
    const agg = byCampaign[cid];
    agg.spend += Number(r.spend) || 0;
    agg.revenue += Number(r.revenue) || 0;
    if (r.result_label && (r.result_value || r.result_value === 0)) {
      const lbl = r.result_label;
      if (agg.results[lbl] === undefined) agg.results[lbl] = 0;
      agg.results[lbl] += Number(r.result_value) || 0;
    }
    if (r.roas != null) agg.roasValues.push(Number(r.roas));
    if (r.metric_date < agg.firstDate) agg.firstDate = r.metric_date;
    if (r.metric_date > agg.lastDate) agg.lastDate = r.metric_date;
  }

  const campaignIds = Object.keys(byCampaign);

  // Buscar nomes/objetivos/status das campanhas
  const { data: campaignsInfo } = await supabase
    .from('campaigns')
    .select('id, name, objective, status')
    .in('id', campaignIds);

  const infoById = {};
  campaignsInfo?.forEach(c => { infoById[c.id] = c; });

  // Enriquecer agregados com info
  for (const cid of campaignIds) {
    const info = infoById[cid] || {};
    byCampaign[cid].name = info.name || `Campanha ${cid}`;
    byCampaign[cid].objective = info.objective || 'UNKNOWN';
    byCampaign[cid].status = info.status || 'unknown';
    // label primária por objetivo
    const obj = String(byCampaign[cid].objective).toUpperCase();
    let primaryLabel = 'Resultados';
    if (['OUTCOME_LEADS','LEAD_GENERATION'].includes(obj)) primaryLabel = 'Leads';
    else if (['MESSAGES','OUTCOME_MESSAGES'].includes(obj)) primaryLabel = 'Conversas';
    else if (['LINK_CLICKS','OUTCOME_TRAFFIC','TRAFFIC'].includes(obj)) primaryLabel = 'Cliques';
    else if (['OUTCOME_ENGAGEMENT','POST_ENGAGEMENT','ENGAGEMENT'].includes(obj)) primaryLabel = 'Engajamentos';
    else if (['VIDEO_VIEWS'].includes(obj)) primaryLabel = 'Views';
    else if (['SALES','CONVERSIONS','OUTCOME_SALES','PURCHASE'].includes(obj)) primaryLabel = 'Compras';
    byCampaign[cid].primaryLabel = primaryLabel;
    byCampaign[cid].primaryResult = byCampaign[cid].results[primaryLabel] || 0;
    byCampaign[cid].costPerPrimary = byCampaign[cid].primaryResult > 0 ? (byCampaign[cid].spend / byCampaign[cid].primaryResult) : null;
    byCampaign[cid].avgRoas = byCampaign[cid].roasValues.length > 0 ? (sum(byCampaign[cid].roasValues) / byCampaign[cid].roasValues.length) : null;
  }

  // Resumo do portfólio
  const portfolio = {
    campaignsCount: campaignIds.length,
    spend: 0,
    revenue: 0,
    results: { Leads: 0, Conversas: 0, Cliques: 0, Engajamentos: 0, Views: 0, Compras: 0, Resultados: 0 },
  };

  for (const c of Object.values(byCampaign)) {
    portfolio.spend += c.spend;
    portfolio.revenue += c.revenue;
    for (const [lbl, val] of Object.entries(c.results)) {
      portfolio.results[lbl] += Number(val) || 0;
    }
  }

  console.log('📦 Portfólio Meta:');
  console.log(`   Campanhas com dados: ${portfolio.campaignsCount}`);
  console.log(`   Investimento total: ${formatBRL(portfolio.spend)}`);
  console.log(`   Receita total (se houver): ${formatBRL(portfolio.revenue)}`);
  console.log(`   Leads: ${portfolio.results.Leads}`);
  console.log(`   Conversas: ${portfolio.results.Conversas}`);
  console.log(`   Cliques: ${portfolio.results.Cliques}`);
  console.log(`   Engajamentos: ${portfolio.results.Engajamentos}`);
  console.log(`   Views: ${portfolio.results.Views}`);
  console.log(`   Compras: ${portfolio.results.Compras}`);
  console.log('');

  // Rankings
  const arr = Object.values(byCampaign);
  const topBySpend = [...arr].sort((a, b) => b.spend - a.spend).slice(0, 10);
  const topByPrimary = [...arr].sort((a, b) => b.primaryResult - a.primaryResult).slice(0, 10);

  console.log('💰 Top 10 por Investimento:');
  topBySpend.forEach((c, i) => {
    console.log(`   ${i+1}. ${c.name} | ${formatBRL(c.spend)} | Obj: ${c.objective} | ${c.primaryLabel}: ${c.primaryResult} | CPR: ${c.costPerPrimary ? formatBRL(c.costPerPrimary) : 'N/A'} | ROAS médio: ${c.avgRoas?.toFixed(2) || 'N/A'}`);
  });
  console.log('');

  console.log('🏆 Top 10 por Resultado Primário:');
  topByPrimary.forEach((c, i) => {
    console.log(`   ${i+1}. ${c.name} | ${c.primaryLabel}: ${c.primaryResult} | Invest: ${formatBRL(c.spend)} | CPR: ${c.costPerPrimary ? formatBRL(c.costPerPrimary) : 'N/A'} | ROAS médio: ${c.avgRoas?.toFixed(2) || 'N/A'} | Janela: ${c.firstDate} → ${c.lastDate}`);
  });
  console.log('');

  // Sinais de oportunidade
  const highSpendLowResult = arr.filter(c => c.spend > 100 && (c.primaryResult || 0) === 0).slice(0, 5);
  if (highSpendLowResult.length) {
    console.log('⚠️  Campanhas com gasto > R$ 100 e zero resultado primário:');
    highSpendLowResult.forEach(c => {
      console.log(`   - ${c.name} | Obj: ${c.objective} | Invest: ${formatBRL(c.spend)} | ${c.primaryLabel}: 0`);
    });
    console.log('');
  }

  console.log('='.repeat(100));
  console.log('\n✅ Análise completa concluída!\n');
}

analyzeMetaCampaigns().catch(err => {
  console.error('❌ Falha na análise:', err.message);
  console.error(err);
  process.exit(1);
});

