import { AppError } from '../middleware/error.middleware';
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = 384;
let extractorPromise: Promise<any> | undefined;
export function validVector(vector: unknown): vector is number[] {
  return Array.isArray(vector) && vector.length === EMBEDDING_DIMENSIONS && vector.every(x => typeof x === 'number' && Number.isFinite(x)) && vector.some(x => x !== 0);
}
export async function embed(text: string): Promise<number[]> {
  if (!text.trim()) throw new AppError('Cannot embed empty text.', 422);
  if (!extractorPromise) {
    const { pipeline, env } = require('@xenova/transformers');
    env.cacheDir = process.env.EMBEDDING_CACHE_DIR || (process.env.VERCEL === '1' ? '/tmp/tutor-embeddings' : env.cacheDir);
    extractorPromise = pipeline('feature-extraction', EMBEDDING_MODEL).catch(() => {
      extractorPromise = undefined;
      throw new AppError('Embedding model unavailable. Download/cache the MiniLM model on the worker and API host.', 503);
    });
  }
  const extractor = await extractorPromise;
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data) as number[];
  if (!validVector(vector)) throw new AppError('Embedding generation returned an invalid vector.', 502);
  return vector;
}
export function cosine(a: number[], b: number[]): number {
  if (!validVector(a) || !validVector(b)) return 0;
  const dot = a.reduce((sum, x, i) => sum + x * b[i], 0);
  return dot / Math.sqrt(a.reduce((s, x) => s + x*x, 0) * b.reduce((s, x) => s + x*x, 0));
}
