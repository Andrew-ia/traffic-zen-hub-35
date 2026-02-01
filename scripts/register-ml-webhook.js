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
const CLIENT_SECRET = process.env.MERCADO_LIVRE_CLIENT_SECRET;
let ACCESS_TOKEN = process.env.MERCADO_LIVRE_ACCESS_TOKEN;
const REFRESH_TOKEN = process.env.MERCADO_LIVRE_REFRESH_TOKEN;
const USER_ID = process.env.MERCADO_LIVRE_USER_ID;
const USER_AGENT = 'TrafficZenHub/1.0';

async function refreshAccessToken() {
  if (!REFRESH_TOKEN || !CLIENT_SECRET) {
    console.error('❌ Impossível renovar token: REFRESH_TOKEN ou CLIENT_SECRET ausentes.');
    return false;
  }

  try {
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'refresh_token',
      client_id: APP_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN
    }, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token } = response.data;
    ACCESS_TOKEN = access_token;
    
    console.log('✅ Token renovado com sucesso!');
    console.log('📝 Atualize seu .env.local com os novos tokens:');
    console.log(`   MERCADO_LIVRE_ACCESS_TOKEN=${access_token}`);
    if (refresh_token !== REFRESH_TOKEN) {
      console.log(`   MERCADO_LIVRE_REFRESH_TOKEN=${refresh_token}`);
    }
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ Falha ao renovar token:', error.response?.data || error.message);
    return false;
  }
}

// Definir base URL dinâmica:
// Prioridade:
// 1) WEBHOOK_BASE_URL explícito
// 2) NGROK_DOMAIN (https://<domain>)
// 3) VERCEL_URL (https://<vercel_url>)
// 4) FRONTEND_URL substituído para API (se for vercel/produção)
// 5) Fallback padrão vercel estável
const WEBHOOK_BASE_URL = (process.env.WEBHOOK_BASE_URL || '').trim();
const NGROK_DOMAIN = (process.env.NGROK_DOMAIN || '').trim();
const VERCEL_URL = (process.env.VERCEL_URL || '').trim();
const DEFAULT_VERCEL = 'https://traffic-zen-hub-35-ten.vercel.app';
const API_BASE = (process.env.API_BASE_URL || process.env.VITE_API_URL || process.env.FRONTEND_URL || '').trim();
const SKIP_WEBHOOK_TEST = (process.env.SKIP_WEBHOOK_TEST || '').toLowerCase() === 'true';
const WEBHOOK_HEALTH_URL = (process.env.WEBHOOK_HEALTH_URL || '').trim();

const resolveBaseUrl = () => {
  if (WEBHOOK_BASE_URL) return WEBHOOK_BASE_URL.replace(/\/+$/, '');
  if (NGROK_DOMAIN) return `https://${NGROK_DOMAIN.replace(/\/+$/, '')}`;
  if (API_BASE) return API_BASE.replace(/\/+$/, '');
  if (VERCEL_URL) return `https://${VERCEL_URL.replace(/\/+$/, '')}`;
  return DEFAULT_VERCEL;
};

