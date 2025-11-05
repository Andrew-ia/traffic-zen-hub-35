#!/usr/bin/env node
/**
 * Script de Auditoria de Dados do Meta Ads
 *
 * Analisa inconsistências entre:
 * - Dados brutos na tabela performance_metrics
 * - Dados agregados retornados pela API
 * - Comparação com Dashboard
 * - Filtros aplicados
 * - Timezone e data de processamento
 *
 * Uso:
 * node scripts/audit-meta-data.js
 * node scripts/audit-meta-data.js --days 7
 * node scripts/audit-meta-data.js --detailed
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const DAYS = daysArg ? Number(daysArg.split('=')[1]) : 7;
const DETAILED = args.includes('--detailed');

const workspaceId = process.env.META_WORKSPACE_ID || process.env.WORKSPACE_ID || process.env.VITE_WORKSPACE_ID;
if (!workspaceId) {
  console.error('❌ Missing workspace ID in environment variables');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

async function getWorkspaceInfo() {
  const { rows } = await client.query(`
    SELECT id, name
    FROM workspaces
    WHERE id = $1
  `, [workspaceId]);

  return rows[0];
}

async function getPlatformAccounts() {
  const { rows } = await client.query(`
    SELECT id, name, platform_key, external_id
    FROM platform_accounts
    WHERE workspace_id = $1 AND platform_key = 'meta'
  `, [workspaceId]);

  return rows;
}

async function getActiveCampaigns() {
  const { rows } = await client.query(`
    SELECT
      c.id,
      c.external_id,
      c.name,
      c.status,
      c.platform_account_id,
      pa.name as account_name,
      c.last_synced_at,
      c.updated_at
    FROM campaigns c
    JOIN platform_accounts pa ON pa.id = c.platform_account_id
    WHERE c.workspace_id = $1
      AND c.platform_account_id IN (
        SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
      )
    ORDER BY c.updated_at DESC
  `, [workspaceId]);

  return rows;
}

async function getRawMetrics(days) {
  const { rows } = await client.query(`
    SELECT
      metric_date,
      granularity,
      campaign_id,
      ad_set_id,
      ad_id,
      impressions,
      clicks,
      spend,
      conversions,
      conversion_value,
      ctr,
      cpc,
      cpa,
      roas,
      synced_at
    FROM performance_metrics
    WHERE workspace_id = $1
      AND platform_account_id IN (
        SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
      )
      AND metric_date >= CURRENT_DATE - $2::int
      AND granularity = 'day'
    ORDER BY metric_date DESC, campaign_id, ad_set_id, ad_id
  `, [workspaceId, days]);

  return rows;
}

async function getMetricsByLevel(days, level) {
  let condition = '';
  if (level === 'account') {
    condition = 'AND ad_id IS NULL AND ad_set_id IS NULL AND campaign_id IS NULL';
  } else if (level === 'campaign') {
    condition = 'AND ad_id IS NULL AND ad_set_id IS NULL AND campaign_id IS NOT NULL';
  } else if (level === 'adset') {
    condition = 'AND ad_id IS NULL AND ad_set_id IS NOT NULL';
  } else if (level === 'ad') {
    condition = 'AND ad_id IS NOT NULL';
  }

  const { rows } = await client.query(`
    SELECT
      metric_date,
      COUNT(*) as row_count,
      SUM(impressions)::float8 as impressions,
      SUM(clicks)::float8 as clicks,
      SUM(spend)::float8 as spend,
      SUM(conversions)::float8 as conversions,
      SUM(conversion_value)::float8 as conversion_value,
      AVG(ctr)::float8 as avg_ctr,
      AVG(cpc)::float8 as avg_cpc,
      AVG(roas)::float8 as avg_roas
    FROM performance_metrics
    WHERE workspace_id = $1
      AND platform_account_id IN (
        SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
      )
      AND metric_date >= CURRENT_DATE - $2::int
      AND granularity = 'day'
      ${condition}
    GROUP BY metric_date
    ORDER BY metric_date DESC
  `, [workspaceId, days]);

  return rows;
}

async function checkDuplicates(days) {
  const { rows } = await client.query(`
    SELECT
      workspace_id,
      platform_account_id,
      campaign_id,
      ad_set_id,
      ad_id,
      granularity,
      metric_date,
      COUNT(*) as duplicate_count
    FROM performance_metrics
    WHERE workspace_id = $1
      AND metric_date >= CURRENT_DATE - $2::int
    GROUP BY
      workspace_id,
      platform_account_id,
      campaign_id,
      ad_set_id,
      ad_id,
      granularity,
      metric_date
    HAVING COUNT(*) > 1
  `, [workspaceId, days]);

  return rows;
}

async function getAggregationComparison(days) {
  // Simula a query CORRIGIDA do endpoint /api/metrics/aggregate
  const { rows } = await client.query(`
    WITH ranked_metrics AS (
      SELECT
        pm.*,
        ROW_NUMBER() OVER (
          PARTITION BY
            pm.platform_account_id,
            COALESCE(pm.campaign_id, '00000000-0000-0000-0000-000000000000'::uuid),
            pm.metric_date
          ORDER BY
            CASE
              WHEN pm.ad_id IS NOT NULL THEN 3
              WHEN pm.ad_set_id IS NOT NULL THEN 2
              WHEN pm.campaign_id IS NOT NULL THEN 1
              ELSE 0
            END DESC
        ) as rn
      FROM performance_metrics pm
      WHERE pm.workspace_id = $1
        AND pm.platform_account_id IN (
          SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
        )
        AND pm.granularity = 'day'
        AND pm.metric_date >= CURRENT_DATE - $2::int
    ),
    deduplicated AS (
      SELECT
        campaign_id,
        platform_account_id,
        metric_date,
        spend,
        conversions,
        conversion_value,
        impressions,
        clicks,
        roas
      FROM ranked_metrics
      WHERE rn = 1
    )
    SELECT
      SUM(spend)::float8 as spend,
      SUM(conversions)::float8 as results,
      SUM(conversion_value)::float8 as revenue,
      SUM(COALESCE(roas, 0) * COALESCE(spend, 0))::float8 as roas_weighted_spend,
      SUM(impressions)::float8 as impressions,
      SUM(clicks)::float8 as clicks
    FROM deduplicated
  `, [workspaceId, days]);

  return rows[0];
}

async function getSimpleSum(days) {
  // Soma simples de todas as métricas (pode causar duplicação)
  const { rows } = await client.query(`
    SELECT
      SUM(spend)::float8 as spend,
      SUM(conversions)::float8 as conversions,
      SUM(conversion_value)::float8 as conversion_value,
      SUM(impressions)::float8 as impressions,
      SUM(clicks)::float8 as clicks
    FROM performance_metrics
    WHERE workspace_id = $1
      AND platform_account_id IN (
        SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
      )
      AND metric_date >= CURRENT_DATE - $2::int
      AND granularity = 'day'
  `, [workspaceId, days]);

  return rows[0];
}

async function getDateRangeInfo(days) {
  const { rows } = await client.query(`
    SELECT
      MIN(metric_date) as oldest_date,
      MAX(metric_date) as newest_date,
      COUNT(DISTINCT metric_date) as distinct_dates,
      CURRENT_DATE - MAX(metric_date)::date as days_behind
    FROM performance_metrics
    WHERE workspace_id = $1
      AND platform_account_id IN (
        SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
      )
      AND metric_date >= CURRENT_DATE - $2::int
  `, [workspaceId, days]);

  return rows[0];
}

async function getSyncStatus() {
  const { rows } = await client.query(`
    SELECT
      c.id,
      c.name,
      c.status,
      c.last_synced_at,
      c.updated_at,
      (
        SELECT MAX(metric_date)
        FROM performance_metrics pm
        WHERE pm.campaign_id = c.id
      ) as last_metric_date,
      (
        SELECT COUNT(*)
        FROM performance_metrics pm
        WHERE pm.campaign_id = c.id
          AND pm.metric_date >= CURRENT_DATE - $2::int
      ) as metrics_count_last_period
    FROM campaigns c
    WHERE c.workspace_id = $1
      AND c.platform_account_id IN (
        SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
      )
    ORDER BY c.last_synced_at DESC NULLS LAST
    LIMIT 20
  `, [workspaceId, DAYS]);

  return rows;
}

async function getDemographicBreakdowns(days) {
  const { rows } = await client.query(`
    SELECT
      breakdown_key,
      breakdown_value_key,
      COUNT(*) as row_count,
      SUM(impressions)::float8 as impressions,
      SUM(clicks)::float8 as clicks,
      SUM(spend)::float8 as spend,
      SUM(conversions)::float8 as conversions
    FROM performance_metric_breakdowns
    WHERE workspace_id = $1
      AND platform_account_id IN (
        SELECT id FROM platform_accounts WHERE workspace_id = $1 AND platform_key = 'meta'
      )
      AND metric_date >= CURRENT_DATE - $2::int
    GROUP BY breakdown_key, breakdown_value_key
    ORDER BY breakdown_key, impressions DESC
  `, [workspaceId, days]);

  return rows;
}

async function runAudit() {
  console.log('🔍 AUDITORIA DE DADOS DO META ADS\n');
  console.log('='.repeat(80));
  console.log(`Workspace ID: ${workspaceId}`);
  console.log(`Período: últimos ${DAYS} dias`);
  console.log(`Modo detalhado: ${DETAILED ? 'SIM' : 'NÃO'}`);
  console.log('='.repeat(80));
  console.log('');

  await client.connect();

  // 1. INFORMAÇÕES DO WORKSPACE
  console.log('📋 1. INFORMAÇÕES DO WORKSPACE');
  console.log('-'.repeat(80));
  const workspace = await getWorkspaceInfo();
  console.log(`Nome: ${workspace?.name || 'N/A'}`);
  console.log(`ID: ${workspace?.id || workspaceId}`);
  console.log('');

  // 2. CONTAS DA PLATAFORMA
  console.log('🏢 2. CONTAS META CONECTADAS');
  console.log('-'.repeat(80));
  const accounts = await getPlatformAccounts();
  accounts.forEach((acc, i) => {
    console.log(`${i + 1}. ${acc.name} (${acc.external_id})`);
    console.log(`   ID interno: ${acc.id}`);
  });
  console.log(`Total de contas: ${accounts.length}`);
  console.log('');

  // 3. CAMPANHAS ATIVAS
  console.log('📊 3. CAMPANHAS RECENTES');
  console.log('-'.repeat(80));
  const campaigns = await getActiveCampaigns();
  console.log(`Total de campanhas: ${campaigns.length}`);
  console.log('');
  if (DETAILED) {
    campaigns.slice(0, 10).forEach((camp, i) => {
      console.log(`${i + 1}. ${camp.name}`);
      console.log(`   Status: ${camp.status}`);
      console.log(`   Última sincronização: ${camp.last_synced_at || 'Nunca'}`);
      console.log(`   Atualizada em: ${camp.updated_at}`);
    });
    console.log('');
  }

  // 4. RANGE DE DATAS
  console.log('📅 4. ANÁLISE DE DATAS DOS DADOS');
  console.log('-'.repeat(80));
  const dateInfo = await getDateRangeInfo(DAYS);
  console.log(`Data mais antiga: ${dateInfo.oldest_date}`);
  console.log(`Data mais recente: ${dateInfo.newest_date}`);
  console.log(`Dias distintos com dados: ${dateInfo.distinct_dates}`);
  console.log(`⚠️  ATRASO: ${dateInfo.days_behind} dias atrás do dia atual`);

  if (dateInfo.days_behind > 1) {
    console.log(`\n⚠️  PROBLEMA IDENTIFICADO: Os dados estão ${dateInfo.days_behind} dias atrasados!`);
    console.log(`   Isso explica por que os dados só aparecem até 2 dias anteriores.`);
    console.log(`   Possíveis causas:`);
    console.log(`   - A sincronização não está rodando diariamente`);
    console.log(`   - A API do Meta tem atraso no processamento`);
    console.log(`   - Configuração de timezone incorreta`);
  }
  console.log('');

  // 5. VERIFICAR DUPLICAÇÕES
  console.log('🔄 5. VERIFICAÇÃO DE DUPLICAÇÕES');
  console.log('-'.repeat(80));
  const duplicates = await checkDuplicates(DAYS);
  if (duplicates.length === 0) {
    console.log('✅ Nenhuma duplicação encontrada');
  } else {
    console.log(`❌ PROBLEMA: Encontradas ${duplicates.length} duplicações!`);
    if (DETAILED) {
      duplicates.forEach((dup, i) => {
        console.log(`${i + 1}. Data: ${dup.metric_date}, Duplicatas: ${dup.duplicate_count}`);
      });
    }
  }
  console.log('');

  // 6. MÉTRICAS POR NÍVEL
  console.log('📈 6. MÉTRICAS POR NÍVEL DE GRANULARIDADE');
  console.log('-'.repeat(80));

  const accountLevel = await getMetricsByLevel(DAYS, 'account');
  const campaignLevel = await getMetricsByLevel(DAYS, 'campaign');
  const adsetLevel = await getMetricsByLevel(DAYS, 'adset');
  const adLevel = await getMetricsByLevel(DAYS, 'ad');

  const sumAccountSpend = accountLevel.reduce((sum, r) => sum + Number(r.spend || 0), 0);
  const sumCampaignSpend = campaignLevel.reduce((sum, r) => sum + Number(r.spend || 0), 0);
  const sumAdsetSpend = adsetLevel.reduce((sum, r) => sum + Number(r.spend || 0), 0);
  const sumAdSpend = adLevel.reduce((sum, r) => sum + Number(r.spend || 0), 0);

  console.log(`Nível CONTA:     ${formatCurrency(sumAccountSpend)} (${accountLevel.length} registros)`);
  console.log(`Nível CAMPANHA:  ${formatCurrency(sumCampaignSpend)} (${campaignLevel.length} registros)`);
  console.log(`Nível ADSET:     ${formatCurrency(sumAdsetSpend)} (${adsetLevel.length} registros)`);
  console.log(`Nível ANÚNCIO:   ${formatCurrency(sumAdSpend)} (${adLevel.length} registros)`);

  console.log('');
  console.log('⚠️  ANÁLISE: Os valores devem ser similares. Grandes diferenças indicam:');
  console.log('   - Falta de dados em níveis granulares');
  console.log('   - Problemas na agregação');
  console.log('   - Campanhas sem anúncios ativos');
  console.log('');

  // 7. COMPARAÇÃO SOMA SIMPLES VS AGREGAÇÃO INTELIGENTE
  console.log('🧮 7. COMPARAÇÃO: SOMA SIMPLES vs AGREGAÇÃO ENDPOINT');
  console.log('-'.repeat(80));

  const simpleSum = await getSimpleSum(DAYS);
  const aggregated = await getAggregationComparison(DAYS);

  console.log('Soma Simples (todos os registros):');
  console.log(`  Investimento:  ${formatCurrency(simpleSum.spend || 0)}`);
  console.log(`  Conversões:    ${formatNumber(simpleSum.conversions || 0)}`);
  console.log(`  Receita:       ${formatCurrency(simpleSum.conversion_value || 0)}`);
  console.log(`  Impressões:    ${formatNumber(simpleSum.impressions || 0)}`);
  console.log(`  Cliques:       ${formatNumber(simpleSum.clicks || 0)}`);
  console.log('');

  console.log('Agregação Inteligente (endpoint /api/metrics/aggregate):');
  console.log(`  Investimento:  ${formatCurrency(aggregated.spend || 0)}`);
  console.log(`  Conversões:    ${formatNumber(aggregated.results || 0)}`);
  console.log(`  Receita:       ${formatCurrency(aggregated.revenue || 0)}`);
  console.log(`  Impressões:    ${formatNumber(aggregated.impressions || 0)}`);
  console.log(`  Cliques:       ${formatNumber(aggregated.clicks || 0)}`);
  console.log('');

  const spendDiff = ((simpleSum.spend - aggregated.spend) / simpleSum.spend) * 100;
  const impressionsDiff = ((simpleSum.impressions - aggregated.impressions) / simpleSum.impressions) * 100;

  console.log('Diferença percentual:');
  console.log(`  Investimento:  ${spendDiff.toFixed(2)}% ${spendDiff > 5 ? '⚠️  ALTA' : '✅'}`);
  console.log(`  Impressões:    ${impressionsDiff.toFixed(2)}% ${impressionsDiff > 5 ? '⚠️  ALTA' : '✅'}`);

  if (spendDiff > 5 || impressionsDiff > 5) {
    console.log('');
    console.log('❌ PROBLEMA: Diferença significativa entre soma simples e agregação!');
    console.log('   Isso pode indicar:');
    console.log('   - Duplicação de métricas em diferentes níveis');
    console.log('   - Lógica de priorização com problemas');
    console.log('   - Métricas órfãs sem relacionamento correto');
  }
  console.log('');

  // 8. DADOS DEMOGRÁFICOS
  console.log('👥 8. DADOS DEMOGRÁFICOS (BREAKDOWNS)');
  console.log('-'.repeat(80));
  const demographics = await getDemographicBreakdowns(DAYS);

  const ageData = demographics.filter(d => d.breakdown_key === 'age');
  const genderData = demographics.filter(d => d.breakdown_key === 'gender');

  console.log('Idade:');
  if (ageData.length === 0) {
    console.log('  ⚠️  Nenhum dado demográfico de idade encontrado');
  } else {
    ageData.forEach(d => {
      console.log(`  ${d.breakdown_value_key}: ${formatNumber(d.impressions)} impressões, ${formatCurrency(d.spend)}`);
    });
  }
  console.log('');

  console.log('Gênero:');
  if (genderData.length === 0) {
    console.log('  ⚠️  Nenhum dado demográfico de gênero encontrado');
  } else {
    genderData.forEach(d => {
      console.log(`  ${d.breakdown_value_key}: ${formatNumber(d.impressions)} impressões, ${formatCurrency(d.spend)}`);
    });
  }
  console.log('');

  // 9. STATUS DE SINCRONIZAÇÃO
  console.log('🔄 9. STATUS DE SINCRONIZAÇÃO DAS CAMPANHAS');
  console.log('-'.repeat(80));
  const syncStatus = await getSyncStatus();

  syncStatus.forEach((s, i) => {
    console.log(`${i + 1}. ${s.name}`);
    console.log(`   Status: ${s.status}`);
    console.log(`   Última sync: ${s.last_synced_at || 'Nunca'}`);
    console.log(`   Última métrica: ${s.last_metric_date || 'Sem dados'}`);
    console.log(`   Métricas no período: ${s.metrics_count_last_period}`);
    console.log('');
  });

  // 10. RESUMO E RECOMENDAÇÕES
  console.log('📝 10. RESUMO E RECOMENDAÇÕES');
  console.log('='.repeat(80));

  const issues = [];

  if (dateInfo.days_behind > 1) {
    issues.push({
      severity: 'CRÍTICO',
      issue: `Dados ${dateInfo.days_behind} dias atrasados`,
      recommendation: 'Verificar se o script de sincronização está rodando diariamente. Executar: node scripts/meta/sync-incremental.js --days=7'
    });
  }

  if (duplicates.length > 0) {
    issues.push({
      severity: 'ALTO',
      issue: `${duplicates.length} duplicações encontradas`,
      recommendation: 'Revisar constraint UNIQUE na tabela performance_metrics e garantir que o upsert está funcionando corretamente'
    });
  }

  if (spendDiff > 5) {
    issues.push({
      severity: 'MÉDIO',
      issue: `Diferença de ${spendDiff.toFixed(2)}% entre soma simples e agregação`,
      recommendation: 'Revisar lógica de priorização no endpoint /api/metrics/aggregate'
    });
  }

  if (ageData.length === 0 || genderData.length === 0) {
    issues.push({
      severity: 'BAIXO',
      issue: 'Dados demográficos ausentes ou incompletos',
      recommendation: 'Verificar se a sincronização de breakdowns está habilitada no script sync-incremental.js'
    });
  }

  if (issues.length === 0) {
    console.log('✅ Nenhum problema crítico encontrado!');
    console.log('   Os dados parecem estar consistentes.');
  } else {
    console.log(`❌ ${issues.length} problema(s) identificado(s):\n`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.severity}] ${issue.issue}`);
      console.log(`   💡 Recomendação: ${issue.recommendation}`);
      console.log('');
    });
  }

  console.log('='.repeat(80));
  console.log('Auditoria concluída!');

  await client.end();
}

runAudit().catch(err => {
  console.error('❌ Erro durante auditoria:', err);
  process.exit(1);
});
