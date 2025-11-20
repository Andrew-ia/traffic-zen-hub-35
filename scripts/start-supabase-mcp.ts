
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

function requireEnv(value: string | undefined, label: string): string {
  if (!value) {
    console.error(`Missing required environment variable: ${label}`);
    process.exit(1);
  }
  return value;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodeCredentials(dbUrl: string): string {
  const schemeEnd = dbUrl.indexOf('://');
  if (schemeEnd === -1) return dbUrl;
  const hostSeparator = dbUrl.lastIndexOf('@');
  if (hostSeparator === -1) return dbUrl;
  const credentials = dbUrl.slice(schemeEnd + 3, hostSeparator);
  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) return dbUrl;
  const usernameRaw = credentials.slice(0, colonIndex);
  const passwordRaw = credentials.slice(colonIndex + 1);
  const rest = dbUrl.slice(hostSeparator + 1);
  const safeUser = encodeURIComponent(safeDecode(usernameRaw));
  const safePass = encodeURIComponent(safeDecode(passwordRaw));
  const prefix = dbUrl.slice(0, schemeEnd + 3);
  return `${prefix}${safeUser}:${safePass}@${rest}`;
}

function addSslParams(dbUrl: string): string {
  try {
    const url = new URL(dbUrl);
    if (!url.searchParams.has('sslmode')) {
      url.searchParams.append('sslmode', 'require');
    }
    if (!url.searchParams.has('ssl')) {
      url.searchParams.append('ssl', 'true');
    }
    return url.toString();
  } catch {
    const separator = dbUrl.includes('?') ? '&' : '?';
    return `${dbUrl}${separator}sslmode=require&ssl=true`;
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseDbUrl = process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_POOLER_URL;

const resolvedUrl = requireEnv(supabaseUrl, 'SUPABASE_URL or VITE_SUPABASE_URL');
const resolvedAnonKey = requireEnv(supabaseAnonKey, 'VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
const resolvedServiceKey = requireEnv(supabaseServiceKey, 'SUPABASE_SERVICE_ROLE_KEY');
const resolvedDbUrl = requireEnv(supabaseDbUrl, 'SUPABASE_DATABASE_URL or SUPABASE_POOLER_URL');

const encodedDbUrl = addSslParams(encodeCredentials(resolvedDbUrl));
const dbUrlObject = new URL(encodedDbUrl);
const decodedPassword = dbUrlObject.password ? safeDecode(dbUrlObject.password) : undefined;

console.error('Starting Supabase MCP server (@aliyun-rds/supabase-mcp-server)');
console.error(`  Project: ${resolvedUrl}`);
console.error(`  Database host: ${dbUrlObject.hostname}:${dbUrlObject.port || '5432'} (SSL enforced)`);

const args = [
  '-y',
  '@aliyun-rds/supabase-mcp-server',
  '--url',
  resolvedUrl,
  '--anon-key',
  resolvedAnonKey,
  '--service-key',
  resolvedServiceKey,
  '--db-url',
  encodedDbUrl,
];

const child = spawn('npx', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    SUPABASE_URL: resolvedUrl,
    SUPABASE_ANON_KEY: resolvedAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: resolvedServiceKey,
    DATABASE_URL: encodedDbUrl,
    PGUSER: process.env.PGUSER || dbUrlObject.username || 'postgres',
    PGSSLMODE: process.env.PGSSLMODE || 'no-verify',
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0',
    ...(decodedPassword ? { PGPASSWORD: decodedPassword } : {}),
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error('Failed to launch Supabase MCP server:', error);
  process.exit(1);
});
