import { genAI } from '../config/gemini';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { SchemaType } from '@google/generative-ai';
import { OfficeParser } from 'officeparser';
import axios from 'axios';
import { diagnosticsService } from './diagnostics.service';
const pdf = require('pdf-parse');

export class RagService {
  private extractor: any = null;

  /**
   * Generates an embedding vector for a given text chunk using offline Transformers.js (Xenova/all-MiniLM-L6-v2)
   */
  public async getEmbedding(text: string): Promise<number[]> {
    const { pipeline } = require('@xenova/transformers');
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  /**
   * Helper function to split text into overlapping chunks.
   */
  private chunkText(text: string, chunkSize = 250, overlap = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;

    while (i < words.length) {
      const chunkWords = words.slice(i, i + chunkSize);
      chunks.push(chunkWords.join(' '));
      if (i + chunkSize >= words.length) {
        break;
      }
      i += (chunkSize - overlap);
    }

    return chunks.filter(c => c.trim().length > 0);
  }

  /**
   * Uploads and processes a document for RAG.
   */
  public async ingestDocument(userId: string, title: string, content: string): Promise<any> {
    if (!title || !content) {
      throw new AppError('Title and content are required.', 400);
    }

    // 1. Create the Document metadata record
    const document = await prisma.document.create({
      data: {
        title,
        content,
        userId,
      },
    });

    // 2. Slice text into chunks
    const textChunks = this.chunkText(content);

    // 3. Generate embeddings and save chunks
    for (const chunkText of textChunks) {
      const vector = await this.getEmbedding(chunkText);
      await prisma.documentChunk.create({
        data: {
          documentId: document.id,
          content: chunkText,
          embedding: JSON.stringify(vector),
        },
      });
    }

    // 4. Automatically generate Knowledge Graph using Gemini
    try {
      console.log(`[RAG Service] Generating Knowledge Graph for document: ${title}`);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              nodes: {
                type: SchemaType.ARRAY,
                description: 'Key academic topics or concepts present in this text.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    id: { type: SchemaType.STRING, description: 'Lowercase alphanumeric id with no spaces (e.g. regression, neural_networks)' },
                    label: { type: SchemaType.STRING, description: 'Readable title of the topic' },
                    type: { type: SchemaType.STRING, description: 'Either "concept" or "subconcept"' },
                    description: { type: SchemaType.STRING, description: 'Short definition or summary of this concept' }
                  },
                  required: ['id', 'label', 'type', 'description']
                }
              },
              edges: {
                type: SchemaType.ARRAY,
                description: 'List of learning dependencies or relationship arrows between nodes.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    from: { type: SchemaType.STRING, description: 'ID of the prerequisite concept (node)' },
                    to: { type: SchemaType.STRING, description: 'ID of the dependent concept (node)' },
                    relation: { type: SchemaType.STRING, description: 'Prerequisite for, Relates to, Part of' }
                  },
                  required: ['from', 'to', 'relation']
                }
              }
            },
            required: ['nodes', 'edges']
          }
        }
      });

      const prompt = `Extract a hierarchical academic knowledge graph from the following educational materials.
Identify the main concepts, subconcepts, and their direct learning dependencies (what needs to be learned first).
Ensure node IDs are lowercase, simple, and strictly alphanumeric (e.g. "binary_search", "sorting").

=== STUDY MATERIAL ===
${content.substring(0, 15000)}
======================`;

      const result = await model.generateContent(prompt);
      const graphData = result.response.text();
      
      await prisma.document.update({
        where: { id: document.id },
        data: { knowledgeGraph: graphData }
      });
      console.log(`[RAG Service] Successfully generated and stored Knowledge Graph for: ${title}`);
    } catch (graphErr) {
      console.error('[RAG Service Graph Error] Failed to generate knowledge graph:', graphErr);
    }

    return {
      documentId: document.id,
      title: document.title,
      chunksCount: textChunks.length,
    };
  }

  /**
   * Retrieves and merges the knowledge graphs of all documents owned by the user.
   */
  public async getUserKnowledgeGraph(userId: string): Promise<any> {
    const docs = await prisma.document.findMany({
      where: { userId, NOT: { knowledgeGraph: null } },
      select: { id: true, title: true, knowledgeGraph: true }
    });

    const allNodes: any[] = [];
    const allEdges: any[] = [];
    const seenNodes = new Set<string>();

    for (const doc of docs) {
      if (!doc.knowledgeGraph) continue;
      try {
        const graph = JSON.parse(doc.knowledgeGraph);
        if (graph.nodes && Array.isArray(graph.nodes)) {
          for (const n of graph.nodes) {
            if (!seenNodes.has(n.id)) {
              seenNodes.add(n.id);
              allNodes.push({
                ...n,
                documentTitle: doc.title,
                documentId: doc.id
              });
            }
          }
        }
        if (graph.edges && Array.isArray(graph.edges)) {
          for (const e of graph.edges) {
            allEdges.push(e);
          }
        }
      } catch (err) {
        console.error('Failed to parse knowledgeGraph for document', doc.id, err);
      }
    }

    return {
      nodes: allNodes,
      edges: allEdges
    };
  }

  /**
   * Uploads and processes a raw file (PDF, Image, Text, Office files) for RAG.
   */
  public async ingestFile(userId: string, file: Express.Multer.File): Promise<any> {
    if (!file) {
      throw new AppError('File is required.', 400);
    }

    let title = file.originalname;
    let content = '';

    if (file.mimetype === 'application/pdf') {
      try {
        const parsed = await pdf(file.buffer);
        content = parsed.text;
        if (!content || content.trim().length === 0) {
          throw new Error('PDF appears to be empty or scanned image. No text was extracted.');
        }
      } catch (err: any) {
        console.error('PDF Parse Error:', err);
        throw new AppError(`Failed to parse PDF file: ${err.message || err}`, 422);
      }
    } else if (file.mimetype.startsWith('image/')) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent([
          {
            inlineData: {
              data: file.buffer.toString('base64'),
              mimeType: file.mimetype
            }
          },
          'Analyze this educational image in detail. Extract any visible text or equations, explain diagrams/charts, and provide a comprehensive, detailed description of the educational content shown so it can be indexed for retrieval.'
        ]);
        content = result.response.text();
        if (!content || content.trim().length === 0) {
          throw new Error('Gemini was unable to describe the image content.');
        }
        title = `Image: ${file.originalname}`;
      } catch (err: any) {
        console.error('Image Analysis Error:', err);
        throw new AppError(`Failed to analyze image file: ${err.message || err}`, 422);
      }
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // DOCX
      file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || // PPTX
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // XLSX
      file.mimetype === 'application/vnd.oasis.opendocument.text' || // ODT
      file.mimetype === 'application/vnd.oasis.opendocument.presentation' || // ODP
      file.mimetype === 'application/vnd.oasis.opendocument.spreadsheet' // ODS
    ) {
      try {
        const ast = await OfficeParser.parseOffice(file.buffer);
        content = ast.toText();
        if (!content || content.trim().length === 0) {
          throw new Error('No text content could be extracted from this document.');
        }
      } catch (err: any) {
        console.error('Office Parser Error:', err);
        throw new AppError(`Failed to parse office document: ${err.message || err}`, 422);
      }
    } else if (file.mimetype.startsWith('text/') || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      content = file.buffer.toString('utf-8');
    } else {
      throw new AppError(`Unsupported file type: ${file.mimetype}. Please upload a PDF, image (PNG, JPEG, WEBP), Word/Powerpoint document, or plain text file.`, 400);
    }

    return this.ingestDocument(userId, title, content);
  }

  /**
   * Scrapes text from a Web URL and processes it for RAG.
   */
  public async ingestUrl(userId: string, url: string): Promise<any> {
    if (!url) {
      throw new AppError('URL is required.', 400);
    }

    let title = url;
    let content = '';

    // Check if it is a YouTube video URL
    if (url.includes('youtube.com/') || url.includes('youtu.be/')) {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : null;

      if (!videoId) {
        throw new AppError(
          'YouTube channels, playlists, or homepages are not supported. Please upload an individual YouTube video link (e.g., https://www.youtube.com/watch?v=...) to index its transcript.',
          400
        );
      }

      content = await this.getYoutubeTranscript(url);
      title = `YouTube: ${url}`;
    } else {
      content = await this.crawlWebpage(url);
      title = `Webpage: ${url}`;
    }

    return this.ingestDocument(userId, title, content);
  }

  /**
   * Helper to crawl web pages.
   */
  private async crawlWebpage(url: string): Promise<string> {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
      });
      const html = res.data;
      
      // Strip scripts, styles, and html tags
      let text = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
      text = text.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
      text = text.replace(/<[^>]+>/g, ' ');
      text = text.replace(/&nbsp;/g, ' ');
      text = text.replace(/\s+/g, ' ').trim();
      
      if (!text || text.length < 50) {
        throw new Error('Webpage content appears empty or heavily protected.');
      }
      return text;
    } catch (err: any) {
      console.error('Web Scraping Error:', err);
      throw new Error(`Failed to scrape webpage: ${err.message || err}`);
    }
  }

  /**
   * Helper to scrape YouTube transcripts.
   */
  private async getYoutubeTranscript(videoUrl: string): Promise<string> {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = videoUrl.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : null;
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      const { YoutubeTranscript } = require('youtube-transcript');
      const transcriptObj = await YoutubeTranscript.fetchTranscript(videoId);
      
      if (!transcriptObj || transcriptObj.length === 0) {
        throw new Error('No transcript chunks returned.');
      }

      const transcript = transcriptObj.map((t: any) => t.text).join(' ');
      return transcript;
    } catch (err: any) {
      console.error('YouTube Transcript Extraction Error:', err);
      throw new Error(`Failed to extract YouTube transcript: ${err.message || err}`);
    }
  }

  /**
   * Computes cosine similarity between two numeric vectors.
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Performs local cosine similarity RAG search.
   * Returns matching snippets with metadata and confidence indices.
   */
  public async searchSimilarChunks(userId: string, query: string, limit = 3): Promise<string> {
    console.log(`[RAG Retrieval] Performing vector similarity search for query: "${query}"`);
    const startTime = Date.now();
    const queryVector = await this.getEmbedding(query);
    const embeddingTime = Date.now() - startTime;

    const dbChunks = await prisma.documentChunk.findMany({
      where: {
        document: {
          userId,
        },
      },
      include: {
        document: {
          select: { title: true }
        }
      }
    });

    console.log(`[RAG Retrieval] Retrieved ${dbChunks.length} candidate chunks from database.`);

    if (dbChunks.length === 0) {
      diagnosticsService.log('retrieval', `RAG retrieval returned 0 chunks (no indexed documents for user)`, {
        query,
        candidateCount: 0,
        latencyMs: Date.now() - startTime
      });
      return '';
    }

    const scoredChunks = dbChunks.map(chunk => {
      const chunkVector = JSON.parse(chunk.embedding) as number[];
      const similarity = this.cosineSimilarity(queryVector, chunkVector);
      return {
        content: chunk.content,
        title: chunk.document.title,
        similarity,
      };
    });

    const sortedChunks = scoredChunks.sort((a, b) => b.similarity - a.similarity);
    
    // Developer mode debugging print
    console.log('=== RAG RETRIEVAL DEBUGGING ===');
    console.log(`Query: "${query}"`);
    console.log(`Embedding generation time: ${embeddingTime}ms`);
    console.log('Top candidate similarity scores:');
    sortedChunks.slice(0, 5).forEach((c, idx) => {
      console.log(`  [Candidate #${idx + 1}] Similarity: ${c.similarity.toFixed(4)} | Title: "${c.title}" | Snippet: "${c.content.substring(0, 60)}..."`);
    });
    console.log('===============================');

    const topChunks = sortedChunks
      .slice(0, limit)
      .filter(chunk => chunk.similarity > 0.25); // Require at least weak semantic relevance

    const searchLatency = Date.now() - startTime;
    const bestScore = sortedChunks[0]?.similarity ?? 0;
    diagnosticsService.log('retrieval', `RAG retrieval completed. Found ${topChunks.length} relevant chunks (best score: ${bestScore.toFixed(3)}).`, {
      query,
      latencyMs: searchLatency,
      embeddingTimeMs: embeddingTime,
      candidatesEvaluated: dbChunks.length,
      topScores: sortedChunks.slice(0, 3).map(c => ({ title: c.title, score: Math.round(c.similarity * 100) }))
    });

    if (topChunks.length === 0) {
      const bestTitle = sortedChunks[0]?.title || 'unknown';
      const bestScore = sortedChunks[0]?.similarity?.toFixed(3) || '0';
      console.warn(`[RAG] No chunks passed similarity threshold (best score: ${bestScore} from "${bestTitle}"). Documents may need re-indexing.`);
      // Return a clear signal to the LLM so it doesn't silently use general knowledge
      return `[RAG NOTE: The user has ${dbChunks.length} indexed document chunks, but none matched this query with sufficient similarity (best match: ${bestScore}). This likely means the documents need to be re-indexed. Please tell the user: "I couldn't find relevant content in your indexed materials for this question. The documents may need to be re-indexed — please use the Sources page to re-upload or re-index them."]`;
    }

    return topChunks.map((c, idx) => `[Source #${idx + 1}: ${c.title}] (Confidence: ${Math.round(c.similarity * 100)}%)\n"${c.content}"`).join('\n\n');
  }
}
