import axios from 'axios';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../.env.local') });

const accessToken = process.env.MERCADO_LIVRE_ACCESS_TOKEN;

if (!accessToken) {
    console.error('❌ MERCADO_LIVRE_ACCESS_TOKEN não encontrado no .env.local');
    process.exit(1);
}

async function testMLConnection() {
    console.log('🔍 Testando conexão com Mercado Livre...\n');
    console.log(`📝 Token: ${accessToken.substring(0, 20)}...`);

    // Extrair User ID do token TG (formato: TG-{hash}-{userId})
    const tgMatch = accessToken.match(/TG-[a-f0-9]+-(\d+)/);
    if (tgMatch) {
        const userId = tgMatch[1];
        console.log(`\n✅ User ID extraído do token: ${userId}`);
        console.log('\n📝 Adicione ao seu .env.local:');
        console.log(`MERCADO_LIVRE_USER_ID=${userId}`);
    }

    // Tentar diferentes endpoints para validar o token
    const endpoints = [
        { name: 'User Info (/users/me)', url: 'https://api.mercadolibre.com/users/me' },
        { name: 'Test User', url: `https://api.mercadolibre.com/users/${tgMatch?.[1] || 'me'}` },
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n🔄 Testando: ${endpoint.name}...`);
            const response = await axios.get(endpoint.url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            console.log(`✅ ${endpoint.name} - Sucesso!`);
            const user = response.data;

            if (user.id) {
                console.log(`   User ID: ${user.id}`);
                console.log(`   Nickname: ${user.nickname || 'N/A'}`);
                console.log(`   País: ${user.site_id || 'N/A'}`);

                console.log('\n📝 Adicione ao seu .env.local:');
                console.log(`MERCADO_LIVRE_USER_ID=${user.id}`);

                return user;
            }
        } catch (error: any) {
            console.log(`❌ ${endpoint.name} - Erro:`);
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Mensagem: ${error.response.data?.message || error.response.statusText}`);
            } else {
                console.log(`   ${error.message}`);
            }
        }
    }

    console.log('\n⚠️  Não foi possível validar o token com os endpoints testados.');
    console.log('\n💡 Possíveis soluções:');
    console.log('   1. Verifique se o token TG está correto');
    console.log('   2. O token TG pode ter expirado (válido por 6 horas)');
    console.log('   3. Gere um novo token TG em: https://developers.mercadolivre.com.br/apps');
    console.log('   4. Ou use o fluxo OAuth completo para obter um token de produção');
}

testMLConnection();
