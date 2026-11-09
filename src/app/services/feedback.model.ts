export const FEEDBACK_EVENTS = [
  'drum-click',
  'drum-whole-mil',
  'drum-turn',
  'drum-stop',
  'detent',
  'shot',
  'empty-chamber',
  'bolt-unlock',
  'bolt-slide',
  'bolt-eject',
  'bolt-feed',
  'bolt-lock',
  'magazine',
  'stamp',
  'radio',
  'button',
  'sheet',
] as const;

export type FeedbackEvent = (typeof FEEDBACK_EVENTS)[number];
export type HapticKind = 'selection' | 'light' | 'medium' | 'heavy' | 'warning';
export type SoundKind =
  | 'tick'
  | 'tick-strong'
  | 'stop'
  | 'shot'
  | 'empty-click'
  | 'bolt-unlock'
  | 'bolt-slide'
  | 'casing'
  | 'bolt-feed'
  | 'bolt-lock'
  | 'magazine'
  | 'stamp'
  | 'radio'
  | 'button'
  | 'sheet';

export interface FeedbackStep {
  haptic: HapticKind | null;
  sound: SoundKind;
}

export const FEEDBACK_PLAN: Record<FeedbackEvent, FeedbackStep> = {
  'drum-click': { haptic: 'selection', sound: 'tick' },
  'drum-whole-mil': { haptic: 'selection', sound: 'tick-strong' },
  'drum-turn': { haptic: 'light', sound: 'tick-strong' },
  'drum-stop': { haptic: 'medium', sound: 'stop' },
  detent: { haptic: 'selection', sound: 'tick' },
  shot: { haptic: 'heavy', sound: 'shot' },
  'empty-chamber': { haptic: 'warning', sound: 'empty-click' },
  'bolt-unlock': { haptic: 'light', sound: 'bolt-unlock' },
  'bolt-slide': { haptic: 'light', sound: 'bolt-slide' },
  'bolt-eject': { haptic: null, sound: 'casing' },
  'bolt-feed': { haptic: 'light', sound: 'bolt-feed' },
  'bolt-lock': { haptic: 'light', sound: 'bolt-lock' },
  magazine: { haptic: 'medium', sound: 'magazine' },
  stamp: { haptic: 'medium', sound: 'stamp' },
  radio: { haptic: 'warning', sound: 'radio' },
  button: { haptic: null, sound: 'button' },
  sheet: { haptic: null, sound: 'sheet' },
};

export const SELECTION_IDLE_MS = 300;

export interface SelectionAdapter {
  start(): void;
  changed(): void;
  end(): void;
}

// iOS (and Capacitor on the web) fires selectionChanged only inside selectionStart … selectionEnd.
export class SelectionHaptics {
  private isOpen = false;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly haptics: SelectionAdapter) {}

  tick(): void {
    if (!this.isOpen) {
      this.haptics.start();
      this.isOpen = true;
    }
    this.haptics.changed();
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
    }
    this.closeTimer = setTimeout(() => {
      this.haptics.end();
      this.isOpen = false;
      this.closeTimer = null;
    }, SELECTION_IDLE_MS);
  }
}