const BASE_URL = resolveBaseUrl();
const CALLBACK_URL = `${BASE_URL}/api/integrations/mercadolivre/notifications`;

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

    const makeRequest = async () => axios.get(
      `https://api.mercadolibre.com/applications/${APP_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'User-Agent': USER_AGENT
        }
      }
    );

    let response;
    try {
      response = await makeRequest();
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data || {};
      const message = (data.message || '').toLowerCase();
      const code = (data.code || '').toLowerCase();
      const errorStr = (data.error || '').toLowerCase();

      // Check for 401/403 OR specific error messages indicating token issues
      if (
        status === 401 || 
        status === 403 || 
        message.includes('invalid access token') || 
        message.includes('unauthorized') ||
        code === 'unauthorized' ||
        errorStr === 'unauthorized'
      ) {
        console.log(`🔄 Token inválido (Status: ${status}, Msg: ${message}). Tentando renovar...`);
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          // Retry with new token
          response = await makeRequest();
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

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

    const makeRequest = async () => axios.post(
      `https://api.mercadolibre.com/applications/${APP_ID}`,
      {
        callback_url: CALLBACK_URL,
        topics: [topic]
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT
        }
      }
    );

    let response;
    try {
      response = await makeRequest();
    } catch (error) {
      // Check for "already exists"
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        console.log(`ℹ️  Webhook para ${topic} já estava registrado\n`);
        return true;
      }

      const status = error.response?.status;
      const data = error.response?.data || {};
      const message = (data.message || '').toLowerCase();
      const code = (data.code || '').toLowerCase();

      if (
        status === 401 || 
        status === 403 || 
        message.includes('invalid access token') || 
        message.includes('unauthorized') ||
        code === 'unauthorized'
      ) {
        console.log(`🔄 Token inválido ao registrar ${topic}. Tentando renovar...`);
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          try {
            response = await makeRequest();
          } catch (retryError) {
             // Handle "already exists" on retry too
             if (retryError.response?.status === 400 && retryError.response?.data?.message?.includes('already exists')) {
                console.log(`ℹ️  Webhook para ${topic} já estava registrado\n`);
                return true;
             }
             throw retryError;
          }
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

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

    const makeRequest = async () => axios.put(
      `https://api.mercadolibre.com/applications/${APP_ID}`,
      {
        notifications_callback_url: CALLBACK_URL
      },
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT
        }
      }
    );

    let response;
    try {
      response = await makeRequest();
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data || {};
      const message = (data.message || '').toLowerCase();
      const code = (data.code || '').toLowerCase();

      if (
        status === 401 || 
        status === 403 || 
        message.includes('invalid access token') || 
        message.includes('unauthorized') ||
        code === 'unauthorized'
      ) {
        console.log('🔄 Token expirado ou inválido (durante update). Tentando renovar...');
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          response = await makeRequest();
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    console.log(`✅ URL de callback atualizada com sucesso!`);
    console.log(`   Nova URL: ${CALLBACK_URL}\n`);
    return true;
  } catch (error) {
      const data = error.response?.data;
      
      // Check for HTML error (WAF/Block)
      if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html'))) {
         console.error('❌ Bloqueio de segurança (WAF) detectado ao atualizar URL.');
         console.error('   O Mercado Livre bloqueou a requisição automática de atualização.');
         return false; // Fail gracefully so main() can show manual steps
      }

      console.error('❌ Erro ao atualizar callback URL:', typeof data === 'object' ? JSON.stringify(data) : (data || error.message));
      return false;
    }
}

async function testWebhook() {
  if (SKIP_WEBHOOK_TEST) {
    console.log('⏭️  Teste de webhook pulado por SKIP_WEBHOOK_TEST=true\n');
    return true;
  }

  try {
    console.log('\n🧪 Testando endpoint de webhook...\n');

    const testPayload = {
      topic: 'orders_v2',
      resource: '/orders/TEST-ORDER-123',
      user_id: parseInt(USER_ID),
      sent: new Date().toISOString()
    };

    // Primeiro, checar health simples para evitar ECONNREFUSED
    const parsed = new URL(CALLBACK_URL);
    const healthUrl = WEBHOOK_HEALTH_URL || `${parsed.origin}/api/health`;
    try {
      const health = await axios.get(healthUrl, { timeout: 3000, validateStatus: () => true });
      if (health.status >= 500) {
        console.warn(`⚠️  Health check respondeu ${health.status} em ${healthUrl}. Continuando mesmo assim...`);
      }
    } catch (err) {
      console.warn(`⚠️  Health check falhou (${healthUrl}): ${err.message}. Continuando para teste de payload...`);
    }

    const response = await axios.post(CALLBACK_URL, testPayload, {
      timeout: 5000,
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 200) {
      console.log('✅ Endpoint de webhook está respondendo corretamente!\n');
      return true;
    }

    if (response.status && response.status < 500) {
      console.log(`⚠️  Endpoint respondeu com status: ${response.status}`);
      console.log(`   Detalhes:`, response.data);
      console.log('');
      return false;
    }

    console.log(`⚠️  Endpoint não respondeu 200 (status ${response.status || 'sem status'})`);
    return false;
  } catch (error) {
    const code = error.code || '';
    const isConn = code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN';
    console.warn(`⚠️  Não foi possível testar o webhook (${error.message}).${isConn ? ' Serviço pode estar offline ou domínio errado.' : ''}`);
    console.warn('   Dica: rode `npm run dev` (api + ngrok) ou configure WEBHOOK_BASE_URL para um endpoint acessível.\n');
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
  let updated = true;
  if (currentWebhook === CALLBACK_URL) {
    console.log('✅ URL de callback já está atualizada no Mercado Livre.');
    console.log('   Pulando etapa de configuração para evitar erros de bloqueio (WAF).\n');
  } else {
    updated = await updateCallbackUrl();
  }

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
