import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

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

  const videoAsset = await findVideoAsset();
  if (videoAsset) {
    console.log('Using video asset from Drive:', videoAsset.name, videoAsset.id);
  } else {
    console.log('No video asset found in DB; will create ad sets without ads');
  }

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
      name: 'Teste Engajamento ' + Date.now(),
      objective: 'OUTCOME_ENGAGEMENT',
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adSets: [1,2,3,4].map((i) => ({
      name: `Conjunto Engajamento ${i}`,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'POST_ENGAGEMENT',
      daily_budget: 1500,
      status: 'PAUSED',
      targeting: baseTargeting,
      ads: [],
    })),
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
        optimization_goal: 'CONVERSATIONS',
        daily_budget: 1500,
        status: 'PAUSED',
        destination_type: 'MESSAGING_APP',
        targeting: baseTargeting,
        ads: videoAsset ? [{ name: 'Ad Vídeo WPP', creative_id: '', status: 'PAUSED', creative_asset_id: videoAsset.id }] : [],
      },
    ],
  };

  const recognitionPayload = {
    workspaceId: WORKSPACE_ID,
    campaign: {
      name: 'Teste Reconhecimento ' + Date.now(),
      objective: 'OUTCOME_AWARENESS',
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adSets: [
      {
        name: 'Conjunto Reconhecimento',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'REACH',
        daily_budget: 1500,
        status: 'PAUSED',
        targeting: baseTargeting,
        ads: [],
      },
    ],
  };

  const trafficPayload = {
    workspaceId: WORKSPACE_ID,
    campaign: {
      name: 'Teste Tráfego ' + Date.now(),
      objective: 'OUTCOME_TRAFFIC',
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adSets: [
      {
        name: 'Conjunto Tráfego Website',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        daily_budget: 1500,
        status: 'PAUSED',
        targeting: baseTargeting,
        ads: [],
        destination_type: 'WEBSITE',
      },
    ],
  };

  // Extra payloads to validate all Traffic destinations
  const pageInfo = await getPageInfo();
  const PAGE_ID = pageInfo?.page_id || process.env.META_PAGE_ID || undefined;
  if (!PAGE_ID) {
    console.log('Warning: No PAGE_ID available. Traffic destinations requiring page will still be attempted without page_id.');
  }

  const trafficAppPayload = {
    ...trafficPayload,
    campaign: { ...trafficPayload.campaign, name: 'Teste Tráfego App ' + Date.now() },
    adSets: [
      {
        name: 'Conjunto Tráfego App',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        daily_budget: 1500,
        status: 'PAUSED',
        destination_type: 'APP',
        targeting: baseTargeting,
        ads: [],
      },
    ],
  };

  const trafficMessagesPayload = {
    ...trafficPayload,
    campaign: { ...trafficPayload.campaign, name: 'Teste Tráfego Mensagens ' + Date.now() },
    adSets: [
      {
        name: 'Conjunto Tráfego Mensagens',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        daily_budget: 1500,
        status: 'PAUSED',
        destination_type: 'MESSAGES_DESTINATIONS',
        targeting: baseTargeting,
        ads: [],
      },
    ],
    pageId: PAGE_ID,
  };

  const trafficIGFBPayload = {
    ...trafficPayload,
    campaign: { ...trafficPayload.campaign, name: 'Teste Tráfego IG/FB ' + Date.now() },
    adSets: [
      {
        name: 'Conjunto Tráfego IG/FB',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        daily_budget: 1500,
        status: 'PAUSED',
        destination_type: 'INSTAGRAM_OR_FACEBOOK',
        targeting: baseTargeting,
        ads: [],
      },
    ],
    pageId: PAGE_ID,
  };

  // Multi-ad-set payload to validate propagation scenario for Traffic to IG/FB
  const trafficMultiIGFBPayload = {
    ...trafficPayload,
    campaign: { ...trafficPayload.campaign, name: 'Teste Tráfego IG/FB Multi ' + Date.now() },
    adSets: [1, 2, 3].map((i) => ({
      name: `Conjunto Tráfego IG/FB ${i}`,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      daily_budget: 1500,
      status: 'PAUSED',
      destination_type: 'INSTAGRAM_OR_FACEBOOK',
      targeting: baseTargeting,
      ads: [],
    })),
    pageId: PAGE_ID,
  };

  const trafficCallsPayload = {
    ...trafficPayload,
    campaign: { ...trafficPayload.campaign, name: 'Teste Tráfego Ligações ' + Date.now() },
    adSets: [
      {
        name: 'Conjunto Tráfego Ligações',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'LINK_CLICKS',
        daily_budget: 1500,
        status: 'PAUSED',
        destination_type: 'CALLS',
        targeting: baseTargeting,
        ads: [],
      },
    ],
  };

  const salesPayload = {
    workspaceId: WORKSPACE_ID,
    campaign: {
      name: 'Teste Vendas ' + Date.now(),
      objective: 'OUTCOME_SALES',
      status: 'PAUSED',
      special_ad_categories: [],
    },
    adSets: [
      {
        name: 'Conjunto Vendas Website',
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'OFFSITE_CONVERSIONS',
        daily_budget: 1500,
        status: 'PAUSED',
        targeting: baseTargeting,
        ads: [],
      },
    ],
  };

  const url = `${API_URL}/api/integrations/meta/create-campaign`;

  console.log('\nTesting Engagement flow (4 ad sets)...');
  const resA = await postJson(url, engagementPayload);
  console.log('Result:', JSON.stringify(resA.data, null, 2));

  console.log('\nTesting Leads (WhatsApp) single ad set...');
  const resB = await postJson(url, leadsWhatsAppPayload);
  console.log('Result:', JSON.stringify(resB.data, null, 2));

  console.log('\nTesting Recognition (Reach) single ad set...');
  const resC = await postJson(url, recognitionPayload);
  console.log('Result:', JSON.stringify(resC.data, null, 2));

  console.log('\nTesting Traffic (Website) single ad set...');
  const resD = await postJson(url, trafficPayload);
  console.log('Result:', JSON.stringify(resD.data, null, 2));

  console.log('\nTesting Traffic (App) single ad set...');
  const resD2 = await postJson(url, trafficAppPayload);
  console.log('Result:', JSON.stringify(resD2.data, null, 2));

  console.log('\nTesting Traffic (Messages Destinations) single ad set...');
  const resD3 = await postJson(url, trafficMessagesPayload);
  console.log('Result:', JSON.stringify(resD3.data, null, 2));

  console.log('\nTesting Traffic (Instagram or Facebook) single ad set...');
  const resD4 = await postJson(url, trafficIGFBPayload);
  console.log('Result:', JSON.stringify(resD4.data, null, 2));

  console.log('\nTesting Traffic (Instagram or Facebook) multi ad sets (3)...');
  const resD4Multi = await postJson(url, trafficMultiIGFBPayload);
  console.log('Result:', JSON.stringify(resD4Multi.data, null, 2));

  console.log('\nTesting Traffic (Calls) single ad set...');
  const resD5 = await postJson(url, trafficCallsPayload);
  console.log('Result:', JSON.stringify(resD5.data, null, 2));

  console.log('\nTesting Sales (Website conversions) single ad set...');
  const resE = await postJson(url, salesPayload);
  console.log('Result:', JSON.stringify(resE.data, null, 2));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
async function findVideoAsset() {
  const connStr = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  if (!connStr) return null;
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT id, name, storage_url
       FROM creative_assets
       WHERE workspace_id = $1 AND type = 'video' AND storage_url IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [WORKSPACE_ID]
    );
    await client.end();
    return rows[0] || null;
  } catch (e) {
    try { await client.end(); } catch (ignore) { /* ignore */ }
    return null;
  }
}

async function getPageInfo() {
  try {
    const url = `${API_URL}/api/integrations/meta/page-info/${WORKSPACE_ID}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.success) return data.data;
    return null;
  } catch (e) {
    return null;
  }
}
