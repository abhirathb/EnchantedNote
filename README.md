# Enchanted Notes

An Obsidian plugin where your notes come alive and talk back to you. A thinking partner and writing companion powered by Claude AI or local LLMs via Ollama.

**Warning: This is a vibecoded plugin with on-going manual review. Please report bugs and security issues**

## Features

- **Muse Mode**: Get inline AI responses that appear directly in your notes as you write
- **Whisper Mode**: Subtle hover annotations that offer insights without interrupting your flow
- **Smart Moods**: Three response personalities:
  - **Reflect** - For journaling and personal exploration
  - **Think** - For essays, ideas, and analytical writing
  - **Plan** - For todos, planning, and structured thinking
- **Context Awareness**: Automatically detects your writing context from frontmatter, folders, and content
- **Linked Notes**: Optionally includes context from linked notes for richer responses
- **Local LLM Support**: Use Ollama for completely private, offline AI assistance

## Installation

### From Obsidian Community Plugins

1. Open Settings → Community Plugins
2. Search for "Enchanted Notes"
3. Click Install, then Enable

### Manual Installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest release
2. Create a folder called `enchanted-notes` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into that folder
4. Enable the plugin in Settings → Community Plugins

## Configuration

### LLM Provider

Choose between:
- **Claude API**: Requires an API key from [Anthropic](https://console.anthropic.com/)
- **Ollama**: Free, local LLM - requires [Ollama](https://ollama.ai/) running on your machine

### Settings

| Setting | Description |
|---------|-------------|
| Provider | Choose Claude or Ollama |
| API Key | Your Claude API key (if using Claude) |
| Model | Select the AI model to use |
| Pause Duration | How long to wait before triggering Muse (2-10 seconds) |
| Default Style | Start with Muse or Whisper mode |
| Linked Notes | Include context from linked notes |

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` | Toggle Muse mode |
| `Ctrl+Shift+W` | Toggle Whisper mode |

### Triggering Responses

- **Pause**: Stop typing for a few seconds (configurable)
- **Double Enter**: Press Enter twice quickly
- **Command**: Use "Summon Muse" from the command palette

### Escape Sequences

Responses appear in your notes using special syntax:

```
::muse[This is an inline response]::

:::muse
This is a block response
that can span multiple lines
:::
```

## Commands

- **Toggle Muse** - Enable/disable inline responses
- **Toggle Whisper** - Enable/disable hover annotations
- **Summon Muse** - Manually trigger a response
- **Set Mood** - Change the response personality
- **Stow/Reveal Enchantments** - Collapse or expand responses
- **Banish Enchantments** - Remove all AI responses from the note
- **Clear Whispers** - Remove all whisper annotations

## Support

- [Report Issues](https://github.com/abhirathb/EnchantedNote/issues)
- [Contribute](https://github.com/abhirathb/EnchantedNote/blob/main/CONTRIBUTING.md)

## License

[MIT](LICENSE)
