import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis';

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Standard rate limiter for API endpoints (e.g., 100 requests per 15 minutes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: ((...args: string[]) => redisClient.call(args[0], ...args.slice(1))) as any,
    prefix: 'rl:api:',
  }),
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Stricter rate limiter for AI generation endpoints (e.g., 20 requests per 15 minutes)
export const aiGenerationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: ((...args: string[]) => redisClient.call(args[0], ...args.slice(1))) as any,
    prefix: 'rl:ai:',
  }),
  message: {
    success: false,
    error: 'AI generation quota exceeded, please try again later.'
  }
});

// Strict rate limiter for auth/login endpoint (max 10 requests per minute)
export const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: ((...args: string[]) => redisClient.call(args[0], ...args.slice(1))) as any,
    prefix: 'rl:login:',
  }),
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after a minute.'
  }
});
