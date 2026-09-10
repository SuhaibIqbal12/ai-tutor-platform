import { ChromaClient } from 'chromadb';
import { aiClient } from '../config/ai.provider';
import { prisma } from '../config/prisma';

const chroma = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });

export class MemoryEngine {
  
  /**
   * Initializes the ChromaDB collection for long-term memory
   */
  static async initMemoryStore() {
    try {
      await chroma.getOrCreateCollection({ name: 'student_memory' });
      console.log('[MemoryEngine] Memory store initialized');
    } catch (error) {
      console.error('[MemoryEngine] Error initializing memory store', error);
    }
  }

  /**
   * Processes an interaction (chat, quiz, code review) and extracts long-term memory insights
   */
  static async extractAndStoreInsight(userId: string, source: string, interactionContent: string) {
    try {
      const prompt = `
        Analyze the following student interaction and extract any long-term learning insights.
        Focus on: 
        1. Weak concepts they struggled with.
        2. Strong concepts they mastered.
        3. Preferences (e.g., likes visual explanations, prefers Python).
        
        Return ONLY a JSON array of insights: [{ "category": "WEAK_CONCEPT", "insight": "struggles with dynamic programming" }]
        Interaction: ${interactionContent}
      `;

      const response = await aiClient.generateContent(prompt, 'You are an analytics engine extracting student memory traits.');
      
      let insights: any[] = [];
      try {
        const cleaned = response.response.text().replace(/```json/g, '').replace(/```/g, '');
        insights = JSON.parse(cleaned);
      } catch (e) {
        console.warn('Failed to parse insights JSON', e);
        return;
      }

      for (const item of insights) {
        // 1. Save to relational DB
        const savedMemory = await prisma.longTermMemory.create({
          data: {
            userId,
            category: item.category,
            insight: item.insight,
            source
          }
        });

        // 2. Save to Vector DB for semantic retrieval
        const collection = await chroma.getCollection({ name: 'student_memory' });
        await collection.add({
          ids: [savedMemory.id],
          documents: [item.insight],
          metadatas: [{ userId, category: item.category, source }]
        });
      }

    } catch (error) {
      console.error('[MemoryEngine] Failed to extract insight', error);
    }
  }

  /**
   * Retrieves semantically relevant memory for the current context
   */
  static async getRelevantMemory(userId: string, contextQuery: string): Promise<string[]> {
    try {
      const collection = await chroma.getCollection({ name: 'student_memory' });
      const results = await collection.query({
        queryTexts: [contextQuery],
        nResults: 5,
        where: { userId }
      });
      
      if (results.documents && results.documents.length > 0) {
        return results.documents[0] as string[];
      }
      return [];
    } catch (error) {
      console.error('[MemoryEngine] Failed to retrieve memory', error);
      return [];
    }
  }
}
