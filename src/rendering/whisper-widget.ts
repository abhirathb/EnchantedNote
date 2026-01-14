import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder, StateField, StateEffect, Extension } from '@codemirror/state';

// Regex pattern for whisper blocks
const INLINE_WHISPER_PATTERN = /::whisper\[(.*?)\]::/g;

/**
 * Effect to add a whisper to a line
 */
export const addWhisperEffect = StateEffect.define<{
  line: number;
  content: string;
}>();

/**
 * Effect to remove a whisper from a line
 */
export const removeWhisperEffect = StateEffect.define<number>();

/**
 * Effect to clear all whispers
 */
export const clearWhispersEffect = StateEffect.define<void>();

/**
 * Whisper data stored in state
 */
interface WhisperData {
  line: number;
  content: string;
}

/**
 * State field to track whispers
 */
export const whisperState = StateField.define<WhisperData[]>({
  create() {
    return [];
  },
  update(whispers, tr) {
    let newWhispers = whispers;

    for (const effect of tr.effects) {
      if (effect.is(addWhisperEffect)) {
        // Add new whisper, replacing any existing whisper on that line
        newWhispers = newWhispers.filter((w) => w.line !== effect.value.line);
        newWhispers = [...newWhispers, effect.value];
      } else if (effect.is(removeWhisperEffect)) {
        newWhispers = newWhispers.filter((w) => w.line !== effect.value);
      } else if (effect.is(clearWhispersEffect)) {
        newWhispers = [];
      }
    }

    // Adjust line numbers if document changed
    if (tr.docChanged) {
      newWhispers = newWhispers
        .map((w) => {
          try {
            const oldLine = tr.startState.doc.line(
              Math.min(w.line, tr.startState.doc.lines)
            );
            const newPos = tr.changes.mapPos(oldLine.from);
            const newLine = tr.state.doc.lineAt(newPos);
            return { ...w, line: newLine.number };
          } catch {
            return null;
          }
        })
        .filter((w): w is WhisperData => w !== null);
    }

    return newWhispers;
  },
});

/**
 * Active popover element (only one can be active at a time)
 */
let activePopover: HTMLElement | null = null;

/**
 * Close any active popover
 */
