import { App, PluginSettingTab, Setting, Notice, DropdownComponent } from 'obsidian';
import type EnchantedNotesPlugin from './main';
import { EnchantedNotesSettings, ProviderType } from './types';
import { CLAUDE_MODELS } from './api/claude';

export class EnchantedNotesSettingTab extends PluginSettingTab {
  plugin: EnchantedNotesPlugin;
  private ollamaModelDropdown: DropdownComponent | null = null;

  constructor(app: App, plugin: EnchantedNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // Provider Selection Section
    containerEl.createEl('h2', { text: 'LLM Provider' });

    new Setting(containerEl)
      .setName('Provider')
      .setDesc('Choose your LLM provider')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('claude', 'Claude (Anthropic)')
          .addOption('ollama', 'Ollama (Local)')
          .setValue(this.plugin.settings.provider)
          .onChange(async (value) => {
            this.plugin.settings.provider = value as ProviderType;
            await this.plugin.saveSettings();
            this.plugin.switchProvider(value as ProviderType);
            this.display(); // Refresh to show/hide provider-specific settings
          })
      );

    // Provider-specific settings
    if (this.plugin.settings.provider === 'claude') {
      this.displayClaudeSettings(containerEl);
    } else {
      this.displayOllamaSettings(containerEl);
    }

    // Test Connection Button
    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Verify connection to the selected provider')
      .addButton((button) =>
        button
          .setButtonText('Test Connection')
          .onClick(async () => {
            button.setDisabled(true);
            button.setButtonText('Testing...');

            const success = await this.plugin.testConnection();

            if (success) {
              new Notice('Connection successful!');
            } else {
              new Notice('Connection failed. Check your settings.');
            }

            button.setDisabled(false);
            button.setButtonText('Test Connection');
          })
      );

    // Behavior Section
    containerEl.createEl('h2', { text: 'Behavior' });

