import { inject, Injectable } from '@angular/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { ProgressStore } from './progress.store';

export type FeedbackEvent =
  | 'drum-click'
  | 'drum-whole-mil'
  | 'drum-turn'
  | 'drum-stop'
  | 'gauge-read'
  | 'shot'
  | 'hit'
  | 'empty-chamber'
  | 'bolt-unlock'
  | 'bolt-slide'
  | 'bolt-eject'
  | 'bolt-feed'
  | 'bolt-lock'
  | 'magazine';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly progress = inject(ProgressStore);
  private audioContext: AudioContext | null = null;

  emit(event: FeedbackEvent): void {
    this.vibrate(event);
    this.sound(event);
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

  private vibrate(event: FeedbackEvent): void {
    if (!this.progress.settings().isHapticsOn) {
      return;
    }
    const run = async (): Promise<void> => {
      switch (event) {
        case 'drum-click':
        case 'bolt-unlock':
        case 'bolt-slide':
          return Haptics.impact({ style: ImpactStyle.Light });
        case 'drum-whole-mil':
        case 'gauge-read':
        case 'bolt-feed':
        case 'hit':
          return Haptics.impact({ style: ImpactStyle.Medium });
        case 'drum-turn':
          await Haptics.impact({ style: ImpactStyle.Medium });
          return Haptics.impact({ style: ImpactStyle.Medium });
        case 'bolt-eject':
          return Haptics.vibrate({ duration: 30 });
        case 'drum-stop':
        case 'shot':
        case 'bolt-lock':
        case 'magazine':
          return Haptics.impact({ style: ImpactStyle.Heavy });
        case 'empty-chamber':
          return Haptics.notification({ type: NotificationType.Warning });
      }
    };
    run().catch(() => undefined);
  }

  private sound(event: FeedbackEvent): void {
    const context = this.context();
    if (!context) {
      return;
    }
    const nowS = context.currentTime;
    switch (event) {
      case 'shot':
        this.noiseBurst(context, nowS, 0.45, 5000, 0.9);
        this.tone(context, nowS, 110, 40, 0.3, 'sine', 0.8);
        return;
      case 'drum-click':
      case 'drum-whole-mil':
      case 'drum-turn':
        this.tone(context, nowS, 2200, 2200, 0.025, 'square', event === 'drum-click' ? 0.06 : 0.1);
        return;
      case 'drum-stop':
        this.noiseBurst(context, nowS, 0.08, 600, 0.4);
        return;
      case 'gauge-read':
        this.tone(context, nowS, 2900, 2900, 0.08, 'square', 0.08);
        return;
      case 'bolt-unlock':
        this.noiseBurst(context, nowS, 0.05, 2600, 0.4);
        this.tone(context, nowS, 180, 90, 0.06, 'square', 0.2);
        return;
      case 'bolt-slide':
        this.noiseBurst(context, nowS, 0.08, 1200, 0.15);
        return;
      case 'bolt-eject':
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
      default:
        return;
    }
  }

  private context(): AudioContext | null {
    if (!this.progress.settings().isSoundOn || typeof AudioContext === 'undefined') {
      return null;
    }
    this.audioContext ??= new AudioContext();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private tone(context: AudioContext, startS: number, fromHz: number, toHz: number, durationS: number, type: OscillatorType, gain: number): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromHz, startS);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), startS + durationS);
    envelope.gain.setValueAtTime(gain, startS);
    envelope.gain.exponentialRampToValueAtTime(0.0001, startS + durationS);
    oscillator.connect(envelope).connect(context.destination);
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
    source.connect(filter).connect(envelope).connect(context.destination);
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
      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(startS);
      oscillator.stop(startS + 1.7);
    }
  }
}
