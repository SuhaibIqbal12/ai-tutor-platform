import 'dotenv/config';
import { Worker } from 'bullmq';
import { redisOptions, redisConfigured } from '../config/redis';
import { processDocument } from '../rag/processing';
if (!redisConfigured) throw new Error('RAG worker requires REDIS_URL or REDIS_HOST');
export const ragWorker = new Worker('rag-processing', async job => {
  await processDocument(job.data.documentId, job.data.userId, job.data);
}, { connection: redisOptions(true), concurrency: 1 });
ragWorker.on('error', () => console.error('[RAG] Worker connection failed. Check Redis configuration.'));
ragWorker.on('failed', job => console.error(`[RAG] Processing failed for job ${job?.id}. See the document status.`));
