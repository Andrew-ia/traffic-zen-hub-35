
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
const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exit(1);
}

const GRAPH_URL = 'https://graph.facebook.com/v21.0';

function decryptCredentials(encrypted: string) {
    try {
        return JSON.parse(encrypted);
    } catch (e) {
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

        if (res.rows.length === 0) throw new Error('No credentials found');
        return decryptCredentials(res.rows[0].encrypted_credentials);
    } finally {
        await pool.end();
    }
}

async function callMetaApi(endpoint: string, method: 'POST' | 'GET', accessToken: string, body: any = {}) {
    const url = `${GRAPH_URL}/${endpoint}`;
    const queryParams = new URLSearchParams({ access_token: accessToken });

    const options: RequestInit = { method };

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
    if (!creds) return;

    const ACCESS_TOKEN = creds.accessToken;
    const AD_ACCOUNT_ID = creds.adAccountId;
    const PAGE_ID = creds.pageId || creds.page_id;

    console.log('Credentials loaded:', { adAccountId: AD_ACCOUNT_ID, pageId: PAGE_ID });

    // 1. Create a temporary campaign
    console.log('Creating temp campaign...');
    const campRes = await callMetaApi(`act_${AD_ACCOUNT_ID}/campaigns`, 'POST', ACCESS_TOKEN, {
        name: 'Test 1487015 ' + Date.now(),
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

    // 2. Test Payloads
    const payloads = [
        {
            name: 'Test A: ON_POST + POST_ENGAGEMENT + IMPRESSIONS',
            payload: {
                name: 'Test A',
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
        },
        {
            name: 'Test B: ON_AD + POST_ENGAGEMENT + IMPRESSIONS',
            payload: {
                name: 'Test B',
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
            name: 'Test C: No destination_type + POST_ENGAGEMENT + IMPRESSIONS (Should fail 2490408)',
            payload: {
                name: 'Test C',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'POST_ENGAGEMENT',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                // destination_type: undefined,
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['facebook', 'instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        },
        {
            name: 'Test D: ON_POST + LINK_CLICKS + IMPRESSIONS',
            payload: {
                name: 'Test D',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'LINK_CLICKS',
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
        },
        {
            name: 'Test E: ON_POST + OFFSITE_CONVERSIONS + IMPRESSIONS',
            payload: {
                name: 'Test E',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'OFFSITE_CONVERSIONS',
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
        },
        {
            name: 'Test F: ON_POST + LINK_CLICKS + IMPRESSIONS',
            payload: {
                name: 'Test F',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'LINK_CLICKS',
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
        },
        {
            name: 'Test G: ON_POST + REACH + IMPRESSIONS',
            payload: {
                name: 'Test G',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'REACH',
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
        },
        {
            name: 'Test H: ON_POST + LEAD_GENERATION + IMPRESSIONS',
            payload: {
                name: 'Test H',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'LEAD_GENERATION',
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
        },
        {
            name: 'Test I: MESSAGING_APP + POST_ENGAGEMENT + IMPRESSIONS',
            payload: {
                name: 'Test I',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'POST_ENGAGEMENT',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                destination_type: 'MESSAGING_APP',
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['facebook', 'instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        },
        {
            name: 'Test J: ON_POST + POST_ENGAGEMENT + LINK_CLICKS (Billing)',
            payload: {
                name: 'Test J',
                campaign_id: campaignId,
                billing_event: 'LINK_CLICKS',
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
        },
        {
            name: 'Test K: ON_POST + MESSAGES + IMPRESSIONS',
            payload: {
                name: 'Test K',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'MESSAGES',
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
        },
        {
            name: 'Test L: ON_POST + POST_ENGAGEMENT + IMPRESSIONS (Instagram Only)',
            payload: {
                name: 'Test L',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'POST_ENGAGEMENT',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                destination_type: 'ON_POST',
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        },
        {
            name: 'Test M: ON_EVENT + EVENT_RESPONSES + IMPRESSIONS',
            payload: {
                name: 'Test M',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'EVENT_RESPONSES',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                destination_type: 'ON_EVENT',
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['facebook', 'instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        },
        {
            name: 'Test N: ON_VIDEO + VIDEO_VIEWS + IMPRESSIONS',
            payload: {
                name: 'Test N',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'VIDEO_VIEWS',
                daily_budget: 1000,
                bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
                status: 'PAUSED',
                destination_type: 'ON_VIDEO',
                targeting: {
                    geo_locations: { countries: ['BR'] },
                    publisher_platforms: ['facebook', 'instagram'],
                },
                promoted_object: { page_id: PAGE_ID }
            }
        },
        {
            name: 'Test O: ON_POST + IMPRESSIONS + IMPRESSIONS',
            payload: {
                name: 'Test O',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'IMPRESSIONS',
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
        },
        {
            name: 'Test P: ON_POST + AD_RECALL_LIFT + IMPRESSIONS',
            payload: {
                name: 'Test P',
                campaign_id: campaignId,
                billing_event: 'IMPRESSIONS',
                optimization_goal: 'AD_RECALL_LIFT',
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
