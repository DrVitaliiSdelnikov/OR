import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { TurretAxis } from './position.model';

interface DrumTick {
  offsetPt: number;
  isMajor: boolean;
}

const PT_PER_CLICK = 12;
const VISIBLE_CLICKS = 14;
const CLICKS_PER_MAJOR = 10;
const TAP_MAX_MOVE_PT = 6;
const TAP_MAX_DURATION_MS = 300;
const LOUPE_OPEN_MS = 1500;
const INERTIA_MIN_PT_PER_MS = 0.3;
const INERTIA_STOP_PT_PER_MS = 0.05;
const INERTIA_FRICTION = 0.92;

@Component({
  selector: 'or-turret-drum',
  template: `
    <div class="drum" [class.vertical]="axis() === 'windage'" [attr.data-test]="'drum-' + axis()">
      <button class="step" type="button" (click)="turn.emit(stepClicks()[0])" [attr.aria-label]="stepLabels()[0]" [attr.data-test]="axis() + '-' + stepNames()[0]">{{ stepLabels()[0] }}</button>
      <div
        class="tape"
        role="slider"
        [attr.aria-label]="axis() === 'elevation' ? 'Барабан высоты' : 'Барабан ветра'"
        [attr.aria-valuenow]="clicks()"
        (pointerdown)="down($event)"
        (pointermove)="move($event)"
        (pointerup)="up($event)"
        (pointercancel)="cancel()"
        data-test="drum-tape"
      >
        <svg class="scale" [attr.viewBox]="viewBox()" preserveAspectRatio="none" aria-hidden="true">
          @if (zeroStopOffset(); as zeroStop) {
            <rect class="zero-stop" [attr.x]="zeroStop.from" y="0" [attr.width]="zeroStop.size" height="40" data-test="drum-zero-stop" />
          }
          @for (tick of ticks(); track tick.offsetPt) {
            @if (isVertical()) {
              <line class="tick" [class.major]="tick.isMajor" [attr.x1]="tick.isMajor ? 4 : 12" x2="28" [attr.y1]="tick.offsetPt" [attr.y2]="tick.offsetPt" />
            } @else {
              <line class="tick" [class.major]="tick.isMajor" [attr.x1]="tick.offsetPt" [attr.x2]="tick.offsetPt" [attr.y1]="tick.isMajor ? 4 : 12" y2="28" />
            }
          }
          @if (targetOffset() !== null) {
            @if (isVertical()) {
              <polygon class="target-mark" [attr.points]="'34,' + (targetOffset()! - 5) + ' 40,' + targetOffset() + ' 34,' + (targetOffset()! + 5)" data-test="drum-target" />
            } @else {
              <polygon class="target-mark" [attr.points]="(targetOffset()! - 5) + ',34 ' + targetOffset() + ',40 ' + (targetOffset()! + 5) + ',34'" data-test="drum-target" />
            }
          }
          @if (isVertical()) {
            <line class="index" x1="0" x2="40" [attr.y1]="halfLength()" [attr.y2]="halfLength()" />
          } @else {
            <line class="index" [attr.x1]="halfLength()" [attr.x2]="halfLength()" y1="0" y2="40" />
          }
        </svg>
        <span class="value mono">{{ valueText() }} <small>{{ clicks() }} кл</small></span>
      </div>
      <button class="step" type="button" (click)="turn.emit(stepClicks()[1])" [attr.aria-label]="stepLabels()[1]" [attr.data-test]="axis() + '-' + stepNames()[1]">{{ stepLabels()[1] }}</button>
      @if (counter()) {
        <span class="counter mono" data-test="drum-counter">{{ counter() }}</span>
      }
      @if (isLoupeOpen()) {
        <div class="loupe" data-test="drum-loupe" aria-hidden="true">
          <span class="loupe-value mono">{{ valueText() }}</span>
          <span class="loupe-clicks mono">{{ clicks() }} кл</span>
          @if (counter()) {
            <span class="loupe-counter mono">{{ counter() }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .drum { position: relative; display: grid; grid-template-columns: var(--touch-min) 1fr var(--touch-min); align-items: center; gap: var(--space-1); }
    .drum.vertical { grid-template-columns: 1fr; grid-template-rows: var(--touch-min) 1fr var(--touch-min); align-items: stretch; height: 100%; }
    .step { min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface-2); color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); cursor: pointer; }
    .tape { position: relative; min-height: var(--touch-min); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-sunken); touch-action: none; overflow: hidden; cursor: grab; }
    .vertical .tape { min-width: var(--touch-min); }
    .scale { position: absolute; inset: 0; width: 100%; height: 100%; }
    .tick { stroke: var(--device-line-muted); stroke-width: 1; }
    .tick.major { stroke: var(--device-text-muted); stroke-width: 1.5; }
    .index { stroke: var(--device-accent); stroke-width: 2; }
    .zero-stop { fill: var(--device-error); opacity: 0.35; }
    .target-mark { fill: var(--device-accent); }
    .value { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 0 var(--space-1); background: var(--device-sunken); font: 700 var(--type-label) / 16px var(--font-mono); color: var(--device-text); white-space: nowrap; pointer-events: none; }
    .value small { color: var(--device-accent); font-weight: 500; }
    .vertical .value { display: flex; flex-direction: column; align-items: center; padding: var(--space-1) 0; }
    .counter { position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%); padding-bottom: 2px; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-accent); white-space: nowrap; }
    .vertical .counter { left: auto; right: 100%; bottom: auto; top: 0; transform: none; padding: 0 var(--space-1) 0 0; }
    .loupe { position: fixed; left: 16.6%; right: 16.6%; top: 30%; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-6) var(--space-4); border: var(--border-width) solid var(--device-accent); border-radius: var(--radius-device); background: var(--device-surface); z-index: 10; }
    .loupe-value { font: 700 var(--type-hero) / 44px var(--font-mono); color: var(--device-text); }
    .loupe-clicks, .loupe-counter { font: 500 var(--type-value) / 22px var(--font-mono); color: var(--device-accent); }
  `,
})
export class TurretDrumComponent {
  readonly axis = input.required<TurretAxis>();
  readonly clicks = input.required<number>();
  readonly targetClicks = input<number | null>(null);
  readonly minClicks = input.required<number>();
  readonly valueText = input.required<string>();
  readonly counter = input<string>('');
  readonly turn = output<number>();

