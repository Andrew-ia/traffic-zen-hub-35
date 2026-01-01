
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const CLIENT_ID = process.env.MERCADO_LIVRE_CLIENT_ID;
const CLIENT_SECRET = process.env.MERCADO_LIVRE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.MERCADO_LIVRE_REFRESH_TOKEN;

async function verifyCredentials() {
    console.log('--- Verificando Credenciais do Mercado Livre ---');
    console.log(`Client ID: ${CLIENT_ID}`);
    console.log(`Client Secret: ${CLIENT_SECRET ? '******' + CLIENT_SECRET.slice(-4) : 'NÃO DEFINIDO'}`);
    console.log(`Refresh Token: ${REFRESH_TOKEN}`);

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.error('❌ ERRO: Credenciais incompletas no .env.local');
        return;
    }

    try {
        console.log('\nTentando renovar o token para validar Client ID e Secret...');
        const response = await axios.post('https://api.mercadolibre.com/oauth/token', new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: REFRESH_TOKEN
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log('✅ SUCESSO! As credenciais estão corretas.');
        console.log('Novo Access Token gerado:', response.data.access_token.slice(0, 10) + '...');
        console.log('\nCONCLUSÃO:');
        console.log('As credenciais no seu arquivo .env.local estão VÁLIDAS.');
        console.log('Se o erro persiste em produção (Vercel), é porque as variáveis de ambiente LÁ estão diferentes destas.');
    } catch (error: any) {
        console.error('❌ FALHA: Ocorreu um erro ao validar as credenciais.');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Erro:', error.response.data);
            if (error.response.data.error === 'invalid_client') {
                console.error('\nDIAGNÓSTICO: O Client ID ou Client Secret está incorreto.');
            } else if (error.response.data.error === 'invalid_grant') {
                 console.error('\nDIAGNÓSTICO: O Refresh Token é inválido ou expirou, mas o Client ID/Secret podem estar certos.');
                 // Try to validate client without refresh token? No public endpoint for that except getting a generic error vs invalid_client.
            }
        } else {
            console.error('Erro:', error.message);
        }
    }
}

verifyCredentials();