function closePopover(): void {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

/**
 * Widget for whisper icon that shows popover on hover/tap
 */
class WhisperIconWidget extends WidgetType {
  constructor(readonly content: string) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const icon = document.createElement('span');
    icon.className = 'enchanted-whisper-icon';
    icon.textContent = '✨';
    icon.setAttribute('aria-label', 'Whisper annotation');
    icon.setAttribute('role', 'button');

    // Desktop: show on hover
    icon.addEventListener('mouseenter', (e) => {
      this.showPopover(icon, view);
    });

    icon.addEventListener('mouseleave', (e) => {
      // Delay closing to allow moving to popover
      setTimeout(() => {
        if (activePopover && !activePopover.matches(':hover')) {
          closePopover();
        }
      }, 100);
    });

    // Mobile: show on tap
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (activePopover) {
        closePopover();
      } else {
        this.showPopover(icon, view);
      }
    });

    return icon;
  }

  private showPopover(icon: HTMLElement, view: EditorView): void {
    closePopover();

    const popover = document.createElement('div');
    popover.className = 'enchanted-whisper-popover';
    popover.textContent = this.content;

    // Position popover relative to icon
    const rect = icon.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.left = `${rect.left}px`;

    // Keep popover open when hovering over it
    popover.addEventListener('mouseenter', () => {
      // Cancel any pending close
    });

    popover.addEventListener('mouseleave', () => {
      closePopover();
    });

    document.body.appendChild(popover);
    activePopover = popover;

    // Adjust position if off-screen
    const popoverRect = popover.getBoundingClientRect();
    if (popoverRect.right > window.innerWidth) {
      popover.style.left = `${window.innerWidth - popoverRect.width - 10}px`;
    }
    if (popoverRect.bottom > window.innerHeight) {
      popover.style.top = `${rect.top - popoverRect.height - 4}px`;
    }
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Widget for inline whisper that replaces the ::whisper[...]:: syntax
 */
class WhisperInlineWidget extends WidgetType {
  constructor(
    readonly content: string,
    readonly onDismiss: () => void
  ) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'enchanted-whisper-inline-widget';

    const icon = document.createElement('span');
    icon.className = 'enchanted-whisper-icon';
    icon.textContent = '✨';

    // Desktop: show on hover
    icon.addEventListener('mouseenter', () => {
      this.showPopover(icon);
    });

    icon.addEventListener('mouseleave', () => {
      setTimeout(() => {
        if (activePopover && !activePopover.matches(':hover')) {
          closePopover();
        }
      }, 100);
    });

    // Mobile: show on tap, double-tap to dismiss
    let lastTap = 0;
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastTap < 300) {
        // Double tap - dismiss
        this.onDismiss();
      } else {
        // Single tap - toggle popover
        if (activePopover) {
          closePopover();
        } else {
          this.showPopover(icon);
        }
      }
      lastTap = now;
    });

    wrapper.appendChild(icon);
    return wrapper;
  }

  private showPopover(icon: HTMLElement): void {
    closePopover();

    const popover = document.createElement('div');
    popover.className = 'enchanted-whisper-popover';
    popover.textContent = this.content;

    const rect = icon.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.left = `${rect.left}px`;

    popover.addEventListener('mouseleave', () => {
      closePopover();
    });

    document.body.appendChild(popover);
    activePopover = popover;

    // Adjust position if off-screen
    const popoverRect = popover.getBoundingClientRect();
    if (popoverRect.right > window.innerWidth) {
      popover.style.left = `${window.innerWidth - popoverRect.width - 10}px`;
    }
    if (popoverRect.bottom > window.innerHeight) {
      popover.style.top = `${rect.top - popoverRect.height - 4}px`;
    }
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Build decorations for inline whisper blocks in the document
 */
function buildWhisperDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();

  INLINE_WHISPER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_WHISPER_PATTERN.exec(doc)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const content = match[1];

    builder.add(
      start,
      end,
      Decoration.replace({
        widget: new WhisperInlineWidget(content, () => {
          view.dispatch({
            changes: { from: start, to: end, insert: '' },
          });
        }),
      })
    );
  }

  // Also add icons for whispers in state (added programmatically)
  const whispers = view.state.field(whisperState, false);
  if (whispers) {
    for (const whisper of whispers) {
      try {
        const line = view.state.doc.line(whisper.line);
        // Add icon at the start of the line
        builder.add(
          line.from,
          line.from,
          Decoration.widget({
            widget: new WhisperIconWidget(whisper.content),
            side: -1, // Before content
          })
        );
      } catch {
        // Line doesn't exist, skip
      }
    }
  }

  return builder.finish();
}

/**
 * Create the whisper widget extension
 */
export function createWhisperWidget(): Extension {
  return [
    whisperState,
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = buildWhisperDecorations(view);
        }

        update(update: ViewUpdate) {
          if (
            update.docChanged ||
            update.viewportChanged ||
            update.transactions.some((tr) =>
              tr.effects.some(
                (e) =>
                  e.is(addWhisperEffect) ||
                  e.is(removeWhisperEffect) ||
                  e.is(clearWhispersEffect)
              )
            )
          ) {
            this.decorations = buildWhisperDecorations(update.view);
          }
        }
      },
      {
        decorations: (v) => v.decorations,
      }
    ),
  ];
}

/**
 * Add a whisper to a specific line
 */
export function addWhisper(view: EditorView, line: number, content: string): void {
  view.dispatch({
    effects: addWhisperEffect.of({ line, content }),
  });
}

/**
 * Remove a whisper from a specific line
 */
export function removeWhisper(view: EditorView, line: number): void {
  view.dispatch({
    effects: removeWhisperEffect.of(line),
  });
}

/**
 * Clear all whispers
 */
export function clearAllWhispers(view: EditorView): void {
  view.dispatch({
    effects: clearWhispersEffect.of(),
  });
}

/**
 * Get current whispers
 */
export function getWhispers(view: EditorView): WhisperData[] {
  return view.state.field(whisperState, false) || [];
}

// Close popover when clicking elsewhere
document.addEventListener('click', (e) => {
  if (
    activePopover &&
    !activePopover.contains(e.target as Node) &&
    !(e.target as HTMLElement).classList.contains('enchanted-whisper-icon')
  ) {
    closePopover();
  }
});
