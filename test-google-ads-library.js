#!/usr/bin/env node

/**
 * Teste da Google Ads API usando a biblioteca oficial e token do gcloud
 */

import { GoogleAdsApi } from 'google-ads-api';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testGoogleAdsLibrary() {
  try {
    console.log('🚀 Testando Google Ads API com biblioteca oficial...\n');

    // Obter token do gcloud como refresh token
    const accessToken = execSync('gcloud auth application-default print-access-token', { encoding: 'utf8' }).trim();
    console.log('✅ Access token obtido do gcloud:', accessToken.substring(0, 20) + '...');

    // Configurar cliente
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    console.log('✅ Cliente configurado com credenciais:', {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasDeveloperToken: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    // Usar refresh token do banco ou env
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    console.log('✅ Refresh token:', refreshToken ? refreshToken.substring(0, 20) + '...' : 'não encontrado');

    if (!refreshToken) {
      console.log('❌ Refresh token não encontrado. Usando access token diretamente...');
      
      // Tentar usar access token diretamente
      const customer = client.Customer({
        customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
        login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
        refresh_token: refreshToken,
      });

      // Configurar token de acesso manualmente
      customer.credentials.access_token = accessToken;
      
      console.log('\n📋 Testando consulta de campanhas...');
      const campaigns = await customer.query(`
        SELECT 
          campaign.id,
          campaign.name,
          campaign.status 
        FROM campaign 
        LIMIT 5
      `);

      console.log('✅ Campanhas encontradas:', campaigns.length);
      console.log(campaigns);
      
    } else {
      // Usar refresh token normal
      console.log('\n📋 Testando listAccessibleCustomers...');
      const customers = await client.listAccessibleCustomers(refreshToken);
      console.log('✅ Customers acessíveis:', customers);

      if (customers.resourceNames && customers.resourceNames.length > 0) {
        const customerId = customers.resourceNames[0].split('/')[1];
        console.log('\n📋 Usando customer ID:', customerId);

        const customer = client.Customer({
          customer_id: customerId,
          login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
          refresh_token: refreshToken,
        });

        console.log('\n📋 Testando consulta de campanhas...');
        const campaigns = await customer.query(`
          SELECT 
            campaign.id,
            campaign.name,
            campaign.status 
          FROM campaign 
          LIMIT 5
        `);

        console.log('✅ Campanhas encontradas:', campaigns.length);
        console.log(campaigns);
      }
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
    
    // Log mais detalhado do erro
    if (error.details) {
      console.error('Detalhes do erro:', error.details);
    }
  }
}

// Executar teste
testGoogleAdsLibrary();