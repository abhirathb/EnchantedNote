import Anthropic from '@anthropic-ai/sdk';
import { ClaudeContext, DeveloperStats, Mood, InteractionStyle } from '../types';
import { getSystemPrompt } from '../moods';
import { getCleanContent } from '../utils/parser';

export type StreamCallback = (text: string) => void;
export type CompleteCallback = (fullText: string) => void;

/**
 * Claude API client for Enchanted Notes
 */
export class ClaudeClient {
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
        dangerouslyAllowBrowser: true
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
        dangerouslyAllowBrowser: true
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

  /**
   * Check if the client is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get the current developer stats
   */
  getStats(): DeveloperStats {
    return { ...this.stats };
  }

  /**
   * Reset session stats
   */
  resetSessionStats(): void {
    this.stats.tokensThisSession = 0;
  }

  /**
   * Build the user message for Claude
   */
  private buildUserMessage(context: ClaudeContext): string {
    const cleanContent = getCleanContent(context.noteContent);

    let message = '';

    // Add linked notes context if available
    if (context.linkedNotes && context.linkedNotes.length > 0) {
      message += '## Linked Notes Context\n\n';
      message += context.linkedNotes.join('\n\n');
      message += '\n\n---\n\n';
    }

    message += '## Current Note\n\n';

    if (context.style === 'muse' && context.cursorPosition !== undefined) {
      // For Muse mode, include content up to cursor
      message += cleanContent.substring(0, context.cursorPosition);
      message += '\n\n[CURSOR POSITION - respond to what comes before this point]';
    } else {
      // For Whisper mode, include full content
      message += cleanContent;
    }

    return message;
  }

  /**
   * Generate a Muse response with streaming
   */
  async generateMuseResponse(
    context: ClaudeContext,
    onStream: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Claude API not configured. Please add your API key in settings.');
    }

    const startTime = Date.now();
    const systemPrompt = getSystemPrompt(context.mood, 'muse');
    const userMessage = this.buildUserMessage(context);

    this.stats.currentContextSize = userMessage.length;

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 300, // Keep responses concise
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
        this.stats.tokensThisSession += finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
        this.stats.tokensToday += finalMessage.usage.input_tokens + finalMessage.usage.output_tokens;
      }

      onComplete(fullText);
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  /**
   * Generate a Whisper response (non-streaming, since whispers are brief)
   */
  async generateWhisperResponse(context: ClaudeContext): Promise<string | null> {
    if (!this.client) {
      throw new Error('Claude API not configured. Please add your API key in settings.');
    }

    const startTime = Date.now();
    const systemPrompt = getSystemPrompt(context.mood, 'whisper');
    const userMessage = this.buildUserMessage(context);

    this.stats.currentContextSize = userMessage.length;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 100, // Whispers should be very brief
        system: systemPrompt + '\n\nIMPORTANT: Only respond if you have something genuinely useful to observe. If not, respond with exactly "NO_WHISPER" and nothing else.',
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
        this.stats.tokensThisSession += response.usage.input_tokens + response.usage.output_tokens;
        this.stats.tokensToday += response.usage.input_tokens + response.usage.output_tokens;
      }

      // Extract text from response
      const textBlock = response.content.find(block => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        return null;
      }

      const text = textBlock.text.trim();

      // Check if Claude decided not to whisper
      if (text === 'NO_WHISPER' || text.includes('NO_WHISPER')) {
        return null;
      }

      return text;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  /**
   * Test the API connection
   */
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
      console.error('API connection test failed:', error);
      return false;
    }
  }
}
