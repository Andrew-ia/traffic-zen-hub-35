#!/usr/bin/env node
/**
 * Script para obter Refresh Token do Google OAuth
 *
 * Este script inicia um servidor local e abre o navegador para autorizar o acesso.
 * Após autorizar, o Google redireciona de volta e o script captura o refresh token.
 *
 * Uso:
 * node scripts/google-ads/get-refresh-token.js
 */

import dotenv from 'dotenv';
import http from 'http';
import { parse } from 'url';
import open from 'open';
import { google } from 'googleapis';

// Load .env.local
dotenv.config({ path: '.env.local' });

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('❌ Faltando GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET no .env.local');
  process.exit(1);
}

const PORT = 3002;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// Scopes necessários
const scopes = [
  'https://www.googleapis.com/auth/adwords', // Google Ads
];

console.log('\n🔐 Processo de autenticação OAuth Google Ads\n');

// Step 1: Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent', // Force to get refresh token
});

console.log('📋 Etapas:');
console.log('1. Um navegador vai abrir automaticamente');
console.log('2. Faça login com sua conta Google');
console.log('3. Autorize o acesso ao Google Ads');
console.log('4. Você será redirecionado de volta\n');

// Step 2: Create local server to receive callback
const server = http.createServer(async (req, res) => {
  try {
    const { query } = parse(req.url, true);

    if (req.url.indexOf('/oauth2callback') > -1) {
      const code = query.code;

      if (!code) {
        res.end('❌ Erro: código não recebido');
        return;
      }

      console.log('✅ Código de autorização recebido');
      console.log('🔄 Trocando código por tokens...\n');

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      console.log('✅ Tokens obtidos com sucesso!\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 ADICIONE ISTO NO SEU .env.local:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autenticação Completa</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 500px;
            }
            h1 { color: #667eea; margin-bottom: 20px; }
            .success { color: #28a745; font-size: 48px; margin-bottom: 20px; }
            .token { background: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all; margin: 20px 0; font-family: monospace; font-size: 12px; }
            .next-step { background: #667eea; color: white; padding: 15px 30px; border-radius: 5px; margin-top: 20px; display: inline-block; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h1>Autenticação Completa!</h1>
            <p>Seu <strong>Refresh Token</strong> foi gerado com sucesso.</p>
            <div class="token">
              <strong>Refresh Token:</strong><br/>
              ${tokens.refresh_token || 'N/A'}
            </div>
            <p><strong>Próximos passos:</strong></p>
            <ol style="text-align: left;">
              <li>Copie o token acima</li>
              <li>Adicione no seu arquivo <code>.env.local</code></li>
              <li>Variável: <code>GOOGLE_ADS_REFRESH_TOKEN</code></li>
              <li>Execute o script de sincronização</li>
            </ol>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Você pode fechar esta janela.
            </p>
          </div>
        </body>
        </html>
      `);

      // Close server after 2 seconds
      setTimeout(() => {
        server.close();
        console.log('✅ Processo concluído. Servidor encerrado.');
        console.log('\n📝 Não esqueça de adicionar o GOOGLE_ADS_REFRESH_TOKEN no .env.local!\n');
        process.exit(0);
      }, 2000);
    }
  } catch (error) {
    console.error('❌ Erro:', error.message);
    res.end('Erro ao processar autorização');
    server.close();
    process.exit(1);
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`🌐 Servidor local iniciado em http://localhost:${PORT}`);
  console.log('🔓 Abrindo navegador para autenticação...\n');

  // Open browser
  setTimeout(() => {
    open(authUrl);
  }, 1000);
});

// Handle errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso`);
    console.error('   Feche outros servidores ou use outra porta\n');
  } else {
    console.error('❌ Erro no servidor:', error.message);
  }
  process.exit(1);
});
