import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import dotenv from 'dotenv';
import { AppError } from '../middleware/error.middleware';
import { diagnosticsService } from './diagnostics.service';

dotenv.config();

export interface AIProviderOptions {
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
}

// ==========================================
// PROVIDER DETECTION HELPERS
// ==========================================

function isQuotaError(err: any): boolean {
  const status = err.status || err.response?.status;
  const errMsg = (err.message || '').toLowerCase();
  const errDetails = err.response?.data ? JSON.stringify(err.response.data).toLowerCase() : '';
  return (
    status === 429 ||
    errMsg.includes('429') ||
    errMsg.includes('quota') ||
    errMsg.includes('rate limit') ||
    errMsg.includes('limit exceeded') ||
    errDetails.includes('429') ||
    errDetails.includes('quota')
  );
}

function isInvalidKeyError(err: any): boolean {
  const status = err.status || err.response?.status;
  const errMsg = (err.message || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    errMsg.includes('invalid api key') ||
    errMsg.includes('unauthorized') ||
    errMsg.includes('authentication')
  );
}

function isRetryable(err: any): boolean {
  // Quota/rate-limit errors are NOT retryable — daily limits won't recover in seconds.
  // Only transient server errors and network timeouts deserve a retry.
  if (isQuotaError(err)) return false;
  const status = err.status || err.response?.status;
  const errMsg = (err.message || '').toLowerCase();
  return (
    (status !== undefined && status >= 500) ||
    errMsg.includes('timeout') ||
    errMsg.includes('econnreset') ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ETIMEDOUT'
  );
}

function logFallback(fromProvider: string, reason: string, err: any) {
  const shortMsg = err?.message?.substring(0, 150) || String(err).substring(0, 150);
  console.warn(`\n🔀 [AI FALLBACK] ${fromProvider} failed → switching to next provider`);
  console.warn(`   Reason: ${reason}`);
  console.warn(`   Error : ${shortMsg}\n`);
}

export class AIProviderService {
  private genAI: GoogleGenerativeAI;
  private defaultModel = 'gemini-2.5-flash';

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  /**
   * Startup environment check. Outputs a visual checklist on boot.
   */
  public validateKeys(): { [key: string]: boolean } {
    const gemini = !!process.env.GEMINI_API_KEY;
    const xai = !!process.env.XAI_API_KEY;
    const openrouter = !!process.env.OPENROUTER_API_KEY;
    const openai = !!process.env.OPENAI_API_KEY;
    const ollama = !!process.env.OLLAMA_BASE_URL;

    console.log('\n=== AI PROVIDER STARTUP REPORT ===');
    console.log(`Google Gemini (Primary):    ${gemini ? '✓ Connected' : '✗ MISSING'}`);
    console.log(`Grok / xAI (Fallback 1):   ${xai ? '✓ Connected' : '✗ MISSING'}`);
    console.log(`OpenRouter (Fallback 2):    ${openrouter ? '✓ Connected' : '✗ MISSING'}`);
    console.log(`OpenAI (Fallback 3):        ${openai ? '✓ Connected' : '✗ MISSING'}`);
    console.log(`Ollama (Local Fallback):    ${ollama ? '✓ Configured' : '✗ MISSING'}`);
    console.log('===================================\n');

    return { gemini, xai, openrouter, openai, ollama };
  }

