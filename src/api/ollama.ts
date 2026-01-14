import { requestUrl } from 'obsidian';
import { DeveloperStats } from '../types';
import { LLMProvider, StreamCallback, CompleteCallback } from './provider';

/**
 * Ollama API response types
 */
interface OllamaTagsResponse {
  models: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
  }>;
}

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/**
 * Ollama local LLM provider implementation
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'Ollama';
  private baseUrl: string;
  private model: string;
  private stats: DeveloperStats = {
    tokensThisSession: 0,
    tokensToday: 0,
    lastResponseTime: 0,
    currentContextSize: 0,
  };

  constructor(baseUrl: string = 'http://localhost:11434', model: string = '') {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.model = model;
  }

  /**
   * Update the base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Update the model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.model;
  }

  isConfigured(): boolean {
    return this.baseUrl.length > 0 && this.model.length > 0;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/api/tags`,
        method: 'GET',
      });

      const data = response.json as OllamaTagsResponse;
      return data.models.map((m) => m.name);
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    onStream: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Ollama not configured. Please select a model in settings.');
    }

    const startTime = Date.now();
    this.stats.currentContextSize = userMessage.length;

    const messages: OllamaChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      // Use fetch for streaming (requestUrl doesn't support streaming)
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Ollama returns newline-delimited JSON
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaChatResponse;
            if (data.message?.content) {
              fullText += data.message.content;
              onStream(data.message.content);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }

      // Update stats
      this.stats.lastResponseTime = Date.now() - startTime;
      // Ollama doesn't provide token counts, estimate based on character count
      const estimatedTokens = Math.ceil((userMessage.length + fullText.length) / 4);
      this.stats.tokensThisSession += estimatedTokens;
      this.stats.tokensToday += estimatedTokens;

      onComplete(fullText);
    } catch (error) {
      console.error('Ollama API error:', error);
      throw error;
    }
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string | null> {
    if (!this.isConfigured()) {
      throw new Error('Ollama not configured. Please select a model in settings.');
    }

    const startTime = Date.now();
    this.stats.currentContextSize = userMessage.length;

    const messages: OllamaChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await requestUrl({
        url: `${this.baseUrl}/api/chat`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
        }),
      });

      const data = response.json as OllamaChatResponse;

      // Update stats
      this.stats.lastResponseTime = Date.now() - startTime;
      const content = data.message?.content || '';
      const estimatedTokens = Math.ceil((userMessage.length + content.length) / 4);
      this.stats.tokensThisSession += estimatedTokens;
      this.stats.tokensToday += estimatedTokens;

      return content.trim() || null;
    } catch (error) {
      console.error('Ollama API error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.length > 0;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }

  getStats(): DeveloperStats {
    return { ...this.stats };
  }

  resetSessionStats(): void {
    this.stats.tokensThisSession = 0;
  }
}
