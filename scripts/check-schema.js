#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  // Verificar campaigns
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .limit(1);

  console.log('\n📋 Campaigns columns:', Object.keys(campaign?.[0] || {}));

  // Verificar ad_sets
  const { data: adSet } = await supabase
    .from('ad_sets')
    .select('*')
    .limit(1);

  console.log('\n📦 Ad Sets columns:', Object.keys(adSet?.[0] || {}));

  // Verificar ads
  const { data: ad } = await supabase
    .from('ads')
    .select('*')
    .limit(1);

  console.log('\n📢 Ads columns:', Object.keys(ad?.[0] || {}));
}

checkSchema();
