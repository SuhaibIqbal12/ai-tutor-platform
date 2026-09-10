import Redis from 'ioredis';

// Create a Redis instance.
// By default, it will connect to localhost:6379.
// In a Docker environment, it will connect to the docker-compose redis service if configured via ENV.
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisClient.on('error', (err) => {
  console.error('[Redis Error]', err);
});

redisClient.on('connect', () => {
  console.log('[Redis] Connected successfully.');
});
