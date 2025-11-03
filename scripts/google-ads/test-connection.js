#!/usr/bin/env node
/**
 * Script para testar conexão com Google Ads API
 */

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

console.log('\n🔍 Testando conexão com Google Ads API\n');

console.log('📋 Credenciais:');
console.log(`   Customer ID: ${GOOGLE_ADS_CUSTOMER_ID}`);
console.log(`   Login Customer ID: ${GOOGLE_ADS_LOGIN_CUSTOMER_ID || 'Não definido'}`);
console.log(`   Developer Token: ${GOOGLE_ADS_DEVELOPER_TOKEN?.substring(0, 10)}...`);
console.log(`   Client ID: ${GOOGLE_CLIENT_ID?.substring(0, 20)}...`);
console.log(`   Client Secret: ${GOOGLE_CLIENT_SECRET ? '✓ Presente' : '✗ Ausente'}`);
console.log(`   Refresh Token: ${GOOGLE_ADS_REFRESH_TOKEN ? '✓ Presente' : '✗ Ausente'}\n`);

if (!GOOGLE_ADS_REFRESH_TOKEN) {
  console.error('❌ Refresh Token não encontrado!');
  console.log('Execute: node scripts/google-ads/get-refresh-token.js\n');
  process.exit(1);
}

try {
  console.log('🔄 Inicializando cliente Google Ads...');

  const client = new GoogleAdsApi({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    developer_token: GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customerConfig = {
    customer_id: GOOGLE_ADS_CUSTOMER_ID,
    refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
  };

  if (GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    customerConfig.login_customer_id = GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  }

  const customer = client.Customer(customerConfig);

  console.log('✅ Cliente inicializado com sucesso!');
  console.log('\n🔄 Testando query simples...\n');

  const query = `
    SELECT
      customer.id,
      customer.descriptive_name
    FROM customer
    LIMIT 1
  `;

  const result = await customer.query(query);

  console.log('✅ Conexão bem-sucedida!');
  console.log('\n📊 Dados do cliente:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n🎉 Tudo funcionando! Você pode executar a sincronização completa agora.\n');

} catch (error) {
  console.error('\n❌ Erro ao conectar:', error.message);

  if (error.errors) {
    console.error('\n📋 Detalhes dos erros:');
    error.errors.forEach((err, i) => {
      console.error(`\nErro ${i + 1}:`);
      console.error(JSON.stringify(err, null, 2));
    });
  }

  console.log('\n💡 Possíveis soluções:');
  console.log('1. Verifique se o Developer Token está correto');
  console.log('2. Certifique-se de que o Customer ID está sem traços: 1988032294');
  console.log('3. Verifique se o Refresh Token foi gerado corretamente');
  console.log('4. Confirme se a conta tem acesso ao Google Ads API\n');

  process.exit(1);
}
