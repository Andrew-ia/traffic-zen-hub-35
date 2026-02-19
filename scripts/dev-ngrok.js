import { spawn } from 'child_process';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const port = Number(process.env.API_PORT || 3001);
const domain = process.env.NGROK_DOMAIN ? String(process.env.NGROK_DOMAIN).trim() : '';
const authtoken = process.env.NGROK_AUTHTOKEN || process.env.NGROK_TOKEN || '';
const hostHeader = process.env.NGROK_HOST_HEADER || `localhost:${port}`;
const apiUrlRaw = (process.env.API_URL || process.env.API_BASE_URL || '').trim();
const apiBaseUrl = apiUrlRaw ? apiUrlRaw.replace(/\/+$/, '') : `http://localhost:${port}`;
const workspaceId =
  process.env.MERCADO_LIVRE_DEFAULT_WORKSPACE_ID ||
  process.env.WORKSPACE_ID ||
  process.env.VITE_WORKSPACE_ID ||
  '00000000-0000-0000-0000-000000000010';
const forceWebhookRegister = String(process.env.FORCE_ML_WEBHOOK_REGISTER || '').toLowerCase() === 'true';
const skipRegisterIfConnected =
  String(process.env.SKIP_ML_WEBHOOK_REGISTER_IF_CONNECTED || 'true').toLowerCase() === 'true';

const args = ['http', String(port), '--host-header', hostHeader];
if (domain) args.push('--domain', domain);
if (authtoken) args.push('--authtoken', authtoken);

console.log('🌐 Iniciando ngrok para expor a API:', {
  port,
  domain: domain || 'dinâmico (free)',
  hostHeader,
});

const proc = spawn('ngrok', args, {
  stdio: 'inherit',
});

async function resolvePublicUrl() {
  if (domain) {
    const fixed = `https://${domain.replace(/\/+$/, '')}`;
    return fixed;
  }
  const api = 'http://127.0.0.1:4040/api/tunnels';
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(api);
      if (!res.ok) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      const data = await res.json();
      const httpTunnel = (data.tunnels || []).find(t => /https?:/.test(t.public_url));
      if (httpTunnel?.public_url) {
        return String(httpTunnel.public_url).replace(/^http:/, 'https:');
      }
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function shouldSkipAutoRegister() {
  if (forceWebhookRegister || !skipRegisterIfConnected) return false;

  const statusUrl = `${apiBaseUrl}/api/integrations/mercadolivre/auth/status?workspaceId=${encodeURIComponent(workspaceId)}&mode=local`;
  try {
    const res = await fetch(statusUrl, { method: 'GET' });
    if (!res.ok) return false;
    const data = await res.json();
    if (data?.connected) {
      console.log('ℹ️  Mercado Livre já conectado para este workspace. Pulando auto-registro do webhook.');
      console.log('   Para forçar o registro, use FORCE_ML_WEBHOOK_REGISTER=true\n');
      return true;
    }
  } catch {
    // Se falhar, não bloqueia o auto registro
  }

  return false;
}

async function autoRegisterWebhook() {
  if (await shouldSkipAutoRegister()) {
    return;
  }

  const publicUrl = await resolvePublicUrl();
  if (!publicUrl) {
    console.warn('⚠️  Não foi possível obter a URL pública do ngrok para auto registro do webhook.');
    return;
  }
  console.log('🔗 URL pública detectada:', publicUrl);
  console.log('🪝 Registrando webhook do Mercado Livre com baseUrl:', publicUrl);
  const child = spawn(process.execPath, ['scripts/register-ml-webhook.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      WEBHOOK_BASE_URL: publicUrl,
    },
  });
  child.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ Webhook registrado/validado com sucesso.');
    } else {
      console.warn('⚠️  Falha ao registrar webhook via script (exit code', code, '). Verifique manualmente no painel do ML.');
    }
  });
}

// Disparar auto registro após inicializar o ngrok
setTimeout(() => {
  autoRegisterWebhook().catch(() => {});
}, 3000);

proc.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('ngrok não encontrado. Instale com `npm install -g ngrok` ou tenha o binário no PATH.');
  } else {
    console.error('Erro ao iniciar ngrok:', err);
  }
  process.exit(1);
});

const shutdown = () => {
  if (proc.pid) {
    proc.kill('SIGTERM');
  }
};

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});
