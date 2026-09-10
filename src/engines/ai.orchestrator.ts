import { aiClient } from '../config/ai.provider';

export class AIOrchestrator {
  
  /**
   * Routes the prompt to the appropriate AI Provider while injecting Long-Term Memory
   */
  static async routeToEngine(
    engineType: 'TUTOR' | 'QUIZ' | 'CODING' | 'CAREER',
    prompt: string,
    studentMemory: any,
    stream: boolean = false
  ) {
    const memoryContext = this.buildMemoryContext(studentMemory);
    const systemInstruction = `You are the ${engineType} engine. Always personalize your response based on the student's memory profile:\n${memoryContext}`;
    
    if (stream) {
      return aiClient.generateContentStream(prompt, systemInstruction);
    } else {
      return aiClient.generateContent(prompt, systemInstruction);
    }
  }

  /**
   * Generates a stringified context from the student's vector memory.
   */
  private static buildMemoryContext(memory: any): string {
    if (!memory) return 'No prior memory found.';
    
    // In a real implementation, this parses the retrieved ChromaDB vector results
    return `
      Weak Concepts: ${memory.weakSubjects || 'None'}
      Strong Concepts: ${memory.strongSubjects || 'None'}
      Learning Style: ${memory.learningStyle || 'Mixed'}
      Current Level: ${memory.currentLevel || 'Intermediate'}
    `;
  }
}
