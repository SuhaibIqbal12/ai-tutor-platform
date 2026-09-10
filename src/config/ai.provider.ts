import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Provider Interfaces
export interface AIProvider {
  name: string;
  generateContent(prompt: any, systemInstruction?: string, config?: any): Promise<any>;
  generateContentStream(prompt: any, systemInstruction?: string, config?: any): Promise<any>;
  startChat(history: any[], systemInstruction?: string, config?: any): any;
}

// Gemini Implementation
export class GeminiProvider implements AIProvider {
  name = 'gemini';
  private genAI: GoogleGenerativeAI;
  private defaultModel = 'gemini-1.5-flash';

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  private getModel(systemInstruction?: string, config?: any) {
    return this.genAI.getGenerativeModel({
      model: this.defaultModel,
      systemInstruction,
      generationConfig: config,
    });
  }

  async generateContent(prompt: any, systemInstruction?: string, config?: any) {
    return this.getModel(systemInstruction, config).generateContent(prompt);
  }

  async generateContentStream(prompt: any, systemInstruction?: string, config?: any) {
    return this.getModel(systemInstruction, config).generateContentStream(prompt);
  }

  startChat(history: any[] = [], systemInstruction?: string, config?: any) {
    return this.getModel(systemInstruction, config).startChat({ history });
  }
}

// Future implementations: OpenAIProvider, AnthropicProvider, GroqProvider...

import { aiProviderService } from '../services/ai-provider.service';

export class AIOrchestratorClient {
  async generateContent(prompt: any, systemInstruction?: string, config?: any) {
    const model = aiProviderService.getModel({ systemInstruction, generationConfig: config });
    return model.generateContent(prompt);
  }

  async generateContentStream(prompt: any, systemInstruction?: string, config?: any) {
    const model = aiProviderService.getModel({ systemInstruction, generationConfig: config });
    return model.generateContentStream(prompt);
  }

  startChat(history: any[] = [], systemInstruction?: string, config?: any) {
    const model = aiProviderService.getModel({ systemInstruction, generationConfig: config });
    return model.startChat({ history });
  }
}

export const aiClient = new AIOrchestratorClient();
