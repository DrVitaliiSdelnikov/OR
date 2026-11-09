import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';

export interface StationView {
  temperature: string;
  pressure: string;
  humidity: string;
  wind: string;
  time: string;
  isShort: boolean;
}

const FULL_MEASUREMENT_MS = 3000;
const PROGRESS_TICK_MS = 50;
const RING_RADIUS = 30;

@Component({
  selector: 'or-conditions-tab',
  template: `
    <div class="conditions">
      <div class="station">
        <svg class="impeller" [class.spinning]="isMeasuring()" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="30" class="shroud" />
          <g class="blades">
            <path d="M32 32 L32 6 A10 10 0 0 1 40 14 Z" />
            <path d="M32 32 L54.5 45 A10 10 0 0 1 43.5 50 Z" />
            <path d="M32 32 L9.5 45 A10 10 0 0 1 12 34 Z" />
          </g>
          <circle cx="32" cy="32" r="4" class="hub" />
        </svg>
        <div class="lcd mono" data-test="station-lcd">
          @if (reading(); as station) {
            <div>T {{ station.temperature }}</div>
            <div>P {{ station.pressure }}</div>
            <div>RH {{ station.humidity }}</div>
            <div>V {{ station.wind }}</div>
          } @else {
            <div>— — —</div>
          }
        </div>
        <div class="hold-wrap">
          <svg class="ring" viewBox="0 0 72 72" aria-hidden="true">
            <circle class="ring-track" cx="36" cy="36" [attr.r]="ringRadius" />
            <circle class="ring-progress" cx="36" cy="36" [attr.r]="ringRadius" [attr.stroke-dasharray]="ringDash()" transform="rotate(-90 36 36)" />
          </svg>
          <button
            class="measure"
            type="button"
            (pointerdown)="press()"
            (pointerup)="release()"
            (pointerleave)="release()"
            (pointercancel)="release()"
            data-test="measure"
            data-hint="measure"
          >Замер</button>
        </div>
      </div>

      @if (reading(); as station) {
        <div class="readings mono" data-test="station-readings">
          <div class="line">{{ station.time }} · T {{ station.temperature }} · P {{ station.pressure }} · RH {{ station.humidity }}</div>
          <div class="line">ветер {{ station.wind }} — справочно, вводится на вкладке «Ветер»</div>
          @if (station.isShort) {
            <div class="short" data-test="short-measurement">короткий замер</div>
          }
        </div>
      } @else {
        <div class="hint mono">Держи «Замер» 3 с</div>
      }
      <div class="reference mono">Эталон ДОПЕ: +15 C · 1013 гПа</div>
      @if (stepLinkText(); as link) {
        <button class="step-link mono" type="button" (click)="toStep.emit()" data-test="conditions-step-link">{{ link }}</button>
      } @else {
        <div class="correction mono" data-test="conditions-correction">{{ correctionText() }}</div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .conditions { display: flex; flex-direction: column; gap: var(--space-2); }
    .station { display: grid; grid-template-columns: 64px 1fr 72px; align-items: center; gap: var(--space-2); padding: var(--space-2); border-radius: var(--radius-device); background: var(--device-surface); }
    .impeller { width: 64px; height: 64px; }
    .shroud { fill: var(--device-sunken); stroke: var(--device-line-strong); stroke-width: 2; }
    .blades { fill: var(--device-text-muted); transform-origin: 32px 32px; }
    .spinning .blades { animation: spin 0.6s linear infinite; }
    .hub { fill: var(--device-text); }
    .lcd { min-height: 64px; padding: 4px 8px; border-radius: 4px; background: var(--device-bg); color: var(--device-ok); border: 1px solid var(--device-line); font: 500 var(--type-label) / 15px var(--font-mono); }
    .hold-wrap { position: relative; display: grid; place-items: center; width: 72px; height: 72px; }
    .ring { position: absolute; inset: 0; width: 100%; height: 100%; }
    .ring-track { fill: none; stroke: var(--device-line); stroke-width: 5; }
    .ring-progress { fill: none; stroke: var(--device-ok); stroke-width: 5; }
    .measure { position: relative; width: 56px; height: 56px; border: 2px solid var(--device-line-strong); border-radius: 50%; background: var(--device-sunken); color: var(--device-text); font: 700 10px / 12px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; touch-action: none; }
    .readings, .hint, .reference { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--paper-ink); }
    .short { color: var(--paper-red-pencil); }
    .correction { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-ink); }
    .step-link { min-height: var(--touch-min); border: 1.5px solid var(--paper-graphite); border-radius: var(--radius-device); background: transparent; color: var(--paper-ink); font: 700 var(--type-label) / 16px var(--font-mono); text-align: left; padding: 0 var(--space-3); }
    @keyframes spin { to { transform: rotate(360deg); } }
  `,
})
export class ConditionsTabComponent {
  readonly reading = input<StationView | null>(null);
  readonly correctionText = input.required<string>();
  readonly stepLinkText = input<string | null>(null);
  readonly measure = output<number>();
  readonly toStep = output<void>();

  protected readonly ringRadius = RING_RADIUS;
  protected readonly isMeasuring = signal(false);
  protected readonly heldMs = signal(0);
  protected readonly ringDash = computed(() => {
    const circumference = 2 * Math.PI * RING_RADIUS;
    return `${((Math.min(this.heldMs(), FULL_MEASUREMENT_MS) / FULL_MEASUREMENT_MS) * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
  });

  private timer: ReturnType<typeof setInterval> | null = null;
  private pressedAtMs = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  protected press(): void {
    if (this.isMeasuring()) {
      return;
    }
    this.isMeasuring.set(true);
    this.pressedAtMs = performance.now();
    this.heldMs.set(0);
    this.timer = setInterval(() => {
      this.heldMs.set(performance.now() - this.pressedAtMs);
      if (this.heldMs() >= FULL_MEASUREMENT_MS) {
        this.finish();
      }
    }, PROGRESS_TICK_MS);
  }

  protected release(): void {
    if (this.isMeasuring()) {
      this.finish();
    }
  }

  private finish(): void {
    const heldS = Math.min(performance.now() - this.pressedAtMs, FULL_MEASUREMENT_MS) / 1000;
    this.stopTimer();
    this.isMeasuring.set(false);
    this.heldMs.set(0);
    this.measure.emit(heldS);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
