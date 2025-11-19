import { GoogleAdsApi } from 'google-ads-api';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function listAccounts() {
    console.log('🚀 Debugging Google Ads Access...');

    const client = new GoogleAdsApi({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

    try {
        console.log('1. Trying listAccessibleCustomers()...');
        const customers = await client.listAccessibleCustomers(refreshToken);
        console.log('✅ Success! Accessible Customers:');
        console.log(JSON.stringify(customers, null, 2));
    } catch (error) {
        console.error('❌ listAccessibleCustomers failed:');
        console.error(error.message);
        if (error.details) console.error('Details:', error.details);

        // Try to decode the error if it's a Google Ads failure
        if (error.errors) {
            error.errors.forEach(e => {
                console.error(`Error Code: ${e.error_code.authorization_error || e.error_code.request_error || 'UNKNOWN'}`);
                console.error(`Message: ${e.message}`);
            });
        }
    }
}

listAccounts();
