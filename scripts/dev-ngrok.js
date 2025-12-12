import { spawn } from 'child_process';
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
