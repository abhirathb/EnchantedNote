// Interaction styles - how Claude responds
export type InteractionStyle = 'muse' | 'whisper';

// Moods - what Claude says
export type Mood = 'reflect' | 'think' | 'plan';

// Plugin settings interface
export interface EnchantedNotesSettings {
  // API Configuration
  apiKey: string;
  model: string;

  // Behavior
  defaultStyle: InteractionStyle | 'off';
  defaultMood: Mood | 'auto';
  pauseDuration: number; // in seconds
  enableLinkedNoteContext: boolean;
  linkedNoteDepth: number; // 1-3

  // Developer
  showDeveloperPanel: boolean;
}

export const DEFAULT_SETTINGS: EnchantedNotesSettings = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  defaultStyle: 'muse',
  defaultMood: 'auto',
  pauseDuration: 2,
  enableLinkedNoteContext: false,
  linkedNoteDepth: 1,
  showDeveloperPanel: false,
};

// Parsed enchantment block
export interface EnchantmentBlock {
  type: 'muse' | 'whisper';
  content: string;
  isMultiline: boolean;
  start: number; // position in document
  end: number;
}

// Context for Claude API calls
export interface ClaudeContext {
  noteContent: string;
  cursorPosition?: number;
  mood: Mood;
  style: InteractionStyle;
  linkedNotes?: string[];
  notePath: string;
}

// Developer stats
export interface DeveloperStats {
  tokensThisSession: number;
  tokensToday: number;
  lastResponseTime: number;
  currentContextSize: number;
}

// Per-note state
export interface NoteState {
  museEnabled: boolean;
  whisperEnabled: boolean;
  currentMood: Mood | 'auto';
}
