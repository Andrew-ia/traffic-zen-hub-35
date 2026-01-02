
import { MercadoAdsAutomationService } from '../server/services/mercadolivre/ads-automation.service.js';
import { getPool } from '../server/config/database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also try .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Manually request with token to debug specific endpoints
async function requestWithToken(token: string, url: string, options: any = {}) {
    try {
        const response = await axios({
            url,
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        });
        return response.data;
    } catch (error: any) {
        console.error(`Request failed: ${url}`);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
        throw error;
    }
}

async function main() {
  const pool = getPool();
  
  try {
      // Find a workspace with Mercado Livre credentials
      const res = await pool.query(`
        SELECT workspace_id 
        FROM integration_credentials 
        WHERE platform_key = 'mercadolivre' 
        LIMIT 1
      `);

      if (res.rows.length === 0) {
        console.error('No workspace with Mercado Livre credentials found.');
        process.exit(1);
      }

      const workspaceId = res.rows[0].workspace_id;
      console.log(`Found workspace: ${workspaceId}`);

      // We use the service to get the valid token (it handles refresh/decrypt)
      // Since the service methods are protected/private, we might need to instantiate it and use a public method 
      // OR we can just use the internal helpers if we could import them.
      // But let's try to "steal" the token by using a public method or just re-implementing credential fetching if needed.
      // Actually, let's just use the service to get credentials. 
      // Wait, the service doesn't expose getCredentials. 
      // But we can import getMercadoLivreCredentials from the api integration file if exported?
      // No, it's not exported.
      
      // Let's copy the logic to get credentials here to be safe and explicit.
      // Or better, let's use the service's existing methods to verify access.
      // But we want to test SPECIFIC endpoints that failed.

      // Let's instantiate the service.
      const service = new MercadoAdsAutomationService();
      
      // We can't easily access the token via the service instance.
      // So I will implement the token retrieval here using the same logic as integration/mercadolivre-fulfillment.ts
      // Note: We need to decrypt.
      
      const credsRes = await pool.query(`
        SELECT encrypted_credentials, encryption_iv, updated_at
        FROM integration_credentials
        WHERE workspace_id = $1 AND platform_key = 'mercadolivre'
        LIMIT 1
      `, [workspaceId]);
      
      if (credsRes.rows.length === 0) throw new Error('No credentials found');
      
      console.log('Credentials Last Updated:', credsRes.rows[0].updated_at);
      
      // We need decryptCredentials. 
      // It is imported from '../../services/encryption.js' in the source.
      // We can import it here too.
      const { decryptCredentials } = await import('../server/services/encryption.js');
      
      const decrypted = decryptCredentials(
            credsRes.rows[0].encrypted_credentials,
            credsRes.rows[0].encryption_iv
      ) as any;
      
      const accessToken = decrypted.accessToken || decrypted.access_token;
      const userId = decrypted.userId || decrypted.user_id; // Advertiser ID is usually linked to User ID
      
      console.log('Got Access Token:', accessToken.substring(0, 10) + '...');
      console.log('User ID:', userId);
      
      // Get Advertiser ID
       console.log('Fetching Advertiser ID...');
        const advertisingInfo = await requestWithToken(
            accessToken, 
            `https://api.mercadolibre.com/advertising/advertisers?user_id=${userId}`,
            { headers: { 'api-version': '2' } }
        );
        
        let advertiserId;
        if (Array.isArray(advertisingInfo) && advertisingInfo.length > 0) {
            advertiserId = advertisingInfo[0].advertiser_id;
        } else if (advertisingInfo && advertisingInfo.advertiser_id) {
            advertiserId = advertisingInfo.advertiser_id;
        } else if (advertisingInfo && advertisingInfo.results && advertisingInfo.results.length > 0) {
             advertiserId = advertisingInfo.results[0].advertiser_id;
        }

        if (!advertiserId) {
            console.error('Could not find Advertiser ID in response:', JSON.stringify(advertisingInfo, null, 2));
            return;
        }
        console.log('Advertiser ID:', advertiserId);

        // 4. Try Standard API for campaigns
        console.log(`Trying Standard API Campaigns for ${advertiserId}...`);
        try {
            const data = await requestWithToken(
                accessToken,
                `https://api.mercadolibre.com/advertising/product_ads/campaigns/search?advertiser_id=${advertiserId}`, 
                 { headers: { 'api-version': '2' } }
            );
            console.log('Campaigns (Standard):', data?.results?.length);
        } catch (err: any) {
             console.error('Campaigns (Standard) Error:', err?.response?.status);
        }

        // 5. Try Marketplace API for campaigns
        console.log(`Trying Marketplace API Campaigns for ${advertiserId}...`);
        try {
            const data = await requestWithToken(
                accessToken,
                `https://api.mercadolibre.com/marketplace/advertising/MLB/advertisers/${advertiserId}/product_ads/campaigns/search`,
                 { headers: { 'api-version': '2' } }
            );
             console.log('Campaigns (Marketplace):', data?.results?.length);
        } catch (err: any) {
             console.error('Campaigns (Marketplace) Error:', err?.response?.status);
        }

  } catch (error: any) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
