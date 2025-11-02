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
  // Buscar uma campanha de leads
  const { data: campaign } = await client
    .from('campaigns')
    .select('id, name')
    .ilike('name', '%lead%')
    .limit(1)
    .single();

  if (!campaign) {
    console.log('Campanha de leads nao encontrada');
    return;
  }

  console.log('📊 Campanha:', campaign.name);
  console.log('   ID:', campaign.id);
  console.log('');

  // Contar conversões por nível
  const { data: campaignLevel } = await client
    .from('performance_metrics')
    .select('conversions')
    .eq('campaign_id', campaign.id)
    .is('ad_set_id', null)
    .is('ad_id', null);

  const { data: adSetLevel } = await client
    .from('performance_metrics')
    .select('conversions')
    .eq('campaign_id', campaign.id)
    .not('ad_set_id', 'is', null)
    .is('ad_id', null);

  const { data: adLevel } = await client
    .from('performance_metrics')
    .select('conversions')
    .eq('campaign_id', campaign.id)
    .not('ad_id', 'is', null);

  const sumConversions = (data) => data?.reduce((sum, row) => sum + Number(row.conversions || 0), 0) || 0;

  const campaignConv = sumConversions(campaignLevel);
  const adSetConv = sumConversions(adSetLevel);
  const adConv = sumConversions(adLevel);

  console.log('🎯 Conversões por nível:');
  console.log('   Campaign level:', campaignConv);
  console.log('   Ad Set level:  ', adSetConv);
  console.log('   Ad level:      ', adConv);
  console.log('   ───────────────────');
  console.log('   TOTAL:         ', campaignConv + adSetConv + adConv);
})();
