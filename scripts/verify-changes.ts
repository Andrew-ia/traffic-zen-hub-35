
import 'dotenv/config';
import { getPool } from '../server/config/database';
import { MetaApiService } from '../server/services/meta/MetaApiService';
import { CreativeService } from '../server/services/meta/CreativeService';
import { CampaignBuilder } from '../server/services/meta/CampaignBuilder';

async function testSystem() {
    console.log('🔍 Starting System Verification...');

    // 1. Test Database Connection & View Existence
    try {
        const pool = getPool();
        const client = await pool.connect();
        console.log('✅ Database connected.');

        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name = 'vw_performance_daily'
    `);

        if (res.rows.length > 0) {
            console.log('✅ View "vw_performance_daily" exists.');
        } else {
            console.error('❌ View "vw_performance_daily" DOES NOT EXIST. Please run migration 0041.');
        }
        client.release();
    } catch (err) {
        console.error('❌ Database check failed:', err);
    }

    // 2. Test Service Instantiation (Refactoring Check)
    try {
        const metaApi = new MetaApiService({ accessToken: 'test-token' });
        if (metaApi) console.log('✅ MetaApiService instantiated successfully.');

        // Mock env vars for CreativeService
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
        const creativeService = new CreativeService();
        if (creativeService) console.log('✅ CreativeService instantiated successfully.');

        // Test CampaignBuilder static method
        const payload = CampaignBuilder.buildCampaignPayload({
            name: 'Test Campaign',
            objective: 'OUTCOME_TRAFFIC',
            status: 'PAUSED',
            daily_budget: 5000
        });

        if (payload.payload.name === 'Test Campaign' && payload.dailyBudgetCents === 5000) {
            console.log('✅ CampaignBuilder logic verified.');
        } else {
            console.error('❌ CampaignBuilder logic failed:', payload);
        }

    } catch (err) {
        console.error('❌ Service instantiation failed:', err);
    }

    console.log('🏁 Verification Complete.');
    process.exit(0);
}

testSystem();
