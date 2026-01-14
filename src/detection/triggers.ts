import { EditorView, ViewUpdate } from '@codemirror/view';

export type TriggerCallback = () => void;

/**
 * Manages pause and double-enter trigger detection for Muse mode
 */
export class TriggerManager {
  private pauseTimer: NodeJS.Timeout | null = null;
  private lastEnterTime: number = 0;
  private lastContent: string = '';
  private pauseDuration: number;
  private onPauseTrigger: TriggerCallback | null = null;
  private onDoubleEnterTrigger: TriggerCallback | null = null;
  private enabled: boolean = false;

  // Double-enter detection threshold (300ms)
  private static readonly DOUBLE_ENTER_THRESHOLD = 300;

  constructor(pauseDurationSeconds: number = 2) {
    this.pauseDuration = pauseDurationSeconds * 1000;
  }

  /**
   * Enable trigger detection
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disable trigger detection
   */
  disable(): void {
    this.enabled = false;
    this.clearPauseTimer();
  }

  /**
   * Check if triggers are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the pause duration in seconds
   */
  setPauseDuration(seconds: number): void {
    this.pauseDuration = seconds * 1000;
  }

  /**
   * Set the callback for pause trigger
   */
  onPause(callback: TriggerCallback): void {
    this.onPauseTrigger = callback;
  }

  /**
   * Set the callback for double-enter trigger
   */
  onDoubleEnter(callback: TriggerCallback): void {
    this.onDoubleEnterTrigger = callback;
  }

  /**
   * Handle document changes from CodeMirror
   */
  handleUpdate(update: ViewUpdate): boolean {
    if (!this.enabled || !update.docChanged) {
      return false;
    }

    const newContent = update.state.doc.toString();
    const contentChanged = newContent !== this.lastContent;

    if (!contentChanged) {
      return false;
    }

    // Check for double-enter
    if (this.checkDoubleEnter(update)) {
      return true;
    }

    // Reset pause timer on any change
    this.resetPauseTimer();

    this.lastContent = newContent;
    return false;
  }

  /**
   * Check if the update contains a double-enter
   */
  private checkDoubleEnter(update: ViewUpdate): boolean {
    // Look at each change in the transaction
    let hasNewline = false;

    update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      const insertedText = inserted.toString();
      if (insertedText === '\n' || insertedText === '\r\n') {
        hasNewline = true;
      }
    });

    if (!hasNewline) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastEnter = now - this.lastEnterTime;

    if (timeSinceLastEnter < TriggerManager.DOUBLE_ENTER_THRESHOLD) {
      // Double-enter detected!
      this.lastEnterTime = 0;
      this.clearPauseTimer();

      if (this.onDoubleEnterTrigger) {
        this.onDoubleEnterTrigger();
      }

      return true;
    }

    this.lastEnterTime = now;
    return false;
  }

  /**
   * Clear the pause timer
   */
  private clearPauseTimer(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  /**
   * Reset and start the pause timer
   */
  private resetPauseTimer(): void {
    this.clearPauseTimer();

    this.pauseTimer = setTimeout(() => {
      if (this.enabled && this.onPauseTrigger) {
        this.onPauseTrigger();
      }
    }, this.pauseDuration);
  }

  /**
   * Update the tracked content without triggering (for initial load)
   */
  setContent(content: string): void {
    this.lastContent = content;
  }

  /**
   * Check if content has changed since last trigger
   */
  hasNewContent(currentContent: string): boolean {
    return currentContent !== this.lastContent;
  }

  /**
   * Mark content as processed (after a response is generated)
   */
  markProcessed(content: string): void {
    this.lastContent = content;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearPauseTimer();
    this.onPauseTrigger = null;
    this.onDoubleEnterTrigger = null;
    this.enabled = false;
  }
}

/**
 * Whisper mode trigger manager - handles continuous background analysis
 */
export class WhisperTriggerManager {
  private analysisTimer: NodeJS.Timeout | null = null;
  private lastAnalyzedContent: string = '';
  private lastWhisperTime: number = 0;
  private onAnalyzeTrigger: TriggerCallback | null = null;
  private enabled: boolean = false;

  // Minimum time between whispers (30 seconds)
  private static readonly MIN_WHISPER_INTERVAL = 30000;

  // Analysis interval (check every 5 seconds)
  private static readonly ANALYSIS_INTERVAL = 5000;

  /**
   * Enable whisper triggers
   */
  enable(): void {
    this.enabled = true;
    this.startAnalysisLoop();
  }

  /**
   * Disable whisper triggers
   */
  disable(): void {
    this.enabled = false;
    this.stopAnalysisLoop();
  }

  /**
   * Check if whispers are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the callback for analysis trigger
   */
  onAnalyze(callback: TriggerCallback): void {
    this.onAnalyzeTrigger = callback;
  }

  /**
   * Start the background analysis loop
   */
  private startAnalysisLoop(): void {
    this.stopAnalysisLoop();

    this.analysisTimer = setInterval(() => {
      if (this.enabled && this.canWhisper() && this.onAnalyzeTrigger) {
        this.onAnalyzeTrigger();
      }
    }, WhisperTriggerManager.ANALYSIS_INTERVAL);
  }

  /**
   * Stop the analysis loop
   */
  private stopAnalysisLoop(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  }

  /**
   * Check if enough time has passed for a new whisper
   */
  private canWhisper(): boolean {
    return Date.now() - this.lastWhisperTime >= WhisperTriggerManager.MIN_WHISPER_INTERVAL;
  }

  /**
   * Check if content has changed enough for analysis
   */
  hasSignificantChange(currentContent: string): boolean {
    if (currentContent === this.lastAnalyzedContent) {
      return false;
    }

    // Check if there's meaningful new content (at least 50 characters difference)
    const lengthDiff = Math.abs(currentContent.length - this.lastAnalyzedContent.length);
    return lengthDiff >= 50;
  }

  /**
   * Mark content as analyzed
   */
  markAnalyzed(content: string): void {
    this.lastAnalyzedContent = content;
    this.lastWhisperTime = Date.now();
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAnalysisLoop();
    this.onAnalyzeTrigger = null;
    this.enabled = false;
  }
}
