import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { FeedbackService } from '../services/feedback.service';
import { text } from '../../i18n';
import { UnitSystem } from '../../core/units';
import { maxWheelSpeed, SPEED_STEP_MPS, speedWheelRows, stepSpeed } from './notebook.model';

const ROW_PT = 32;
const KEY_STEPS: Readonly<Record<string, number>> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };

@Component({
  selector: 'or-speed-wheel',
  template: `
    <div class="speed">
      <div
        class="wheel mono"
        role="spinbutton"
        tabindex="0"
        [attr.aria-label]="label()"
        aria-valuemin="0"
        [attr.aria-valuemax]="maxSpeed()"
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
        <span class="unit">{{ unit() }}</span>
      </div>
      <div class="steps">
        <button data-own-feedback class="step" type="button" (click)="nudge(-1)" [attr.aria-label]="slowerLabel" data-test="speed-minus">−</button>
        <button data-own-feedback class="step" type="button" (click)="nudge(1)" [attr.aria-label]="fasterLabel" data-test="speed-plus">+</button>
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
  readonly system = input<UnitSystem>('metric');
  readonly speedChange = output<number>();

  protected readonly texts = text.notebook.speedWheel;
  protected readonly slowerLabel = this.texts.slower({ stepMps: SPEED_STEP_MPS });
  protected readonly fasterLabel = this.texts.faster({ stepMps: SPEED_STEP_MPS });

  // Быстрые шаги подряд приходят раньше, чем родитель вернёт новое значение во вход: считаем от своего.
  protected readonly shownSpeed = linkedSignal(() => this.speed());
  protected readonly maxSpeed = computed(() => maxWheelSpeed(this.system()));
  protected readonly unit = computed(() => text.units.unitLabel('windSpeed', this.system()));
  protected readonly label = computed(() => this.texts.label({ unit: this.unit() }));
  protected readonly rows = computed(() => speedWheelRows(this.shownSpeed(), this.system()));

  private dragStartY: number | null = null;
  private dragStepsApplied = 0;

  protected nudge(steps: number): void {
    const next = stepSpeed(this.shownSpeed() ?? 0, steps, this.system());
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
