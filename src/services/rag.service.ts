import { prisma } from '../config/prisma';
import { embed, cosine, validVector, EMBEDDING_MODEL } from '../rag/embedding';
import { processDocument } from '../rag/processing';
import { AppError } from '../middleware/error.middleware';
import { diagnosticsService } from './diagnostics.service';
export interface RetrievedSource {
  id: number; chunkId: string; documentId: string; title: string; content: string;
  pageNumber: number | null; timestamp: number | null; sourceUrl: string | null;
  similarity: number; lexicalScore: number;
}
export interface Retrieval { sources: RetrievedSource[]; context: string; reason?: string }
export const NO_EVIDENCE = "I couldn't find evidence for that question in your ready, indexed materials. Try a more specific question or upload the relevant material. I won't fill in document facts from general knowledge.";
const terms = (text: string) => [...new Set((text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []).filter(x => x.length > 2 && !['the','and','what','how','does','this','that','with','from','for','are','explain','about','was','which'].includes(x)))];
export function rankEvidence(query: string, vector: number[], candidates: Array<any>, limit = 5): RetrievedSource[] {
  const queryTerms = terms(query);
  const scored = candidates.flatMap(c => {
    let parsed: unknown;
    try { parsed = JSON.parse(c.embedding); } catch { return []; }
    if (c.model !== EMBEDDING_MODEL || c.dimensions !== 384 || !validVector(parsed)) return [];
    const similarity = cosine(vector, parsed);
    const words = new Set(terms(c.content));
    const lexicalScore = queryTerms.length ? queryTerms.filter(x => words.has(x)).length / queryTerms.length : 0;
    // Conservative semantic gate; lexical overlap helps ranking, not admitting unrelated chunks.
    const exactMatches = queryTerms.filter(x => words.has(x)).length;
    const semanticHit = similarity >= 0.35 && (similarity >= 0.5 || lexicalScore >= 0.2);
    const exactTermHit = similarity >= 0.25 && exactMatches >= 2 && lexicalScore >= 0.4;
    if (!semanticHit && !exactTermHit) return [];
    return [{ id: 0, chunkId: c.id, documentId: c.documentId, title: c.document.title,
      content: c.content, pageNumber: c.pageNumber, timestamp: c.timestamp, sourceUrl: c.document.sourceUrl,
      similarity, lexicalScore, rank: similarity * 0.8 + lexicalScore * 0.2 }];
  }).sort((a,b) => b.rank - a.rank);
  const seen = new Set<string>();
  return scored.filter(c => { const key = `${c.documentId}:${c.content}`; if (seen.has(key)) return false; seen.add(key); return true; })
    .slice(0, limit).map((c,i) => ({ ...c, id: i+1 }));
}
export function formatEvidence(sources: RetrievedSource[]): string {
  return sources.map(s => JSON.stringify({ source: s.id, documentId: s.documentId, chunkId: s.chunkId, title: s.title, page: s.pageNumber, timestampSeconds: s.timestamp, text: s.content })).join('\n');
}
export class RagService {
  public getEmbedding(text: string) { return embed(text); }
  public async retrieve(userId: string, query: string, documentId?: string): Promise<Retrieval> {
    const start = Date.now();
    if (documentId && !(await prisma.document.findFirst({ where: { id: documentId, userId, status: 'READY' }, select: { id: true } }))) {
      throw new AppError('The selected document is unavailable or not ready.', 404);
    }
    const candidates = await prisma.documentChunk.findMany({ where: {
      document: { userId, status: 'READY', ...(documentId ? { id: documentId } : {}) },
    }, include: { document: { select: { title: true, sourceUrl: true } } } });
    if (!candidates.length) return { sources: [], context: '', reason: 'No ready documents' };
    const vector = await embed(query);
    const sources = rankEvidence(query, vector, candidates);
    diagnosticsService.log('retrieval', 'Evidence retrieval completed', { userId, candidates: candidates.length,
      latencyMs: Date.now()-start, sourceIds: sources.map(s => s.chunkId), scores: sources.map(s => s.similarity) });
    return { sources, context: formatEvidence(sources), reason: sources.length ? undefined : 'No sufficiently relevant evidence' };
  }
  public async searchSimilarChunks(userId: string, query: string, limit = 5): Promise<string> {
    const result = await this.retrieve(userId, query);
    return result.sources.length ? formatEvidence(result.sources.slice(0,limit)) : `[NO DOCUMENT EVIDENCE: ${NO_EVIDENCE}]`;
  }
  // Retain service entry points; all ingestion now uses the shared processing implementation.
  public async ingestDocument(userId: string, title: string, content: string) {
    if (!title?.trim() || !content?.trim()) throw new AppError('Title and text are required.', 400);
    const doc = await prisma.document.create({ data: { userId, title, fileType: 'TXT' } });
    await processDocument(doc.id, userId, { fileType: 'TXT', content });
    return { documentId: doc.id, title, chunksCount: await prisma.documentChunk.count({ where: { documentId: doc.id } }) };
  }
  public async ingestFile(userId: string, file: Express.Multer.File) {
    const ext = file.originalname.split('.').pop()?.toUpperCase() || '';
    const fileType = file.mimetype.startsWith('image/') ? 'IMAGE' : ext === 'MD' ? 'TXT' : ext;
    const doc = await prisma.document.create({ data: { userId, title: file.originalname, fileType } });
    await processDocument(doc.id, userId, { fileType, fileBufferBase64: file.buffer.toString('base64'), mimeType: file.mimetype });
    return { documentId: doc.id, title: doc.title };
  }
  public async ingestUrl(userId: string, url: string) {
    const { validatePublicUrl, youtubeId } = await import('../rag/url');
    const parsed = await validatePublicUrl(url);
    const fileType = youtubeId(parsed) ? 'YOUTUBE' : 'WEB';
    const doc = await prisma.document.create({ data: { userId, title: url.slice(0,200), fileType, sourceUrl: url } });
    await processDocument(doc.id, userId, { fileType, url });
    return { documentId: doc.id, title: doc.title };
  }
  public async getUserKnowledgeGraph(userId: string) {
    const docs = await prisma.document.findMany({ where: { userId, status: 'READY', NOT: { knowledgeGraph: null } }, select: { id: true, title: true, knowledgeGraph: true } });
    const nodes: any[] = []; const edges: any[] = [];
    for (const doc of docs) {
      try {
        const graph = JSON.parse(doc.knowledgeGraph!);
        const prefix = (id: string) => `${doc.id}_${id}`;
        const ids = new Set<string>();
        for (const n of graph.nodes || []) {
          if (typeof n.id !== 'string' || ids.has(n.id)) continue;
          ids.add(n.id); nodes.push({ ...n, id: prefix(n.id), documentTitle: doc.title, documentId: doc.id });
        }
        for (const e of graph.edges || []) if (ids.has(e.from) && ids.has(e.to)) edges.push({ ...e, from: prefix(e.from), to: prefix(e.to) });
      } catch { /* Invalid optional enrichment must not break the whole Sources page. */ }
    }
    return { nodes, edges };
  }
}
