import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  gutter,
  GutterMarker,
} from '@codemirror/view';
import { RangeSetBuilder, StateField, StateEffect, Extension } from '@codemirror/state';

// Regex pattern for whisper blocks
const INLINE_WHISPER_PATTERN = /::whisper\[(.*?)\]::/g;

/**
 * Effect to add a whisper to the gutter
 */
export const addWhisperEffect = StateEffect.define<{
  line: number;
  content: string;
}>();

/**
 * Effect to remove a whisper from the gutter
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
          const oldLine = tr.startState.doc.line(Math.min(w.line, tr.startState.doc.lines));
          const newPos = tr.changes.mapPos(oldLine.from);
          try {
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
 * Gutter marker for whisper indicator
 */
class WhisperGutterMarker extends GutterMarker {
  constructor(readonly content: string) {
    super();
  }

  toDOM(): HTMLElement {
    const marker = document.createElement('div');
    marker.className = 'cm-enchanted-whisper-marker';
    marker.title = this.content;

    // Add click handler to show/hide tooltip
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showTooltip(marker);
    });

    return marker;
  }

  private showTooltip(marker: HTMLElement): void {
    // Check if tooltip already exists
    const existingTooltip = document.querySelector('.enchanted-whisper-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
      return;
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'enchanted-whisper-tooltip';
    tooltip.textContent = this.content;

    // Position tooltip near the marker
    const rect = marker.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    tooltip.style.top = `${rect.top}px`;
    tooltip.style.left = `${rect.right + 10}px`;

    document.body.appendChild(tooltip);

    // Remove tooltip when clicking elsewhere
    const removeTooltip = () => {
      tooltip.remove();
      document.removeEventListener('click', removeTooltip);
    };

    setTimeout(() => {
      document.addEventListener('click', removeTooltip);
    }, 0);
  }
}

/**
 * Create the whisper gutter extension
 */
export function createWhisperGutter(): Extension {
  return [
    whisperState,
    gutter({
      class: 'enchanted-whisper-gutter',
      markers: (view) => {
        const whispers = view.state.field(whisperState);
        const builder = new RangeSetBuilder<GutterMarker>();

        for (const whisper of whispers) {
          try {
            const line = view.state.doc.line(whisper.line);
            builder.add(line.from, line.from, new WhisperGutterMarker(whisper.content));
          } catch {
            // Line doesn't exist anymore, skip
          }
        }

        return builder.finish();
      },
      initialSpacer: () => new WhisperGutterMarker(''),
    }),
  ];
}

/**
 * Widget for inline whisper decoration
 */
class WhisperInlineWidget extends WidgetType {
  constructor(
    readonly content: string,
    readonly onDismiss: () => void
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('span');
    wrapper.className = 'enchanted-whisper-inline';
    wrapper.textContent = this.content;
    wrapper.onclick = () => this.onDismiss();
    wrapper.title = 'Click to dismiss';
    return wrapper;
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

  return builder.finish();
}

/**
 * Create the whisper inline decorator extension
 */
export function createWhisperDecorator() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildWhisperDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildWhisperDecorations(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

/**
 * Add a whisper to the gutter at a specific line
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
  return view.state.field(whisperState);
}
