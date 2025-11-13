import { Client, Pool } from 'pg';

/**
 * Database configuration and connection utilities
 */

export function getDatabaseUrl(): string {
  const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

  if (!url) {
    throw new Error('SUPABASE_DATABASE_URL or DATABASE_URL environment variable is required');
  }

  // Add SSL and timeout parameters for Vercel serverless
  if (process.env.VERCEL && !url.includes('sslmode')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sslmode=require&connect_timeout=10`;
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
    ssl: process.env.VERCEL ? { rejectUnauthorized: true } : undefined,
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
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

/**
 * Shared database pool instance
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  // For serverless environments (like Vercel), create a new pool each time
  // to avoid connection issues across function invocations
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const serverlessPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 1, // Limit to 1 connection for serverless
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: true }, // Required for Supabase Pooler on Vercel
    });

    return serverlessPool;
  }

  if (!pool) {
    pool = createDatabasePool();

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });

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
