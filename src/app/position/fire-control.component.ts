import { Component, computed, input, output } from '@angular/core';
import { Vector2 } from '../../sim/noise';
import { BreathRing } from './position.model';

const FIRE_RING_RADIUS = 58;
const HOLD_RING_RADIUS = 48;

@Component({
  selector: 'or-fire-control',
  template: `
    <div class="fire-control">
      <div class="hold-wrap">
        <svg class="ring" viewBox="0 0 114 114" aria-hidden="true">
          <circle class="ring-track" cx="57" cy="57" [attr.r]="holdRadius" />
          <circle class="ring-air" cx="57" cy="57" [attr.r]="holdRadius" [attr.stroke-dasharray]="holdDash()" transform="rotate(-90 57 57)" data-test="air-ring" [attr.data-share]="breath().share" />
        </svg>
        <button data-own-feedback
          class="hold"
          type="button"
          [class.cooldown]="breath().isCooldown"
          (pointerdown)="holdPress.emit()"
          (pointerup)="holdRelease.emit()"
          (pointerleave)="holdRelease.emit()"
          (pointercancel)="holdRelease.emit()"
          data-test="hold"
          data-hint="hold"
        >
          <span>{{ holdLabel() }}</span>
          @if (breath().secondsText) {
            <span class="hold-seconds mono" data-test="air-seconds">{{ breath().secondsText }}</span>
          }
        </button>
      </div>
      <div class="fire-wrap">
        @if (mode() === 'pressure') {
          <span class="pressure mono" data-test="pressure">{{ pressureLabel() }}</span>
        }
        <svg class="ring fire-ring" viewBox="0 0 138 138" aria-hidden="true">
          <circle class="ring-track" cx="69" cy="69" [attr.r]="fireRadius" />
          <circle class="ring-pressure" cx="69" cy="69" [attr.r]="fireRadius" [attr.stroke-dasharray]="fireDash()" transform="rotate(-90 69 69)" />
        </svg>
        <button data-own-feedback
          class="fire"
          type="button"
          [disabled]="!isFireEnabled()"
          (click)="mode() === 'tap' && fireTap.emit()"
          (pointerdown)="down($event)"
          (pointermove)="move($event)"
          (pointerup)="up()"
          (pointercancel)="up()"
          data-test="fire"
        >Огонь</button>
        <span class="rounds mono" data-test="rounds">{{ rounds() }}</span>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .fire-control { display: flex; align-items: center; justify-content: space-between; }
    .hold-wrap, .fire-wrap { position: relative; display: grid; place-items: center; }
    .hold-wrap { width: 114px; height: 114px; }
    .fire-wrap { width: 138px; height: 138px; }
    .ring { position: absolute; inset: 0; width: 100%; height: 100%; }
    .ring-track { fill: none; stroke: var(--device-line); }
    .ring-air { fill: none; stroke: var(--device-ok); }
    .ring-pressure { fill: none; stroke: var(--device-accent); }
    .hold-wrap .ring-track, .ring-air { stroke-width: 8; }
    .fire-ring .ring-track, .ring-pressure { stroke-width: 10; }
    .hold { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: var(--hold-size); height: var(--hold-size); border: 2px solid var(--device-line-muted); border-radius: 50%; background: var(--device-sunken); color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; touch-action: none; }
    .hold.cooldown { opacity: 0.45; }
    .hold-seconds { color: var(--device-ok); }
    .fire { position: relative; width: var(--fire-size); height: var(--fire-size); border: 4px solid var(--device-line-strong); border-radius: 50%; background: var(--device-error); color: var(--device-text); font: 700 var(--type-body) / 18px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; touch-action: none; }
    .fire:disabled { opacity: 0.45; }
    .pressure { position: absolute; right: 100%; top: 50%; transform: translateY(-50%); margin-right: var(--space-2); font: 700 var(--type-title) / 26px var(--font-mono); color: var(--device-accent); white-space: nowrap; }
    .rounds { position: absolute; bottom: -18px; right: 0; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
  `,
})
export class FireControlComponent {
  readonly mode = input.required<'tap' | 'pressure'>();
  readonly pressure = input(0);
  readonly pressureLabel = input('');
  readonly breath = input.required<BreathRing>();
  readonly holdLabel = input.required<string>();
  readonly rounds = input.required<string>();
  readonly isFireEnabled = input(true);
  readonly fireTap = output<void>();
  readonly firePress = output<Vector2>();
  readonly fireMove = output<Vector2>();
  readonly fireRelease = output<void>();
  readonly holdPress = output<void>();
  readonly holdRelease = output<void>();

  protected readonly fireRadius = FIRE_RING_RADIUS;
  protected readonly holdRadius = HOLD_RING_RADIUS;
  protected readonly fireDash = computed(() => dash(this.pressure(), FIRE_RING_RADIUS));
  protected readonly holdDash = computed(() => dash(this.breath().share, HOLD_RING_RADIUS));

  private isPressing = false;

  protected down(event: PointerEvent): void {
    if (this.mode() !== 'pressure' || !this.isFireEnabled()) {
      return;
    }
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.isPressing = true;
    this.firePress.emit(this.offset(event));
  }

  protected move(event: PointerEvent): void {
    if (this.isPressing) {
      this.fireMove.emit(this.offset(event));
    }
  }

  protected up(): void {
    if (this.isPressing) {
      this.isPressing = false;
      this.fireRelease.emit();
    }
  }

  private offset(event: PointerEvent): Vector2 {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    return { x: event.clientX - (rect.left + rect.width / 2), y: event.clientY - (rect.top + rect.height / 2) };
  }
}

function dash(share: number, radius: number): string {
  const circumference = 2 * Math.PI * radius;
  return `${(Math.max(0, Math.min(1, share)) * circumference).toFixed(1)} ${circumference.toFixed(1)}`;
}
