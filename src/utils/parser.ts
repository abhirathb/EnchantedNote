import { EnchantmentBlock } from '../types';

// Regex patterns for escape sequences
const INLINE_MUSE_PATTERN = /::muse\[(.*?)\]::/g;
const INLINE_WHISPER_PATTERN = /::whisper\[(.*?)\]::/g;
const MULTILINE_MUSE_PATTERN = /:::muse\n([\s\S]*?)\n:::/g;
const MULTILINE_WHISPER_PATTERN = /:::whisper\n([\s\S]*?)\n:::/g;

/**
 * Parse all enchantment blocks from a document
 */
export function parseEnchantments(content: string): EnchantmentBlock[] {
  const blocks: EnchantmentBlock[] = [];

  // Parse inline muse blocks
  let match: RegExpExecArray | null;

  // Reset regex state
  INLINE_MUSE_PATTERN.lastIndex = 0;
  while ((match = INLINE_MUSE_PATTERN.exec(content)) !== null) {
    blocks.push({
      type: 'muse',
      content: match[1],
      isMultiline: false,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Parse inline whisper blocks
  INLINE_WHISPER_PATTERN.lastIndex = 0;
  while ((match = INLINE_WHISPER_PATTERN.exec(content)) !== null) {
    blocks.push({
      type: 'whisper',
      content: match[1],
      isMultiline: false,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Parse multiline muse blocks
  MULTILINE_MUSE_PATTERN.lastIndex = 0;
  while ((match = MULTILINE_MUSE_PATTERN.exec(content)) !== null) {
    blocks.push({
      type: 'muse',
      content: match[1],
      isMultiline: true,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Parse multiline whisper blocks
  MULTILINE_WHISPER_PATTERN.lastIndex = 0;
  while ((match = MULTILINE_WHISPER_PATTERN.exec(content)) !== null) {
    blocks.push({
      type: 'whisper',
      content: match[1],
      isMultiline: true,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Sort by position in document
  blocks.sort((a, b) => a.start - b.start);

  return blocks;
}

/**
 * Create an inline muse block string
 */
export function createMuseBlock(content: string, multiline: boolean = false): string {
  if (multiline || content.includes('\n')) {
    return `:::muse\n${content}\n:::`;
  }
  return `::muse[${content}]::`;
}

/**
 * Create an inline whisper block string
 */
export function createWhisperBlock(content: string, multiline: boolean = false): string {
  if (multiline || content.includes('\n')) {
    return `:::whisper\n${content}\n:::`;
  }
  return `::whisper[${content}]::`;
}

/**
 * Remove all enchantment blocks from content
 */
export function removeAllEnchantments(content: string): string {
  let result = content;

  // Remove multiline blocks first (they may contain patterns that look like inline)
  result = result.replace(MULTILINE_MUSE_PATTERN, '');
  result = result.replace(MULTILINE_WHISPER_PATTERN, '');

  // Remove inline blocks
  result = result.replace(INLINE_MUSE_PATTERN, '');
  result = result.replace(INLINE_WHISPER_PATTERN, '');

  // Clean up any resulting double newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Check if a position is inside an enchantment block
 */
export function isInsideEnchantment(content: string, position: number): boolean {
  const blocks = parseEnchantments(content);
  return blocks.some(block => position >= block.start && position <= block.end);
}

/**
 * Get the content without enchantment blocks (for sending to Claude)
 */
export function getCleanContent(content: string): string {
  return removeAllEnchantments(content).trim();
}