    new Setting(containerEl)
      .setName('Default interaction style')
      .setDesc('How the AI responds by default')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('muse', 'Muse (inline responses)')
          .addOption('whisper', 'Whisper (hover annotations)')
          .addOption('off', 'Off')
          .setValue(this.plugin.settings.defaultStyle)
          .onChange(async (value) => {
            this.plugin.settings.defaultStyle = value as 'muse' | 'whisper' | 'off';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default mood')
      .setDesc('The default persona for AI responses')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('auto', 'Auto-detect')
          .addOption('reflect', 'Reflect (journaling)')
          .addOption('think', 'Think (essays/ideas)')
          .addOption('plan', 'Plan (todos/planning)')
          .setValue(this.plugin.settings.defaultMood)
          .onChange(async (value) => {
            this.plugin.settings.defaultMood = value as 'reflect' | 'think' | 'plan' | 'auto';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Pause duration')
      .setDesc('How long to wait after typing stops before Muse responds (seconds)')
      .addSlider((slider) =>
        slider
          .setLimits(1, 5, 0.5)
          .setValue(this.plugin.settings.pauseDuration)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.pauseDuration = value;
            await this.plugin.saveSettings();
            this.plugin.updatePauseDuration(value);
          })
      );

    new Setting(containerEl)
      .setName('Enable linked note context')
      .setDesc('Include content from linked notes in AI context')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableLinkedNoteContext)
          .onChange(async (value) => {
            this.plugin.settings.enableLinkedNoteContext = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Linked note depth')
      .setDesc('How many levels of links to include (if linked note context is enabled)')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('1', '1 level')
          .addOption('2', '2 levels')
          .addOption('3', '3 levels')
          .setValue(this.plugin.settings.linkedNoteDepth.toString())
          .onChange(async (value) => {
            this.plugin.settings.linkedNoteDepth = parseInt(value);
            await this.plugin.saveSettings();
          })
      );

    // Keyboard Shortcuts Section
    containerEl.createEl('h2', { text: 'Keyboard Shortcuts' });

    containerEl.createEl('p', {
      text: 'Default shortcuts:',
      cls: 'setting-item-description',
    });

    const shortcutList = containerEl.createEl('ul', {
      cls: 'setting-item-description',
    });
    shortcutList.createEl('li', { text: 'Cmd/Ctrl + Shift + M: Toggle Muse mode' });
    shortcutList.createEl('li', { text: 'Cmd/Ctrl + Shift + W: Toggle Whisper mode' });

    new Setting(containerEl)
      .setName('Customize shortcuts')
      .setDesc("Open Obsidian's hotkey settings to customize shortcuts")
      .addButton((button) =>
        button.setButtonText('Open Hotkey Settings').onClick(() => {
          // @ts-ignore - accessing internal API
          this.app.setting.openTabById('hotkeys');
          // @ts-ignore
          this.app.setting.activeTab.searchComponent.inputEl.value = 'Enchanted Notes';
          // @ts-ignore
          this.app.setting.activeTab.updateHotkeyVisibility();
        })
      );

    // Developer Section
    containerEl.createEl('h2', { text: 'Developer' });

    new Setting(containerEl)
      .setName('Show developer panel')
      .setDesc('Display token usage and response times')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showDeveloperPanel).onChange(async (value) => {
          this.plugin.settings.showDeveloperPanel = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.showDeveloperPanel) {
      const stats = this.plugin.getStats();

      const statsContainer = containerEl.createDiv({
        cls: 'enchanted-notes-stats',
      });

      statsContainer.createEl('p', {
        text: `Tokens this session: ${stats.tokensThisSession}`,
      });
      statsContainer.createEl('p', {
        text: `Tokens today: ${stats.tokensToday}`,
      });
      statsContainer.createEl('p', {
        text: `Last response time: ${stats.lastResponseTime}ms`,
      });
      statsContainer.createEl('p', {
        text: `Current context size: ${stats.currentContextSize} chars`,
      });

      new Setting(containerEl)
        .setName('Reset session stats')
        .addButton((button) =>
          button.setButtonText('Reset').onClick(() => {
            this.plugin.resetSessionStats();
            this.display();
          })
        );
    }

    // About Section
    containerEl.createEl('h2', { text: 'About' });

    containerEl.createEl('p', {
      text: 'Enchanted Notes makes your notes come alive. Write naturally, and AI will respond as your thinking partner.',
      cls: 'setting-item-description',
    });

    containerEl.createEl('p', {
      text: 'Use ::muse[...]:: or :::muse blocks for inline responses, and ::whisper[...]:: for hover annotations.',
      cls: 'setting-item-description',
    });
  }

  /**
   * Display Claude-specific settings
   */
  private displayClaudeSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Claude API Key')
      .setDesc('Your Anthropic API key. Get one at console.anthropic.com')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.claudeApiKey)
          .onChange(async (value) => {
            this.plugin.settings.claudeApiKey = value;
            await this.plugin.saveSettings();
            this.plugin.updateProviderConfig();
          })
      );

    new Setting(containerEl)
      .setName('Model')
      .setDesc('The Claude model to use for responses')
      .addDropdown((dropdown) => {
        for (const model of CLAUDE_MODELS) {
          const label =
            model === 'claude-sonnet-4-20250514'
              ? 'Claude Sonnet 4 (Recommended)'
              : model === 'claude-opus-4-20250514'
                ? 'Claude Opus 4'
                : model === 'claude-3-5-sonnet-20241022'
                  ? 'Claude 3.5 Sonnet'
                  : 'Claude 3.5 Haiku (Faster)';
          dropdown.addOption(model, label);
        }
        dropdown.setValue(this.plugin.settings.claudeModel).onChange(async (value) => {
          this.plugin.settings.claudeModel = value;
          await this.plugin.saveSettings();
          this.plugin.updateProviderConfig();
        });
      });
  }

  /**
   * Display Ollama-specific settings
   */
  private displayOllamaSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Ollama Base URL')
      .setDesc('The URL where Ollama is running')
      .addText((text) =>
        text
          .setPlaceholder('http://localhost:11434')
          .setValue(this.plugin.settings.ollamaBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollamaBaseUrl = value;
            await this.plugin.saveSettings();
            this.plugin.updateProviderConfig();
          })
      );

    // Model dropdown with refresh button
    const modelSetting = new Setting(containerEl)
      .setName('Model')
      .setDesc('Select an Ollama model (click Refresh to load available models)');

    modelSetting.addDropdown((dropdown) => {
      this.ollamaModelDropdown = dropdown;

      if (this.plugin.settings.ollamaModel) {
        dropdown.addOption(this.plugin.settings.ollamaModel, this.plugin.settings.ollamaModel);
        dropdown.setValue(this.plugin.settings.ollamaModel);
      } else {
        dropdown.addOption('', 'Select a model...');
        dropdown.setValue('');
      }

      dropdown.onChange(async (value) => {
        this.plugin.settings.ollamaModel = value;
        await this.plugin.saveSettings();
        this.plugin.updateProviderConfig();
      });
    });

    modelSetting.addButton((button) =>
      button.setButtonText('Refresh Models').onClick(async () => {
        button.setDisabled(true);
        button.setButtonText('Loading...');

        try {
          const models = await this.plugin.fetchOllamaModels();

          if (this.ollamaModelDropdown) {
            // Clear existing options
            this.ollamaModelDropdown.selectEl.empty();

            if (models.length === 0) {
              this.ollamaModelDropdown.addOption('', 'No models found');
              new Notice('No Ollama models found. Make sure Ollama is running.');
            } else {
              for (const model of models) {
                this.ollamaModelDropdown.addOption(model, model);
              }

              // Keep current selection if it exists
              if (models.includes(this.plugin.settings.ollamaModel)) {
                this.ollamaModelDropdown.setValue(this.plugin.settings.ollamaModel);
              } else if (models.length > 0) {
                // Select first model
                this.ollamaModelDropdown.setValue(models[0]);
                this.plugin.settings.ollamaModel = models[0];
                await this.plugin.saveSettings();
                this.plugin.updateProviderConfig();
              }

              new Notice(`Found ${models.length} model(s)`);
            }
          }
        } catch (error) {
          new Notice('Failed to fetch models. Check if Ollama is running.');
          console.error('Failed to fetch Ollama models:', error);
        }

        button.setDisabled(false);
        button.setButtonText('Refresh Models');
      })
    );
  }
}
