import { prisma } from '../config/prisma';
import { redisClient } from '../config/redis';

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
      details
    });
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  public recordLatency(ms: number) {
    this.lastLatency = ms;
  }

  public getLogs() {
    return this.logs;
  }

  public async getHealthStats() {
    const gemini = !!process.env.GEMINI_API_KEY;
    const groq = !!process.env.GROQ_API_KEY;
    const openrouter = !!process.env.OPENROUTER_API_KEY;

    let dbConnected = false;
    let documentCount = 0;
    let chunkCount = 0;
    let nodeCount = 0;

    try {
      documentCount = await prisma.document.count();
      chunkCount = await prisma.documentChunk.count();
      
      const docs = await prisma.document.findMany({
        select: { knowledgeGraph: true }
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
      console.error('Database connection failed in diagnostics:', err);
    }

    let redisConnected = false;
    try {
      const ping = await redisClient.ping();
      redisConnected = ping === 'PONG';
    } catch {}

    const providers = { gemini, groq, openrouter };
    const currentProvider = gemini ? 'Google Gemini' : groq ? 'Groq' : openrouter ? 'OpenRouter' : 'None';

    return {
      providers,
      currentProvider,
      database: dbConnected ? 'Connected' : 'Disconnected',
      redis: redisConnected ? 'Connected' : 'Disconnected',
      documentCount,
      chunkCount,
      nodeCount,
      latency: this.lastLatency,
      lastRetrievalLog: this.logs.find(l => l.type === 'retrieval') || null,
      lastIngestionLog: this.logs.find(l => l.type === 'ingestion') || null,
      lastAiRequestLog: this.logs.find(l => l.type === 'ai_request') || null,
    };
  }
}

export const diagnosticsService = new DiagnosticsService();