  protected readonly isLoupeOpen = signal(false);
  protected readonly isVertical = computed(() => this.axis() === 'windage');
  protected readonly halfLength = computed(() => VISIBLE_CLICKS * PT_PER_CLICK);
  protected readonly viewBox = computed(() => (this.isVertical() ? `0 0 40 ${2 * this.halfLength()}` : `0 0 ${2 * this.halfLength()} 40`));
  protected readonly stepClicks = computed<[number, number]>(() => (this.isVertical() ? [1, -1] : [-1, 1]));
  protected readonly stepLabels = computed<[string, string]>(() => (this.isVertical() ? ['L', 'R'] : ['−', '+']));
  protected readonly stepNames = computed<[string, string]>(() => (this.isVertical() ? ['left', 'right'] : ['minus', 'plus']));
  protected readonly ticks = computed<DrumTick[]>(() => {
    const ticks: DrumTick[] = [];
    for (let offset = -VISIBLE_CLICKS; offset <= VISIBLE_CLICKS; offset++) {
      const value = this.clicks() + offset;
      const isMajor = value % CLICKS_PER_MAJOR === 0;
      ticks.push({ offsetPt: this.positionPt(offset), isMajor });
    }
    return ticks;
  });
  protected readonly targetOffset = computed(() => {
    const target = this.targetClicks();
    if (target === null || target === this.clicks()) {
      return null;
    }
    const offset = Math.max(-VISIBLE_CLICKS, Math.min(VISIBLE_CLICKS, target - this.clicks()));
    return this.positionPt(offset);
  });
  // Красная зона ZERO STOP — только у барабана высоты: ниже нуля он не идёт.
  protected readonly zeroStopOffset = computed(() => {
    const belowStop = this.minClicks() - this.clicks();
    if (this.isVertical() || belowStop <= -VISIBLE_CLICKS) {
      return null;
    }
    const edgeOffset = Math.min(VISIBLE_CLICKS, belowStop);
    const edgePt = this.positionPt(edgeOffset);
    return { from: 0, size: edgePt };
  });

