#!/bin/bash

# Script para iniciar o fluxo OAuth do Mercado Livre
# Este script abre o navegador na URL de autorização

echo "🚀 Iniciando fluxo OAuth do Mercado Livre..."
echo ""

# Ler credenciais do .env.local
source .env.local 2>/dev/null || true

CLIENT_ID="${MERCADO_LIVRE_CLIENT_ID}"
REDIRECT_URI="${MERCADO_LIVRE_REDIRECT_URI:-http://localhost:8080/integrations/mercadolivre/callback}"
WORKSPACE_ID="${WORKSPACE_ID:-00000000-0000-0000-0000-000000000010}"
AUTH_BASE_URL="${MERCADO_LIVRE_AUTH_BASE_URL:-https://auth.mercadolibre.com}"
SCOPES="${MERCADO_LIVRE_SCOPES:-offline_access read write}"

if [ -z "$CLIENT_ID" ]; then
    echo "❌ MERCADO_LIVRE_CLIENT_ID não encontrado no .env.local"
    exit 1
fi

# Construir URL de autorização
ENCODED_REDIRECT_URI=$(node -p "encodeURIComponent(process.argv[1])" "$REDIRECT_URI")
ENCODED_SCOPES=$(node -p "encodeURIComponent(process.argv[1])" "$SCOPES")
AUTH_URL="${AUTH_BASE_URL}/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${ENCODED_REDIRECT_URI}&state=${WORKSPACE_ID}&scope=${ENCODED_SCOPES}"

echo "📋 Configuração:"
echo "   Client ID: ${CLIENT_ID}"
echo "   Redirect URI: ${REDIRECT_URI}"
echo "   Workspace ID: ${WORKSPACE_ID}"
echo "   Scopes: ${SCOPES}"
echo ""
echo "🔗 URL de autorização:"
echo "   ${AUTH_URL}"
echo ""
echo "📝 Passos:"
echo "   1. Certifique-se de que o servidor está rodando (npm run dev)"
echo "   2. A URL será aberta no seu navegador"
echo "   3. Faça login no Mercado Livre"
echo "   4. Autorize a aplicação"
echo "   5. Você será redirecionado e verá os tokens (incluindo refresh token)"
echo ""
echo "⚠️  IMPORTANTE: Configure a URL de redirecionamento no painel do ML:"
echo "   https://developers.mercadolivre.com.br/apps"
echo "   Adicione: ${REDIRECT_URI}"
echo ""
read -p "Pressione ENTER para abrir o navegador..."

# Abrir URL no navegador padrão
if command -v open &> /dev/null; then
    # macOS
    open "$AUTH_URL"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$AUTH_URL"
elif command -v start &> /dev/null; then
    # Windows
    start "$AUTH_URL"
else
    echo "❌ Não foi possível abrir o navegador automaticamente"
    echo "   Copie e cole esta URL no seu navegador:"
    echo "   ${AUTH_URL}"
fi

echo ""
echo "✅ Aguardando autorização..."
echo "   Após autorizar, você verá os tokens na página de callback"
