import { inject, Injectable } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { FEEDBACK_PLAN, FeedbackEvent, HapticKind, SelectionHaptics, SoundKind, soundOf } from './feedback.model';
import { ProgressStore } from './progress.store';

export type { FeedbackEvent } from './feedback.model';

const IMPACT_STYLES: Partial<Record<HapticKind, ImpactStyle>> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

function quietly(action: () => Promise<void>): void {
  action().catch(() => undefined);
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly progress = inject(ProgressStore);
  private audioContext: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  // Start, changed and end must reach the plugin in order: the web plugin loads lazily and would see "changed" before "start".
  private selectionQueue: Promise<void> = Promise.resolve();
  private readonly selection = new SelectionHaptics({
    start: () => this.queueSelection(() => Haptics.selectionStart()),
    changed: () => this.queueSelection(() => Haptics.selectionChanged()),
    end: () => this.queueSelection(() => Haptics.selectionEnd()),
  });

  emit(event: FeedbackEvent): void {
    const step = FEEDBACK_PLAN[event];
    if (step.haptic) {
      this.vibrate(step.haptic);
    }
    const sound = soundOf(event, this.progress.settings());
    if (sound) {
      this.sound(sound);
    }
  }

  scheduleImpact(isHit: boolean, delayS: number): void {
    const context = this.context();
    if (!context) {
      return;
    }
    const startS = context.currentTime + delayS;
    if (isHit) {
      this.ring(context, startS);
    } else {
      this.noiseBurst(context, startS, 0.22, 400, 0.35);
    }
  }

  private queueSelection(action: () => Promise<void>): void {
    this.selectionQueue = this.selectionQueue.then(action).catch(() => undefined);
  }

  private vibrate(haptic: HapticKind): void {
    if (!this.progress.settings().isHapticsOn) {
      return;
    }
    if (haptic === 'selection') {
      this.selection.tick();
      return;
    }
    if (haptic === 'warning') {
      quietly(() => Haptics.notification({ type: NotificationType.Warning }));
      return;
    }
    quietly(() => Haptics.impact({ style: IMPACT_STYLES[haptic]! }));
  }

  private sound(sound: SoundKind): void {
    const context = this.context();
    if (!context) {
      return;
    }
    const nowS = context.currentTime;
    switch (sound) {
      case 'shot':
        this.noiseBurst(context, nowS, 0.45, 5000, 0.9);
        this.tone(context, nowS, 110, 40, 0.3, 'sine', 0.8);
        this.noiseBurst(context, nowS + 0.35, 1.1, 700, 0.18);
        this.noiseBurst(context, nowS + 0.9, 1.4, 450, 0.1);
        return;
      case 'tick':
        this.tone(context, nowS, 2200, 2200, 0.025, 'square', 0.06);
        return;
      case 'tick-strong':
        this.tone(context, nowS, 2200, 2200, 0.025, 'square', 0.1);
        return;
      case 'stop':
        this.noiseBurst(context, nowS, 0.08, 600, 0.4);
        return;
      case 'empty-click':
        this.noiseBurst(context, nowS, 0.03, 2400, 0.3);
        this.tone(context, nowS, 900, 600, 0.03, 'square', 0.08);
        return;
      case 'bolt-unlock':
        this.noiseBurst(context, nowS, 0.05, 2600, 0.4);
        this.tone(context, nowS, 180, 90, 0.06, 'square', 0.2);
        return;
      case 'bolt-slide':
        this.noiseBurst(context, nowS, 0.08, 1200, 0.15);
        return;
      case 'casing':
        this.tone(context, nowS, 3400, 3000, 0.25, 'sine', 0.12);
        return;
      case 'bolt-feed':
        this.noiseBurst(context, nowS, 0.08, 700, 0.35);
        this.tone(context, nowS, 260, 200, 0.1, 'triangle', 0.25);
        return;
      case 'bolt-lock':
        this.noiseBurst(context, nowS, 0.08, 1200, 0.4);
        this.tone(context, nowS, 90, 50, 0.12, 'sine', 0.5);
        return;
      case 'magazine':
        this.noiseBurst(context, nowS, 0.1, 900, 0.4);
        return;
      case 'stamp':
        this.noiseBurst(context, nowS, 0.12, 450, 0.6);
        return;
      case 'radio':
        this.noiseBurst(context, nowS, 0.15, 3000, 0.2);
        this.tone(context, nowS + 0.15, 1800, 1800, 0.09, 'square', 0.08);
        return;
      case 'button':
        this.noiseBurst(context, nowS, 0.015, 3200, 0.22);
        return;
      case 'sheet':
        this.noiseBurst(context, nowS, 0.04, 1800, 0.3);
        return;
    }
  }

  private context(): AudioContext | null {
    if (this.progress.settings().volume === 0 || typeof AudioContext === 'undefined') {
      return null;
    }
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private output(context: AudioContext): GainNode {
    if (!this.masterVolume) {
      this.masterVolume = context.createGain();
      this.masterVolume.connect(context.destination);
    }
    this.masterVolume.gain.value = this.progress.settings().volume;
    return this.masterVolume;
  }

  private tone(context: AudioContext, startS: number, fromHz: number, toHz: number, durationS: number, type: OscillatorType, gain: number): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromHz, startS);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), startS + durationS);
    envelope.gain.setValueAtTime(gain, startS);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startS + durationS);
    oscillator.connect(envelope).connect(this.output(context));
    oscillator.start(startS);
    oscillator.stop(startS + durationS + 0.02);
  }

  private noiseBurst(context: AudioContext, startS: number, durationS: number, cutoffHz: number, gain: number): void {
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * durationS)), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = cutoffHz;
    envelope.gain.setValueAtTime(gain, startS);
    envelope.gain.exponentialRampToValueAtTime(0.001, startS + durationS);
    source.connect(filter).connect(envelope).connect(this.output(context));
    source.start(startS);
  }

  private ring(context: AudioContext, startS: number): void {
    for (const [frequencyHz, weight] of [
      [880, 1],
      [1330, 0.6],
      [2150, 0.4],
      [3170, 0.25],
    ]) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.frequency.value = frequencyHz;
      envelope.gain.setValueAtTime(0.0001, startS);
      envelope.gain.exponentialRampToValueAtTime(0.25 * weight, startS + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startS + 1.6);
      oscillator.connect(envelope).connect(this.output(context));
      oscillator.start(startS);
      oscillator.stop(startS + 1.7);
    }
  }
}
