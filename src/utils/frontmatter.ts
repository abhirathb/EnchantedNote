import { TFile, App, CachedMetadata } from 'obsidian';
import { InteractionStyle, Mood } from '../types';

export interface EnchantmentFrontmatter {
  style?: InteractionStyle;
  mood?: Mood;
  type?: string; // e.g., 'journal', 'essay', 'project'
}

/**
 * Extract enchantment-related frontmatter from a file
 */
export function getEnchantmentFrontmatter(
  app: App,
  file: TFile
): EnchantmentFrontmatter {
  const cache = app.metadataCache.getFileCache(file);
  if (!cache?.frontmatter) {
    return {};
  }

  const fm = cache.frontmatter;
  const result: EnchantmentFrontmatter = {};

  // Check for explicit enchant-style
  if (fm['enchant-style']) {
    const style = fm['enchant-style'].toLowerCase();
    if (style === 'muse' || style === 'whisper') {
      result.style = style;
    }
  }

  // Check for explicit enchant-mood
  if (fm['enchant-mood']) {
    const mood = fm['enchant-mood'].toLowerCase();
    if (mood === 'reflect' || mood === 'think' || mood === 'plan') {
      result.mood = mood;
    }
  }

  // Check for type tag (used for mood inference)
  if (fm['type']) {
    result.type = fm['type'].toLowerCase();
  }

  return result;
}

/**
 * Infer mood from frontmatter type tag
 */
export function inferMoodFromType(type: string): Mood | null {
  const typeMap: Record<string, Mood> = {
    journal: 'reflect',
    diary: 'reflect',
    reflection: 'reflect',
    essay: 'think',
    writing: 'think',
    article: 'think',
    idea: 'think',
    ideas: 'think',
    project: 'plan',
    todo: 'plan',
    task: 'plan',
    tasks: 'plan',
    plan: 'plan',
    planning: 'plan',
  };

  return typeMap[type.toLowerCase()] || null;
}

/**
 * Check if frontmatter contains any enchantment settings
 */
export function hasEnchantmentSettings(app: App, file: TFile): boolean {
  const fm = getEnchantmentFrontmatter(app, file);
  return fm.style !== undefined || fm.mood !== undefined;
}

/**
 * Get all frontmatter as a record
 */
export function getAllFrontmatter(
  app: App,
  file: TFile
): Record<string, unknown> | null {
  const cache = app.metadataCache.getFileCache(file);
  return cache?.frontmatter || null;
}
