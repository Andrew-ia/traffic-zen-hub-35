#!/bin/bash

echo "🔄 Configurando variáveis de ambiente no Vercel..."

# Core Supabase
echo "https://bichvnuepmgvdlrclmxb.supabase.co" | npx vercel env add SUPABASE_URL production --force
echo "https://bichvnuepmgvdlrclmxb.supabase.co" | npx vercel env add VITE_SUPABASE_URL production --force

echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpY2h2bnVlcG1ndmRscmNsbXhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NjkwMjksImV4cCI6MjA3NzU0NTAyOX0.AS3_RVEapk2kCEZ0NlpXMC2Uzebd_sb0EqNeds0Cv44" | npx vercel env add VITE_SUPABASE_ANON_KEY production --force

echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpY2h2bnVlcG1ndmRscmNsbXhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk2OTAyOSwiZXhwIjoyMDc3NTQ1MDI5fQ.eJ1H61FpwZemzmGysagCa1f0d1eF43Grj4nqj-m0QZQ" | npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --force

# Workspace
echo "00000000-0000-0000-0000-000000000010" | npx vercel env add WORKSPACE_ID production --force
echo "00000000-0000-0000-0000-000000000010" | npx vercel env add VITE_WORKSPACE_ID production --force

# Auth
echo "true" | npx vercel env add VITE_DISABLE_AUTH production --force
echo "prod-secret-trafficpro-2025-secure-key-change-me" | npx vercel env add AUTH_SECRET production --force

# Database
echo "postgresql://postgres:PlataformaVermezzo%40@db.bichvnuepmgvdlrclmxb.supabase.co:5432/postgres" | npx vercel env add SUPABASE_DATABASE_URL production --force

echo "✅ Variáveis configuradas com sucesso!"