import { App, PluginSettingTab, Setting } from 'obsidian';
import type EnchantedNotesPlugin from './main';
import { EnchantedNotesSettings } from './types';

export class EnchantedNotesSettingTab extends PluginSettingTab {
  plugin: EnchantedNotesPlugin;

  constructor(app: App, plugin: EnchantedNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // API Configuration Section
    containerEl.createEl('h2', { text: 'API Configuration' });

    new Setting(containerEl)
      .setName('Claude API Key')
      .setDesc('Your Anthropic API key. Get one at console.anthropic.com')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
            this.plugin.updateApiKey(value);
          })
      );

    new Setting(containerEl)
      .setName('Model')
      .setDesc('The Claude model to use for responses')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('claude-sonnet-4-20250514', 'Claude Sonnet 4 (Recommended)')
          .addOption('claude-opus-4-20250514', 'Claude Opus 4')
          .addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet')
          .addOption('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku (Faster)')
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value;
            await this.plugin.saveSettings();
            this.plugin.updateModel(value);
          })
      );

    // Behavior Section
    containerEl.createEl('h2', { text: 'Behavior' });

    new Setting(containerEl)
      .setName('Default interaction style')
      .setDesc('How Claude responds by default')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('muse', 'Muse (inline responses)')
          .addOption('whisper', 'Whisper (margin annotations)')
          .addOption('off', 'Off')
          .setValue(this.plugin.settings.defaultStyle)
          .onChange(async (value) => {
            this.plugin.settings.defaultStyle = value as 'muse' | 'whisper' | 'off';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default mood')
      .setDesc('The default persona for Claude\'s responses')
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
      .setDesc('Include content from linked notes in Claude\'s context')
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
      .setDesc('Open Obsidian\'s hotkey settings to customize shortcuts')
      .addButton((button) =>
        button
          .setButtonText('Open Hotkey Settings')
          .onClick(() => {
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
        toggle
          .setValue(this.plugin.settings.showDeveloperPanel)
          .onChange(async (value) => {
            this.plugin.settings.showDeveloperPanel = value;
            await this.plugin.saveSettings();
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
          button
            .setButtonText('Reset')
            .onClick(() => {
              this.plugin.resetSessionStats();
              this.display();
            })
        );
    }

    // About Section
    containerEl.createEl('h2', { text: 'About' });

    containerEl.createEl('p', {
      text: 'Enchanted Notes makes your notes come alive. Write naturally, and Claude will respond as your thinking partner.',
      cls: 'setting-item-description',
    });

    containerEl.createEl('p', {
      text: 'Use ::muse[...]:: or :::muse blocks for inline responses, and ::whisper[...]:: for margin annotations.',
      cls: 'setting-item-description',
    });
  }
}
