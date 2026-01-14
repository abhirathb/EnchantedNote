import { App, MarkdownView, Notice, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { ClaudeClient } from '../api/claude';
import { TriggerManager } from '../detection/triggers';
import { detectContext, getLinkedNotesContent } from '../detection/context';
import { createMuseBlock, isInsideEnchantment } from '../utils/parser';
import { ClaudeContext, EnchantedNotesSettings, Mood } from '../types';

/**
 * Manages Muse mode - inline responses that appear in the note
 */
export class MuseMode {
  private app: App;
  private claudeClient: ClaudeClient;
  private settings: EnchantedNotesSettings;
  private triggerManager: TriggerManager;
  private isGenerating: boolean = false;
  private currentMood: Mood | 'auto' = 'auto';

  constructor(
    app: App,
    claudeClient: ClaudeClient,
    settings: EnchantedNotesSettings
  ) {
    this.app = app;
    this.claudeClient = claudeClient;
    this.settings = settings;
    this.triggerManager = new TriggerManager(settings.pauseDuration);

    this.setupTriggers();
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
   * Handle editor updates
   */
  handleEditorUpdate(view: EditorView): void {
    // This is called on each editor update
    // The TriggerManager handles debouncing internally
  }

  /**
   * Manually trigger a Muse response
   */
  async summon(): Promise<void> {
    await this.handleTrigger();
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

    // Check if API is configured
    if (!this.claudeClient.isConfigured()) {
      new Notice('Please configure your Claude API key in settings');
      return;
    }

    this.isGenerating = true;

    try {
      // Detect context
      const detectedContext = detectContext(
        this.app,
        file,
        content,
        this.settings
      );

      // Use mood override if set
      const mood =
        this.currentMood !== 'auto' ? this.currentMood : detectedContext.mood;

      // Build context for Claude
      const context: ClaudeContext = {
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

      // Insert placeholder while generating
      const placeholderPos = cursorPos;
      editor.replaceRange('\n\n::muse[...]::  ', editor.offsetToPos(cursorPos));

      let streamedContent = '';
      const startPos = placeholderPos + 2; // After the two newlines

      // Generate response with streaming
      await this.claudeClient.generateMuseResponse(
        context,
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
      const content = editor.getValue();
      const placeholderMatch = content.match(/::muse\[\.\.\.\]::/);
      if (placeholderMatch) {
        const matchStart = content.indexOf(placeholderMatch[0]);
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
