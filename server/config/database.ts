import { Client, Pool } from 'pg';
import dotenv from 'dotenv';

// Ensure environment variables are loaded early for modules importing database utilities
try {
  dotenv.config({ path: '.env.local' });
} catch { void 0 }

/**
 * Database configuration and connection utilities
 */

function shouldPreferPooler(): boolean {
  if (process.env.USE_SUPABASE_POOLER === 'true') return true;
  if (process.env.USE_SUPABASE_POOLER === 'false') return false;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  return false;
}

function getHostname(connectionString?: string): string {
  if (!connectionString) return '';
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function shouldAutoPreferSupabasePooler(pooler?: string, direct?: string): boolean {
  if (!pooler || !direct) return false;
  const directHost = getHostname(direct);
  if (!directHost) return false;

  // Supabase direct hosts are frequently blocked or unresolved on local networks.
  return /^db\..+\.supabase\.co$/.test(directHost);
}

export function getDatabaseUrl(): string {
  const pooler = process.env.SUPABASE_POOLER_URL;
  const direct = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
  const preferPooler = shouldPreferPooler() || shouldAutoPreferSupabasePooler(pooler, direct);

  const url = preferPooler
    ? (pooler || direct)
    : (direct || pooler);

  if (!url) {
    throw new Error('SUPABASE_DATABASE_URL or DATABASE_URL environment variable is required');
  }

  return url;
}

/**
 * Create a new PostgreSQL client (for single queries)
 * With SSL configuration for serverless environments
 */
export async function createDatabaseClient(): Promise<Client> {
  const client = new Client({
    connectionString: getDatabaseUrl(),
    ssl: process.env.VERCEL ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();
  return client;
}

/**
 * Create a PostgreSQL connection pool (recommended for servers)
 */
export function createDatabasePool(): Pool {
  return new Pool({
    connectionString: getDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    max: 10, // Maximum number of clients in the pool (reduced)
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // Increased timeout
    allowExitOnIdle: true, // Allow process to exit when no active connections
  });
}

/**
 * Shared database pool instance
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  // If a pool already exists, return it (works for both local and serverless warm starts)
  if (pool) {
    return pool;
  }

  // For serverless environments (like Vercel)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 1, // Limit to 1 connection for serverless
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false }, // Required for Supabase Pooler on Vercel
    });
  } else {
    // For local development or long-running servers
    pool = createDatabasePool();
  }

  // Attach error handler to the pool
  pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
  });

  if (!process.env.VERCEL) {
    pool.on('connect', () => {
      console.log('✅ Connected to PostgreSQL database');
    });
  }

  return pool;
}

/**
 * Close the database pool
 */
export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
