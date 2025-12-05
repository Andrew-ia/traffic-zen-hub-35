// Debug específico da lógica de conversões
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Reproduzindo a lógica dos hooks
const CONVERSATION_STARTED_ACTION = "onsite_conversion.messaging_conversation_started_7d";
const CONVERSATION_CONNECTION_ACTION = "onsite_conversion.total_messaging_connection";

function getActionValueForType(extraMetrics, actionType) {
  const actions = Array.isArray(extraMetrics?.actions) ? extraMetrics.actions ?? [] : [];
  const match = actions.find((action) => action?.action_type === actionType);
  if (!match) return null;
  const asNumber = Number(match.value ?? 0);
  return Number.isNaN(asNumber) ? null : asNumber;
}

function getActionValueAmount(extraMetrics, actionType) {
  const actionValues = Array.isArray(extraMetrics?.action_values) ? extraMetrics?.action_values ?? [] : [];
  const match = actionValues.find((action) => action?.action_type === actionType);
  if (!match) return null;
  const asNumber = Number(match.value ?? 0);
  return Number.isNaN(asNumber) ? null : asNumber;
}

async function debugConversionLogic() {
  console.log('🔍 Debugando lógica de conversões...\n');
  
  const workspaceId = '00000000-0000-0000-0000-000000000010';
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: rawData, error } = await supabase
    .from('performance_metrics')
    .select('metric_date, spend, impressions, clicks, conversions, conversion_value, extra_metrics, platform_account_id')
    .eq('workspace_id', workspaceId)
    .is('campaign_id', null)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .gte('metric_date', sinceStr)
    .order('metric_date', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log(`📊 Analisando ${rawData.length} registros...\n`);

  let totalSpend = 0;
  let totalConversions = 0;
  let totalConversionValue = 0;
  let totalStarted = 0;
  let totalConnections = 0;
  let totalClicks = 0;
  let totalImpressions = 0;

  const problemRows = [];

  for (const row of rawData) {
    const spend = Number(row.spend || 0);
    const impressions = Number(row.impressions || 0);
    const clicks = Number(row.clicks || 0);
    const conversions = Number(row.conversions || 0);
    const conversionValue = Number(row.conversion_value || 0);
    
    totalSpend += spend;
    totalImpressions += impressions;
    totalClicks += clicks;
    totalConversions += conversions;
    totalConversionValue += conversionValue;

    // Analisar extra_metrics
    const extraMetrics = row.extra_metrics;
    const started = getActionValueForType(extraMetrics, CONVERSATION_STARTED_ACTION) || 0;
    const connections = getActionValueForType(extraMetrics, CONVERSATION_CONNECTION_ACTION) || 0;
    
    totalStarted += started;
    totalConnections += connections;

    // Verificar se há action_values com valores monetários
    const purchaseValue = getActionValueAmount(extraMetrics, 'purchase') || 
                         getActionValueAmount(extraMetrics, 'omni_purchase') || 0;

    // Identificar problemas
    if (conversions > 0 && conversionValue === 0) {
      problemRows.push({
        date: row.metric_date,
        conversions,
        conversionValue,
        started,
        connections,
        purchaseValue,
        hasActionValues: Array.isArray(extraMetrics?.action_values) && extraMetrics.action_values.length > 0
      });
    }

    if (started > 0 || connections > 0) {
      console.log(`📅 ${row.metric_date}: Gasto R$${spend.toFixed(2)} | Conversas: ${started} | Conexões: ${connections} | Conv.Value: R$${conversionValue.toFixed(2)}`);
    }
  }

  console.log('\n📊 TOTAIS RECALCULADOS:');
  console.table({
    'Gasto Total': `R$ ${totalSpend.toFixed(2)}`,
    'Impressões': totalImpressions.toLocaleString(),
    'Cliques': totalClicks.toLocaleString(),
    'Conversões (DB)': totalConversions,
    'Conversas Iniciadas': totalStarted,
    'Conexões': totalConnections,
    'Valor de Conversão (DB)': `R$ ${totalConversionValue.toFixed(2)}`,
    'ROAS (DB)': totalSpend > 0 ? (totalConversionValue / totalSpend).toFixed(4) : '0',
    'ROAS Usando Conversas': totalSpend > 0 && totalStarted > 0 ? `${totalStarted} conversas / R$ ${totalSpend.toFixed(2)}` : 'N/A',
    'CPC': totalClicks > 0 ? `R$ ${(totalSpend / totalClicks).toFixed(2)}` : 'N/A'
  });

  if (problemRows.length > 0) {
    console.log('\n⚠️ PROBLEMAS ENCONTRADOS:');
    console.log(`${problemRows.length} registros com conversões mas sem valor monetário:`);
    console.table(problemRows.slice(0, 5));
  }

  // Verificar se o problema está na lógica do hook
  console.log('\n🔧 TESTANDO LÓGICA DO HOOK usePerformanceMetrics...');
  
  // Simular o que o hook faz
  const latestByDateAndPlatform = new Map();
  for (const row of rawData) {
    const key = `${row.metric_date}::${row.platform_account_id || 'null'}`;
    latestByDateAndPlatform.set(key, row);
  }

  const byDate = new Map();
  for (const row of latestByDateAndPlatform.values()) {
    const date = row.metric_date;
    const started = getActionValueForType(row.extra_metrics, CONVERSATION_STARTED_ACTION) || 0;
    const connections = getActionValueForType(row.extra_metrics, CONVERSATION_CONNECTION_ACTION) || 0;
    
    // O hook está usando apenas conversas iniciadas como conversões
    const conversions = started; // Esta é a lógica no hook (linha 150)
    
    const existing = byDate.get(date) || {
      date,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversationsStarted: 0,
      messagingConnections: 0,
      spend: 0,
      conversionValue: 0,
      roas: 0,
    };

    existing.impressions += Number(row.impressions || 0);
    existing.clicks += Number(row.clicks || 0);
    existing.conversions += conversions;
    existing.conversationsStarted += started;
    existing.messagingConnections += connections;
    existing.spend += Number(row.spend || 0);
    existing.conversionValue += Number(row.conversion_value || 0);
    existing.roas = existing.spend > 0 ? existing.conversionValue / existing.spend : 0;

    byDate.set(date, existing);
  }

  const points = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totals = points.reduce((acc, point) => {
    acc.impressions += point.impressions;
    acc.clicks += point.clicks;
    acc.conversions += point.conversions;
    acc.spend += point.spend;
    acc.conversionValue += point.conversionValue;
    return acc;
  }, { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversionValue: 0 });

  console.log('\n✅ RESULTADO DA LÓGICA DO HOOK:');
  console.table({
    'Conversões (Hook)': totals.conversions,
    'Gasto (Hook)': `R$ ${totals.spend.toFixed(2)}`,
    'Valor Conversão (Hook)': `R$ ${totals.conversionValue.toFixed(2)}`,
    'ROAS (Hook)': totals.spend > 0 ? (totals.conversionValue / totals.spend).toFixed(4) : '0'
  });
}

debugConversionLogic().catch(console.error);