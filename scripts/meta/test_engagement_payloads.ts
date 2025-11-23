
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const { Pool } = pg;

// Load env
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const DATABASE_URL = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010'; // From screenshot logs

if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exit(1);
}

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

// Mock decrypt (since we know it's plaintext JSON now)
function decryptCredentials(encrypted: string) {
    try {
        return JSON.parse(encrypted);
    } catch (e) {
        console.error('Failed to parse credentials:', e);
        return null;
    }
}

async function getCredentials() {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query(
            `SELECT encrypted_credentials FROM integration_credentials 
       WHERE workspace_id = $1 AND platform_key = 'meta'`,
            [WORKSPACE_ID]
        );

        if (res.rows.length === 0) {
            throw new Error('No credentials found for workspace');
        }

        const creds = decryptCredentials(res.rows[0].encrypted_credentials);
        return creds;
    } finally {
        await pool.end();
    }
}

async function callMetaApi(endpoint: string, method: 'POST' | 'GET', accessToken: string, body: any = {}) {
    const url = `${GRAPH_URL}/${endpoint}`;
    const queryParams = new URLSearchParams({ access_token: accessToken });

    const options: RequestInit = {
        method,
    };

    if (method === 'POST') {
        const form = new URLSearchParams();
        for (const [key, value] of Object.entries(body)) {
            if (value === undefined || value === null) continue;
            if (typeof value === 'object') {
                form.append(key, JSON.stringify(value));
            } else {
                form.append(key, String(value));
            }
        }
        options.body = form.toString();
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }

    const response = await fetch(`${url}?${queryParams.toString()}`, options);
    const data = await response.json();
    return data;
}

async function testPayloads() {
    console.log('--- Fetching Credentials ---');
    const creds = await getCredentials();
    if (!creds) {
        console.error('Could not retrieve credentials');
        return;
    }

    const ACCESS_TOKEN = creds.accessToken;
    const AD_ACCOUNT_ID = creds.adAccountId;
    const PAGE_ID = creds.pageId || creds.page_id;

    console.log('Credentials loaded:', {
        adAccountId: AD_ACCOUNT_ID,
        pageId: PAGE_ID,
        hasToken: !!ACCESS_TOKEN
    });

    if (!ACCESS_TOKEN || !AD_ACCOUNT_ID || !PAGE_ID) {
        console.error('Missing required credentials (token, adAccount, or pageId)');
        return;
    }

    console.log('\n--- Starting Payload Tests ---');

    // 1. Create a temporary campaign
    console.log('Creating temp campaign...');
    const campRes = await callMetaApi(`act_${AD_ACCOUNT_ID}/campaigns`, 'POST', ACCESS_TOKEN, {
        name: 'Test API Payload ' + Date.now(),
        objective: 'OUTCOME_ENGAGEMENT',
        status: 'PAUSED',
        special_ad_categories: [],
    });

    if (campRes.error) {
        console.error('Failed to create campaign:', campRes.error);
        return;
    }
    const campaignId = campRes.id;
    console.log('Campaign created:', campaignId);

    // 2. Test Ad Set Payloads
    const payloads = [
        {
            name: 'Test 1: No destination_type, with publisher_platforms',
            payload: {
                name: 'Test Ad Set 1',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'POST_ENGAGEMENT',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['facebook', 'instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        },
        {
            name: 'Test 2: destination_type=ON_AD',
            payload: {
                name: 'Test Ad Set 2',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'POST_ENGAGEMENT',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                destination_type: 'ON_AD',
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['facebook', 'instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        },
        {
            name: 'Test 3: destination_type=ON_POST',
            payload: {
                name: 'Test Ad Set 3',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'POST_ENGAGEMENT',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                destination_type: 'ON_POST',
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['facebook', 'instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        }
    ];

    for (const test of payloads) {
        console.log(`\nRunning ${test.name}...`);
        const res = await callMetaApi(`act_${AD_ACCOUNT_ID}/adsets`, 'POST', ACCESS_TOKEN, test.payload);
        if (res.error) {
            console.error('FAILED:', res.error.message, `(Code: ${res.error.code}, Subcode: ${res.error.error_subcode})`);
        } else {
            console.log('SUCCESS! Ad Set ID:', res.id);
        }
    }
}

testPayloads().catch(console.error);
