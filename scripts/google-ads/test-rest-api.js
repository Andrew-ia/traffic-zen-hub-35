#!/usr/bin/env node
/**
 * Test Google Ads API usando REST direto
 */

import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config({ path: '.env.local' });

const {
  GOOGLE_ADS_CUSTOMER_ID,
  GOOGLE_ADS_DEVELOPER_TOKEN,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_ADS_REFRESH_TOKEN,
} = process.env;

console.log('\n🧪 Testando Google Ads API com REST direto\n');

async function test() {
  try {
    // Step 1: Get access token from refresh token
    console.log('1️⃣  Obtendo Access Token...');

    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      'http://localhost:3002/oauth2callback'
    );

    oauth2Client.setCredentials({
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    const accessToken = credentials.access_token;

    console.log('✅ Access Token obtido!');
    console.log(`   Token: ${accessToken.substring(0, 30)}...`);

    // Step 2: Make REST API call to Google Ads
    console.log('\n2️⃣  Fazendo requisição REST para Google Ads API...');

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      LIMIT 5
    `;

    // Try v22 (newest version)
    const url = `https://googleads.googleapis.com/v22/customers/${GOOGLE_ADS_CUSTOMER_ID}/googleAds:search`;

    console.log(`   URL: ${url}`);
    console.log(`   Customer ID: ${GOOGLE_ADS_CUSTOMER_ID}`);
    console.log(`   Developer Token: ${GOOGLE_ADS_DEVELOPER_TOKEN}`);
    console.log(`   Refresh Token present: ${GOOGLE_ADS_REFRESH_TOKEN ? 'Yes' : 'No'}\n`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
        'login-customer-id': GOOGLE_ADS_CUSTOMER_ID, // Add MCC/login customer ID
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro na API:', response.status, response.statusText);
      console.error('Detalhes:', errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    console.log('✅ Requisição bem-sucedida!');
    console.log('\n📊 Dados recebidos:');
    console.log(JSON.stringify(data, null, 2));

    console.log('\n🎉 Sucesso! A API está funcionando corretamente.\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }

    console.log('\n💡 Possíveis problemas:');
    console.log('1. O Developer Token pode estar inativo ou incorreto');
    console.log('2. A conta pode não ter acesso ao Google Ads API');
    console.log('3. O Customer ID pode estar incorreto');
    console.log('4. A conta pode precisar de permissões adicionais\n');

    process.exit(1);
  }
}

test();
