import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pkg from 'pg';
const { Pool } = pkg;
import crypto from 'crypto';

const WORKSPACE_ID = process.env.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL
});

function encryptCredentials(data) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Combine encrypted data with authTag (separated by colon)
    const encryptedWithTag = encrypted + ':' + authTag.toString('hex');

    return {
        encrypted: encryptedWithTag,
        iv: iv.toString('hex')
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

        const { encrypted, iv } = encryptCredentials(credentials);

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
