import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL
});

async function checkCredentials() {
    try {
        const result = await pool.query(
            `SELECT 
        workspace_id, 
        platform_key, 
        encrypted_credentials, 
        encryption_iv,
        created_at 
      FROM integration_credentials 
      WHERE workspace_id = $1 AND platform_key = 'google_ads'`,
            ['00000000-0000-0000-0000-000000000010']
        );

        console.log('Found credentials:', result.rows.length);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log('Credential info:');
            console.log('- Workspace ID:', row.workspace_id);
            console.log('- Platform:', row.platform_key);
            console.log('- Created at:', row.created_at);
            console.log('- Has IV:', !!row.encryption_iv);
            console.log('- IV length:', row.encryption_iv?.length);
            console.log('- Encrypted data length:', row.encrypted_credentials?.length);
            console.log('- Encrypted data preview:', row.encrypted_credentials?.substring(0, 50) + '...');

            // Check if it has the authTag separator
            const hasAuthTag = row.encrypted_credentials?.includes(':');
            console.log('- Has authTag separator (:):', hasAuthTag);

            if (hasAuthTag) {
                const parts = row.encrypted_credentials.split(':');
                console.log('- Encrypted part length:', parts[0].length);
                console.log('- AuthTag length:', parts[1].length, '(should be 32)');
            }
        }

        await pool.end();

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkCredentials();
