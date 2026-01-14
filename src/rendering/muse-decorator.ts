import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Regex patterns for muse blocks
const INLINE_MUSE_PATTERN = /::muse\[(.*?)\]::/g;
const MULTILINE_MUSE_START = /^:::muse\s*$/gm;
const MULTILINE_MUSE_END = /^:::$/gm;

// Stowed state management
let stowedBlocks: Set<number> = new Set();

/**
 * Widget for rendering muse content
 */
class MuseContentWidget extends WidgetType {
  constructor(
    readonly content: string,
    readonly isMultiline: boolean,
    readonly onDismiss: () => void
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = this.isMultiline ? 'enchanted-muse-block' : 'enchanted-muse';

    const content = document.createElement('span');
    content.className = 'enchanted-muse-content';
    content.textContent = this.content;
    wrapper.appendChild(content);

    const dismissBtn = document.createElement('button');
    dismissBtn.className = this.isMultiline ? 'enchanted-muse-block-dismiss' : 'enchanted-muse-dismiss';
    dismissBtn.textContent = '×';
    dismissBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onDismiss();
    };
    wrapper.appendChild(dismissBtn);

    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Widget for stowed/collapsed muse block
 */
class StowedMuseWidget extends WidgetType {
  constructor(readonly onReveal: () => void) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'enchanted-stowed';
    wrapper.title = 'Click to reveal enchantment';
    wrapper.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onReveal();
    };
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Widget for streaming muse response
 */
class StreamingMuseWidget extends WidgetType {
  private element: HTMLElement | null = null;

  constructor(private content: string = '') {
    super();
  }

  updateContent(newContent: string): void {
    this.content = newContent;
    if (this.element) {
      const contentEl = this.element.querySelector('.enchanted-muse-content');
      if (contentEl) {
        contentEl.textContent = this.content;
      }
    }
  }

  toDOM(): HTMLElement {
    this.element = document.createElement('span');
    this.element.className = 'enchanted-muse enchanted-streaming';

    const content = document.createElement('span');
    content.className = 'enchanted-muse-content';
    content.textContent = this.content;
    this.element.appendChild(content);

    return this.element;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/**
 * Build decorations for muse blocks
 */
function buildDecorations(
  view: EditorView,
  showStowed: boolean = false
): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();

  // Find inline muse blocks
  INLINE_MUSE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_MUSE_PATTERN.exec(doc)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const content = match[1];

    if (stowedBlocks.has(start) && !showStowed) {
      // Show stowed widget
      builder.add(
        start,
        end,
        Decoration.replace({
          widget: new StowedMuseWidget(() => {
            stowedBlocks.delete(start);
            view.dispatch({ effects: [] }); // Trigger re-render
          }),
        })
      );
    } else {
      // Show full muse content
      builder.add(
        start,
        end,
        Decoration.replace({
          widget: new MuseContentWidget(content, false, () => {
            // Dismiss: remove the block from the document
            view.dispatch({
              changes: { from: start, to: end, insert: '' },
            });
          }),
        })
      );
    }
  }

  // Find multiline muse blocks
  const lines = doc.split('\n');
  let pos = 0;
  let inMuseBlock = false;
  let blockStart = 0;
  let blockContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = pos;
    const lineEnd = pos + line.length;

    if (!inMuseBlock && line.match(/^:::muse\s*$/)) {
      inMuseBlock = true;
      blockStart = lineStart;
      blockContent = '';
    } else if (inMuseBlock && line.match(/^:::$/)) {
      // End of block
      const blockEnd = lineEnd;

      if (stowedBlocks.has(blockStart) && !showStowed) {
        builder.add(
          blockStart,
          blockEnd,
          Decoration.replace({
            widget: new StowedMuseWidget(() => {
              stowedBlocks.delete(blockStart);
              view.dispatch({ effects: [] });
            }),
          })
        );
      } else {
        builder.add(
          blockStart,
          blockEnd,
          Decoration.replace({
            widget: new MuseContentWidget(blockContent.trim(), true, () => {
              view.dispatch({
                changes: { from: blockStart, to: blockEnd, insert: '' },
              });
            }),
          })
        );
      }

      inMuseBlock = false;
      blockContent = '';
    } else if (inMuseBlock) {
      blockContent += (blockContent ? '\n' : '') + line;
    }

    pos = lineEnd + 1; // +1 for newline
  }

  return builder.finish();
}

/**
 * Create the muse decorator extension
 */
export function createMuseDecorator() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

/**
 * Stow all muse blocks
 */
export function stowAllBlocks(view: EditorView): void {
  const doc = view.state.doc.toString();

  // Find all inline blocks
  INLINE_MUSE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_MUSE_PATTERN.exec(doc)) !== null) {
    stowedBlocks.add(match.index);
  }

  // Find all multiline blocks
  const lines = doc.split('\n');
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^:::muse\s*$/)) {
      stowedBlocks.add(pos);
    }
    pos += lines[i].length + 1;
  }

  // Trigger re-render
  view.dispatch({ effects: [] });
}

/**
 * Reveal all stowed blocks
 */
export function revealAllBlocks(view: EditorView): void {
  stowedBlocks.clear();
  view.dispatch({ effects: [] });
}

/**
 * Clear stowed state
 */
export function clearStowedState(): void {
  stowedBlocks.clear();
}

export { MuseContentWidget, StowedMuseWidget, StreamingMuseWidget };
