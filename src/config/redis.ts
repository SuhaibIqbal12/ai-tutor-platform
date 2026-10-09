import 'dotenv/config';
import Redis, { RedisOptions } from 'ioredis';
export const redisConfigured = !!(process.env.REDIS_URL || process.env.REDIS_HOST);
export function redisOptions(worker = false): RedisOptions {
  const url = new URL(process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
  return {
    host: url.hostname, port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: Number(url.pathname.slice(1) || 0), tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: worker ? null : 1,
    connectTimeout: 5000, enableOfflineQueue: worker, lazyConnect: !redisConfigured,
    retryStrategy: times => worker ? Math.min(times * 200, 2000) : (times <= 3 ? times * 200 : null),
  };
}
export const redisClient = new Redis(redisOptions());
redisClient.on('error', () => { /* Readiness reports connectivity; never log credential-bearing URLs. */ });
export function isRedisConnected(): boolean { return redisClient.status === 'ready'; }
