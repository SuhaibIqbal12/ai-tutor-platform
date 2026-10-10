// Vercel runs ingestion within the request lifetime; a separate worker is optional.
export function inlineProcessing(): boolean {
  return process.env.RAG_PROCESSING_MODE === 'inline' ||
    (!process.env.RAG_PROCESSING_MODE && process.env.VERCEL === '1');
}
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const INLINE_MAX_CHUNKS = 500;
