#!/usr/bin/env node
/**
 * check-env.mjs
 * Validates local environment credentials and attempts safe fixes.
 *
 * - Ensures critical variables exist for local dev
 * - Warns for optional integrations (Meta, Google Ads, GA4)
 * - Detects obvious formatting issues (e.g., Postgres URL password with @)
 */

import fs from 'fs';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';

const ENV_PATH = path.resolve('.env.local');
dotenv.config({ path: ENV_PATH });

const results = [];
function ok(msg) { results.push({ level: 'ok', msg }); }
function warn(msg) { results.push({ level: 'warn', msg }); }
function error(msg) { results.push({ level: 'error', msg }); }

function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
}

function looksLikeSupabaseUrl(v) {
  return typeof v === 'string' && /https:\/\/.*\.supabase\.co/.test(v);
}

function looksLikeJwt(v) {
  return typeof v === 'string' && v.split('.').length >= 3;
}

function looksLikePublishable(v) {
  return typeof v === 'string' && v.startsWith('sb_publishable_');
}

function looksLikeMetaAccountId(v) {
  return typeof v === 'string' && /^\d{6,}$/.test(v);
}

function safeWriteEnv(updates) {
  try {
    const original = fs.readFileSync(ENV_PATH, 'utf8');
    const lines = original.split(/\r?\n/);
    const map = new Map();
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) map.set(m[1], m[2]);
    }
    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
      if (!map.has(key) && value) {
        lines.push(`${key}=${value}`);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(ENV_PATH, lines.join('\n'));
      ok('Atualizações leves aplicadas ao .env.local');
    }
  } catch (e) {
    warn(`Não foi possível atualizar .env.local automaticamente: ${e.message}`);
  }
}

// Critical for frontend
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const VITE_WORKSPACE_ID = process.env.VITE_WORKSPACE_ID;

if (!VITE_SUPABASE_URL || !looksLikeSupabaseUrl(VITE_SUPABASE_URL)) {
  error('VITE_SUPABASE_URL ausente ou inválida (https://<ref>.supabase.co)');
}
if (!VITE_SUPABASE_ANON_KEY || !(looksLikeJwt(VITE_SUPABASE_ANON_KEY) || looksLikePublishable(VITE_SUPABASE_ANON_KEY))) {
  error('VITE_SUPABASE_ANON_KEY ausente ou inválida (JWT ou sb_publishable_...)');
}
if (!VITE_WORKSPACE_ID || !isUuid(VITE_WORKSPACE_ID)) {
  error('VITE_WORKSPACE_ID ausente ou inválida (UUID)');
}

// Critical for backend/scripts
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL;

// Sync SUPABASE_URL with VITE if missing
if (!SUPABASE_URL && looksLikeSupabaseUrl(VITE_SUPABASE_URL)) {
  safeWriteEnv({ SUPABASE_URL: VITE_SUPABASE_URL });
  process.env.SUPABASE_URL = VITE_SUPABASE_URL; // refletir imediatamente
  ok('SUPABASE_URL definido a partir de VITE_SUPABASE_URL');
}

if (!process.env.SUPABASE_URL) {
  error('SUPABASE_URL ausente (necessário para scripts/admin)');
} else if (!looksLikeSupabaseUrl(process.env.SUPABASE_URL)) {
  error('SUPABASE_URL inválido');
} else {
  ok('SUPABASE_URL OK');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  warn('SUPABASE_SERVICE_ROLE_KEY ausente. Algumas operações admin podem falhar.');
} else if (!looksLikeJwt(SUPABASE_SERVICE_ROLE_KEY)) {
  warn('SUPABASE_SERVICE_ROLE_KEY parece inválido (não é JWT).');
} else {
  ok('SUPABASE_SERVICE_ROLE_KEY OK');
}

