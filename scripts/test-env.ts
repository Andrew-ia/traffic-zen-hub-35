import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

function requireVar(name: string) {
  const v = process.env[name];
  if (!v || String(v).trim() === '') {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

requireVar('VITE_WORKSPACE_ID');
requireVar('VITE_API_URL');

console.log('OK');
