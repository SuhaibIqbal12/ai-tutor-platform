import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import Redis from 'ioredis';

import { prisma } from '../config/prisma';
import { aiProviderService } from '../services/ai-provider.service';
import { SchemaType } from '@google/generative-ai';
import { OfficeParser } from 'officeparser';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const pdf = require('pdf-parse');
const execAsync = promisify(exec);

// Helper to clean VTT subtitles
function cleanVttContent(vtt: string): string {
  let text = vtt.replace(/WEBVTT[\s\S]*?\n\n/, '');
  text = text.replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*?\n/g, '');
  text = text.replace(/<[^>]+>/g, '');
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const uniqueLines: string[] = [];
  for (const line of lines) {
    if (uniqueLines.length === 0 || uniqueLines[uniqueLines.length - 1] !== line) {
      uniqueLines.push(line);
    }
  }
  return uniqueLines.join(' ');
}

// Youtube transcript fallback chain
async function getYoutubeTranscriptFallback(url: string, videoId: string): Promise<string> {
  const scratchDir = path.join(__dirname, '../../scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  // Fallback 1: youtube-transcript
  try {
    console.log(`[RAG Worker] YouTube: Trying youtube-transcript for ${videoId}`);
    const { YoutubeTranscript } = require('youtube-transcript');
    const transcriptObj = await YoutubeTranscript.fetchTranscript(videoId);
    if (transcriptObj && transcriptObj.length > 0) {
      const text = transcriptObj.map((t: any) => t.text).join(' ');
      console.log(`[RAG Worker] YouTube: youtube-transcript succeeded.`);
      return text;
    }
  } catch (err: any) {
    console.warn(`[RAG Worker] youtube-transcript failed: ${err.message || err}`);
  }

  // Fallback 2: yt-dlp subtitles
  const subFilePrefix = path.join(scratchDir, `sub_${videoId}`);
  try {
    console.log(`[RAG Worker] YouTube: Trying yt-dlp subtitles for ${videoId}`);
    const cmd = `python -m yt_dlp --skip-download --write-auto-subs --write-subs --sub-lang en --output "${subFilePrefix}" "${url}"`;
    await execAsync(cmd);
    
    const files = fs.readdirSync(scratchDir);
    const subFile = files.find(f => f.startsWith(`sub_${videoId}.en`));
    
    if (subFile) {
      const filePath = path.join(scratchDir, subFile);
      const content = fs.readFileSync(filePath, 'utf-8');
      fs.unlinkSync(filePath);
      
      const cleaned = cleanVttContent(content);
      if (cleaned && cleaned.trim().length > 0) {
        console.log(`[RAG Worker] YouTube: yt-dlp subtitles succeeded.`);
        return cleaned;
      }
    }
  } catch (err: any) {
    console.warn(`[RAG Worker] yt-dlp subtitles failed: ${err.message || err}`);
  }

  // Fallback 3: Gemini audio buffer transcription
  const audioFilePrefix = path.join(scratchDir, `audio_${videoId}`);
  try {
    console.log(`[RAG Worker] YouTube: Trying yt-dlp audio download + Gemini transcription for ${videoId}`);
    const cmd = `python -m yt_dlp -f "ba" -x --audio-format mp3 -o "${audioFilePrefix}.%(ext)s" "${url}"`;
    await execAsync(cmd);
    
    const audioPath = `${audioFilePrefix}.mp3`;
    if (fs.existsSync(audioPath)) {
      const audioBuffer = fs.readFileSync(audioPath);
      fs.unlinkSync(audioPath);
      
      console.log(`[RAG Worker] YouTube: Transcribing audio track using Gemini...`);
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const tempGenAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = tempGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent([
        {
          inlineData: {
            data: audioBuffer.toString('base64'),
            mimeType: 'audio/mp3'
          }
        },
        'Transcribe the audio from this educational video. Return only the transcription text, with no extra conversational filler or commentary.'
      ]);
      
      const transcription = result.response.text();
      if (transcription && transcription.trim().length > 0) {
        console.log(`[RAG Worker] YouTube: Gemini audio transcription succeeded.`);
        return transcription;
      }
    }
  } catch (err: any) {
    console.error(`[RAG Worker] YouTube Gemini transcription failed: ${err.message || err}`);
  }

  throw new Error(`Failed to extract YouTube video content after trying all fallbacks.`);
}

// Web scraper helper
async function crawlWebpage(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
    });
    let html = res.data;
    if (typeof html !== 'string') {
      html = typeof html === 'object' ? JSON.stringify(html) : String(html);
    }
    
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
    throw new Error(`Failed to scrape webpage: ${err.message || err}`);
  }
}

