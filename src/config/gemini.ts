import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

// Check if the API key is configured
if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
  console.warn(
    'WARNING: GEMINI_API_KEY is not set or contains the default placeholder. Please set it in your .env file.'
  );
}

// Actual SDK instance
const rawGenAI = new GoogleGenerativeAI(apiKey || '');

// Fallback chain for text generation models
const FALLBACK_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-3.5-flash'
];

/**
 * Robust wrapper around the Google Generative AI model that transparently catches 503
 * errors and falls back to alternate flash models to guarantee high availability.
 */
class RobustGenerativeModel {
  private modelName: string;
  private systemInstruction?: string;
  private generationConfig?: any;

  constructor(modelName: string, systemInstruction?: string, generationConfig?: any) {
    this.modelName = modelName;
    this.systemInstruction = systemInstruction;
    this.generationConfig = generationConfig;
  }

  private getModelInstance(modelName: string) {
    return rawGenAI.getGenerativeModel({
      model: modelName,
      systemInstruction: this.systemInstruction,
      generationConfig: this.generationConfig,
    });
  }

  public async generateContent(prompt: any): Promise<any> {
    let lastError: any;
    const modelsToTry = [this.modelName, ...FALLBACK_MODELS.filter(m => m !== this.modelName)];

    for (const model of modelsToTry) {
      try {
        console.log(`[RobustModel] Attempting generateContent with model: ${model}`);
        const inst = this.getModelInstance(model);
        return await inst.generateContent(prompt);
      } catch (err: any) {
        lastError = err;
        console.warn(`[RobustModel] generateContent failed for ${model}: ${err.message || err}. Trying fallback...`);
        // If it is a bad request (like schema parsing structure issues), do not retry fallback models
        if (err.status === 400 || err.message?.includes('400')) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  public async generateContentStream(prompt: any): Promise<any> {
    let lastError: any;
    const modelsToTry = [this.modelName, ...FALLBACK_MODELS.filter(m => m !== this.modelName)];

    for (const model of modelsToTry) {
      try {
        console.log(`[RobustModel] Attempting generateContentStream with model: ${model}`);
        const inst = this.getModelInstance(model);
        return await inst.generateContentStream(prompt);
      } catch (err: any) {
        lastError = err;
        console.warn(`[RobustModel] generateContentStream failed for ${model}: ${err.message || err}. Trying fallback...`);
        if (err.status === 400 || err.message?.includes('400')) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  public startChat(chatOptions?: any): any {
    const self = this;
    const history = chatOptions?.history || [];

    return {
      sendMessage: async (message: any) => {
        let lastError: any;
        const modelsToTry = [self.modelName, ...FALLBACK_MODELS.filter(m => m !== self.modelName)];

        for (const model of modelsToTry) {
          try {
            console.log(`[RobustModel] Chat: Attempting sendMessage with model: ${model}`);
            const inst = self.getModelInstance(model);
            const chat = inst.startChat({ history });
            return await chat.sendMessage(message);
          } catch (err: any) {
            lastError = err;
            console.warn(`[RobustModel] Chat sendMessage failed for ${model}: ${err.message || err}. Trying fallback...`);
            if (err.status === 400 || err.message?.includes('400')) {
              throw err;
            }
          }
        }
        throw lastError;
      },
      sendMessageStream: async (message: any) => {
        let lastError: any;
        const modelsToTry = [self.modelName, ...FALLBACK_MODELS.filter(m => m !== self.modelName)];

        for (const model of modelsToTry) {
          try {
            console.log(`[RobustModel] Chat: Attempting sendMessageStream with model: ${model}`);
            const inst = self.getModelInstance(model);
            const chat = inst.startChat({ history });
            return await chat.sendMessageStream(message);
          } catch (err: any) {
            lastError = err;
            console.warn(`[RobustModel] Chat sendMessageStream failed for ${model}: ${err.message || err}. Trying fallback...`);
            if (err.status === 400 || err.message?.includes('400')) {
              throw err;
            }
          }
        }
        throw lastError;
      }
    };
  }
}

import { aiProviderService } from '../services/ai-provider.service';

// Export a wrapped genAI proxy to maintain existing imports
export const genAI = {
  getGenerativeModel(options: { model: string; systemInstruction?: string; generationConfig?: any }): any {
    if (options.model.includes('embedding')) {
      return rawGenAI.getGenerativeModel(options);
    }
    return aiProviderService.getModel({
      systemInstruction: options.systemInstruction,
      generationConfig: options.generationConfig
    });
  }
};

export const GEMINI_MODEL = 'gemini-2.5-flash'; // Default model
