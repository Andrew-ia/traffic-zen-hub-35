import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function debugAuth() {
    const code = "TG-6956f3f7017f1b0001770084-1438975559"; // Código do usuário
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID;
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET;
    
    // Simular o que o servidor faz: omitir redirect_uri para localhost
    // const redirectUri = "http://localhost:8080/integrations/mercadolivre/callback"; 
    // Em localhost, USAMOS A URL DA VERCEL
    const redirectUri = "https://traffic-zen-hub-35.vercel.app/integrations/mercadolivre/callback";

    console.log('--- Debug Auth Exchange ---');
    console.log('Client ID:', clientId);
    // console.log('Client Secret:', clientSecret ? '***' : 'MISSING');

    const payloadParams = {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri // AGORA ENVIAMOS
    };

    console.log('Payload:', payloadParams);

    try {
        const response = await axios.post(
            `https://api.mercadolibre.com/oauth/token`,
            new URLSearchParams(payloadParams as any),
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" }
            }
        );
        console.log('SUCCESS:', response.data);
    } catch (error: any) {
        console.error('ERROR:', error.response ? error.response.data : error.message);
    }
}

debugAuth();
