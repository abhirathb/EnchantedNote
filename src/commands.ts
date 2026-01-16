import { App, Command, MarkdownView, Notice } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { MuseMode } from './modes/muse';
import { WhisperMode } from './modes/whisper';
import { stowAllBlocks, revealAllBlocks } from './rendering/muse-decorator';
import { removeAllEnchantments } from './utils/parser';
import { Mood } from './types';
import {
  getEnchantmentFrontmatter,
  setEnchantmentFrontmatter,
  isEnchantEnabled
} from './utils/frontmatter';

/**
 * Register all plugin commands
 */
export function registerCommands(
  app: App,
  addCommand: (command: Command) => void,
  museMode: MuseMode,
  whisperMode: WhisperMode
): void {
  // Toggle Enchant Mode for current note
  addCommand({
    id: 'toggle-enchant',
    name: 'Toggle Enchant Note',
    hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'e' }],
    checkCallback: (checking: boolean) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view || !view.file) {
        return false;
      }

      if (!checking) {
        const file = view.file;
        const isEnabled = isEnchantEnabled(app, file);

        if (isEnabled) {
          // Disable enchant mode
          setEnchantmentFrontmatter(app, file, { enabled: false });
          new Notice('Enchant mode disabled for this note');
        } else {
          // Enable enchant mode with defaults
          setEnchantmentFrontmatter(app, file, {
            enabled: true,
            style: 'muse',
            mood: 'reflect',
          });
          new Notice('Enchant mode enabled! Edit the frontmatter to customize mode and tone.');
        }
      }

      return true;
    },
  });

  // Toggle Muse mode (mutually exclusive with Whisper)
  addCommand({
    id: 'toggle-muse',
    name: 'Toggle Muse',
    hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'm' }],
    callback: () => {
      if (!museMode.isEnabled()) {
        // Enabling Muse - disable Whisper first
        if (whisperMode.isEnabled()) {
          whisperMode.disable();
        }
      }
      museMode.toggle();
    },
  });

  // Toggle Whisper mode (mutually exclusive with Muse)
  addCommand({
    id: 'toggle-whisper',
    name: 'Toggle Whisper',
    hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'w' }],
    callback: () => {
      if (!whisperMode.isEnabled()) {
        // Enabling Whisper - disable Muse first
        if (museMode.isEnabled()) {
          museMode.disable();
        }
      }
      whisperMode.toggle();
    },
  });

  // Stow Enchantments
  addCommand({
    id: 'stow-enchantments',
    name: 'Stow Enchantments',
    checkCallback: (checking: boolean) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        return false;
      }

      if (!checking) {
        // @ts-ignore - accessing internal API
        const cmEditor = view.editor.cm as EditorView;
        if (cmEditor) {
          stowAllBlocks(cmEditor);
          new Notice('Enchantments stowed');
        }
      }

      return true;
    },
  });

  // Reveal Enchantments
  addCommand({
    id: 'reveal-enchantments',
    name: 'Reveal Enchantments',
    checkCallback: (checking: boolean) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        return false;
      }

      if (!checking) {
        // @ts-ignore - accessing internal API
        const cmEditor = view.editor.cm as EditorView;
        if (cmEditor) {
          revealAllBlocks(cmEditor);
          new Notice('Enchantments revealed');
        }
      }

      return true;
    },
  });

  // Banish Enchantments
  addCommand({
    id: 'banish-enchantments',
    name: 'Banish Enchantments',
    checkCallback: (checking: boolean) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        return false;
      }

      if (!checking) {
        const editor = view.editor;
        const content = editor.getValue();
        const cleanContent = removeAllEnchantments(content);

        if (content !== cleanContent) {
          editor.setValue(cleanContent);
          new Notice('Enchantments banished');
        } else {
          new Notice('No enchantments to banish');
        }
      }

      return true;
    },
  });

  // Set Mood - Reflect
  addCommand({
    id: 'set-mood-reflect',
    name: 'Set Mood: Reflect',
    callback: () => {
      museMode.setMood('reflect');
      whisperMode.setMood('reflect');
    },
  });

  // Set Mood - Think
  addCommand({
    id: 'set-mood-think',
    name: 'Set Mood: Think',
    callback: () => {
      museMode.setMood('think');
      whisperMode.setMood('think');
    },
  });

  // Set Mood - Plan
  addCommand({
    id: 'set-mood-plan',
    name: 'Set Mood: Plan',
    callback: () => {
      museMode.setMood('plan');
      whisperMode.setMood('plan');
    },
  });

  // Set Mood - Auto
  addCommand({
    id: 'set-mood-auto',
    name: 'Set Mood: Auto-detect',
    callback: () => {
      museMode.setMood('auto');
      whisperMode.setMood('auto');
    },
  });

  // Set Mood (interactive)
  addCommand({
    id: 'set-mood',
    name: 'Set Mood',
    callback: () => {
      const moods: Array<{ mood: Mood | 'auto'; label: string }> = [
        { mood: 'auto', label: 'Auto-detect' },
        { mood: 'reflect', label: 'Reflect (journaling)' },
        { mood: 'think', label: 'Think (essays/ideas)' },
        { mood: 'plan', label: 'Plan (todos/planning)' },
      ];

      // Create a simple modal for mood selection
      const modal = document.createElement('div');
      modal.className = 'modal-container mod-dim';
      modal.innerHTML = `
        <div class="modal-bg" style="opacity: 0.85;"></div>
        <div class="modal" style="width: 300px;">
          <div class="modal-title">Set Mood</div>
          <div class="modal-content" style="padding: 1em;">
            ${moods
              .map(
                (m, i) => `
              <button class="mod-cta" style="width: 100%; margin-bottom: 0.5em;" data-mood="${m.mood}">
                ${m.label}
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Handle button clicks
      modal.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mood = btn.dataset.mood as Mood | 'auto';
          museMode.setMood(mood);
          whisperMode.setMood(mood);
          modal.remove();
        });
      });

      // Handle background click to close
      modal.querySelector('.modal-bg')?.addEventListener('click', () => {
        modal.remove();
      });

      // Handle Escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
    },
  });

  // Summon Muse
  addCommand({
    id: 'summon-muse',
    name: 'Summon Muse',
    checkCallback: (checking: boolean) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        return false;
      }

      if (!checking) {
        museMode.summon();
      }

      return true;
    },
  });

  // Clear Whispers
  addCommand({
    id: 'clear-whispers',
    name: 'Clear Whispers',
    checkCallback: (checking: boolean) => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        return false;
      }

      if (!checking) {
        whisperMode.clearWhispers();
      }

      return true;
    },
  });
}
