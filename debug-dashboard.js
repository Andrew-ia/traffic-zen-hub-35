// Script para debug dos dados do dashboard
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugDashboardData() {
  console.log('🔍 Debugando dados do dashboard...\n');
  
  const workspaceId = '00000000-0000-0000-0000-000000000010';
  
  // 1. Verificar dados de performance metrics
  console.log('1. Verificando performance_metrics...');
  const { data: metricsData, error: metricsError } = await supabase
    .from('performance_metrics')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('campaign_id', null)
    .is('ad_set_id', null) 
    .is('ad_id', null)
    .gte('metric_date', '2024-11-01')
    .order('metric_date', { ascending: false })
    .limit(10);

  if (metricsError) {
    console.error('❌ Erro ao buscar performance_metrics:', metricsError);
  } else {
    console.log(`✅ Encontrados ${metricsData?.length || 0} registros de métricas`);
    if (metricsData && metricsData.length > 0) {
      console.log('Amostra dos dados:');
      console.table(metricsData.slice(0, 3).map(row => ({
        date: row.metric_date,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: row.conversions,
        platform_account: row.platform_account_id
      })));
    }
  }

  // 2. Verificar contas de plataforma
  console.log('\n2. Verificando platform_accounts...');
  const { data: accountsData, error: accountsError } = await supabase
    .from('platform_accounts')
    .select('id, name, platform')
    .eq('workspace_id', workspaceId);

  if (accountsError) {
    console.error('❌ Erro ao buscar platform_accounts:', accountsError);
  } else {
    console.log(`✅ Encontradas ${accountsData?.length || 0} contas`);
    if (accountsData && accountsData.length > 0) {
      console.table(accountsData);
    }
  }

  // 3. Verificar campanhas
  console.log('\n3. Verificando campaigns...');
  const { data: campaignsData, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, objective, status')
    .eq('workspace_id', workspaceId)
    .limit(10);

  if (campaignsError) {
    console.error('❌ Erro ao buscar campaigns:', campaignsError);
  } else {
    console.log(`✅ Encontradas ${campaignsData?.length || 0} campanhas`);
    if (campaignsData && campaignsData.length > 0) {
      console.table(campaignsData.slice(0, 5));
    }
  }

  // 4. Verificar dados agregados específicos para dashboard
  console.log('\n4. Verificando dados agregados para dashboard...');
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: dashboardData, error: dashboardError } = await supabase
    .from('performance_metrics')
    .select('metric_date, impressions, clicks, conversions, spend, conversion_value, extra_metrics, platform_account_id')
    .eq('workspace_id', workspaceId)
    .is('campaign_id', null)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .gte('metric_date', sinceStr);

  if (dashboardError) {
    console.error('❌ Erro ao buscar dados do dashboard:', dashboardError);
  } else {
    console.log(`✅ Encontrados ${dashboardData?.length || 0} registros para dashboard (últimos 30 dias)`);
    
    if (dashboardData && dashboardData.length > 0) {
      // Calcular totais
      const totals = dashboardData.reduce((acc, row) => {
        acc.spend += Number(row.spend || 0);
        acc.impressions += Number(row.impressions || 0);
        acc.clicks += Number(row.clicks || 0);
        acc.conversions += Number(row.conversions || 0);
        acc.conversionValue += Number(row.conversion_value || 0);
        return acc;
      }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 });

      console.log('\n📊 Totais calculados:');
      console.table({
        'Gasto Total': `R$ ${totals.spend.toFixed(2)}`,
        'Impressões': totals.impressions.toLocaleString(),
        'Cliques': totals.clicks.toLocaleString(),
        'Conversões': totals.conversions,
        'Valor de Conversão': `R$ ${totals.conversionValue.toFixed(2)}`,
        'ROAS': totals.spend > 0 ? (totals.conversionValue / totals.spend).toFixed(2) : '0',
        'CPC': totals.clicks > 0 ? `R$ ${(totals.spend / totals.clicks).toFixed(2)}` : 'N/A',
        'CPM': totals.impressions > 0 ? `R$ ${((totals.spend / totals.impressions) * 1000).toFixed(2)}` : 'N/A'
      });

      // Verificar se há dados de extra_metrics
      const withExtraMetrics = dashboardData.filter(row => row.extra_metrics && Object.keys(row.extra_metrics).length > 0);
      console.log(`\n📋 Registros com extra_metrics: ${withExtraMetrics.length}/${dashboardData.length}`);
      
      if (withExtraMetrics.length > 0) {
        console.log('Exemplo de extra_metrics:');
        console.log(JSON.stringify(withExtraMetrics[0].extra_metrics, null, 2));
      }
    }
  }
}

debugDashboardData().catch(console.error);