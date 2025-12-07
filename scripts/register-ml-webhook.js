/**
 * Script para registrar webhooks do Mercado Livre
 *
 * Este script registra os webhooks necessários para receber notificações
 * de vendas, perguntas, itens e mensagens do Mercado Livre em tempo real.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const APP_ID = process.env.MERCADO_LIVRE_CLIENT_ID;
const ACCESS_TOKEN = process.env.MERCADO_LIVRE_ACCESS_TOKEN;
const USER_ID = process.env.MERCADO_LIVRE_USER_ID;

// URL de produção - ajustar conforme necessário
const PRODUCTION_URL = 'https://traffic-zen-hub-35-ok1hoszcp-andrews-projects-9f7566af.vercel.app';
const CALLBACK_URL = `${PRODUCTION_URL}/api/integrations/mercadolivre/notifications`;

// Tópicos a serem registrados
const TOPICS = [
  'orders_v2',  // Notificações de vendas/pedidos
  'questions',  // Notificações de perguntas
  'items',      // Notificações de alterações em produtos
  'messages'    // Notificações de mensagens
];

async function listWebhooks() {
  try {
    console.log('\n🔍 Listando webhooks registrados...\n');

    const response = await axios.get(
      `https://api.mercadolibre.com/applications/${APP_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    if (response.data.notifications_callback_url) {
      console.log(`✅ Webhook já configurado no app:`);
      console.log(`   URL: ${response.data.notifications_callback_url}\n`);
    } else {
      console.log('⚠️  Nenhum webhook configurado no app ainda.\n');
    }

    return response.data.notifications_callback_url;
  } catch (error) {
    console.error('❌ Erro ao listar webhooks:', error.response?.data || error.message);
    return null;
  }
}

async function registerWebhook(topic) {
  try {
    console.log(`📝 Registrando webhook para tópico: ${topic}...`);

    const response = await axios.post(
      `https://api.mercadolibre.com/applications/${APP_ID}`,
      {
        callback_url: CALLBACK_URL,
        topics: [topic]
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Webhook para ${topic} registrado com sucesso!\n`);
    return true;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log(`ℹ️  Webhook para ${topic} já estava registrado\n`);
      return true;
    }
    console.error(`❌ Erro ao registrar webhook ${topic}:`, error.response?.data || error.message);
    return false;
  }
}

async function updateCallbackUrl() {
  try {
    console.log('\n🔄 Atualizando URL de callback no app...\n');

    const response = await axios.put(
      `https://api.mercadolibre.com/applications/${APP_ID}`,
      {
        notifications_callback_url: CALLBACK_URL
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ URL de callback atualizada com sucesso!`);
    console.log(`   Nova URL: ${CALLBACK_URL}\n`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao atualizar callback URL:', error.response?.data || error.message);
    return false;
  }
}

async function testWebhook() {
  try {
    console.log('\n🧪 Testando endpoint de webhook...\n');

    const testPayload = {
      topic: 'orders_v2',
      resource: '/orders/TEST-ORDER-123',
      user_id: parseInt(USER_ID),
      sent: new Date().toISOString()
    };

    const response = await axios.post(CALLBACK_URL, testPayload, {
      timeout: 5000
    });

    if (response.status === 200) {
      console.log('✅ Endpoint de webhook está respondendo corretamente!\n');
      return true;
    } else {
      console.log(`⚠️  Endpoint respondeu com status: ${response.status}\n`);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao testar webhook:', error.message);
    console.log('   Verifique se a aplicação está rodando em produção.\n');
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   REGISTRO DE WEBHOOKS DO MERCADO LIVRE              ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Validar variáveis de ambiente
  if (!APP_ID || !ACCESS_TOKEN || !USER_ID) {
    console.error('❌ Erro: Variáveis de ambiente não configuradas!');
    console.error('   Verifique se o .env.local contém:');
    console.error('   - MERCADO_LIVRE_CLIENT_ID');
    console.error('   - MERCADO_LIVRE_ACCESS_TOKEN');
    console.error('   - MERCADO_LIVRE_USER_ID\n');
    process.exit(1);
  }

  console.log(`📋 Configuração:`);
  console.log(`   App ID: ${APP_ID}`);
  console.log(`   User ID: ${USER_ID}`);
  console.log(`   Callback URL: ${CALLBACK_URL}\n`);
  console.log('─'.repeat(60));

  // 1. Listar webhooks atuais
  const currentWebhook = await listWebhooks();

  // 2. Testar se o endpoint está acessível
  const endpointOk = await testWebhook();
  if (!endpointOk) {
    console.log('⚠️  AVISO: O endpoint não está acessível. Continuando mesmo assim...\n');
  }

  // 3. Atualizar/Configurar URL de callback no app
  const updated = await updateCallbackUrl();

  if (!updated) {
    console.log('\n⚠️  Não foi possível atualizar via API.');
    console.log('   Configure manualmente em: https://developers.mercadolivre.com.br/');
    console.log('   1. Acesse "Minhas Aplicações"');
    console.log(`   2. Edite o app ${APP_ID}`);
    console.log('   3. Configure "Notifications Callback URL" com:');
    console.log(`      ${CALLBACK_URL}\n`);
  }

  console.log('─'.repeat(60));
  console.log('\n✨ Processo concluído!\n');
  console.log('📌 Próximos passos:');
  console.log('   1. Verifique no painel do desenvolvedor se o webhook está ativo');
  console.log('   2. Faça uma venda de teste no Mercado Livre');
  console.log('   3. Monitore os logs do servidor para ver as notificações chegando');
  console.log('   4. Você receberá notificações no Telegram quando houver vendas!\n');

  console.log('🔗 Links úteis:');
  console.log('   - Painel Dev ML: https://developers.mercadolivre.com.br/');
  console.log('   - Suas aplicações: https://developers.mercadolivre.com.br/devcenter/applications');
  console.log(`   - Endpoint webhook: ${CALLBACK_URL}\n`);
}

main().catch(console.error);