// Text chunking helper
function chunkText(text: string, chunkSize = 250, overlap = 50): string[] {
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

let extractor: any = null;

// Get embeddings using offline Transformers.js
async function getEmbedding(text: string): Promise<number[]> {
  const { pipeline } = require('@xenova/transformers');
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export const ragWorker = new Worker('rag-processing', async (job: Job) => {
  const { documentId, userId, fileType, url, fileBufferBase64, originalName, title } = job.data;
  console.log(`[RAG Worker] Starting job for document ${documentId} (${fileType})`);

  const progressKey = `doc_progress:${documentId}`;

  const updateProgress = async (data: any) => {
    await redisClient.set(progressKey, JSON.stringify({
      documentId,
      status: 'processing',
      textExtracted: false,
      chunksCount: 0,
      chunksCreated: false,
      embeddingsCount: 0,
      embeddingsGenerated: false,
      graphNodesCount: 0,
      graphGenerated: false,
      flashcardsGenerated: false,
      mindMapGenerated: false,
      tutorReady: false,
      error: null,
      ...data
    }), 'EX', 86400); // 24 hour expiry
  };

  try {
    await updateProgress({ status: 'processing' });

    let content = '';

    // 1. Text Extraction Stage
    if (fileType === 'YOUTUBE') {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : null;
      if (!videoId) {
        throw new Error('Invalid YouTube video ID.');
      }
      content = await getYoutubeTranscriptFallback(url, videoId);
    } else if (fileType === 'WEB') {
      content = await crawlWebpage(url);
    } else if (fileBufferBase64) {
      const buffer = Buffer.from(fileBufferBase64, 'base64');
      if (fileType === 'PDF') {
        const parsed = await pdf(buffer);
        content = parsed.text;
      } else if (['DOCX', 'PPTX', 'XLSX', 'ODT'].includes(fileType)) {
        // officeparser v7: TS says OfficeParserAST but runtime value varies.
        // Use String() for real runtime coercion, not just a TS cast.
        const ftMap: Record<string, string> = { DOCX: 'docx', PPTX: 'pptx', XLSX: 'xlsx', ODT: 'odt' };
        const rawResult = await OfficeParser.parseOffice(buffer, { fileType: ftMap[fileType] as any });
        content = typeof rawResult === 'string' ? rawResult : String(rawResult);
      } else if (fileType === 'IMAGE') {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const tempGenAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = tempGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent([
          {
            inlineData: {
              data: fileBufferBase64,
              mimeType: 'image/jpeg'
            }
          },
          'Extract all readable text and academic info from this image. Explain any diagrams in details.'
        ]);
        content = result.response.text();
      } else {
        // Plain text / Markdown
        content = buffer.toString('utf-8');
      }
    } else {
      content = job.data.content || '';
    }

    if (!content || content.trim().length === 0) {
      throw new Error('No readable text content extracted.');
    }

    // Update document content in DB
    await prisma.document.update({
      where: { id: documentId },
      data: { content }
    });

    await updateProgress({ textExtracted: true });

    // 2. Chunking Stage
    const chunks = chunkText(content);
    await updateProgress({ textExtracted: true, chunksCount: chunks.length, chunksCreated: true });

    // 3. Embeddings Generation Stage
    let embeddingsCount = 0;
    for (const chunkText of chunks) {
      const vector = await getEmbedding(chunkText);
      await prisma.documentChunk.create({
        data: {
          documentId,
          content: chunkText,
          embedding: JSON.stringify(vector)
        }
      });
      embeddingsCount++;
      await updateProgress({
        textExtracted: true,
        chunksCount: chunks.length,
        chunksCreated: true,
        embeddingsCount,
        embeddingsGenerated: embeddingsCount === chunks.length
      });
    }

    // 4. Knowledge Graph & Metadata Stage
    console.log(`[RAG Worker] Generating Knowledge Graph and Metadata...`);
    const model = aiProviderService.getModel({
      systemInstruction: 'You are an expert curriculum design agent.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            difficulty: { type: SchemaType.STRING, description: 'Beginner, Intermediate, or Advanced' },
            estimatedStudyTimeMinutes: { type: SchemaType.INTEGER },
            prerequisites: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            },
            topicHierarchy: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING }
            },
            nodes: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  id: { type: SchemaType.STRING, description: 'lowercase letters and underscores only, no spaces' },
                  label: { type: SchemaType.STRING },
                  type: { type: SchemaType.STRING, description: 'concept or subconcept' },
                  description: { type: SchemaType.STRING }
                },
                required: ['id', 'label', 'type', 'description']
              }
            },
            edges: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  from: { type: SchemaType.STRING },
                  to: { type: SchemaType.STRING },
                  relation: { type: SchemaType.STRING }
                },
                required: ['from', 'to', 'relation']
              }
            }
          },
          required: ['difficulty', 'estimatedStudyTimeMinutes', 'prerequisites', 'topicHierarchy', 'nodes', 'edges']
        }
      }
    });

    const graphPrompt = `Analyze the study material and build a curriculum-aligned academic knowledge graph.
Identify concepts, prerequisites, difficulty, estimated study time, and hierarchy categories.

=== STUDY MATERIAL ===
${content.substring(0, 15000)}
======================`;

    const graphRes = await model.generateContent(graphPrompt);
    const parsedData = JSON.parse(graphRes.response.text());

    const graphNodesCount = parsedData.nodes?.length || 0;

    await updateProgress({
      textExtracted: true,
      chunksCount: chunks.length,
      chunksCreated: true,
      embeddingsCount: chunks.length,
      embeddingsGenerated: true,
      graphNodesCount,
      graphGenerated: true
    });

    // 5. Flashcards Stage
    console.log(`[RAG Worker] Generating Flashcards...`);
    const fcModel = aiProviderService.getModel({
      systemInstruction: 'You are an educational assistant that generates high quality flashcards.',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              front: { type: SchemaType.STRING },
              back: { type: SchemaType.STRING }
            },
            required: ['front', 'back']
          }
        }
      }
    });

    const fcRes = await fcModel.generateContent(`Generate 5 conceptual study flashcards from this text:\n\n${content.substring(0, 8000)}`);
    const flashcardsStr = fcRes.response.text();

    await updateProgress({
      textExtracted: true,
      chunksCount: chunks.length,
      chunksCreated: true,
      embeddingsCount: chunks.length,
      embeddingsGenerated: true,
      graphNodesCount,
      graphGenerated: true,
      flashcardsGenerated: true
    });

    // 6. Mind Map (Mermaid) Stage
    console.log(`[RAG Worker] Generating Mind Map...`);
    const mmModel = aiProviderService.getModel({
      systemInstruction: 'You generate strictly valid mermaid.js mindmaps.'
    });

    const mmRes = await mmModel.generateContent(`Create a Mermaid.js mindmap diagram representing the core concepts of this text. Return ONLY the code inside standard backticks:\n\n${content.substring(0, 6000)}`);
    let mindMap = mmRes.response.text().replace(/```mermaid/g, '').replace(/```/g, '').trim();

    // Update DB with all details
    await prisma.document.update({
      where: { id: documentId },
      data: {
        knowledgeGraph: JSON.stringify({ nodes: parsedData.nodes, edges: parsedData.edges }),
        flashcards: flashcardsStr,
        mindMap,
        prerequisites: JSON.stringify(parsedData.prerequisites),
        relatedTopics: JSON.stringify(parsedData.topicHierarchy),
        estimatedReadingTime: parsedData.estimatedStudyTimeMinutes
      }
    });

    await updateProgress({
      status: 'completed',
      textExtracted: true,
      chunksCount: chunks.length,
      chunksCreated: true,
      embeddingsCount: chunks.length,
      embeddingsGenerated: true,
      graphNodesCount,
      graphGenerated: true,
      flashcardsGenerated: true,
      mindMapGenerated: true,
      tutorReady: true
    });

    console.log(`[RAG Worker] Successfully processed document ${documentId}`);

  } catch (err: any) {
    console.error(`[RAG Worker] Job failed for document ${documentId}:`, err);
    await redisClient.set(progressKey, JSON.stringify({
      documentId,
      status: 'failed',
      error: err.message || err
    }), 'EX', 86400);
    throw err;
  }
}, {
  // Use plain connection options (not a Redis instance) to avoid dual-ioredis version type conflicts
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null as any,
  }
});

ragWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with ${err.message}`);
});
