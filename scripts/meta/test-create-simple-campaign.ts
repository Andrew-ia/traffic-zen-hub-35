import { getPool } from '../../server/config/database.js';
import { decryptCredentials } from '../../server/services/encryption.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const GRAPH_URL = 'https://graph.facebook.com/v21.0';
const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

async function testCreateSimpleCampaign() {
    console.log('🚀 Starting Minimal Campaign Creation Test');

    try {
        const pool = getPool();

        // 1. Get Credentials
        console.log('1. Fetching credentials...');
        const { rows } = await pool.query(
            `SELECT encrypted_credentials, encryption_iv 
             FROM integration_credentials 
             WHERE workspace_id = $1 AND platform_key = 'meta'`,
            [WORKSPACE_ID]
        );

        if (rows.length === 0) {
            throw new Error('Meta Ads credentials not found');
        }

        const credentials = await decryptCredentials(rows[0].encrypted_credentials, rows[0].encryption_iv);
        const accessToken = credentials.accessToken || credentials.access_token;
        const adAccountId = credentials.adAccountId || credentials.ad_account_id;

        if (!accessToken || !adAccountId) {
            throw new Error('Incomplete Meta credentials');
        }

        console.log('✅ Credentials found for Ad Account:', adAccountId);

        const actAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

        // Helper for Meta API calls
        const callMetaApi = async (path: string, method: 'POST' | 'GET', body: any = {}) => {
            const url = `${GRAPH_URL}/${path}`;
            const queryParams = new URLSearchParams({ access_token: accessToken });

            const options: RequestInit = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };

            if (method === 'POST') {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${url}?${queryParams.toString()}`, options);
            const data = await response.json();

            if (data.error) {
                throw new Error(`Meta API Error: ${data.error.message}`);
            }

            return data;
        };

        // 2. Create Campaign
        const campaignName = `Test Minimal Campaign ${new Date().toISOString()}`;
        console.log(`2. Creating Campaign: ${campaignName}`);

        const campaignResponse = await callMetaApi(`${actAccountId}/campaigns`, 'POST', {
            name: campaignName,
            objective: 'OUTCOME_LEADS',
            status: 'PAUSED',
            special_ad_categories: '[]',
        });

        console.log('✅ Campaign Created:', campaignResponse.id);
        const campaignId = campaignResponse.id;

        // 3. Create Ad Set
        const adSetName = 'Test Minimal Ad Set';
        console.log(`3. Creating Ad Set: ${adSetName}`);

        const adSetResponse = await callMetaApi(`${actAccountId}/adsets`, 'POST', {
            name: adSetName,
            campaign_id: campaignId,
            billing_event: 'IMPRESSIONS',
            optimization_goal: 'LEAD_GENERATION',
            daily_budget: 2000, // 20.00 BRL
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
            targeting: JSON.stringify({
                geo_locations: { countries: ['BR'] },
                age_min: 18,
                age_max: 65,
                // No interests to keep it simple
            }),
            status: 'PAUSED',
        });

        console.log('✅ Ad Set Created:', adSetResponse.id);

        console.log('🎉 SUCCESS! Minimal campaign structure created.');

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        process.exit(0);
    }
}

testCreateSimpleCampaign();
