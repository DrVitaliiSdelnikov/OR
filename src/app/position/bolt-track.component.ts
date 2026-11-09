import { Component, computed, input, output } from '@angular/core';
import { BoltStep } from '../../sim/bolt';
import { Vector2 } from '../../sim/noise';
import { boltHandlePosition, boltHeader, boltSteps } from './position.model';

const VIEWBOX_WIDTH = 380;
const TRACK_HOME = 'M300 110';
const PASSED_CORNERS: Record<BoltStep, string> = { up: '', back: ' V50', forward: ' V50 H160', down: ' V50 H160 H300' };
// Подписи вне жёлоба (он ±25 от осевой): 1 — справа от вертикали, 2 — над горизонталью, 3 и 4 — под ней.
const LABEL_POSITIONS: readonly Vector2[] = [
  { x: 332, y: 86 },
  { x: 170, y: 16 },
  { x: 170, y: 96 },
  { x: 214, y: 124 },
];

@Component({
  selector: 'or-bolt-track',
  template: `
    <div class="bolt" data-test="bolt-track">
      <div class="header mono" data-test="bolt-header">{{ header() }}</div>
      <svg class="track" viewBox="0 0 380 150" aria-label="Затвор: вверх, назад, вперёд, вниз">
        <path class="groove-edge" d="M300 110 V50 H160" />
        <path class="groove" d="M300 110 V50 H160" />
        <path class="done" [attr.d]="donePath()" />
        @for (step of steps(); track step.label; let index = $index) {
          <text class="step-label" [class.current]="step.isCurrent" [class.done]="step.isDone" [attr.x]="labels[index].x" [attr.y]="labels[index].y">{{ step.label }}</text>
        }
        <circle
          class="handle"
          [attr.cx]="handle().x"
          [attr.cy]="handle().y"
          r="22"
          (pointerdown)="down($event)"
          (pointermove)="move($event)"
          (pointerup)="up()"
          (pointercancel)="up()"
          data-test="bolt-handle"
        />
        <circle class="handle-core" [attr.cx]="handle().x" [attr.cy]="handle().y" r="10" />
      </svg>
      <button data-own-feedback class="waiting" type="button" (click)="waitingTap.emit()" data-test="fire-waiting">Огонь · ждёт затвор</button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .bolt { display: flex; flex-direction: column; gap: var(--space-2); }
    .header { font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-accent); }
    .track { width: 100%; height: auto; touch-action: none; }
    .groove-edge { fill: none; stroke: var(--device-line-strong); stroke-width: 50; stroke-linecap: round; stroke-linejoin: round; }
    .groove { fill: none; stroke: var(--device-bg); stroke-width: 44; stroke-linecap: round; stroke-linejoin: round; }
    .done { fill: none; stroke: var(--device-ok); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
    .step-label { font: 700 var(--type-label) var(--font-mono); fill: var(--device-text-muted); }
    .step-label.current { fill: var(--device-accent); }
    .step-label.done { fill: var(--device-ok); }
    .handle { fill: var(--device-accent); stroke: var(--device-bg); stroke-width: 3; cursor: grab; touch-action: none; }
    .handle-core { fill: none; stroke: var(--device-bg); stroke-width: 2.5; pointer-events: none; }
    .waiting { min-height: var(--touch-min); border: var(--border-width) dashed var(--device-line-strong); border-radius: var(--radius-device); background: transparent; color: var(--device-text-muted); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
  `,
})
export class BoltTrackComponent {
  readonly step = input.required<BoltStep>();
  readonly progress = input.required<number>();
  readonly drag = output<Vector2>();
  readonly waitingTap = output<void>();

  protected readonly labels = LABEL_POSITIONS;
  protected readonly header = computed(() => boltHeader(this.step()));
  protected readonly steps = computed(() => boltSteps(this.step()));
  protected readonly handle = computed(() => boltHandlePosition(this.step(), this.progress()));
  protected readonly donePath = computed(() => {
    const handle = this.handle();
    return `${TRACK_HOME}${PASSED_CORNERS[this.step()]} L${handle.x} ${handle.y}`;
  });

  private last: Vector2 | null = null;
  private unitsPerPx = 1;

  protected down(event: PointerEvent): void {
    const handle = event.target as SVGGraphicsElement;
    handle.setPointerCapture?.(event.pointerId);
    this.unitsPerPx = VIEWBOX_WIDTH / (handle.ownerSVGElement?.getBoundingClientRect().width || VIEWBOX_WIDTH);
    this.last = { x: event.clientX, y: event.clientY };
  }

  protected move(event: PointerEvent): void {
    if (!this.last) {
      return;
    }
    this.drag.emit({ x: (event.clientX - this.last.x) * this.unitsPerPx, y: (event.clientY - this.last.y) * this.unitsPerPx });
    this.last = { x: event.clientX, y: event.clientY };
  }

  protected up(): void {
    this.last = null;
  }
}
