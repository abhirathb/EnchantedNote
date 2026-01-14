# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Enchanted Notes** is an Obsidian plugin that makes notes come alive and talk back to the user. It acts as a thinking partner and writing companion powered by Claude AI, adapting to what the user is doing—journaling, essay writing, planning—and responding in the appropriate tone and style.

## Build Commands

```bash
# Install dependencies
npm install

# Development mode (watch for changes)
npm run dev

# Production build
npm run build
```

## Project Architecture

```
src/
├── main.ts                 # Plugin entry point
├── settings.ts             # Settings tab and management
├── commands.ts             # All command definitions
├── types.ts                # Shared TypeScript types
├── modes/
│   ├── muse.ts            # Muse mode logic (inline responses)
│   └── whisper.ts         # Whisper mode logic (margin annotations)
├── moods/
│   ├── index.ts           # Mood exports and helpers
│   ├── reflect.ts         # Reflect mood prompts (journaling)
│   ├── think.ts           # Think mood prompts (essays/ideas)
│   └── plan.ts            # Plan mood prompts (todos/planning)
├── detection/
│   ├── context.ts         # Context detection (folder, frontmatter, content)
│   └── triggers.ts        # Pause and double-enter trigger detection
├── rendering/
│   ├── muse-decorator.ts  # CodeMirror decorator for muse blocks
│   ├── whisper-gutter.ts  # Gutter/margin rendering for whispers
│   └── styles.css         # All enchantment styling
├── api/
│   └── claude.ts          # Claude API integration with streaming
└── utils/
    ├── parser.ts          # Parse ::muse[] and :::muse blocks
    └── frontmatter.ts     # Frontmatter reading utilities
```

## Key Concepts

### Interaction Styles (how Claude responds)
- **Muse mode**: Inline responses that appear directly in the note. Triggers on pause (2 seconds default) or double-enter (instant trigger).
- **Whisper mode**: Margin annotations that appear in the gutter. Continuous background analysis.

### Moods (what Claude says)
- **reflect**: For journaling. Explores feelings, asks about emotions, encourages introspection.
- **think**: For essays and ideas. Challenges assumptions, suggests angles, finds holes in arguments.
- **plan**: For todos and planning. Clarifies next actions, spots missing steps, suggests priorities.

### Escape Sequence Syntax
Claude's responses are stored directly in notes using custom markdown-like syntax:

```markdown
# Inline
::muse[What if you explored why this matters to you?]::
::whisper[You made this point in paragraph 2]::

# Multi-line
:::muse
This is a longer thought from Claude.
It could span multiple lines.
:::
```

## Context Detection Priority

1. Explicit frontmatter: `enchant-mood: reflect`
2. Frontmatter type tag: `type: journal` → reflect
3. Folder conventions: `/journal/` → reflect, `/projects/` → plan
4. Content inference: "I feel..." → reflect, checkboxes → plan

## Available Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Toggle Muse | Cmd/Ctrl+Shift+M | Enable/disable Muse mode |
| Toggle Whisper | Cmd/Ctrl+Shift+W | Enable/disable Whisper mode |
| Stow Enchantments | - | Collapse all muse blocks |
| Reveal Enchantments | - | Expand all stowed blocks |
| Banish Enchantments | - | Remove all enchantment blocks |
| Set Mood | - | Quick-switch mood for session |
| Summon Muse | - | Manually trigger a Muse response |

## Development Notes

- Uses CodeMirror 6 for editor integration
- Claude API calls use streaming for Muse responses
- Triggers use debouncing for pause detection
- API key is stored using Obsidian's local storage

## Testing

To test the plugin:
1. Build with `npm run build`
2. Copy `main.js`, `styles.css`, and `manifest.json` to your vault's `.obsidian/plugins/enchanted-notes/` folder
3. Enable the plugin in Obsidian settings
4. Configure your Claude API key in plugin settings
