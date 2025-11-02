#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const campaignId = '23494cca-5c35-4b53-843e-8e81e1c7a917';

  // Buscar TODAS as métricas de campaign level
  const { data: allMetrics } = await client
    .from('performance_metrics')
    .select('conversions, metric_date')
    .eq('campaign_id', campaignId)
    .is('ad_set_id', null)
    .is('ad_id', null)
    .order('metric_date', { ascending: true });

  const totalLifetime = allMetrics?.reduce((sum, row) => sum + Number(row.conversions || 0), 0) || 0;

  // Últimos 30 dias (como a plataforma mostra)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 29);

  const last30Days = allMetrics
    ?.filter(r => {
      const date = new Date(r.metric_date);
      return date >= thirtyDaysAgo && date <= today;
    })
    .reduce((sum, row) => sum + Number(row.conversions || 0), 0) || 0;

  // Últimos 7 dias
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  const last7Days = allMetrics
    ?.filter(r => {
      const date = new Date(r.metric_date);
      return date >= sevenDaysAgo && date <= today;
    })
    .reduce((sum, row) => sum + Number(row.conversions || 0), 0) || 0;

  console.log('📊 Conversões da Campanha de Leads 23/10 Whatsapp');
  console.log('   ID:', campaignId);
  console.log('');
  console.log('🎯 Conversões por período:');
  console.log('   Lifetime (todas as datas): ', totalLifetime);
  console.log('   Últimos 30 dias:           ', last30Days);
  console.log('   Últimos 7 dias:            ', last7Days);
  console.log('');
  console.log('📅 Datas com conversões (campaign level):');

  allMetrics
    ?.filter(r => r.conversions > 0)
    .forEach(r => {
      console.log(`   ${r.metric_date}: ${r.conversions} conversões`);
    });

  console.log('');
  console.log('📊 Total de registros de métricas:', allMetrics?.length || 0);
})();
