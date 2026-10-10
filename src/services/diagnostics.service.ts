import { prisma } from '../config/prisma';
import { redisClient, redisConfigured } from '../config/redis';
import { inlineProcessing } from '../config/processing';
import { requestContext } from './request-context';

export interface LogEntry {
  timestamp: string;
  type: 'ingestion' | 'retrieval' | 'ai_request';
  message: string;
  details?: any;
}

class DiagnosticsService {
  private logs: LogEntry[] = [];
  private maxLogs = 50;
  private lastLatency = 0;

  public log(type: 'ingestion' | 'retrieval' | 'ai_request', message: string, details?: any) {
    this.logs.unshift({
      timestamp: new Date().toISOString(),
      type,
      message,
      details: { ...details, userId: details?.userId || requestContext.getStore()?.userId }
    });
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  public recordLatency(ms: number) {
    this.lastLatency = ms;
  }

  public getLogs(userId: string) {
    return this.logs.filter(log => log.details?.userId === userId);
  }

  public async getReadiness() {
    let database = false; let redis = false; let workers = 0;
    try { await prisma.$queryRaw`SELECT 1`; database = true; } catch { /* Connectivity only. */ }
    try { redis = redisConfigured && await redisClient.ping() === 'PONG'; } catch { /* Connectivity only. */ }
    if (redis) {
      try { const { ragQueue } = await import('../queues/rag.queue'); workers = await ragQueue?.getWorkersCount() || 0; } catch { /* Worker unavailable. */ }
    }
    const configuredProviders = ['GEMINI_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY','OPENAI_API_KEY','OLLAMA_BASE_URL']
      .filter(key => process.env[key] && !process.env[key]!.startsWith('your_'));
    const authConfigured = !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 && !process.env.JWT_SECRET.startsWith('your_');
    const inline = inlineProcessing();
    return { ready: database && (inline || (redis && workers > 0)) && authConfigured && configuredProviders.length > 0,
      database: database ? 'Connected' : 'Disconnected', redis: redis ? 'Connected' : 'Disconnected',
      authConfigured, configuredProviders, providerConnectivity: 'Not probed',
      processingMode: inline ? 'inline' : 'queue',
      workers, worker: inline ? 'Not required: bounded processing runs during upload.' : workers > 0 ? 'Connected' : 'Unavailable: run npm run worker on a persistent host.' };
  }

  public async getHealthStats(userId: string) {
    const gemini = !!process.env.GEMINI_API_KEY;
    const xai = !!process.env.XAI_API_KEY;
    const openai = !!process.env.OPENAI_API_KEY;
    const ollama = !!process.env.OLLAMA_BASE_URL;
    const openrouter = !!process.env.OPENROUTER_API_KEY;

    let dbConnected = false;
    let documentCount = 0;
    let chunkCount = 0;
    let nodeCount = 0;

    try {
      documentCount = await prisma.document.count({ where: { userId } });
      chunkCount = await prisma.documentChunk.count({ where: { document: { userId } } });
      
      const docs = await prisma.document.findMany({
        where: { userId }, select: { knowledgeGraph: true }
      });
      for (const doc of docs) {
        if (doc.knowledgeGraph) {
          try {
            const graph = JSON.parse(doc.knowledgeGraph);
            if (graph.nodes) nodeCount += graph.nodes.length;
          } catch {}
        }
      }
      dbConnected = true;
    } catch (err) {
      console.error('Database connection failed in diagnostics:');
    }

    let redisConnected = false;
    try {
      const ping = redisConfigured ? await redisClient.ping() : '';
      redisConnected = ping === 'PONG';
    } catch {}

    const providers = { gemini, xai, openrouter, openai, ollama };
    const currentProvider = gemini ? 'Google Gemini (configured)' : xai ? 'xAI (configured)' : openrouter ? 'OpenRouter (configured)' : openai ? 'OpenAI (configured)' : ollama ? 'Ollama (configured)' : 'None';

    return {
      providers,
      currentProvider,
      database: dbConnected ? 'Connected' : 'Disconnected',
      redis: redisConnected ? 'Connected' : 'Disconnected',
      documentCount,
      chunkCount,
      nodeCount,
      latency: this.lastLatency,
      lastRetrievalLog: this.getLogs(userId).find(l => l.type === 'retrieval') || null,
      lastIngestionLog: this.getLogs(userId).find(l => l.type === 'ingestion') || null,
      lastAiRequestLog: this.getLogs(userId).find(l => l.type === 'ai_request') || null,
    };
  }
}

export const diagnosticsService = new DiagnosticsService();
