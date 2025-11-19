import { GoogleAdsApi } from 'google-ads-api';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function syncGoogleAdsManual() {
    try {
        console.log('🚀 Starting Manual Google Ads Sync for Customer 1988032294...');

        const client = new GoogleAdsApi({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        });

        const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
        const targetCustomerId = '1988032294';

        if (!refreshToken) {
            throw new Error('GOOGLE_ADS_REFRESH_TOKEN not found in .env.local');
        }

        const customer = client.Customer({
            customer_id: targetCustomerId,
            login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
            refresh_token: refreshToken,
        });

        console.log(`\n📋 Fetching data for Customer ID: ${targetCustomerId}`);

        // 1. Fetch Campaigns
        console.log('\n🔹 Fetching Campaigns...');
        const campaigns = await customer.query(`
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros
      FROM campaign 
      WHERE campaign.status != 'REMOVED'
      LIMIT 50
    `);
        console.log(`✅ Found ${campaigns.length} campaigns.`);
        if (campaigns.length > 0) {
            console.log('Sample Campaign:', campaigns[0]);
        }

        // 2. Fetch Ad Groups
        console.log('\n🔹 Fetching Ad Groups...');
        const adGroups = await customer.query(`
      SELECT 
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.id
      FROM ad_group 
      WHERE ad_group.status != 'REMOVED'
      LIMIT 50
    `);
        console.log(`✅ Found ${adGroups.length} ad groups.`);

        // 3. Fetch Ads
        console.log('\n🔹 Fetching Ads...');
        const ads = await customer.query(`
      SELECT 
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.status
      FROM ad_group_ad 
      WHERE ad_group_ad.status != 'REMOVED'
      LIMIT 50
    `);
        console.log(`✅ Found ${ads.length} ads.`);

        console.log('\n🎉 Manual Sync Test Completed Successfully!');

    } catch (error) {
        console.error('❌ Error during manual sync:', error.message);
        if (error.details) {
            console.error('Details:', error.details);
        }
        process.exit(1);
    }
}

syncGoogleAdsManual();
