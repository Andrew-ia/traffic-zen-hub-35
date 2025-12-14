import { spawn } from 'child_process';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const port = Number(process.env.API_PORT || 3001);
const domain = process.env.NGROK_DOMAIN ? String(process.env.NGROK_DOMAIN).trim() : '';
const authtoken = process.env.NGROK_AUTHTOKEN || process.env.NGROK_TOKEN || '';
const hostHeader = process.env.NGROK_HOST_HEADER || `localhost:${port}`;

const args = ['http', String(port), '--log', 'stdout', '--host-header', hostHeader];
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

async function autoRegisterWebhook() {
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
