import { Client, Pool } from 'pg';

/**
 * Database configuration and connection utilities
 */

export function getDatabaseUrl(): string {
  const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

  if (!url) {
    throw new Error('SUPABASE_DATABASE_URL or DATABASE_URL environment variable is required');
  }

  return url;
}

/**
 * Create a new PostgreSQL client (for single queries)
 */
export async function createDatabaseClient(): Promise<Client> {
  const client = new Client({
    connectionString: getDatabaseUrl(),
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