if (!SUPABASE_DATABASE_URL) {
  error('SUPABASE_DATABASE_URL ausente (postgresql://user:pass@host:port/db)');
} else {
  try {
    // Basic parse; catches obvious format issues
    new url.URL(SUPABASE_DATABASE_URL.replace(/^postgresql:\/\//, 'http://'));
    ok('SUPABASE_DATABASE_URL format OK');
    // Check if password contains unescaped @ character
    const passwordMatch = SUPABASE_DATABASE_URL.match(/postgresql:\/\/[^:]+:([^@]+)@/);
    if (passwordMatch && passwordMatch[1].includes('@') && !passwordMatch[1].includes('%40')) {
      warn('SUPABASE_DATABASE_URL pode conter @ não escapado na senha. Se a senha tiver @, encode como %40.');
    }
  } catch {
    error('SUPABASE_DATABASE_URL inválido. Verifique usuário/senha/host e encoding.');
  }
}

// Meta Ads
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const META_WORKSPACE_ID = process.env.META_WORKSPACE_ID || VITE_WORKSPACE_ID;

if (!META_WORKSPACE_ID || !isUuid(META_WORKSPACE_ID)) {
  warn('META_WORKSPACE_ID ausente ou inválido (usa VITE_WORKSPACE_ID por padrão).');
}
if (!META_APP_ID || !META_APP_SECRET || !META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
  warn('Credenciais do Meta incompletas. Sincronização de métricas não funcionará até preencher META_*');
} else {
  if (!looksLikeMetaAccountId(META_AD_ACCOUNT_ID)) warn('META_AD_ACCOUNT_ID deve conter apenas dígitos (sem act_)');
  ok('META_* presentes');
}

// Google Ads
const GACID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const GADT = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const GCID = process.env.GOOGLE_CLIENT_ID;
const GSECRET = process.env.GOOGLE_CLIENT_SECRET;
const GREFRESH = process.env.GOOGLE_ADS_REFRESH_TOKEN;
if (GACID && !/^\d{6,}$/.test(GACID)) warn('GOOGLE_ADS_CUSTOMER_ID deve conter apenas dígitos');
if (!GACID || !GADT || !GCID || !GSECRET || !GREFRESH) {
  warn('Credenciais do Google Ads incompletas. Sincronização Google pode falhar.');
} else {
  ok('Google Ads credenciais presentes');
}

// GA4
const GA4_PROP = process.env.GA4_PROPERTY_ID;
const GA4_EMAIL = process.env.GA4_SERVICE_ACCOUNT_EMAIL;
const GA4_KEY = process.env.GA4_SERVICE_ACCOUNT_KEY;
const GCREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (GCREDS_PATH) {
  if (fs.existsSync(GCREDS_PATH)) {
    ok('GOOGLE_APPLICATION_CREDENTIALS OK');
  } else {
    warn(`GOOGLE_APPLICATION_CREDENTIALS aponta para arquivo inexistente: ${GCREDS_PATH}`);
  }
} else if (GA4_EMAIL && GA4_KEY) {
  ok('GA4 service account via env OK');
} else if (GA4_PROP) {
  warn('GA4 configurado parcialmente (property sem credenciais). API de relatórios pode falhar.');
}

// Gemini
if (!process.env.GEMINI_API_KEY) {
  warn('GEMINI_API_KEY ausente. Funcionalidades de geração de criativos podem ficar limitadas.');
}

// Apply minimal safe auto-fixes
safeWriteEnv({ META_WORKSPACE_ID: META_WORKSPACE_ID });

// Output summary
const summary = {
  ok: results.filter(r => r.level === 'ok').map(r => r.msg),
  warnings: results.filter(r => r.level === 'warn').map(r => r.msg),
  errors: results.filter(r => r.level === 'error').map(r => r.msg),
};

const hasErrors = summary.errors.length > 0;
const hasWarnings = summary.warnings.length > 0;

console.log('\n📋 Verificação de Ambiente (.env.local)');
console.log('────────────────────────────────────────');
summary.ok.forEach(m => console.log(`✅ ${m}`));
summary.warnings.forEach(m => console.log(`⚠️  ${m}`));
summary.errors.forEach(m => console.log(`❌ ${m}`));
console.log('────────────────────────────────────────');

if (hasErrors) {
  console.log('❌ Erros críticos encontrados. Ajuste o .env.local conforme mensagens acima.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  Ambiente com avisos. Algumas integrações podem não funcionar.');
  process.exit(0);
} else {
  console.log('✅ Ambiente OK.');
}
