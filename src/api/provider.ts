import { DeveloperStats } from '../types';

/**
 * Message format for chat interactions
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Stream callback types
 */
export type StreamCallback = (text: string) => void;
export type CompleteCallback = (fullText: string) => void;

/**
 * LLM Provider interface - abstraction for different AI backends
 */
export interface LLMProvider {
  /** Provider display name */
  readonly name: string;

  /** Check if the provider is properly configured */
  isConfigured(): boolean;

  /** List available models from the provider */
  listModels(): Promise<string[]>;

  /**
   * Generate a streaming chat response
   * @param systemPrompt The system prompt to use
   * @param userMessage The user's message
   * @param onStream Callback for each streamed chunk
   * @param onComplete Callback when streaming is complete
   */
  chat(
    systemPrompt: string,
    userMessage: string,
    onStream: StreamCallback,
    onComplete: CompleteCallback
  ): Promise<void>;

  /**
   * Generate a non-streaming response (for whispers)
   * @param systemPrompt The system prompt to use
   * @param userMessage The user's message
   * @returns The complete response or null if no response
   */
  generate(systemPrompt: string, userMessage: string): Promise<string | null>;

  /** Test the connection to the provider */
  testConnection(): Promise<boolean>;

  /** Get developer stats */
  getStats(): DeveloperStats;

  /** Reset session stats */
  resetSessionStats(): void;
}

/**
 * Provider type enum
 */
export type ProviderType = 'claude' | 'ollama';

/**
 * Provider configuration in settings
 */
export interface ProviderConfig {
  type: ProviderType;

  // Claude settings
  claudeApiKey: string;
  claudeModel: string;

  // Ollama settings
  ollamaBaseUrl: string;
  ollamaModel: string;
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  type: 'claude',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-20250514',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: '',
};
