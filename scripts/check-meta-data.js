#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetaData() {
  console.log('🔍 Verificando dados do Meta no Supabase...\n');

  // First, get Meta platform accounts
  const { data: metaAccounts } = await supabase
    .from('platform_accounts')
    .select('id, name, external_id')
    .eq('platform_key', 'meta');

  const metaAccountIds = metaAccounts?.map(a => a.id) || [];

  console.log('🔗 CONTAS META (platform_accounts):');
  if (metaAccounts && metaAccounts.length > 0) {
    metaAccounts.forEach(a => {
      console.log(`   ✅ ${a.name} (${a.external_id})`);
    });
  } else {
    console.log('   ⚠️  Nenhuma conta Meta encontrada');
  }
  console.log('');

  // Check campaigns
  const { data: campaigns, error: campaignsError, count: campaignsCount } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: false })
    .in('platform_account_id', metaAccountIds)
    .limit(5);

  console.log('📊 CAMPANHAS (campaigns):');
  if (campaignsError) {
    console.error('❌ Erro:', campaignsError.message);
  } else {
    console.log(`✅ Total: ${campaignsCount} campanhas`);
    if (campaigns && campaigns.length > 0) {
      console.log(`   Primeiras ${campaigns.length} campanhas:`);
      campaigns.forEach(c => {
        console.log(`   - ${c.name} (${c.external_id}) - Status: ${c.status}`);
      });
    } else {
      console.log('   ⚠️  Nenhuma campanha encontrada');
    }
  }
  console.log('');

  // Check ad_sets
  const { data: adSets, error: adSetsError, count: adSetsCount } = await supabase
    .from('ad_sets')
    .select('*', { count: 'exact', head: false })
    .in('platform_account_id', metaAccountIds)
    .limit(5);

  console.log('📊 CONJUNTOS DE ANÚNCIOS (ad_sets):');
  if (adSetsError) {
    console.error('❌ Erro:', adSetsError.message);
  } else {
    console.log(`✅ Total: ${adSetsCount} ad sets`);
    if (adSets && adSets.length > 0) {
      console.log(`   Primeiros ${adSets.length} ad sets:`);
      adSets.forEach(a => {
        console.log(`   - ${a.name} (${a.external_id}) - Status: ${a.status}`);
      });
    } else {
      console.log('   ⚠️  Nenhum ad set encontrado');
    }
  }
  console.log('');

  // Check ads
  const { data: ads, error: adsError, count: adsCount } = await supabase
    .from('ads')
    .select('*', { count: 'exact', head: false })
    .in('platform_account_id', metaAccountIds)
    .limit(5);

  console.log('📊 ANÚNCIOS (ads):');
  if (adsError) {
    console.error('❌ Erro:', adsError.message);
  } else {
    console.log(`✅ Total: ${adsCount} anúncios`);
    if (ads && ads.length > 0) {
      console.log(`   Primeiros ${ads.length} anúncios:`);
      ads.forEach(a => {
        console.log(`   - ${a.name} (${a.external_id}) - Status: ${a.status}`);
      });
    } else {
      console.log('   ⚠️  Nenhum anúncio encontrado');
    }
  }
  console.log('');

  // Check performance_metrics - just count all
  const { error: metricsError, count: metricsCount } = await supabase
    .from('performance_metrics')
    .select('*', { count: 'exact', head: true });

  console.log('📊 MÉTRICAS DE PERFORMANCE (performance_metrics):');
  if (metricsError) {
    console.error('❌ Erro:', metricsError.message);
  } else {
    console.log(`✅ Total: ${metricsCount} registros de métricas`);
  }
  console.log('');

  // Check workspace_integrations
  const { data: integrations, error: integrationsError } = await supabase
    .from('workspace_integrations')
    .select('*')
    .eq('platform_key', 'meta');

  console.log('🔗 INTEGRAÇÕES (workspace_integrations):');
  if (integrationsError) {
    console.error('❌ Erro:', integrationsError.message);
  } else if (integrations && integrations.length > 0) {
    integrations.forEach(i => {
      console.log(`✅ Workspace: ${i.workspace_id}`);
      console.log(`   Status: ${i.status}`);
      console.log(`   Última sincronização: ${i.last_synced_at || 'Nunca'}`);
    });
  } else {
    console.log('⚠️  Nenhuma integração Meta encontrada');
  }
  console.log('');

  // Summary
  console.log('📈 RESUMO:');
  console.log(`   Campanhas: ${campaignsCount || 0}`);
  console.log(`   Ad Sets: ${adSetsCount || 0}`);
  console.log(`   Anúncios: ${adsCount || 0}`);
  console.log(`   Métricas: ${metricsCount || 0}`);
  console.log('');

  if (!campaignsCount && !adSetsCount && !adsCount && !metricsCount) {
    console.log('⚠️  ATENÇÃO: Nenhum dado do Meta encontrado no banco!');
    console.log('   Você precisa executar a sincronização:');
    console.log('   npm run sync:meta');
  }
}

checkMetaData().catch(console.error);
