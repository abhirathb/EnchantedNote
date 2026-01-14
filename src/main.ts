import {
  App,
  Plugin,
  PluginManifest,
  MarkdownView,
} from 'obsidian';
import { Extension } from '@codemirror/state';
import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';

import { EnchantedNotesSettings, DEFAULT_SETTINGS, DeveloperStats } from './types';
import { EnchantedNotesSettingTab } from './settings';
import { ClaudeClient } from './api/claude';
import { MuseMode } from './modes/muse';
import { WhisperMode } from './modes/whisper';
import { registerCommands } from './commands';
import { createMuseDecorator, clearStowedState } from './rendering/muse-decorator';
import { createWhisperGutter, createWhisperDecorator } from './rendering/whisper-gutter';

export default class EnchantedNotesPlugin extends Plugin {
  settings: EnchantedNotesSettings = DEFAULT_SETTINGS;
  claudeClient: ClaudeClient | null = null;
  private museMode: MuseMode | null = null;
  private whisperMode: WhisperMode | null = null;
  private editorExtensions: Extension[] = [];

  async onload(): Promise<void> {
    console.log('Loading Enchanted Notes plugin');

    // Load settings
    await this.loadSettings();

    // Initialize Claude client
    this.claudeClient = new ClaudeClient(
      this.settings.apiKey,
      this.settings.model
    );

    // Initialize modes
    this.museMode = new MuseMode(
      this.app,
      this.claudeClient,
      this.settings
    );

    this.whisperMode = new WhisperMode(
      this.app,
      this.claudeClient,
      this.settings
    );

    // Enable modes based on default settings
    if (this.settings.defaultStyle === 'muse') {
      this.museMode.enable();
    } else if (this.settings.defaultStyle === 'whisper') {
      this.whisperMode.enable();
    }

    // Register commands
    registerCommands(
      this.app,
      (cmd) => this.addCommand(cmd),
      this.museMode,
      this.whisperMode
    );

    // Add settings tab
    this.addSettingTab(new EnchantedNotesSettingTab(this.app, this));

    // Register editor extensions
    this.registerEditorExtensions();

    // Add status bar item
    this.setupStatusBar();
  }

  /**
   * Register CodeMirror editor extensions
   */
  private registerEditorExtensions(): void {
    // Muse decorator for rendering muse blocks
    const museDecorator = createMuseDecorator();

    // Whisper gutter and decorator
    const whisperGutter = createWhisperGutter();
    const whisperDecorator = createWhisperDecorator();

    // Editor update handler for triggers
    const triggerHandler = ViewPlugin.fromClass(
      class {
        constructor(private view: EditorView) {}

        update(update: ViewUpdate) {
          if (update.docChanged && this.plugin?.museMode) {
            const triggerManager = this.plugin.museMode.getTriggerManager();
            triggerManager.handleUpdate(update);
          }
        }

        private get plugin(): EnchantedNotesPlugin | null {
          // Access plugin through app
          // @ts-ignore
          return this.view.state.facet(pluginFacet)?.[0] || null;
        }
      }
    );

    // Register extensions
    this.registerEditorExtension([
      museDecorator,
      whisperGutter,
      whisperDecorator,
    ]);
  }

  /**
   * Set up status bar item showing current mode
   */
  private setupStatusBar(): void {
    const statusBarItem = super.addStatusBarItem();
    statusBarItem.addClass('enchanted-status');

    const updateStatus = () => {
      const museEnabled = this.museMode?.isEnabled() || false;
      const whisperEnabled = this.whisperMode?.isEnabled() || false;

      let statusText = '';
      let statusClass = '';

      if (museEnabled && whisperEnabled) {
        statusText = 'Muse + Whisper';
        statusClass = 'active';
      } else if (museEnabled) {
        statusText = 'Muse';
        statusClass = 'active';
      } else if (whisperEnabled) {
        statusText = 'Whisper';
        statusClass = 'whisper-active';
      } else {
        statusText = 'Enchanted';
        statusClass = '';
      }

      statusBarItem.empty();

      const indicator = statusBarItem.createSpan({
        cls: `enchanted-status-indicator ${statusClass}`,
      });

      statusBarItem.createSpan({ text: statusText });
    };

    // Update status periodically
    this.registerInterval(
      window.setInterval(updateStatus, 1000)
    );

    // Initial update
    updateStatus();
  }

  async onunload(): Promise<void> {
    console.log('Unloading Enchanted Notes plugin');

    // Clean up modes
    this.museMode?.destroy();
    this.whisperMode?.destroy();

    // Clear stowed state
    clearStowedState();
  }

  /**
   * Load settings from disk
   */
  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  /**
   * Save settings to disk
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);

    // Update modes with new settings
    this.museMode?.updateSettings(this.settings);
    this.whisperMode?.updateSettings(this.settings);
  }

  /**
   * Update the Claude API key
   */
  updateApiKey(apiKey: string): void {
    this.claudeClient?.setApiKey(apiKey);
  }

  /**
   * Update the Claude model
   */
  updateModel(model: string): void {
    this.claudeClient?.setModel(model);
  }

  /**
   * Update the pause duration
   */
  updatePauseDuration(seconds: number): void {
    this.museMode?.updateSettings({
      ...this.settings,
      pauseDuration: seconds,
    });
  }

  /**
   * Get developer stats
   */
  getStats(): DeveloperStats {
    return this.claudeClient?.getStats() || {
      tokensThisSession: 0,
      tokensToday: 0,
      lastResponseTime: 0,
      currentContextSize: 0,
    };
  }

  /**
   * Reset session stats
   */
  resetSessionStats(): void {
    this.claudeClient?.resetSessionStats();
  }
}
