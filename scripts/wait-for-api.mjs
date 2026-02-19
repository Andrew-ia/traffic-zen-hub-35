import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const shouldSkip = String(process.env.SKIP_API_WAIT || '').toLowerCase() === 'true';
if (shouldSkip) {
  console.log('⏭️  SKIP_API_WAIT=true. Pulando espera da API.');
  process.exit(0);
}

const port = Number(process.env.API_PORT || process.env.PORT || 3001);
const apiUrlRaw = (process.env.API_URL || process.env.API_BASE_URL || '').trim();
const baseUrl = apiUrlRaw ? apiUrlRaw.replace(/\/+$/, '') : `http://localhost:${port}`;
const healthPath = (process.env.API_HEALTH_PATH || '/api/health').trim();
const healthUrl = (process.env.API_HEALTH_URL || `${baseUrl}${healthPath.startsWith('/') ? healthPath : `/${healthPath}`}`).trim();

const timeoutMs = Number(process.env.API_WAIT_TIMEOUT_MS || 20000);
const intervalMs = Number(process.env.API_WAIT_INTERVAL_MS || 500);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const start = Date.now();
console.log(`⏳ Aguardando API em ${healthUrl} (timeout ${timeoutMs}ms)...`);

while (Date.now() - start < timeoutMs) {
  try {
    const res = await fetch(healthUrl, { method: 'GET' });
    if (res.ok) {
      console.log('✅ API pronta.');
      process.exit(0);
    }
  } catch {
    // aguardando até a API ficar disponível
  }

  await sleep(intervalMs);
}

console.error(`❌ Timeout ao aguardar API em ${healthUrl}.`);
process.exit(1);
