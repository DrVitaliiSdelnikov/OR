import { Component, computed, input, output } from '@angular/core';
import { windClockShare } from '../../core/field';
import { clockFromDialAngle, dialAngleFromClock } from './notebook.model';

const DIAL_CENTER = 130;
const DIAL_RADIUS = 104;
const HOUR_NUMBER_RADIUS = 84;
const SHARE_LABEL_RADIUS = 62;
const HAND_LENGTH = 76;
const HALF_HOURS = 24;
const DEG_TO_RAD = Math.PI / 180;

interface DialTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isHour: boolean;
}

@Component({
  selector: 'or-wind-clock',
  template: `
    <svg
      class="dial"
      viewBox="0 0 260 270"
      role="slider"
      aria-label="Направление ветра по часам"
      aria-valuemin="0.5"
      aria-valuemax="12"
      [attr.aria-valuenow]="clock()"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up()"
      (pointercancel)="up()"
      data-test="wind-clock"
    >
      <text class="aim" x="130" y="12">ЦЕЛЬ</text>
      <g transform="translate(0 10)">
        <circle class="face" [attr.cx]="center" [attr.cy]="center" [attr.r]="radius" />
        @for (tick of ticks; track $index) {
          <line [class.hour]="tick.isHour" class="tick" [attr.x1]="tick.x1" [attr.y1]="tick.y1" [attr.x2]="tick.x2" [attr.y2]="tick.y2" />
        }
        @for (hour of hours; track hour.label) {
          <text class="hour-label" [attr.x]="hour.x" [attr.y]="hour.y">{{ hour.label }}</text>
        }
        @if (showShares()) {
          @for (share of shares; track share.label + share.x) {
            <text class="share-label" [attr.x]="share.x" [attr.y]="share.y" data-test="clock-share">{{ share.label }}</text>
          }
        }
        @if (hand(); as end) {
          <line class="hand" [attr.x1]="center" [attr.y1]="center" [attr.x2]="end.x" [attr.y2]="end.y" data-test="wind-hand" />
          <circle class="hand-tip" [attr.cx]="end.x" [attr.cy]="end.y" r="7" />
        }
        <circle class="hub" [attr.cx]="center" [attr.cy]="center" r="5" />
      </g>
    </svg>
  `,
  styles: `
    :host { display: block; touch-action: none; }
    .dial { display: block; width: 100%; max-width: 200px; margin: 0 auto; }
    .face { fill: var(--device-sunken); stroke: var(--device-line-strong); stroke-width: 2; }
    .tick { stroke: var(--device-line); stroke-width: 1.5; }
    .tick.hour { stroke: var(--device-text-muted); stroke-width: 2.5; }
    .share-label { fill: var(--device-accent); font: 500 9px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
    .hour-label { fill: var(--device-text); font: 500 13px var(--font-mono); text-anchor: middle; dominant-baseline: central; }
    .aim { fill: var(--device-accent); font: 700 11px var(--font-mono); letter-spacing: var(--tracking-label); text-anchor: middle; }
    .hand { stroke: var(--device-accent); stroke-width: 4; stroke-linecap: round; }
    .hand-tip { fill: var(--device-accent); }
    .hub { fill: var(--device-text); }
  `,
})
export class WindClockComponent {
  readonly clock = input<number | null>(null);
  readonly showShares = input(false);
  readonly clockChange = output<number>();

  protected readonly center = DIAL_CENTER;
  protected readonly radius = DIAL_RADIUS;
  protected readonly ticks: DialTick[] = Array.from({ length: HALF_HOURS }, (_, index) => {
    const isHour = index % 2 === 0;
    const angle = (index / HALF_HOURS) * 360;
    const inner = pointAt(angle, DIAL_RADIUS - (isHour ? 12 : 7));
    const outer = pointAt(angle, DIAL_RADIUS - 2);
    return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, isHour };
  });
  protected readonly hours = Array.from({ length: 12 }, (_, index) => ({ label: String(index + 1), ...pointAt(dialAngleFromClock(index + 1), HOUR_NUMBER_RADIUS) }));
  protected readonly shares = Array.from({ length: 12 }, (_, index) => ({
    label: shareText(windClockShare(index + 1)),
    ...pointAt(dialAngleFromClock(index + 1), SHARE_LABEL_RADIUS),
  }));
  protected readonly hand = computed(() => {
    const clock = this.clock();
    return clock === null ? null : pointAt(dialAngleFromClock(clock), HAND_LENGTH);
  });

  private isDragging = false;

  protected down(event: PointerEvent): void {
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.isDragging = true;
    this.pick(event);
  }

  protected move(event: PointerEvent): void {
    if (this.isDragging) {
      this.pick(event);
    }
  }

  protected up(): void {
    this.isDragging = false;
  }

  private pick(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / 260;
    const centerX = rect.left + DIAL_CENTER * scale;
    const centerY = rect.top + (DIAL_CENTER + 10) * scale;
    const angle = Math.atan2(event.clientX - centerX, centerY - event.clientY) / DEG_TO_RAD;
    const clock = clockFromDialAngle(angle);
    if (clock !== this.clock()) {
      this.clockChange.emit(clock);
    }
  }
}

function shareText(share: number): string {
  return share === 1 ? '1' : share === 0 ? '0' : share.toFixed(2).replace(/^0/, '').replace(/0$/, '');
}

function pointAt(angleDeg: number, distance: number): { x: number; y: number } {
  return { x: DIAL_CENTER + Math.sin(angleDeg * DEG_TO_RAD) * distance, y: DIAL_CENTER - Math.cos(angleDeg * DEG_TO_RAD) * distance };
}
