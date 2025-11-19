import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL
});

async function listAllGoogleAdsCredentials() {
    try {
        const result = await pool.query(
            `SELECT 
        workspace_id, 
        platform_key, 
        encrypted_credentials, 
        encryption_iv,
        created_at,
        updated_at
      FROM integration_credentials 
      WHERE platform_key = 'google_ads'
      ORDER BY created_at DESC`
        );

        console.log(`Found ${result.rows.length} Google Ads credentials in database:\n`);

        result.rows.forEach((row, index) => {
            console.log(`Credential #${index + 1}:`);
            console.log('  Workspace ID:', row.workspace_id);
            console.log('  Created:', row.created_at);
            console.log('  Updated:', row.updated_at || 'never');
            console.log('  Has IV:', !!row.encryption_iv, `(length: ${row.encryption_iv?.length})`);
            console.log('  Encrypted data length:', row.encrypted_credentials?.length);
            console.log('  Has authTag separator (:):', row.encrypted_credentials?.includes(':'));

            if (row.encrypted_credentials?.includes(':')) {
                const parts = row.encrypted_credentials.split(':');
                console.log('  AuthTag length:', parts[1]?.length, '(should be 32)');
            }
            console.log('');
        });

        await pool.end();

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

listAllGoogleAdsCredentials();
