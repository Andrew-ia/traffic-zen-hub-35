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

  const workspaces = await fetch(`${base}/api/workspaces`, {
    headers: { Accept: 'application/json' },
  }).catch(() => null);

  if (!workspaces || !workspaces.ok) {
    console.error('API workspaces endpoint failed');
    process.exit(1);
  }

  console.log('API health OK');
  console.log(`Workspace ID env: ${workspaceId}`);
}

main();
