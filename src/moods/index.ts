import { Mood, InteractionStyle } from '../types';
import { REFLECT_SYSTEM_PROMPT, REFLECT_WHISPER_PROMPT } from './reflect';
import { THINK_SYSTEM_PROMPT, THINK_WHISPER_PROMPT } from './think';
import { PLAN_SYSTEM_PROMPT, PLAN_WHISPER_PROMPT } from './plan';

/**
 * Get the appropriate system prompt for a mood and style combination
 */
export function getSystemPrompt(mood: Mood, style: InteractionStyle): string {
  if (style === 'whisper') {
    switch (mood) {
      case 'reflect':
        return REFLECT_WHISPER_PROMPT;
      case 'think':
        return THINK_WHISPER_PROMPT;
      case 'plan':
        return PLAN_WHISPER_PROMPT;
    }
  }

  // Muse mode
  switch (mood) {
    case 'reflect':
      return REFLECT_SYSTEM_PROMPT;
    case 'think':
      return THINK_SYSTEM_PROMPT;
    case 'plan':
      return PLAN_SYSTEM_PROMPT;
  }
}

/**
 * Get a user-friendly display name for a mood
 */
export function getMoodDisplayName(mood: Mood): string {
  switch (mood) {
    case 'reflect':
      return 'Reflect';
    case 'think':
      return 'Think';
    case 'plan':
      return 'Plan';
  }
}

export { REFLECT_SYSTEM_PROMPT, REFLECT_WHISPER_PROMPT } from './reflect';
export { THINK_SYSTEM_PROMPT, THINK_WHISPER_PROMPT } from './think';
export { PLAN_SYSTEM_PROMPT, PLAN_WHISPER_PROMPT } from './plan';