  private gesture: { startPt: number; lastPt: number; startMs: number; lastMs: number; remainderPt: number; velocityPtPerMs: number; movedPt: number } | null = null;
  private inertiaFrame = 0;
  private loupeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      cancelAnimationFrame(this.inertiaFrame);
      if (this.loupeTimer) {
        clearTimeout(this.loupeTimer);
      }
    });
  }

  protected down(event: PointerEvent): void {
    cancelAnimationFrame(this.inertiaFrame);
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const positionPt = this.alongPt(event);
    this.gesture = { startPt: positionPt, lastPt: positionPt, startMs: event.timeStamp, lastMs: event.timeStamp, remainderPt: 0, velocityPtPerMs: 0, movedPt: 0 };
  }

  protected move(event: PointerEvent): void {
    const gesture = this.gesture;
    if (!gesture) {
      return;
    }
    const positionPt = this.alongPt(event);
    const deltaPt = positionPt - gesture.lastPt;
    const elapsedMs = Math.max(1, event.timeStamp - gesture.lastMs);
    gesture.velocityPtPerMs = deltaPt / elapsedMs;
    gesture.lastPt = positionPt;
    gesture.lastMs = event.timeStamp;
    gesture.movedPt = Math.max(gesture.movedPt, Math.abs(positionPt - gesture.startPt));
    this.addTravel(gesture, deltaPt);
  }

  protected up(event: PointerEvent): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (!gesture) {
      return;
    }
    const isTap = gesture.movedPt < TAP_MAX_MOVE_PT && event.timeStamp - gesture.startMs < TAP_MAX_DURATION_MS;
    if (isTap) {
      this.openLoupe();
      return;
    }
    if (Math.abs(gesture.velocityPtPerMs) >= INERTIA_MIN_PT_PER_MS) {
      this.coast(gesture);
    }
  }

  protected cancel(): void {
    this.gesture = null;
  }

  private positionPt(offsetClicks: number): number {
    const along = offsetClicks * PT_PER_CLICK;
    return this.halfLength() + (this.isVertical() ? -along : along);
  }

  // Вдоль ленты: вправо по верхнему барабану — клики вверх; вверх по боковому — клики влево.
  private alongPt(event: PointerEvent): number {
    return this.isVertical() ? -event.clientY : event.clientX;
  }

  private addTravel(gesture: NonNullable<typeof this.gesture>, deltaPt: number): void {
    gesture.remainderPt += deltaPt;
    const clicks = Math.trunc(gesture.remainderPt / PT_PER_CLICK);
    if (clicks !== 0) {
      gesture.remainderPt -= clicks * PT_PER_CLICK;
      this.turn.emit(clicks);
    }
  }

  private coast(gesture: NonNullable<typeof this.gesture>): void {
    let velocity = gesture.velocityPtPerMs;
    let lastMs = performance.now();
    const step = (nowMs: number): void => {
      const elapsedMs = nowMs - lastMs;
      lastMs = nowMs;
      this.addTravel(gesture, velocity * elapsedMs);
      velocity *= INERTIA_FRICTION;
      if (Math.abs(velocity) >= INERTIA_STOP_PT_PER_MS) {
        this.inertiaFrame = requestAnimationFrame(step);
      }
    };
    this.inertiaFrame = requestAnimationFrame(step);
  }

  private openLoupe(): void {
    this.isLoupeOpen.set(true);
    if (this.loupeTimer) {
      clearTimeout(this.loupeTimer);
    }
    this.loupeTimer = setTimeout(() => this.isLoupeOpen.set(false), LOUPE_OPEN_MS);
  }
}

