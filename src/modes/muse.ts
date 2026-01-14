import { App, MarkdownView, Notice, TFile } from 'obsidian';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { LLMProvider } from '../api/provider';
import { TriggerManager } from '../detection/triggers';
import { detectContext, getLinkedNotesContent } from '../detection/context';
import { isInsideEnchantment, getCleanContent } from '../utils/parser';
import { getSystemPrompt } from '../moods';
import { EnchantedNotesSettings, Mood, LLMContext } from '../types';

/**
 * Manages Muse mode - inline responses that appear in the note
 */
export class MuseMode {
  private app: App;
  private provider: LLMProvider;
  private settings: EnchantedNotesSettings;
  private triggerManager: TriggerManager;
  private isGenerating: boolean = false;
  private currentMood: Mood | 'auto' = 'auto';

  constructor(app: App, provider: LLMProvider, settings: EnchantedNotesSettings) {
    this.app = app;
    this.provider = provider;
    this.settings = settings;
    this.triggerManager = new TriggerManager(settings.pauseDuration);

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
    this.triggerManager.onPause(() => this.handleTrigger());
    this.triggerManager.onDoubleEnter(() => this.handleTrigger());
  }

  /**
   * Enable Muse mode
   */
  enable(): void {
    this.triggerManager.enable();
    new Notice('Muse mode enabled');
  }

  /**
   * Disable Muse mode
   */
  disable(): void {
    this.triggerManager.disable();
    new Notice('Muse mode disabled');
  }

  /**
   * Toggle Muse mode
   */
  toggle(): void {
    if (this.triggerManager.isEnabled()) {
      this.disable();
    } else {
      this.enable();
    }
  }

  /**
   * Check if Muse mode is enabled
   */
  isEnabled(): boolean {
    return this.triggerManager.isEnabled();
  }

  /**
   * Set the current mood override
   */
  setMood(mood: Mood | 'auto'): void {
    this.currentMood = mood;
    new Notice(`Mood set to: ${mood === 'auto' ? 'Auto-detect' : mood}`);
  }

  /**
   * Get the current mood
   */
  getMood(): Mood | 'auto' {
    return this.currentMood;
  }

  /**
   * Update settings
   */
  updateSettings(settings: EnchantedNotesSettings): void {
    this.settings = settings;
    this.triggerManager.setPauseDuration(settings.pauseDuration);
  }

  /**
   * Handle editor updates from CodeMirror
   */
  handleEditorUpdate(update: ViewUpdate): void {
    if (!this.triggerManager.isEnabled()) {
      return;
    }
    // Forward the update to the trigger manager
    this.triggerManager.handleUpdate(update);
  }

  /**
   * Manually trigger a Muse response
   */
  async summon(): Promise<void> {
    await this.handleTrigger();
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
   * Handle a trigger event (pause or double-enter)
   */
  private async handleTrigger(): Promise<void> {
    if (this.isGenerating) {
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

    const editor = view.editor;
    const content = editor.getValue();
    const cursor = editor.getCursor();
    const cursorPos = editor.posToOffset(cursor);

    // Don't trigger if cursor is inside an enchantment block
    if (isInsideEnchantment(content, cursorPos)) {
      return;
    }

    // Check if there's new content since last response
    if (!this.triggerManager.hasNewContent(content)) {
      return;
    }

    // Check if provider is configured
    if (!this.provider.isConfigured()) {
      new Notice('Please configure your LLM provider in settings');
      return;
    }

    this.isGenerating = true;

    try {
      // Detect context
      const detectedContext = detectContext(this.app, file, content, this.settings);

      // Use mood override if set
      const mood = this.currentMood !== 'auto' ? this.currentMood : detectedContext.mood;

      // Build context
      const context: LLMContext = {
        noteContent: content,
        cursorPosition: cursorPos,
        mood,
        style: 'muse',
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
      const systemPrompt = getSystemPrompt(mood, 'muse');
      const userMessage = this.buildUserMessage(context);

      // Insert placeholder while generating
      editor.replaceRange('\n\n::muse[...]::  ', editor.offsetToPos(cursorPos));

      let streamedContent = '';

      // Generate response with streaming
      await this.provider.chat(
        systemPrompt,
        userMessage,
        (text) => {
          // Update the placeholder with streaming content
          streamedContent += text;
          const currentContent = editor.getValue();

          // Find and update the placeholder
          const placeholderMatch = currentContent.match(/::muse\[([^\]]*)\]::/);
          if (placeholderMatch) {
            const matchStart = currentContent.indexOf(placeholderMatch[0]);
            const matchEnd = matchStart + placeholderMatch[0].length;

            editor.replaceRange(
              `::muse[${streamedContent}]::`,
              editor.offsetToPos(matchStart),
              editor.offsetToPos(matchEnd)
            );
          }
        },
        (fullText) => {
          // Response complete
          this.triggerManager.markProcessed(editor.getValue());
        }
      );
    } catch (error) {
      console.error('Muse generation error:', error);
      new Notice(`Muse error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Remove the placeholder if there was an error
      const currentContent = editor.getValue();
      const placeholderMatch = currentContent.match(/::muse\[\.\.\.\]::/);
      if (placeholderMatch) {
        const matchStart = currentContent.indexOf(placeholderMatch[0]);
        const matchEnd = matchStart + placeholderMatch[0].length;
        editor.replaceRange('', editor.offsetToPos(matchStart), editor.offsetToPos(matchEnd));
      }
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Get the trigger manager (for editor integration)
   */
  getTriggerManager(): TriggerManager {
    return this.triggerManager;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.triggerManager.destroy();
  }
}
