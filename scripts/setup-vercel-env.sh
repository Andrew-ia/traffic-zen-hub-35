#!/bin/bash

echo "🔧 Configurando variáveis de ambiente no Vercel..."
echo ""

# Load .env.local
if [ ! -f .env.local ]; then
  echo "❌ Arquivo .env.local não encontrado!"
  exit 1
fi

# Export all variables from .env.local
set -a
source .env.local
set +a

echo "📝 Adicionando variáveis de ambiente..."

# Function to add env var to Vercel
add_env() {
  local key=$1
  local value=$2

  if [ -z "$value" ]; then
    echo "⚠️  Pulando $key (valor vazio)"
    return
  fi

  echo "✅ Adicionando $key"
  npx vercel env add "$key" production <<EOF
$value
EOF
}

# Add all essential variables
add_env "SUPABASE_URL" "$SUPABASE_URL"
add_env "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"
add_env "SUPABASE_DATABASE_URL" "$SUPABASE_DATABASE_URL"
add_env "WORKSPACE_ID" "$WORKSPACE_ID"
add_env "VITE_WORKSPACE_ID" "$VITE_WORKSPACE_ID"
add_env "META_WORKSPACE_ID" "$META_WORKSPACE_ID"
add_env "IG_WORKSPACE_ID" "$IG_WORKSPACE_ID"

# Google Ads
add_env "GOOGLE_ADS_CUSTOMER_ID" "$GOOGLE_ADS_CUSTOMER_ID"
add_env "VITE_AW_CONVERSION_ID" "$VITE_AW_CONVERSION_ID"
add_env "VITE_AW_LABEL_PURCHASE" "$VITE_AW_LABEL_PURCHASE"
add_env "GOOGLE_ADS_DEVELOPER_TOKEN" "$GOOGLE_ADS_DEVELOPER_TOKEN"
add_env "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
add_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
add_env "GOOGLE_ADS_REFRESH_TOKEN" "$GOOGLE_ADS_REFRESH_TOKEN"

# AI Keys
add_env "GEMINI_API_KEY" "$GEMINI_API_KEY"
add_env "OPENAI_API_KEY" "$OPENAI_API_KEY"

# ClickUp
add_env "CLICKUP_TOKEN" "$CLICKUP_TOKEN"

# GA4
add_env "GA4_PROPERTY_ID" "$GA4_PROPERTY_ID"
add_env "GA4_SERVICE_ACCOUNT_EMAIL" "$GA4_SERVICE_ACCOUNT_EMAIL"

# Meta Ads
add_env "META_APP_ID" "$META_APP_ID"
add_env "META_APP_SECRET" "$META_APP_SECRET"
add_env "META_ACCESS_TOKEN" "$META_ACCESS_TOKEN"
add_env "META_AD_ACCOUNT_ID" "$META_AD_ACCOUNT_ID"
add_env "META_SYSTEM_USER_TOKEN" "$META_SYSTEM_USER_TOKEN"
add_env "META_BUSINESS_ID" "$META_BUSINESS_ID"
add_env "META_SYSTEM_USER_ID" "$META_SYSTEM_USER_ID"

# Instagram
add_env "IG_USER_ID" "$IG_USER_ID"
add_env "IG_ACCESS_TOKEN" "$IG_ACCESS_TOKEN"
add_env "VITE_IG_USER_ID" "$VITE_IG_USER_ID"

# Encryption removed - no longer needed

# Auth Secret (generate if not exists)
if [ -z "$AUTH_SECRET" ]; then
  AUTH_SECRET=$(openssl rand -hex 32)
  echo "🔐 Gerando AUTH_SECRET..."
fi
add_env "AUTH_SECRET" "$AUTH_SECRET"

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. Nota: GOOGLE_APPLICATION_CREDENTIALS não pode ser adicionado automaticamente"
echo "   Você precisa fazer upload do arquivo ga4-service-account.json manualmente no Vercel"
echo "2. Execute: npx vercel --prod"
echo "3. Teste o app na URL de produção"
