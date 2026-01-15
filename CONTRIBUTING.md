# Contributing to Enchanted Notes

Thank you for your interest in contributing to Enchanted Notes! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/enchanted-notes.git`
3. Install dependencies: `npm install`
4. Start development: `npm run dev`

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Obsidian (for testing)

### Building

```bash
# Development build (with watch mode)
npm run dev

# Production build
npm run build
```

### Testing in Obsidian

1. Build the plugin with `npm run build`
2. Copy `main.js`, `styles.css`, and `manifest.json` to your Obsidian vault's `.obsidian/plugins/enchanted-notes/` directory
3. Enable the plugin in Obsidian settings

## Pull Request Process

1. Create a new branch for your feature or fix
2. Make your changes following the code style of the project
3. Test your changes thoroughly in Obsidian
4. Update documentation if needed
5. Submit a pull request with a clear description of changes

## Code Style

- Use TypeScript for all source files
- Follow existing code patterns and naming conventions
- Add comments for complex logic
- Use meaningful variable and function names

## Reporting Issues

When reporting issues, please include:

- Obsidian version
- Plugin version
- Steps to reproduce the issue
- Expected vs actual behavior
- Any error messages from the console

## License

By contributing to Enchanted Notes, you agree that your contributions will be licensed under the MIT License.
