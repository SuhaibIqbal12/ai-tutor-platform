import { AppError } from '../middleware/error.middleware';
import { providerFailure } from '../services/ai-provider.service';
const hosted = process.env.EMBEDDING_PROVIDER === 'gemini' ||
  (!process.env.EMBEDDING_PROVIDER && process.env.VERCEL === '1');
export const EMBEDDING_MODEL = hosted ? 'gemini-embedding-001' : 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIMENSIONS = hosted ? 768 : 384;
let extractorPromise: Promise<any> | undefined;
export function validVector(vector: unknown): vector is number[] {
  return Array.isArray(vector) && vector.length === EMBEDDING_DIMENSIONS && vector.every(x => typeof x === 'number' && Number.isFinite(x)) && vector.some(x => x !== 0);
}
async function remoteEmbeddings(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AppError('Document indexing requires a configured Gemini key on this deployment.', 503);
  let response: globalThis.Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ requests: texts.map(text => ({ model: `models/${EMBEDDING_MODEL}`, content: { parts: [{ text }] }, taskType, outputDimensionality: EMBEDDING_DIMENSIONS })) }),
      signal: AbortSignal.timeout(45000),
    });
  } catch { throw new AppError('The embedding service could not be reached. Please retry shortly.', 503); }
  if (!response.ok) throw providerFailure({ status: response.status });
  const data = await response.json() as { embeddings?: { values?: number[] }[] };
  const vectors = data.embeddings?.map(item => item.values);
  if (!vectors || vectors.length !== texts.length || !vectors.every(validVector)) throw new AppError('The embedding service returned invalid vectors. Please retry.', 502);
  return (vectors as number[][]).map(vector => {
    const norm = Math.sqrt(vector.reduce((sum, x) => sum + x*x, 0));
    return vector.map(x => x / norm);
  });
}
export async function embedBatch(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'): Promise<number[][]> {
  if (!texts.length || texts.some(text => !text.trim())) throw new AppError('Cannot embed empty text.', 422);
  if (texts.length > 32) throw new AppError('Embedding batch is too large.', 422);
  if (hosted) return remoteEmbeddings(texts, taskType);
  const vectors: number[][] = [];
  for (const text of texts) vectors.push(await embed(text, taskType));
  return vectors;
}
export async function embed(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
  if (!text.trim()) throw new AppError('Cannot embed empty text.', 422);
  if (hosted) return (await remoteEmbeddings([text], taskType))[0];
  if (!extractorPromise) {
    try {
      const { pipeline, env } = require('@xenova/transformers');
      if (process.env.EMBEDDING_CACHE_DIR) env.cacheDir = process.env.EMBEDDING_CACHE_DIR;
      extractorPromise = pipeline('feature-extraction', EMBEDDING_MODEL);
    } catch { throw new AppError('The local embedding runtime is unavailable. Use EMBEDDING_PROVIDER=gemini or install the worker embedding runtime.', 503); }
  }
  let extractor: any;
  try { extractor = await extractorPromise; }
  catch { extractorPromise = undefined; throw new AppError('Embedding model unavailable. Download/cache MiniLM or configure Gemini embeddings.', 503); }
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
