import { Queue } from 'bullmq';
import { redisConfigured, redisOptions, redisClient } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
export const ragQueue = redisConfigured ? new Queue('rag-processing', { connection: redisOptions() }) : null;
ragQueue?.on('error', () => {});
export async function requireRagQueue() {
  if (!ragQueue || !redisConfigured) throw new AppError('Document indexing is unavailable. Configure REDIS_URL and start the RAG worker.', 503);
  try { await redisClient.ping(); } catch { throw new AppError('Document indexing is temporarily unavailable. Redis cannot be reached.', 503); }
  return ragQueue;
}
