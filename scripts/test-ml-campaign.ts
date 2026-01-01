import { MercadoAdsAutomationService } from '../server/services/mercadolivre/ads-automation.service.js';
import { getPool } from '../server/config/database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also try .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

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

      const service = new MercadoAdsAutomationService();
      
      console.log('Starting testCreateCampaign...');
      const result = await service.testCreateCampaign(workspaceId);
      console.log('Campaign created successfully:', result);

  } catch (error: any) {
    console.error('Error creating campaign:', error);
    if (error.response) {
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.message) {
        console.error('Error message:', error.message);
    }
  } finally {
    await pool.end();
  }
}

main();
