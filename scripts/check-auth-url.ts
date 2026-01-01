import { getPool } from '../server/config/database';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env.local in root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config(); // fallback

async function checkEnv() {
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL;
    
    console.log('--- Environment Check ---');
    console.log('MERCADO_LIVRE_CLIENT_ID:', clientId ? `${clientId.substring(0, 4)}...` : 'MISSING');
    console.log('FRONTEND_URL:', frontendUrl || 'MISSING');
    
    if (!clientId || !frontendUrl) {
        console.error('Missing critical env vars');
        return;
    }

    // Simulate URL generation
    const workspaceId = 'test-workspace-id';
    const redirectUri = `${frontendUrl.replace(/\/$/, '')}/integrations/mercadolivre/callback`;
    
    // CloudFront blocks requests with localhost/127.0.0.1 in redirect_uri param (WAF rule).
    // If we are on localhost, we omit the redirect_uri param and rely on the Mercado Livre App settings.
    const isLocalhost = redirectUri.includes("localhost") || redirectUri.includes("127.0.0.1");

    // 1. Brazil Auth (Correct)
    let authUrlBR = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${clientId}&state=${workspaceId}`;

    if (!isLocalhost) {
        authUrlBR += `&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }
    
    // 2. Global Auth
    const authUrlGlobal = `https://auth.mercadolibre.com/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${workspaceId}`;

    console.log('\n--- Generated URLs ---');
    console.log('BR URL:', authUrlBR);
    console.log('Global URL:', authUrlGlobal);
    
    console.log('\n--- Analysis ---');
    if (authUrlBR.includes('mercadolibre.com.br')) {
        console.error('WARNING: Typo in BR domain (mercadolibre instead of mercadolivre)');
    } else {
        console.log('BR Domain spelling looks correct (mercadolivre)');
    }
}

checkEnv().catch(console.error);
