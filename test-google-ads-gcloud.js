#!/usr/bin/env node

/**
 * Teste da Google Ads API usando o token do gcloud
 */

import fetch from 'node-fetch';
import { execSync } from 'child_process';

async function testGoogleAdsWithGCloudToken() {
  try {
    // Obter token do gcloud
    const token = execSync('gcloud auth application-default print-access-token', { encoding: 'utf8' }).trim();
    console.log('✅ Token obtido do gcloud:', token.substring(0, 20) + '...');

    // Configurar headers
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'PHDnt9SoV92TyZlefN-gyg',
    };

    console.log('🔑 Headers configurados:', {
      hasAuth: !!headers.Authorization,
      hasDeveloperToken: !!headers['developer-token'],
    });

    // Testar listagem de customers
    console.log('\n📋 Testando listAccessibleCustomers...');
    const customersUrl = 'https://googleads.googleapis.com/v15/customers:listAccessibleCustomers';
    
    const customersResponse = await fetch(customersUrl, {
      method: 'GET',
      headers: headers
    });

    console.log('Status:', customersResponse.status, customersResponse.statusText);
    const customersText = await customersResponse.text();
    console.log('Response:', customersText.substring(0, 200) + '...');

    if (customersResponse.ok) {
      const customersData = JSON.parse(customersText);
      console.log('✅ Customers encontrados:', customersData);
      return customersData;
    } else {
      console.log('❌ Erro na API de customers');
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar teste
testGoogleAdsWithGCloudToken();