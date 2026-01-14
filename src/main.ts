import { App, Plugin, MarkdownView } from 'obsidian';
import { Extension } from '@codemirror/state';
import { ViewPlugin, ViewUpdate } from '@codemirror/view';

import { EnchantedNotesSettings, DEFAULT_SETTINGS, DeveloperStats, ProviderType } from './types';
import { EnchantedNotesSettingTab } from './settings';
import { LLMProvider } from './api/provider';
import { ClaudeProvider } from './api/claude';
import { OllamaProvider } from './api/ollama';
import { MuseMode } from './modes/muse';
import { WhisperMode } from './modes/whisper';
import { registerCommands } from './commands';
import { createMuseDecorator, clearStowedState } from './rendering/muse-decorator';
import { createWhisperWidget } from './rendering/whisper-widget';

export default class EnchantedNotesPlugin extends Plugin {
  settings: EnchantedNotesSettings = DEFAULT_SETTINGS;
  provider: LLMProvider | null = null;
  private claudeProvider: ClaudeProvider | null = null;
  private ollamaProvider: OllamaProvider | null = null;
  private museMode: MuseMode | null = null;
  private whisperMode: WhisperMode | null = null;
  private editorExtensions: Extension[] = [];

  async onload(): Promise<void> {
    console.log('Loading Enchanted Notes plugin');

    // Load settings
    await this.loadSettings();

    // Initialize providers
    this.initializeProviders();

    // Initialize modes
    this.museMode = new MuseMode(this.app, this.provider!, this.settings);
    this.whisperMode = new WhisperMode(this.app, this.provider!, this.settings);

    // Enable modes based on default settings
    if (this.settings.defaultStyle === 'muse') {
      this.museMode.enable();
    } else if (this.settings.defaultStyle === 'whisper') {
      this.whisperMode.enable();
    }

    // Register commands
    registerCommands(this.app, (cmd) => this.addCommand(cmd), this.museMode, this.whisperMode);

    // Add settings tab
    this.addSettingTab(new EnchantedNotesSettingTab(this.app, this));

    // Register editor extensions
    this.registerEditorExtensions();

    // Add status bar item
    this.setupStatusBar();
  }

  /**
   * Initialize LLM providers
   */
  private initializeProviders(): void {
    // Initialize Claude provider
    this.claudeProvider = new ClaudeProvider(
      this.settings.claudeApiKey,
      this.settings.claudeModel
    );

    // Initialize Ollama provider
    this.ollamaProvider = new OllamaProvider(
      this.settings.ollamaBaseUrl,
      this.settings.ollamaModel
    );

    // Set active provider based on settings
    this.provider =
      this.settings.provider === 'claude' ? this.claudeProvider : this.ollamaProvider;
  }

  /**
   * Switch to a different provider
   */
  switchProvider(providerType: ProviderType): void {
    this.provider = providerType === 'claude' ? this.claudeProvider : this.ollamaProvider;

    // Update modes with new provider
    this.museMode?.setProvider(this.provider!);
    this.whisperMode?.setProvider(this.provider!);
  }

  /**
   * Update provider configuration
   */
  updateProviderConfig(): void {
    if (this.settings.provider === 'claude' && this.claudeProvider) {
      this.claudeProvider.setApiKey(this.settings.claudeApiKey);
      this.claudeProvider.setModel(this.settings.claudeModel);
    } else if (this.settings.provider === 'ollama' && this.ollamaProvider) {
      this.ollamaProvider.setBaseUrl(this.settings.ollamaBaseUrl);
      this.ollamaProvider.setModel(this.settings.ollamaModel);
    }
  }

  /**
   * Test connection to current provider
   */
  async testConnection(): Promise<boolean> {
    if (!this.provider) {
      return false;
    }
    return this.provider.testConnection();
  }

  /**
   * Fetch available Ollama models
   */
  async fetchOllamaModels(): Promise<string[]> {
    if (!this.ollamaProvider) {
      return [];
    }
    return this.ollamaProvider.listModels();
  }

  /**
   * Register CodeMirror editor extensions
   */
  private registerEditorExtensions(): void {
    // Muse decorator for rendering muse blocks
    const museDecorator = createMuseDecorator();

    // Whisper widget for hover/tap icons
    const whisperWidget = createWhisperWidget();

    // Trigger plugin to forward editor updates to MuseMode
    const triggerPlugin = this.createTriggerPlugin();

    // Register extensions
    this.registerEditorExtension([museDecorator, whisperWidget, triggerPlugin]);
  }

  /**
   * Create a ViewPlugin that forwards editor updates to the trigger system
   */
  private createTriggerPlugin(): Extension {
    const museMode = this.museMode;

    return ViewPlugin.fromClass(
      class {
        update(update: ViewUpdate) {
          if (update.docChanged && museMode) {
            museMode.handleEditorUpdate(update);
          }
        }
      }
    );
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

      statusBarItem.createSpan({
        cls: `enchanted-status-indicator ${statusClass}`,
      });

      statusBarItem.createSpan({ text: statusText });
    };

    // Update status periodically
    this.registerInterval(window.setInterval(updateStatus, 1000));

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
    return (
      this.provider?.getStats() || {
        tokensThisSession: 0,
        tokensToday: 0,
        lastResponseTime: 0,
        currentContextSize: 0,
      }
    );
  }

  /**
   * Reset session stats
   */
  resetSessionStats(): void {
    this.provider?.resetSessionStats();
  }
}