  /**
   * Main entry point: returns a Gemini-SDK-compatible model interface backed by the fallback chain.
   */
  public getModel(options: {
    systemInstruction?: string;
    generationConfig?: {
      responseMimeType?: string;
      responseSchema?: any;
      temperature?: number;
    };
  }) {
    const self = this;
    const providerOptions: AIProviderOptions = {
      systemInstruction: options.systemInstruction,
      responseMimeType: options.generationConfig?.responseMimeType,
      responseSchema: options.generationConfig?.responseSchema,
      temperature: options.generationConfig?.temperature,
    };

    return {
      generateContent: async (prompt: string | any[]) => {
        const text = await self.generateContentWithFallback(prompt, providerOptions);
        return { response: { text: () => text } };
      },

      generateContentStream: async (prompt: string | any[]) => {
        const generator = await self.generateStreamWithFallback(prompt, providerOptions);
        return {
          stream: {
            async *[Symbol.asyncIterator]() {
              for await (const chunk of generator) {
                yield { text: () => chunk };
              }
            }
          }
        };
      },

      startChat: (chatOptions?: { history?: any[] }) => {
        const history = chatOptions?.history || [];
        const messages = history.map(h => ({
          role: h.role === 'model' ? 'assistant' : 'user',
          content: h.parts?.map((p: any) => p.text).join('\n') || h.content || ''
        }));

        return {
          sendMessage: async (message: string) => {
            const chatMessages = [...messages, { role: 'user', content: message }];
            const text = await self.generateChatCompletionWithFallback(chatMessages, providerOptions);
            messages.push({ role: 'user', content: message });
            messages.push({ role: 'assistant', content: text });
            return { response: { text: () => text } };
          },

          sendMessageStream: async (message: string) => {
            const chatMessages = [...messages, { role: 'user', content: message }];
            const generator = await self.generateChatStreamWithFallback(chatMessages, providerOptions);
            messages.push({ role: 'user', content: message });
            return {
              stream: {
                async *[Symbol.asyncIterator]() {
                  let accumulated = '';
                  for await (const chunk of generator) {
                    accumulated += chunk;
                    yield { text: () => chunk };
                  }
                  messages.push({ role: 'assistant', content: accumulated });
                }
              }
            };
          }
        };
      }
    };
  }

  // ==========================================
  // RETRY HELPER
  // ==========================================

