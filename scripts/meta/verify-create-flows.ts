import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const WORKSPACE_ID = (process.env.VITE_WORKSPACE_ID || process.env.WORKSPACE_ID || '').trim();

if (!WORKSPACE_ID) {
  console.error('Missing WORKSPACE_ID. Set VITE_WORKSPACE_ID in .env.local');
  process.exit(1);
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

async function run() {
  console.log('Verifying Meta Ads campaign creation flows...');

  const baseTargeting = {
    geo_locations: { countries: ['BR'] },
    age_min: 18,
    age_max: 65,
    genders: [1, 2],
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed'],
    instagram_positions: ['stream'],
    device_platforms: ['mobile', 'desktop'],
  };

  const engagementPayload = {
    workspaceId: WORKSPACE_ID,
    campaign: {
      name: 'Teste Engajamento Automatizado ' + Date.now(),
      objective: 'OUTCOME_ENGAGEMENT',
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adSets: [
      {
        name: 'Conjunto Engajamento',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'POST_ENGAGEMENT',
        daily_budget: 1500,
        status: 'PAUSED',
        targeting: baseTargeting,
        ads: [],
      },
    ],
  };

  const leadsWhatsAppPayload = {
    workspaceId: WORKSPACE_ID,
    campaign: {
      name: 'Teste Leads WhatsApp ' + Date.now(),
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adSets: [
      {
        name: 'Conjunto Leads WhatsApp',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'MESSAGES',
        daily_budget: 1500,
        status: 'PAUSED',
        destination_type: 'MESSAGING_APP',
        targeting: baseTargeting,
        ads: [],
      },
    ],
  };

  const url = `${API_URL}/api/integrations/meta/create-campaign`;

  console.log('\nTesting Engagement flow...');
  const res1 = await postJson(url, engagementPayload);
  console.log('Result:', JSON.stringify(res1.data, null, 2));

  console.log('\nTesting Leads (WhatsApp) flow...');
  const res2 = await postJson(url, leadsWhatsAppPayload);
  console.log('Result:', JSON.stringify(res2.data, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
