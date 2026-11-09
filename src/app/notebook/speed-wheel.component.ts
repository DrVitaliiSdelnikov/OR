import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { FeedbackService } from '../services/feedback.service';
import { MAX_WIND_SPEED_MPS, stepSpeed } from './notebook.model';

const ROW_PT = 32;
const VISIBLE_NEIGHBORS = 2;
const KEY_STEPS: Readonly<Record<string, number>> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };

@Component({
  selector: 'or-speed-wheel',
  template: `
    <div class="speed">
      <div
        class="wheel mono"
        role="spinbutton"
        tabindex="0"
        aria-label="Скорость ветра, м/с"
        aria-valuemin="0"
        [attr.aria-valuemax]="maxSpeed"
        [attr.aria-valuenow]="shownSpeed() ?? 0"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up()"
        (pointercancel)="up()"
        (keydown)="key($event)"
        data-test="speed-wheel"
      >
        @for (row of rows(); track row.offset) {
          <div class="row" [class.current]="row.offset === 0" [style.opacity]="row.opacity">{{ row.text }}</div>
        }
        <span class="unit">м/с</span>
      </div>
      <div class="steps">
        <button data-own-feedback class="step" type="button" (click)="nudge(-1)" aria-label="Медленнее на 0,1" data-test="speed-minus">−</button>
        <button data-own-feedback class="step" type="button" (click)="nudge(1)" aria-label="Быстрее на 0,1" data-test="speed-plus">+</button>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .speed { display: flex; flex-direction: column; gap: var(--space-2); }
    .steps { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .step { min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-sunken); color: var(--device-text); font: 700 var(--type-value) / 20px var(--font-mono); }
    .wheel { position: relative; display: flex; flex-direction: column; align-items: center; height: 120px; overflow: hidden; border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-sunken); touch-action: none; user-select: none; }
    .row { height: 24px; font: 500 var(--type-label) / 24px var(--font-mono); color: var(--device-text-muted); }
    .row.current { color: var(--device-accent); font-size: var(--type-value); font-weight: 700; border-top: 1px solid var(--device-line); border-bottom: 1px solid var(--device-line); width: 100%; text-align: center; }
    .unit { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
  `,
})
export class SpeedWheelComponent {
  private readonly feedback = inject(FeedbackService);
  readonly speed = input<number | null>(null);
  readonly speedChange = output<number>();

  // Быстрые шаги подряд приходят раньше, чем родитель вернёт новое значение во вход: считаем от своего.
  protected readonly shownSpeed = linkedSignal(() => this.speed());
  protected readonly maxSpeed = MAX_WIND_SPEED_MPS;
  protected readonly rows = computed(() => {
    const current = this.shownSpeed();
    return Array.from({ length: VISIBLE_NEIGHBORS * 2 + 1 }, (_, index) => {
      const offset = index - VISIBLE_NEIGHBORS;
      if (current === null) {
        return { offset, text: offset === 0 ? '—' : '', opacity: 1 };
      }
      const value = current + offset * 0.1;
      const isOutside = value < -1e-9 || value > MAX_WIND_SPEED_MPS + 1e-9;
      return { offset, text: isOutside ? '' : value.toFixed(1), opacity: 1 - Math.abs(offset) * 0.3 };
    });
  });

  private dragStartY: number | null = null;
  private dragStepsApplied = 0;

  protected nudge(steps: number): void {
    const next = stepSpeed(this.shownSpeed() ?? 0, steps);
    if (next !== this.shownSpeed()) {
      this.feedback.emit('detent');
    }
    this.shownSpeed.set(next);
    this.speedChange.emit(next);
  }

  protected key(event: KeyboardEvent): void {
    const steps = KEY_STEPS[event.key];
    if (steps === undefined) {
      return;
    }
    event.preventDefault();
    this.nudge(steps);
  }

  protected down(event: PointerEvent): void {
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.dragStartY = event.clientY;
    this.dragStepsApplied = 0;
  }

  protected move(event: PointerEvent): void {
    if (this.dragStartY === null) {
      return;
    }
    const steps = Math.trunc((this.dragStartY - event.clientY) / ROW_PT);
    if (steps !== this.dragStepsApplied) {
      this.nudge(steps - this.dragStepsApplied);
      this.dragStepsApplied = steps;
    }
  }

  protected up(): void {
    this.dragStartY = null;
  }
}
