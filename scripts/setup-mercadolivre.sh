#!/bin/bash

# Script para obter credenciais do Mercado Livre
# Este script guia você no processo de autenticação OAuth2

echo "🛒 Mercado Livre - Obter Credenciais"
echo "===================================="
echo ""

# Configuração
APP_ID=""
CLIENT_SECRET=""
REDIRECT_URI="http://localhost:3001/api/integrations/mercadolivre/callback"
AUTH_BASE_URL="${MERCADO_LIVRE_AUTH_BASE_URL:-https://auth.mercadolibre.com}"

echo "📝 Passo 1: Criar Aplicação"
echo "---------------------------"
echo "1. Acesse: https://developers.mercadolivre.com.br/"
echo "2. Faça login com sua conta do Mercado Livre"
echo "3. Vá em 'Minhas aplicações' > 'Criar nova aplicação'"
echo "4. Preencha os dados da aplicação:"
echo "   - Nome: Traffic Pro - Mercado Livre Integration"
echo "   - Descrição breve: Integração para análise de vendas"
echo "   - Site: http://localhost:8080"
echo "   - Redirect URI: $REDIRECT_URI"
echo "5. Selecione os seguintes scopes:"
echo "   ✓ read - Leitura de dados"
echo "   ✓ offline_access - Acesso offline"
echo "   ✓ write - Escrita de dados (opcional, para responder perguntas)"
echo ""

read -p "Digite o APP_ID da sua aplicação: " APP_ID
read -p "Digite o CLIENT_SECRET: " CLIENT_SECRET

if [ -z "$APP_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "❌ Erro: APP_ID e CLIENT_SECRET são obrigatórios"
    exit 1
fi

echo ""
echo "📝 Passo 2: Autorização"
echo "----------------------"
echo "Abra o seguinte link no navegador:"
echo ""
echo "${AUTH_BASE_URL}/authorization?response_type=code&client_id=$APP_ID&redirect_uri=$REDIRECT_URI"
echo ""
echo "Após autorizar, você será redirecionado para uma URL como:"
echo "http://localhost:3001/api/integrations/mercadolivre/callback?code=TG-..."
echo ""

read -p "Cole o código (TG-...) aqui: " AUTH_CODE

if [ -z "$AUTH_CODE" ]; then
    echo "❌ Erro: Código de autorização é obrigatório"
    exit 1
fi

echo ""
echo "📝 Passo 3: Trocar código por Access Token"
echo "-------------------------------------------"

RESPONSE=$(curl -s -X POST \
  'https://api.mercadolibre.com/oauth/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=authorization_code&client_id=$APP_ID&client_secret=$CLIENT_SECRET&code=$AUTH_CODE&redirect_uri=$REDIRECT_URI")

# Extrair dados da resposta (requer jq)
ACCESS_TOKEN=$(echo $RESPONSE | jq -r '.access_token')
REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.refresh_token')
USER_ID=$(echo $RESPONSE | jq -r '.user_id')
EXPIRES_IN=$(echo $RESPONSE | jq -r '.expires_in')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Erro ao obter token. Resposta da API:"
    echo $RESPONSE
    exit 1
fi

echo ""
echo "✅ Credenciais obtidas com sucesso!"
echo "===================================="
echo ""
echo "Adicione as seguintes variáveis ao seu arquivo .env.local:"
echo ""
echo "# Mercado Livre API Credentials"
echo "MERCADO_LIVRE_APP_ID=$APP_ID"
echo "MERCADO_LIVRE_CLIENT_SECRET=$CLIENT_SECRET"
echo "MERCADO_LIVRE_ACCESS_TOKEN=$ACCESS_TOKEN"
echo "MERCADO_LIVRE_REFRESH_TOKEN=$REFRESH_TOKEN"
echo "MERCADO_LIVRE_USER_ID=$USER_ID"
echo ""
echo "⏰ Nota: O Access Token expira em $EXPIRES_IN segundos (~6 horas)"
echo "💡 Use o Refresh Token para renovar automaticamente"
echo ""

# Opcional: Salvar em arquivo
read -p "Deseja salvar essas credenciais em um arquivo? (s/n): " SAVE_FILE

if [ "$SAVE_FILE" = "s" ] || [ "$SAVE_FILE" = "S" ]; then
    echo "" >> .env.local
    echo "# Mercado Livre API Credentials - Gerado em $(date)" >> .env.local
    echo "MERCADO_LIVRE_APP_ID=$APP_ID" >> .env.local
    echo "MERCADO_LIVRE_CLIENT_SECRET=$CLIENT_SECRET" >> .env.local
    echo "MERCADO_LIVRE_ACCESS_TOKEN=$ACCESS_TOKEN" >> .env.local
    echo "MERCADO_LIVRE_REFRESH_TOKEN=$REFRESH_TOKEN" >> .env.local
    echo "MERCADO_LIVRE_USER_ID=$USER_ID" >> .env.local
    echo ""
    echo "✅ Credenciais salvas em .env.local"
fi

echo ""
echo "🔄 Para renovar o token quando expirar, use:"
echo "curl -X POST 'https://api.mercadolibre.com/oauth/token' \\"
echo "  -H 'Content-Type: application/x-www-form-urlencoded' \\"
echo "  -d 'grant_type=refresh_token&client_id=$APP_ID&client_secret=$CLIENT_SECRET&refresh_token=$REFRESH_TOKEN'"
echo ""
echo "✨ Pronto! Inicie o servidor com: npm run dev"
echo "🌐 Acesse: http://localhost:8080/mercado-livre"
