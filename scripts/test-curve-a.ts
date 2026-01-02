
import { MercadoAdsAutomationService } from '../server/services/mercadolivre/ads-automation.service.js';
import { getPool } from '../server/config/database.js';
import { config } from 'dotenv';
import path from 'path';

// Load env vars
config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
  const service = new MercadoAdsAutomationService();
  const pool = getPool();
  
  try {
    // 1. Get workspace
    const wsRes = await pool.query('SELECT id FROM workspaces LIMIT 1');
    if (wsRes.rows.length === 0) throw new Error('No workspace found');
    const workspaceId = wsRes.rows[0].id;
    console.log(`Using Workspace: ${workspaceId}`);

    // 2. Sync campaigns to find the manually created "Curva A"
    console.log('Syncing campaigns...');
    
    // DEBUG: Inject a spy on console.warn/error/log to see what's happening inside service
    const originalWarn = console.warn;
    console.warn = (...args) => {
        console.log('[SERVICE WARN]:', ...args);
        originalWarn.apply(console, args);
    };

    // Access private method via any cast or just use listCampaigns which calls syncExistingCampaigns internally
    await service.listCampaigns(workspaceId);

    // 3. Find "Curva A" campaign
    const campRes = await pool.query(
      `SELECT * FROM ml_ads_campaigns WHERE workspace_id = $1`,
      [workspaceId]
    );
    
    console.log(`Found ${campRes.rows.length} campaigns in DB:`);
    campRes.rows.forEach(c => console.log(` - [${c.curve || 'NO_CURVE'}] ${c.name} (ID: ${c.ml_campaign_id}) Status: ${c.status}`));

    const campaignA = campRes.rows.find(c => c.curve === 'A');
    
    if (!campaignA) {
       throw new Error('Please ensure a campaign named "Curva A" exists in Mercado Livre and sync again.');
    }
    
    console.log(`✅ Found Campaign Curve A: ${campaignA.name} (ID: ${campaignA.ml_campaign_id})`);

    // 4. Find a product to test
    // Prefer a product that has sales to be "worthy" of Curve A, or just any product for this test
    const prodRes = await pool.query(
      `SELECT id, ml_item_id, title FROM products WHERE workspace_id = $1 LIMIT 1`,
      [workspaceId]
    );
    
    if (prodRes.rows.length === 0) throw new Error('No products found');
    const product = prodRes.rows[0];
    console.log(`Testing with Product: ${product.title} (${product.ml_item_id})`);

    // 5. Upsert Ad to Campaign A
    const { advertiserId, siteId } = await (service as any).resolveAdvertiserContext(workspaceId);
    
    console.log('Adding product to campaign...');
    const adId = await service.upsertProductAd(
      workspaceId,
      advertiserId,
      siteId,
      campaignA,
      'A',
      {
        productId: product.id,
        mlItemId: product.ml_item_id,
        curve: 'A',
        title: product.title,
        action: 'active' // Ensure it's active
      }
    );

    console.log(`✅ SUCCESS! Product added/updated in Campaign A. Remote Ad ID: ${adId}`);

  } catch (error: any) {
    console.error('❌ Test Failed:', error?.message || error);
    if (error?.response?.data) {
        console.error('API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    process.exit(0);
  }
}

runTest();
