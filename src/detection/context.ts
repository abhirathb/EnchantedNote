import { App, TFile } from 'obsidian';
import { Mood, InteractionStyle, EnchantedNotesSettings } from '../types';
import { getEnchantmentFrontmatter, inferMoodFromType } from '../utils/frontmatter';

/**
 * Detected context for a note
 */
export interface DetectedContext {
  mood: Mood;
  style: InteractionStyle;
  source: 'frontmatter' | 'folder' | 'content' | 'default';
}

/**
 * Folder patterns that suggest a mood
 */
const FOLDER_MOOD_PATTERNS: Record<string, Mood> = {
  journal: 'reflect',
  journals: 'reflect',
  diary: 'reflect',
  diaries: 'reflect',
  reflection: 'reflect',
  reflections: 'reflect',
  project: 'plan',
  projects: 'plan',
  todo: 'plan',
  todos: 'plan',
  task: 'plan',
  tasks: 'plan',
  planning: 'plan',
  essay: 'think',
  essays: 'think',
  writing: 'think',
  writings: 'think',
  idea: 'think',
  ideas: 'think',
  article: 'think',
  articles: 'think',
};

/**
 * Content patterns that suggest a mood (regex patterns)
 */
const CONTENT_PATTERNS: Array<{ pattern: RegExp; mood: Mood }> = [
  // Reflect patterns
  { pattern: /\bI feel\b/i, mood: 'reflect' },
  { pattern: /\bI felt\b/i, mood: 'reflect' },
  { pattern: /\bToday I\b/i, mood: 'reflect' },
  { pattern: /\bI'm feeling\b/i, mood: 'reflect' },
  { pattern: /\bI've been feeling\b/i, mood: 'reflect' },
  { pattern: /\bI noticed\b/i, mood: 'reflect' },
  { pattern: /\bI'm grateful\b/i, mood: 'reflect' },
  { pattern: /\bI'm struggling\b/i, mood: 'reflect' },

  // Plan patterns (checkboxes)
  { pattern: /^- \[ \]/m, mood: 'plan' },
  { pattern: /^- \[x\]/im, mood: 'plan' },
  { pattern: /\bTODO\b/i, mood: 'plan' },
  { pattern: /\bnext steps\b/i, mood: 'plan' },
  { pattern: /\baction items\b/i, mood: 'plan' },
  { pattern: /\bdeadline\b/i, mood: 'plan' },

  // Think patterns
  { pattern: /\bthe argument is\b/i, mood: 'think' },
  { pattern: /\bmy thesis\b/i, mood: 'think' },
  { pattern: /\bI argue\b/i, mood: 'think' },
  { pattern: /\bI believe\b/i, mood: 'think' },
  { pattern: /\bthe evidence\b/i, mood: 'think' },
  { pattern: /\bthe reason\b/i, mood: 'think' },
  { pattern: /\bin conclusion\b/i, mood: 'think' },
  { pattern: /\bfurthermore\b/i, mood: 'think' },
  { pattern: /\bhowever\b/i, mood: 'think' },
];

/**
 * Detect mood from folder path
 */
function detectMoodFromFolder(filePath: string): Mood | null {
  const pathParts = filePath.toLowerCase().split('/');

  for (const part of pathParts) {
    if (FOLDER_MOOD_PATTERNS[part]) {
      return FOLDER_MOOD_PATTERNS[part];
    }
  }

  return null;
}

/**
 * Detect mood from content patterns
 */
function detectMoodFromContent(content: string): Mood | null {
  const moodCounts: Record<Mood, number> = {
    reflect: 0,
    think: 0,
    plan: 0,
  };

  for (const { pattern, mood } of CONTENT_PATTERNS) {
    const matches = content.match(new RegExp(pattern, 'g'));
    if (matches) {
      moodCounts[mood] += matches.length;
    }
  }

  // Find the mood with the most matches
  let maxMood: Mood | null = null;
  let maxCount = 0;

  for (const [mood, count] of Object.entries(moodCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxMood = mood as Mood;
    }
  }

  // Only return if we have meaningful matches (at least 2)
  return maxCount >= 2 ? maxMood : null;
}

/**
 * Detect the context for a note
 *
 * Priority stack (highest to lowest):
 * 1. Explicit frontmatter: enchant-mood
 * 2. Frontmatter type tag: type: journal → reflect
 * 3. Folder conventions: /journal/ → reflect
 * 4. Content inference: "I feel..." → reflect
 * 5. Default settings
 */
export function detectContext(
  app: App,
  file: TFile,
  content: string,
  settings: EnchantedNotesSettings
): DetectedContext {
  // 1. Check explicit frontmatter
  const frontmatter = getEnchantmentFrontmatter(app, file);

  if (frontmatter.mood) {
    return {
      mood: frontmatter.mood,
      style: frontmatter.style || (settings.defaultStyle === 'off' ? 'muse' : settings.defaultStyle),
      source: 'frontmatter',
    };
  }

  // 2. Check frontmatter type tag
  if (frontmatter.type) {
    const inferredMood = inferMoodFromType(frontmatter.type);
    if (inferredMood) {
      return {
        mood: inferredMood,
        style: frontmatter.style || (settings.defaultStyle === 'off' ? 'muse' : settings.defaultStyle),
        source: 'frontmatter',
      };
    }
  }

  // 3. Check folder conventions
  const folderMood = detectMoodFromFolder(file.path);
  if (folderMood) {
    return {
      mood: folderMood,
      style: frontmatter.style || (settings.defaultStyle === 'off' ? 'muse' : settings.defaultStyle),
      source: 'folder',
    };
  }

  // 4. Content inference
  const contentMood = detectMoodFromContent(content);
  if (contentMood) {
    return {
      mood: contentMood,
      style: frontmatter.style || (settings.defaultStyle === 'off' ? 'muse' : settings.defaultStyle),
      source: 'content',
    };
  }

  // 5. Default settings
  return {
    mood: settings.defaultMood === 'auto' ? 'reflect' : settings.defaultMood,
    style: settings.defaultStyle === 'off' ? 'muse' : settings.defaultStyle,
    source: 'default',
  };
}

/**
 * Get linked notes content for context
 */
export async function getLinkedNotesContent(
  app: App,
  file: TFile,
  depth: number,
  visited: Set<string> = new Set()
): Promise<string[]> {
  const linkedContent: string[] = [];

  if (depth <= 0 || visited.has(file.path)) {
    return linkedContent;
  }

  visited.add(file.path);

  const cache = app.metadataCache.getFileCache(file);
  if (!cache?.links) {
    return linkedContent;
  }

  for (const link of cache.links) {
    const linkedFile = app.metadataCache.getFirstLinkpathDest(
      link.link,
      file.path
    );

    if (linkedFile && linkedFile instanceof TFile && !visited.has(linkedFile.path)) {
      try {
        const content = await app.vault.read(linkedFile);
        linkedContent.push(`--- ${linkedFile.basename} ---\n${content}`);

        // Recursively get linked notes if depth allows
        if (depth > 1) {
          const nestedContent = await getLinkedNotesContent(
            app,
            linkedFile,
            depth - 1,
            visited
          );
          linkedContent.push(...nestedContent);
        }
      } catch (e) {
        // File couldn't be read, skip it
        console.warn(`Couldn't read linked file: ${linkedFile.path}`);
      }
    }
  }

  return linkedContent;
}
