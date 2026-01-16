import { App, MarkdownView, Notice, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { LLMProvider } from '../api/provider';
import { WhisperTriggerManager } from '../detection/triggers';
import { detectContext, getLinkedNotesContent } from '../detection/context';
import { getCleanContent } from '../utils/parser';
import { getSystemPrompt } from '../moods';
import { addWhisper, clearAllWhispers } from '../rendering/whisper-widget';
import { EnchantedNotesSettings, Mood, LLMContext } from '../types';
import {
  getEnchantmentFrontmatter,
  setEnchantmentFrontmatter,
  isEnchantEnabled
} from '../utils/frontmatter';

/**
 * Manages Whisper mode - hover/tap annotations that appear as icons
 */
export class WhisperMode {
  private app: App;
  private provider: LLMProvider;
  private settings: EnchantedNotesSettings;
  private triggerManager: WhisperTriggerManager;
  private isAnalyzing: boolean = false;
  private currentMood: Mood | 'auto' = 'auto';
  private lastParagraphAnalyzed: number = -1;

  constructor(app: App, provider: LLMProvider, settings: EnchantedNotesSettings) {
    this.app = app;
    this.provider = provider;
    this.settings = settings;
    this.triggerManager = new WhisperTriggerManager();

    this.setupTriggers();
  }

  /**
   * Set the LLM provider
   */
  setProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  /**
   * Set up trigger callbacks
   */
  private setupTriggers(): void {
    this.triggerManager.onAnalyze(() => this.handleAnalyze());
  }

  /**
   * Enable Whisper mode
   */
  enable(): void {
    this.triggerManager.enable();
    new Notice('Whisper mode enabled');
  }

  /**
   * Disable Whisper mode
   */
  disable(): void {
    this.triggerManager.disable();
    new Notice('Whisper mode disabled');
  }

  /**
   * Toggle Whisper mode
   */
  toggle(): void {
    if (this.triggerManager.isEnabled()) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Check if Whisper mode is enabled
   */
  isEnabled(): boolean {
    return this.triggerManager.isEnabled();
  }

  /**
   * Set the current mood override
   */
  setMood(mood: Mood | 'auto'): void {
    this.currentMood = mood;
  }

  /**
   * Update settings
   */
  updateSettings(settings: EnchantedNotesSettings): void {
    this.settings = settings;
  }

  /**
   * Build the user message for the LLM
   */
  private buildUserMessage(context: LLMContext): string {
    const cleanContent = getCleanContent(context.noteContent);

    let message = '';

    // Add linked notes context if available
    if (context.linkedNotes && context.linkedNotes.length > 0) {
      message += '## Linked Notes Context\n\n';
      message += context.linkedNotes.join('\n\n');
      message += '\n\n---\n\n';
    }

    message += '## Current Note\n\n';
    message += cleanContent;

    return message;
  }

  /**
   * Handle analysis trigger
   */
  private async handleAnalyze(): Promise<void> {
    if (this.isAnalyzing) {
      return;
    }

    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      return;
    }

    const file = view.file;
    if (!file) {
      return;
    }

    // Check if enchant mode is enabled for this note
    if (!isEnchantEnabled(this.app, file)) {
      return;
    }

    const editor = view.editor;
    const content = editor.getValue();

    // Check if content has changed significantly
    if (!this.triggerManager.hasSignificantChange(content)) {
      return;
    }

    // Check if provider is configured
    if (!this.provider.isConfigured()) {
      return; // Silently fail for whispers
    }

    // Find a paragraph to analyze (different from last one)
    const paragraphToAnalyze = this.findParagraphToAnalyze(content);
    if (paragraphToAnalyze === null) {
      return;
    }

    this.isAnalyzing = true;

    try {
      // Get frontmatter configuration
      const frontmatter = getEnchantmentFrontmatter(this.app, file);

      // Use frontmatter mood/style, with fallback to defaults
      const mood = frontmatter.mood || 'reflect';
      const style = frontmatter.style || 'whisper';

      // Note: Keep the detectContext code path for potential future use
      // const detectedContext = detectContext(this.app, file, content, this.settings);

      // Use mood override if set via command
      const finalMood = this.currentMood !== 'auto' ? this.currentMood : mood;

      // Build context
      const context: LLMContext = {
        noteContent: content,
        mood: finalMood,
        style: style as 'muse' | 'whisper',
        notePath: file.path,
      };

      // Get linked notes if enabled
      if (this.settings.enableLinkedNoteContext) {
        context.linkedNotes = await getLinkedNotesContent(
          this.app,
          file,
          this.settings.linkedNoteDepth
        );
      }

      // Get system prompt and user message
      const systemPrompt =
        getSystemPrompt(finalMood, style as 'muse' | 'whisper') +
        '\n\nIMPORTANT: Only respond if you have something genuinely useful to observe. If not, respond with exactly "NO_WHISPER" and nothing else.';
      const userMessage = this.buildUserMessage(context);

      // Generate whisper response
      const whisper = await this.provider.generate(systemPrompt, userMessage);

      if (whisper && whisper !== 'NO_WHISPER' && !whisper.includes('NO_WHISPER')) {
        // Get the EditorView for widget manipulation
        // @ts-ignore - accessing internal API
        const cmEditor = view.editor.cm as EditorView;

        if (cmEditor) {
          // Add whisper icon at the paragraph
          const line = this.getLineForParagraph(content, paragraphToAnalyze);
          addWhisper(cmEditor, line, whisper);
        }

        this.lastParagraphAnalyzed = paragraphToAnalyze;

        // Mark that this note has received its first response
        if (!frontmatter.hasFirstResponse) {
          await setEnchantmentFrontmatter(this.app, file, {
            hasFirstResponse: true,
          });
        }
      }

      // Mark content as analyzed
      this.triggerManager.markAnalyzed(content);
    } catch (error) {
      console.error('Whisper analysis error:', error);
      // Silently fail for whispers - don't interrupt the user
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Find a paragraph to analyze - always picks the last valid paragraph (most recent content)
   */
  private findParagraphToAnalyze(content: string): number | null {
    const paragraphs = content.split(/\n\n+/);

    // Find the last valid paragraph (most recent user content)
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      const para = paragraphs[i].trim();
      if (
        para.length > 50 && // Meaningful content
        !para.startsWith('::muse[') &&
        !para.startsWith(':::muse') &&
        !para.startsWith('::whisper[') &&
        !para.startsWith('---') // Skip frontmatter
      ) {
        // Only return if this is different from the last analyzed paragraph
        if (i !== this.lastParagraphAnalyzed) {
          return i;
        }
        // Same paragraph, no new content to analyze
        return null;
      }
    }

    return null;
  }

  /**
   * Get the line number for a paragraph index
   */
  private getLineForParagraph(content: string, paragraphIndex: number): number {
    const paragraphs = content.split(/\n\n+/);
    let lineNumber = 1;

    for (let i = 0; i < paragraphIndex && i < paragraphs.length; i++) {
      // Count lines in this paragraph
      const lines = paragraphs[i].split('\n').length;
      lineNumber += lines;

      // Add the blank line(s) between paragraphs
      lineNumber += 1;
    }

    return lineNumber;
  }

  /**
   * Clear all whispers from the current view
   */
  clearWhispers(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      return;
    }

    // @ts-ignore - accessing internal API
    const cmEditor = view.editor.cm as EditorView;
    if (cmEditor) {
      clearAllWhispers(cmEditor);
    }

    new Notice('Whispers cleared');
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.triggerManager.destroy();
  }
}
