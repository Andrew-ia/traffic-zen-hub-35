import { MercadoAdsAutomationService } from '../server/services/mercadolivre/ads-automation.service';
import { getPool } from '../server/config/database';
import dotenv from 'dotenv';

dotenv.config();

const WORKSPACE_ID = '904766a7-e89c-4bf1-8777-4b8fde78a3a6'; // Andrew

async function main() {
  const service = new MercadoAdsAutomationService();
  console.log(`Starting campaign creation test for workspace: ${WORKSPACE_ID}`);

  try {
    const result = await service.testCreateCampaign(WORKSPACE_ID);
    console.log('✅ Test Completed Successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ Test Failed!');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('API Response Status:', error.response.status);
      console.error('API Response Data:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    await getPool().end();
  }
}

main();
