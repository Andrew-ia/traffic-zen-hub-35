import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pkg from 'pg';
const { Pool } = pkg;

const WORKSPACE_ID = process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';

const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL
});

// No encryption - just store as JSON
function storeCredentials(data) {
    return {
        encrypted: JSON.stringify(data),
        iv: '' // Empty IV for plaintext mode
    };
}

async function saveGoogleAdsCredentials() {
    try {
        console.log('🔐 Saving Google Ads credentials to database...');

        const credentials = {
            refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
            customerId: process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, ''),
            developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '')
        };

        console.log('Credentials to save:', {
            hasRefreshToken: !!credentials.refreshToken,
            hasCustomerId: !!credentials.customerId,
            hasDeveloperToken: !!credentials.developerToken,
            hasClientId: !!credentials.clientId,
            hasClientSecret: !!credentials.clientSecret,
            hasLoginCustomerId: !!credentials.loginCustomerId
        });

        if (!credentials.refreshToken || !credentials.customerId || !credentials.developerToken) {
            throw new Error('Missing required credentials in environment variables');
        }

        const { encrypted, iv } = storeCredentials(credentials);

        // Delete existing credentials
        await pool.query(
            'DELETE FROM integration_credentials WHERE workspace_id = $1 AND platform_key = $2',
            [WORKSPACE_ID, 'google_ads']
        );

        // Insert new credentials
        await pool.query(
            `INSERT INTO integration_credentials (workspace_id, platform_key, encrypted_credentials, encryption_iv)
       VALUES ($1, $2, $3, $4)`,
            [WORKSPACE_ID, 'google_ads', encrypted, iv]
        );

        console.log('✅ Credentials saved successfully to database!');

        await pool.end();

    } catch (error) {
        console.error('❌ Error saving credentials:', error.message);
        process.exit(1);
    }
}

saveGoogleAdsCredentials();
