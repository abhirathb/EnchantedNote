import { TFile, App, CachedMetadata } from 'obsidian';
import { InteractionStyle, Mood } from '../types';

export interface EnchantmentFrontmatter {
  style?: InteractionStyle;
  mood?: Mood;
  type?: string; // e.g., 'journal', 'essay', 'project'
  enabled?: boolean; // Whether enchant mode is enabled for this note
  hasFirstResponse?: boolean; // Whether the first AI response has been generated
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

  // Check for explicit enchant-mode (enabled/disabled)
  if (fm['enchant-enabled'] !== undefined) {
    result.enabled = fm['enchant-enabled'] === true;
  }

  // Check for explicit enchant-style
  if (fm['enchant-mode']) {
    const style = fm['enchant-mode'].toLowerCase();
    if (style === 'muse' || style === 'whisper') {
      result.style = style;
    }
  }

  // Check for explicit enchant-mood (renamed from enchant-mood to enchant-tone for clarity)
  if (fm['enchant-tone']) {
    const mood = fm['enchant-tone'].toLowerCase();
    if (mood === 'reflect' || mood === 'think' || mood === 'plan') {
      result.mood = mood;
    }
  }

  // Check for first response flag
  if (fm['enchant-has-response'] !== undefined) {
    result.hasFirstResponse = fm['enchant-has-response'] === true;
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

/**
 * Add or update enchantment frontmatter in a file
 */
export async function setEnchantmentFrontmatter(
  app: App,
  file: TFile,
  updates: Partial<EnchantmentFrontmatter>
): Promise<void> {
  const content = await app.vault.read(file);
  const newContent = updateFrontmatterInContent(content, updates);
  await app.vault.modify(file, newContent);
}

/**
 * Update frontmatter in content string
 */
function updateFrontmatterInContent(
  content: string,
  updates: Partial<EnchantmentFrontmatter>
): string {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  const frontmatterUpdates: Record<string, any> = {};

  if (updates.enabled !== undefined) {
    frontmatterUpdates['enchant-enabled'] = updates.enabled;
  }
  if (updates.style !== undefined) {
    frontmatterUpdates['enchant-mode'] = updates.style;
  }
  if (updates.mood !== undefined) {
    frontmatterUpdates['enchant-tone'] = updates.mood;
  }
  if (updates.hasFirstResponse !== undefined) {
    frontmatterUpdates['enchant-has-response'] = updates.hasFirstResponse;
  }

  if (match) {
    // Frontmatter exists, update it
    const existingFrontmatter = match[1];
    let updatedFrontmatter = existingFrontmatter;

    for (const [key, value] of Object.entries(frontmatterUpdates)) {
      const lineRegex = new RegExp(`^${key}:.*$`, 'm');
      const lineMatch = updatedFrontmatter.match(lineRegex);

      if (lineMatch) {
        // Update existing line
        updatedFrontmatter = updatedFrontmatter.replace(
          lineRegex,
          `${key}: ${value}`
        );
      } else {
        // Add new line
        updatedFrontmatter += `\n${key}: ${value}`;
      }
    }

    return content.replace(frontmatterRegex, `---\n${updatedFrontmatter}\n---\n`);
  } else {
    // No frontmatter, create it
    const frontmatterLines = Object.entries(frontmatterUpdates)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return `---\n${frontmatterLines}\n---\n${content}`;
  }
}

/**
 * Check if a note has enchant mode enabled
 */
export function isEnchantEnabled(app: App, file: TFile): boolean {
  const fm = getEnchantmentFrontmatter(app, file);
  return fm.enabled === true;
}
