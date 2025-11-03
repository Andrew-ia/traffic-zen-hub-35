#!/usr/bin/env node
import { GoogleAdsApi } from 'google-ads-api';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const {
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} = process.env;

const customerId = GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');

const client = new GoogleAdsApi({
  client_id: GOOGLE_CLIENT_ID,
  client_secret: GOOGLE_CLIENT_SECRET,
  developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customerConfig = {
  customer_id: customerId,
  refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
};

if (GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
  customerConfig.login_customer_id = GOOGLE_ADS_LOGIN_CUSTOMER_ID;
}

const customer = client.Customer(customerConfig);

async function main() {
  try {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.id
      LIMIT 10
    `;

    const campaigns = await customer.query(query);

    console.log('\n📋 Status das campanhas no Google Ads:\n');
    campaigns.forEach(c => {
      console.log(`ID: ${c.campaign.id}`);
      console.log(`Nome: ${c.campaign.name}`);
      console.log(`Status: ${c.campaign.status}`);
      console.log(`Tipo: ${c.campaign.advertising_channel_type}`);
      console.log('---');
    });

  } catch (error) {
    console.error('Erro:', error.message || error);
    console.error('Stack:', error.stack);
  }
}

main();