  private async retryOperation<T>(operation: () => Promise<T>, providerName: string, retries = 2, delayMs = 1500): Promise<T> {
    let currentDelay = delayMs;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        const retryable = isRetryable(err);

        if (retryable && attempt < retries) {
          console.warn(`[${providerName}] Attempt ${attempt}/${retries} failed (transient): ${err.message?.substring(0, 100)}. Retrying in ${currentDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay = Math.min(currentDelay * 2, 10000);
        } else {
          // Non-retryable (quota, invalid key, 400) or exhausted — throw immediately to trigger fallback
          throw err;
        }
      }
    }
    throw new Error(`[${providerName}] Failed after ${retries} attempts`);
  }

  // ==========================================
  // FALLBACK CHAIN BUILDERS
  // ==========================================

  private buildProviders(isMultimodal: boolean, isStream: boolean, prompt: any, options: AIProviderOptions) {
    const providers: Array<{ name: string; execute: () => Promise<any> }> = [];

    if (process.env.GEMINI_API_KEY) {
      if (isStream) {
        providers.push({ name: 'GEMINI', execute: () => this.retryOperation(() => this.generateStreamWithGemini(prompt, options), 'GEMINI') });
      } else {
        providers.push({ name: 'GEMINI', execute: () => this.retryOperation(() => this.generateWithGemini(prompt, options), 'GEMINI') });
      }
    }

    if (!isMultimodal) {
      if (process.env.XAI_API_KEY) {
        if (isStream) {
          providers.push({ name: 'XAI (Grok)', execute: () => this.retryOperation(() => this.generateStreamWithXAI(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'XAI') });
        } else {
          providers.push({ name: 'XAI (Grok)', execute: () => this.retryOperation(() => this.generateWithXAI(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'XAI') });
        }
      }

      if (process.env.OPENROUTER_API_KEY) {
        if (isStream) {
          providers.push({ name: 'OPENROUTER', execute: () => this.retryOperation(() => this.generateStreamWithOpenRouter(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'OPENROUTER') });
        } else {
          providers.push({ name: 'OPENROUTER', execute: () => this.retryOperation(() => this.generateWithOpenRouter(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'OPENROUTER') });
        }
      }

      if (process.env.OPENAI_API_KEY) {
        if (isStream) {
          providers.push({ name: 'OPENAI', execute: () => this.retryOperation(() => this.generateStreamWithOpenAI(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'OPENAI') });
        } else {
          providers.push({ name: 'OPENAI', execute: () => this.retryOperation(() => this.generateWithOpenAI(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'OPENAI') });
        }
      }

      // Ollama: always attempt, but catch connection errors gracefully
      if (isStream) {
        providers.push({ name: 'OLLAMA', execute: () => this.retryOperation(() => this.generateStreamWithOllama(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'OLLAMA', 1) });
      } else {
        providers.push({ name: 'OLLAMA', execute: () => this.retryOperation(() => this.generateWithOllama(typeof prompt === 'string' ? prompt : JSON.stringify(prompt), options), 'OLLAMA', 1) });
      }
    }

    return providers;
  }

  private buildChatProviders(isStream: boolean, messages: any[], options: AIProviderOptions) {
    const providers: Array<{ name: string; execute: () => Promise<any> }> = [];

    if (process.env.GEMINI_API_KEY) {
      if (isStream) {
        providers.push({ name: 'GEMINI', execute: () => this.retryOperation(() => this.generateChatStreamWithGemini(messages, options), 'GEMINI') });
      } else {
        providers.push({ name: 'GEMINI', execute: () => this.retryOperation(() => this.generateChatWithGemini(messages, options), 'GEMINI') });
      }
    }

    if (process.env.XAI_API_KEY) {
      if (isStream) {
        providers.push({ name: 'XAI (Grok)', execute: () => this.retryOperation(() => this.generateChatStreamWithXAI(messages, options), 'XAI') });
      } else {
        providers.push({ name: 'XAI (Grok)', execute: () => this.retryOperation(() => this.generateChatWithXAI(messages, options), 'XAI') });
      }
    }

    if (process.env.OPENROUTER_API_KEY) {
      if (isStream) {
        providers.push({ name: 'OPENROUTER', execute: () => this.retryOperation(() => this.generateChatStreamWithOpenRouter(messages, options), 'OPENROUTER') });
      } else {
        providers.push({ name: 'OPENROUTER', execute: () => this.retryOperation(() => this.generateChatWithOpenRouter(messages, options), 'OPENROUTER') });
      }
    }

    if (process.env.OPENAI_API_KEY) {
      if (isStream) {
        providers.push({ name: 'OPENAI', execute: () => this.retryOperation(() => this.generateChatStreamWithOpenAI(messages, options), 'OPENAI') });
      } else {
        providers.push({ name: 'OPENAI', execute: () => this.retryOperation(() => this.generateChatWithOpenAI(messages, options), 'OPENAI') });
      }
    }

    // Ollama: always attempt, single try
    if (isStream) {
      providers.push({ name: 'OLLAMA', execute: () => this.retryOperation(() => this.generateChatStreamWithOllama(messages, options), 'OLLAMA', 1) });
    } else {
      providers.push({ name: 'OLLAMA', execute: () => this.retryOperation(() => this.generateChatWithOllama(messages, options), 'OLLAMA', 1) });
    }

    return providers;
  }

  // ==========================================
  // CONTENT GENERATION FALLBACK ENTRYPOINTS
  // ==========================================

  private async generateContentWithFallback(prompt: string | any[], options: AIProviderOptions): Promise<string> {
    const isMultimodal = Array.isArray(prompt) && prompt.some((p: any) => typeof p === 'object' && p.inlineData);
    const providers = this.buildProviders(isMultimodal, false, prompt, options);

    if (providers.length === 0) {
      return 'AI Tutor configuration error: No AI providers configured. Please set at least GEMINI_API_KEY in your .env file.';
    }

    let lastError: any;
    for (const provider of providers) {
      try {
        console.log(`\n📤 [AI Provider] Attempting generateContent using: ${provider.name}`);
        const startTime = Date.now();
        const result = await provider.execute();
        const latency = Date.now() - startTime;
        console.log(`✅ [AI Provider] Content generated by ${provider.name} in ${latency}ms`);
        diagnosticsService.recordLatency(latency);
        diagnosticsService.log('ai_request', `Content generation succeeded using ${provider.name}`, { latencyMs: latency });
        return result;
      } catch (err: any) {
        lastError = err;
        const reason = isQuotaError(err) ? 'Quota/rate limit exceeded' : isInvalidKeyError(err) ? 'Invalid API key' : err.message?.substring(0, 100) || 'Unknown error';
        logFallback(provider.name, reason, err);
      }
    }

    throw new AppError(`All AI providers failed. Last error: ${lastError?.message || lastError}`, 502);
  }

  private async generateStreamWithFallback(prompt: string | any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const isMultimodal = Array.isArray(prompt) && prompt.some((p: any) => typeof p === 'object' && p.inlineData);
    const providers = this.buildProviders(isMultimodal, true, prompt, options);

    if (providers.length === 0) {
      async function* noProviders() {
        yield 'AI Tutor error: No AI providers are configured. Please set GEMINI_API_KEY or another provider key in your .env file.';
      }
      return noProviders();
    }

    let lastError: any;
    for (const provider of providers) {
      try {
        console.log(`\n📡 [AI Provider] Attempting generateStream using: ${provider.name}`);
        const startTime = Date.now();
        const result = await provider.execute();
        const latency = Date.now() - startTime;
        console.log(`✅ [AI Provider] Stream started by ${provider.name} in ${latency}ms`);
        diagnosticsService.recordLatency(latency);
        diagnosticsService.log('ai_request', `Stream started using ${provider.name}`, { latencyMs: latency });
        return result;
      } catch (err: any) {
        lastError = err;
        const reason = isQuotaError(err) ? 'Quota/rate limit exceeded' : isInvalidKeyError(err) ? 'Invalid API key' : err.message?.substring(0, 100) || 'Unknown error';
        logFallback(provider.name, reason, err);
      }
    }

    // Return an error stream instead of throwing — prevents UI from hanging forever
    const errMsg = lastError?.message || String(lastError);
    async function* errorStream() {
      yield `⚠️ All AI providers failed. Please check your API keys and quota limits.\n\nLast error: ${errMsg.substring(0, 300)}`;
    }
    return errorStream();
  }

  private async generateChatCompletionWithFallback(messages: any[], options: AIProviderOptions): Promise<string> {
    const providers = this.buildChatProviders(false, messages, options);

    if (providers.length === 0) {
      return 'AI Tutor configuration error: No AI providers configured.';
    }

    let lastError: any;
    for (const provider of providers) {
      try {
        console.log(`\n💬 [AI Provider] Attempting chat completion using: ${provider.name}`);
        const startTime = Date.now();
        const result = await provider.execute();
        const latency = Date.now() - startTime;
        console.log(`✅ [AI Provider] Chat completion by ${provider.name} in ${latency}ms`);
        diagnosticsService.recordLatency(latency);
        diagnosticsService.log('ai_request', `Chat completion by ${provider.name}`, { latencyMs: latency });
        return result;
      } catch (err: any) {
        lastError = err;
        const reason = isQuotaError(err) ? 'Quota/rate limit exceeded' : isInvalidKeyError(err) ? 'Invalid API key' : err.message?.substring(0, 100) || 'Unknown error';
        logFallback(provider.name, reason, err);
      }
    }

    throw new AppError(`All AI chat providers failed. Last error: ${lastError?.message || lastError}`, 502);
  }

  private async generateChatStreamWithFallback(messages: any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const providers = this.buildChatProviders(true, messages, options);

    if (providers.length === 0) {
      async function* noProviders() {
        yield 'AI Tutor error: No AI providers are configured.';
      }
      return noProviders();
    }

    let lastError: any;
    for (const provider of providers) {
      try {
        console.log(`\n🌊 [AI Provider] Attempting chat stream using: ${provider.name}`);
        const startTime = Date.now();
        const result = await provider.execute();
        const latency = Date.now() - startTime;
        console.log(`✅ [AI Provider] Chat stream started by ${provider.name} in ${latency}ms`);
        diagnosticsService.recordLatency(latency);
        diagnosticsService.log('ai_request', `Chat stream by ${provider.name}`, { latencyMs: latency });
        return result;
      } catch (err: any) {
        lastError = err;
        const reason = isQuotaError(err) ? 'Quota/rate limit exceeded' : isInvalidKeyError(err) ? 'Invalid API key' : err.message?.substring(0, 100) || 'Unknown error';
        logFallback(provider.name, reason, err);
      }
    }

    // Return an error stream — prevents UI from hanging forever
    const errMsg = lastError?.message || String(lastError);
    async function* errorStream() {
      yield `⚠️ All AI providers failed. Please check your API keys.\n\nLast error: ${errMsg.substring(0, 300)}`;
    }
    return errorStream();
  }

  // ==========================================
  // GEMINI SDK METHODS
  // ==========================================

  private async generateWithGemini(prompt: string | any[], options: AIProviderOptions): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.defaultModel,
      systemInstruction: options.systemInstruction,
      generationConfig: {
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        temperature: options.temperature
      }
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private async generateStreamWithGemini(prompt: string | any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const model = this.genAI.getGenerativeModel({
      model: this.defaultModel,
      systemInstruction: options.systemInstruction,
      generationConfig: {
        responseMimeType: options.responseMimeType,
        responseSchema: options.responseSchema,
        temperature: options.temperature
      }
    });
    const result = await model.generateContentStream(prompt);
    async function* geminiChunks() {
      for await (const chunk of result.stream) {
        yield chunk.text();
      }
    }
    return geminiChunks();
  }

  private async generateChatWithGemini(messages: any[], options: AIProviderOptions): Promise<string> {
    const userMessage = messages[messages.length - 1]?.content || '';
    const geminiHistory = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }]
    }));
    const model = this.genAI.getGenerativeModel({
      model: this.defaultModel,
      systemInstruction: options.systemInstruction,
      generationConfig: { temperature: options.temperature }
    });
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  }

  private async generateChatStreamWithGemini(messages: any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const userMessage = messages[messages.length - 1]?.content || '';
    const geminiHistory = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }]
    }));
    const model = this.genAI.getGenerativeModel({
      model: this.defaultModel,
      systemInstruction: options.systemInstruction,
      generationConfig: { temperature: options.temperature }
    });
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(userMessage);
    async function* geminiChatChunks() {
      for await (const chunk of result.stream) {
        yield chunk.text();
      }
    }
    return geminiChatChunks();
  }

  // ==========================================
  // OPENAI-COMPATIBLE PAYLOAD BUILDER (shared by xAI, OpenRouter, OpenAI, Ollama)
  // ==========================================

  private buildOpenAIMessages(promptOrMessages: string | any[], options: AIProviderOptions, modelHint?: string): any[] {
    let messagesList: any[] = [];
    if (typeof promptOrMessages === 'string') {
      if (options.systemInstruction) {
        messagesList.push({ role: 'system', content: options.systemInstruction });
      }
      let userPrompt = promptOrMessages;
      if (options.responseMimeType === 'application/json' && options.responseSchema) {
        userPrompt += `\n\nIMPORTANT: Respond ONLY with valid JSON conforming to this schema:\n${JSON.stringify(options.responseSchema, null, 2)}`;
      }
      messagesList.push({ role: 'user', content: userPrompt });
    } else {
      messagesList = promptOrMessages.map(m => ({ role: m.role, content: m.content }));
      if (options.systemInstruction) {
        messagesList.unshift({ role: 'system', content: options.systemInstruction });
      }
      if (options.responseMimeType === 'application/json' && options.responseSchema) {
        const last = messagesList[messagesList.length - 1];
        if (last) last.content += `\n\nIMPORTANT: Respond ONLY with valid JSON conforming to this schema:\n${JSON.stringify(options.responseSchema, null, 2)}`;
      }
    }
    return messagesList;
  }

  // ==========================================
  // xAI / GROK METHODS
  // ==========================================

  private async generateWithXAI(prompt: string, options: AIProviderOptions): Promise<string> {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new Error('XAI_API_KEY is not defined.');
    const messages = this.buildOpenAIMessages(prompt, options);
    const body: any = {
      model: 'grok-3-mini-fast',
      messages,
      temperature: options.temperature ?? 0.7,
    };
    if (options.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
    const response = await axios.post('https://api.x.ai/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    return response.data?.choices?.[0]?.message?.content || '';
  }

  private async generateStreamWithXAI(prompt: string, options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new Error('XAI_API_KEY is not defined.');
    const messages = this.buildOpenAIMessages(prompt, options);
    const body: any = { model: 'grok-3-mini-fast', messages, temperature: options.temperature ?? 0.7, stream: true };
    const response = await axios.post('https://api.x.ai/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 30000
    });
    return this.parseSseStream(response.data);
  }

  private async generateChatWithXAI(messages: any[], options: AIProviderOptions): Promise<string> {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new Error('XAI_API_KEY is not defined.');
    const msgList = this.buildOpenAIMessages(messages, options);
    const body: any = { model: 'grok-3-mini-fast', messages: msgList, temperature: options.temperature ?? 0.7 };
    if (options.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
    const response = await axios.post('https://api.x.ai/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    return response.data?.choices?.[0]?.message?.content || '';
  }

  private async generateChatStreamWithXAI(messages: any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new Error('XAI_API_KEY is not defined.');
    const msgList = this.buildOpenAIMessages(messages, options);
    const body: any = { model: 'grok-3-mini-fast', messages: msgList, temperature: options.temperature ?? 0.7, stream: true };
    const response = await axios.post('https://api.x.ai/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 30000
    });
    return this.parseSseStream(response.data);
  }

  // ==========================================
  // OPENROUTER METHODS
  // ==========================================

  private async generateWithOpenRouter(prompt: string, options: AIProviderOptions): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not defined.');
    const messages = this.buildOpenAIMessages(prompt, options);
    const body: any = {
      model: 'google/gemma-2-9b-it:free',
      messages,
      temperature: options.temperature ?? 0.7,
    };
    if (options.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Tutor'
      },
      timeout: 60000
    });
    return response.data?.choices?.[0]?.message?.content || '';
  }

  private async generateStreamWithOpenRouter(prompt: string, options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not defined.');
    const messages = this.buildOpenAIMessages(prompt, options);
    const body: any = { model: 'google/gemma-2-9b-it:free', messages, temperature: options.temperature ?? 0.7, stream: true };
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Tutor'
      },
      responseType: 'stream',
      timeout: 60000
    });
    return this.parseSseStream(response.data);
  }

  private async generateChatWithOpenRouter(messages: any[], options: AIProviderOptions): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not defined.');
    const msgList = this.buildOpenAIMessages(messages, options);
    const body: any = { model: 'google/gemma-2-9b-it:free', messages: msgList, temperature: options.temperature ?? 0.7 };
    if (options.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Tutor'
      },
      timeout: 60000
    });
    return response.data?.choices?.[0]?.message?.content || '';
  }

  private async generateChatStreamWithOpenRouter(messages: any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not defined.');
    const msgList = this.buildOpenAIMessages(messages, options);
    const body: any = { model: 'google/gemma-2-9b-it:free', messages: msgList, temperature: options.temperature ?? 0.7, stream: true };
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', body, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Tutor'
      },
      responseType: 'stream',
      timeout: 60000
    });
    return this.parseSseStream(response.data);
  }

  // ==========================================
  // OPENAI METHODS
  // ==========================================

  private async generateWithOpenAI(prompt: string, options: AIProviderOptions): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not defined.');
    const messages = this.buildOpenAIMessages(prompt, options);
    const body: any = { model: 'gpt-4o-mini', messages, temperature: options.temperature ?? 0.7 };
    if (options.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
    const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 60000
    });
    return response.data?.choices?.[0]?.message?.content || '';
  }

  private async generateStreamWithOpenAI(prompt: string, options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not defined.');
    const messages = this.buildOpenAIMessages(prompt, options);
    const body: any = { model: 'gpt-4o-mini', messages, temperature: options.temperature ?? 0.7, stream: true };
    const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 60000
    });
    return this.parseSseStream(response.data);
  }

  private async generateChatWithOpenAI(messages: any[], options: AIProviderOptions): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not defined.');
    const msgList = this.buildOpenAIMessages(messages, options);
    const body: any = { model: 'gpt-4o-mini', messages: msgList, temperature: options.temperature ?? 0.7 };
    if (options.responseMimeType === 'application/json') body.response_format = { type: 'json_object' };
    const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      timeout: 60000
    });
    return response.data?.choices?.[0]?.message?.content || '';
  }

  private async generateChatStreamWithOpenAI(messages: any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not defined.');
    const msgList = this.buildOpenAIMessages(messages, options);
    const body: any = { model: 'gpt-4o-mini', messages: msgList, temperature: options.temperature ?? 0.7, stream: true };
    const response = await axios.post('https://api.openai.com/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 60000
    });
    return this.parseSseStream(response.data);
  }

  // ==========================================
  // OLLAMA LOCAL METHODS (graceful if not running)
  // ==========================================

  private getOllamaBaseUrl(): string {
    return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  private async generateWithOllama(prompt: string, options: AIProviderOptions): Promise<string> {
    const baseUrl = this.getOllamaBaseUrl();
    let fullPrompt = prompt;
    if (options.systemInstruction) fullPrompt = `System: ${options.systemInstruction}\n\nUser: ${prompt}`;
    if (options.responseMimeType === 'application/json' && options.responseSchema) {
      fullPrompt += `\n\nIMPORTANT: Respond ONLY with valid JSON conforming to this schema:\n${JSON.stringify(options.responseSchema, null, 2)}`;
    }
    try {
      const response = await axios.post(`${baseUrl}/api/generate`, {
        model: 'qwen3',
        prompt: fullPrompt,
        stream: false,
        format: options.responseMimeType === 'application/json' ? 'json' : undefined
      }, { timeout: 90000 });
      return response.data?.response || '';
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        throw new Error('Ollama is not running. Start it with: ollama serve');
      }
      throw err;
    }
  }

  private async generateStreamWithOllama(prompt: string, options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const baseUrl = this.getOllamaBaseUrl();
    let fullPrompt = prompt;
    if (options.systemInstruction) fullPrompt = `System: ${options.systemInstruction}\n\nUser: ${prompt}`;
    try {
      const response = await axios.post(`${baseUrl}/api/generate`, {
        model: 'qwen3',
        prompt: fullPrompt,
        stream: true
      }, { responseType: 'stream', timeout: 90000 });

      return this.parseOllamaStream(response.data);
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        throw new Error('Ollama is not running. Start it with: ollama serve');
      }
      throw err;
    }
  }

  private async generateChatWithOllama(messages: any[], options: AIProviderOptions): Promise<string> {
    const baseUrl = this.getOllamaBaseUrl();
    const ollamaMessages = messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    if (options.systemInstruction) {
      ollamaMessages.unshift({ role: 'system', content: options.systemInstruction });
    }
    try {
      const response = await axios.post(`${baseUrl}/api/chat`, {
        model: 'qwen3',
        messages: ollamaMessages,
        stream: false,
        format: options.responseMimeType === 'application/json' ? 'json' : undefined
      }, { timeout: 90000 });
      return response.data?.message?.content || '';
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        throw new Error('Ollama is not running. Start it with: ollama serve');
      }
      throw err;
    }
  }

  private async generateChatStreamWithOllama(messages: any[], options: AIProviderOptions): Promise<AsyncGenerator<string, void, unknown>> {
    const baseUrl = this.getOllamaBaseUrl();
    const ollamaMessages = messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    if (options.systemInstruction) {
      ollamaMessages.unshift({ role: 'system', content: options.systemInstruction });
    }
    try {
      const response = await axios.post(`${baseUrl}/api/chat`, {
        model: 'qwen3',
        messages: ollamaMessages,
        stream: true
      }, { responseType: 'stream', timeout: 90000 });
      return this.parseOllamaChatStream(response.data);
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        throw new Error('Ollama is not running. Start it with: ollama serve');
      }
      throw err;
    }
  }

  // ==========================================
  // STREAM PARSING HELPERS
  // ==========================================

  private async *parseSseStream(stream: any): AsyncGenerator<string, void, unknown> {
    let buffer = '';
    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine.startsWith('data: ')) continue;
        const dataStr = cleanLine.slice(6);
        if (dataStr === '[DONE]') continue;
        try {
          const data = JSON.parse(dataStr);
          const text = data.choices?.[0]?.delta?.content || '';
          if (text) yield text;
        } catch {
          // ignore partial chunks
        }
      }
    }
  }

  private async *parseOllamaStream(stream: any): AsyncGenerator<string, void, unknown> {
    for await (const chunk of stream) {
      const lines = chunk.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) yield data.response;
        } catch {
          // ignore
        }
      }
    }
  }

  private async *parseOllamaChatStream(stream: any): AsyncGenerator<string, void, unknown> {
    for await (const chunk of stream) {
      const lines = chunk.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) yield data.message.content;
        } catch {
          // ignore
        }
      }
    }
  }
}

export const aiProviderService = new AIProviderService();
