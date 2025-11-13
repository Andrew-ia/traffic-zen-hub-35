#!/bin/bash

# Script to sync environment variables to Vercel
# Required environment variables for authentication

echo "🔐 Configuring Vercel Environment Variables..."
echo ""

# Auth variables
npx vercel env add AUTH_SECRET production <<< "prod-secret-trafficpro-2025-secure-key-change-me"
npx vercel env add ADMIN_EMAIL production <<< "founder@trafficpro.dev"
npx vercel env add ADMIN_PASSWORD production <<< "admin123"
npx vercel env add ADMIN_NAME production <<< "Founder TrafficPro"
npx vercel env add WORKSPACE_ID production <<< "00000000-0000-0000-0000-000000000010"

# Get other critical env vars from .env.local and add to Vercel
if [ -f .env.local ]; then
  # Database
  SUPABASE_DATABASE_URL=$(grep "^SUPABASE_DATABASE_URL=" .env.local | cut -d '=' -f2-)
  if [ ! -z "$SUPABASE_DATABASE_URL" ]; then
    npx vercel env add SUPABASE_DATABASE_URL production <<< "$SUPABASE_DATABASE_URL"
  fi

  # Supabase
  SUPABASE_URL=$(grep "^SUPABASE_URL=" .env.local | cut -d '=' -f2-)
  if [ ! -z "$SUPABASE_URL" ]; then
    npx vercel env add SUPABASE_URL production <<< "$SUPABASE_URL"
  fi

  SUPABASE_SERVICE_ROLE_KEY=$(grep "^SUPABASE_SERVICE_ROLE_KEY=" .env.local | cut -d '=' -f2-)
  if [ ! -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    npx vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "$SUPABASE_SERVICE_ROLE_KEY"
  fi
fi

echo ""
echo "✅ Environment variables configured!"
echo ""
echo "Next steps:"
echo "1. Run: npx vercel --prod --yes"
echo "2. Verify deployment at your Vercel URL"
