import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create a Redis instance with graceful failure handling for serverless environments
export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.warn('[Redis] Max reconnection attempts reached. Running without Redis.');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  }
});

let redisConnected = false;

redisClient.on('error', (err) => {
  if (redisConnected) {
    console.error('[Redis Error]', err.message);
  }
  redisConnected = false;
});

redisClient.on('connect', () => {
  redisConnected = true;
  console.log('[Redis] Connected successfully.');
});

export function isRedisConnected(): boolean {
  return redisConnected;
}
