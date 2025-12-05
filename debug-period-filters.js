// Debug dos filtros de período
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugPeriodFilters() {
  console.log('🗓️  Debugando filtros de período...\n');
  
  const workspaceId = '00000000-0000-0000-0000-000000000010';
  
  // Verificar range completo dos dados
  const { data: rangeData, error: rangeError } = await supabase
    .from('performance_metrics')
    .select('metric_date, spend')
    .eq('workspace_id', workspaceId)
    .is('campaign_id', null)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .order('metric_date', { ascending: true });

  if (rangeError) {
    console.error('❌ Erro:', rangeError);
    return;
  }

  if (!rangeData || rangeData.length === 0) {
    console.log('❌ Nenhum dado encontrado');
    return;
  }

  const dates = rangeData.map(r => r.metric_date).filter(Boolean);
  const oldestDate = dates[0];
  const newestDate = dates[dates.length - 1];
  const totalSpend = rangeData.reduce((sum, row) => sum + Number(row.spend || 0), 0);

  console.log('📊 RANGE COMPLETO DOS DADOS:');
  console.table({
    'Data Mais Antiga': oldestDate,
    'Data Mais Recente': newestDate,
    'Total de Registros': rangeData.length,
    'Gasto Total (All Time)': `R$ ${totalSpend.toFixed(2)}`
  });

  // Testar diferentes filtros
  const testPeriods = [7, 14, 30, 60, 90];
  
  console.log('\n🔍 TESTANDO DIFERENTES PERÍODOS:\n');
  
  for (const days of testPeriods) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: periodData, error: periodError } = await supabase
      .from('performance_metrics')
      .select('metric_date, spend, impressions, clicks, conversions')
      .eq('workspace_id', workspaceId)
      .is('campaign_id', null)
      .is('ad_set_id', null)
      .is('ad_id', null)
      .gte('metric_date', sinceStr)
      .order('metric_date', { ascending: false });

    if (periodError) {
      console.error(`❌ Erro para ${days} dias:`, periodError);
      continue;
    }

    if (!periodData || periodData.length === 0) {
      console.log(`📅 Últimos ${days} dias: Nenhum dado`);
      continue;
    }

    const periodSpend = periodData.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const periodImpressions = periodData.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
    const periodClicks = periodData.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    const periodConversions = periodData.reduce((sum, row) => sum + Number(row.conversions || 0), 0);

    console.log(`📅 Últimos ${days} dias (desde ${sinceStr}):`);
    console.table({
      'Registros': periodData.length,
      'Período Real': `${periodData[periodData.length - 1]?.metric_date} → ${periodData[0]?.metric_date}`,
      'Gasto': `R$ ${periodSpend.toFixed(2)}`,
      'Impressões': periodImpressions.toLocaleString(),
      'Cliques': periodClicks,
      'Conversões': periodConversions,
      'CPC': periodClicks > 0 ? `R$ ${(periodSpend / periodClicks).toFixed(2)}` : 'N/A'
    });
    console.log('---');
  }

  // Verificar se há problemas de timezone
  console.log('\n🌍 VERIFICANDO TIMEZONE/DATA ATUAL:');
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  
  console.table({
    'Data Atual (Local)': now.toLocaleDateString('pt-BR'),
    'Data Atual (ISO)': today,
    'Ontem (ISO)': yesterday,
    'Data Mais Recente nos Dados': newestDate,
    'Diferença (dias)': Math.ceil((new Date(today).getTime() - new Date(newestDate).getTime()) / (24 * 60 * 60 * 1000))
  });

  // Verificar filtro padrão do dashboard (30 dias)
  console.log('\n📱 SIMULANDO FILTRO PADRÃO DO DASHBOARD (30 dias):');
  const dashboardSince = new Date();
  dashboardSince.setDate(dashboardSince.getDate() - 30);
  const dashboardSinceStr = dashboardSince.toISOString().slice(0, 10);

  const { data: dashboardData, error: dashboardError } = await supabase
    .from('performance_metrics')
    .select('metric_date, spend, impressions, clicks, conversions, platform_account_id')
    .eq('workspace_id', workspaceId)
    .is('campaign_id', null)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .gte('metric_date', dashboardSinceStr);

  if (dashboardData && dashboardData.length > 0) {
    // Simular deduplição do hook
    const latestByDateAndPlatform = new Map();
    for (const row of dashboardData) {
      const key = `${row.metric_date}::${row.platform_account_id || 'null'}`;
      const existing = latestByDateAndPlatform.get(key);
      if (!existing) {
        latestByDateAndPlatform.set(key, row);
      }
    }

    const deduped = Array.from(latestByDateAndPlatform.values());
    const dedupedSpend = deduped.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const originalSpend = dashboardData.reduce((sum, row) => sum + Number(row.spend || 0), 0);

    console.table({
      'Registros Originais': dashboardData.length,
      'Registros Após Deduplição': deduped.length,
      'Gasto Original': `R$ ${originalSpend.toFixed(2)}`,
      'Gasto Dedupado': `R$ ${dedupedSpend.toFixed(2)}`,
      'Diferença': `R$ ${(originalSpend - dedupedSpend).toFixed(2)}`,
      'Filtro Aplicado': `>= ${dashboardSinceStr}`
    });

    // Verificar duplicações
    const duplicates = dashboardData.length - deduped.length;
    if (duplicates > 0) {
      console.log(`\n⚠️  DUPLICAÇÕES ENCONTRADAS: ${duplicates} registros duplicados`);
      
      // Mostrar exemplos de duplicação
      const duplicateMap = new Map();
      for (const row of dashboardData) {
        const key = `${row.metric_date}::${row.platform_account_id || 'null'}`;
        if (!duplicateMap.has(key)) {
          duplicateMap.set(key, []);
        }
        duplicateMap.get(key).push(row);
      }

      let duplicateExamples = 0;
      for (const [key, rows] of duplicateMap.entries()) {
        if (rows.length > 1 && duplicateExamples < 3) {
          console.log(`\nDuplicação em ${key}:`);
          console.table(rows.map(row => ({
            date: row.metric_date,
            spend: row.spend,
            platform: row.platform_account_id
          })));
          duplicateExamples++;
        }
      }
    }
  }
}

debugPeriodFilters().catch(console.error);