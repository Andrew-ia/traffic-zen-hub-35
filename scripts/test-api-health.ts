import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

async function main() {
  const apiUrl = (process.env.VITE_API_URL || process.env.API_URL || '').trim();
  const base = apiUrl || 'http://localhost:3001';
  const workspaceId = (process.env.VITE_WORKSPACE_ID || process.env.WORKSPACE_ID || '').trim();

  if (!workspaceId) {
    console.error('Missing workspace id');
    process.exit(1);
  }

  const health = await fetch(`${base}/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error('API health check failed');
    process.exit(1);
  }

  const jobs = await fetch(`${base}/api/integrations/sync/workspace/${workspaceId}?limit=1`, {
    headers: { Accept: 'application/json' },
  }).catch(() => null);

  if (!jobs || !jobs.ok) {
    console.error('API workspace sync jobs endpoint failed');
    process.exit(1);
  }

  const startResp = await fetch(`${base}/api/integrations/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ workspaceId, platformKey: 'meta', days: 1, type: 'all' }),
  }).catch(() => null);

  if (!startResp || !startResp.ok) {
    const payload = startResp ? await startResp.json().catch(() => ({})) : null;
    console.error('Failed to start sync', payload);
    process.exit(1);
  }

  const startPayload: any = await startResp.json().catch(() => ({}));
  const jobId: string | undefined = startPayload?.data?.jobId;
  if (!jobId) {
    console.error('Sync start did not return jobId');
    process.exit(1);
  }

  let attempts = 0;
  const maxAttempts = 60;
  while (attempts < maxAttempts) {
    attempts += 1;
    await new Promise((r) => setTimeout(r, 2000));
    const statusResp = await fetch(`${base}/api/integrations/sync/${jobId}`, { headers: { Accept: 'application/json' } }).catch(() => null);
    if (!statusResp || !statusResp.ok) continue;
    const statusPayload: any = await statusResp.json().catch(() => ({}));
    const status = statusPayload?.data?.status;
    const progress = statusPayload?.data?.progress;
    console.log(`Status: ${status} ${typeof progress === 'number' ? progress + '%' : ''}`);
    if (status === 'completed') {
      console.log('OK');
      return;
    }
    if (status === 'failed') {
      console.error('Sync failed', statusPayload?.data?.error);
      process.exit(1);
    }
  }

  console.error('Sync timed out');
  process.exit(1);
}

main();
