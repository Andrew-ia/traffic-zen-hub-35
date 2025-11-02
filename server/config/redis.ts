import Redis from 'ioredis';

/**
 * Redis connection configuration
 * Supports both local Redis and cloud providers (Upstash, Redis Cloud, etc.)
 */

function getRedisConfig() {
  // Check for Redis URL (e.g., from cloud provider)
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  // Check for Upstash Redis
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (token) {
      // Parse URL and add auth
      const urlObj = new URL(url);
      return {
        host: urlObj.hostname,
        port: parseInt(urlObj.port || '6379'),
        password: token,
        tls: urlObj.protocol === 'https:' ? {} : undefined,
      };
    }
  }

  // Default to local Redis
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  };
}

/**
 * Create a new Redis connection
 */
export function createRedisConnection(): Redis {
  const config = getRedisConfig();

  const connection = new Redis(config, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  connection.on('error', (error) => {
    console.error('Redis connection error:', error);
  });

  connection.on('connect', () => {
    console.log('✅ Connected to Redis');
  });

  return connection;
}

/**
 * Connection options for BullMQ
 */
export const bullMQConnection = {
  connection: createRedisConnection(),
};
