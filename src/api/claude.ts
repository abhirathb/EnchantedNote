import Anthropic from '@anthropic-ai/sdk';
import { DeveloperStats } from '../types';
import { LLMProvider, StreamCallback, CompleteCallback } from './provider';

/**
 * Available Claude models
 */
export const CLAUDE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
];

/**
 * Claude API provider implementation
 */
export class ClaudeProvider implements LLMProvider {
  readonly name = 'Claude';
  private client: Anthropic | null = null;
  private model: string;
  private stats: DeveloperStats = {
    tokensThisSession: 0,
    tokensToday: 0,
    lastResponseTime: 0,
    currentContextSize: 0,
  };

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    this.model = model;
    if (apiKey) {
      this.client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      });
    }
  }

  /**
   * Update the API key
   */
  setApiKey(apiKey: string): void {
    if (apiKey) {
      this.client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true,
      });
    } else {
      this.client = null;
    }
  }

  /**
   * Update the model
   */
  setModel(model: string): void {
    this.model = model;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async listModels(): Promise<string[]> {
    // Claude models are predefined, not fetched from API
    return CLAUDE_MODELS;
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    onStream: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Claude API not configured. Please add your API key in settings.');
    }

    const startTime = Date.now();
    this.stats.currentContextSize = userMessage.length;

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      let fullText = '';

      stream.on('text', (text) => {
        fullText += text;
        onStream(text);
      });

      const finalMessage = await stream.finalMessage();

      // Update stats
      this.stats.lastResponseTime = Date.now() - startTime;
      if (finalMessage.usage) {
        this.stats.tokensThisSession +=
          finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
        this.stats.tokensToday +=
          finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
      }

      onComplete(fullText);
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string | null> {
    if (!this.client) {
      throw new Error('Claude API not configured. Please add your API key in settings.');
    }

    const startTime = Date.now();
    this.stats.currentContextSize = userMessage.length;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 100,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      // Update stats
      this.stats.lastResponseTime = Date.now() - startTime;
      if (response.usage) {
        this.stats.tokensThisSession +=
          response.usage.input_tokens + response.usage.output_tokens;
        this.stats.tokensToday +=
          response.usage.input_tokens + response.usage.output_tokens;
      }

      // Extract text from response
      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return null;
      }

      return textBlock.text.trim();
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
      });
      return true;
    } catch (error) {
      console.error('Claude connection test failed:', error);
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
