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

  const url = `${API_URL}/api/integrations/meta/create-campaign`;

  console.log('\nTesting Engagement flow (4 ad sets)...');
  const resA = await postJson(url, engagementPayload);
  console.log('Result:', JSON.stringify(resA.data, null, 2));

  console.log('\nTesting Leads (WhatsApp) single ad set...');
  const resB = await postJson(url, leadsWhatsAppPayload);
  console.log('Result:', JSON.stringify(resB.data, null, 2));
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
