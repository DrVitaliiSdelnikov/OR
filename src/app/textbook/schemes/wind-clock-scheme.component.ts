import { Component, computed, signal } from '@angular/core';
import { windClockView } from './scheme.model';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const HOUR_RADIUS = 84;
const ARROW_START_RADIUS = 60;
const ARROW_END_RADIUS = 14;
const ARROW_HEAD = 8;
const ARROW_HEAD_SPREAD_DEG = 20;
const DEFAULT_HOUR = 3;

@Component({
  selector: 'or-wind-clock-scheme',
  template: `
    @let wind = view();
    <svg viewBox="-108 -108 216 216" role="img" aria-label="Часы ветра: тапни по часу" data-test="wind-clock-scheme">
      <circle class="dial" r="66" />
      <text class="target" x="0" y="-36">ЦЕЛЬ</text>
      <line class="fire-line" x1="0" y1="0" x2="0" y2="-28" />
      <line class="arrow" [attr.x1]="arrow().fromX" [attr.y1]="arrow().fromY" [attr.x2]="arrow().toX" [attr.y2]="arrow().toY" data-test="wind-arrow" />
      <polygon class="arrow-head" [attr.points]="arrow().head" />
      <circle class="shooter" r="4" />
      @for (hour of hours; track hour.value) {
        <g class="hour" [class.chosen]="hour.value === wind.clockHours" role="button" [attr.aria-label]="hour.value + ' ч'" (click)="clockHours.set(hour.value)" [attr.data-test]="'scheme-hour-' + hour.value">
          <circle class="hit" [attr.cx]="hour.x" [attr.cy]="hour.y" r="20" />
          <text [attr.x]="hour.x" [attr.y]="hour.y + 5">{{ hour.value }}</text>
        </g>
      }
    </svg>
    <p class="caption mono"><b data-test="scheme-caption">{{ wind.caption }}</b> · боковой ветер = ветер × доля</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
    svg { width: 100%; max-width: 240px; aspect-ratio: 1; }
    .dial { fill: color-mix(in srgb, var(--paper-graphite) 8%, transparent); stroke: var(--paper-graphite); stroke-width: 1.2; }
    .target { font: 600 10px var(--font-mono); fill: var(--paper-graphite); text-anchor: middle; }
    .fire-line { stroke: var(--paper-graphite); stroke-width: 1; stroke-dasharray: 3 3; }
    .shooter { fill: var(--paper-ink); }
    .arrow { stroke: var(--paper-red-pencil); stroke-width: 3; }
    .arrow-head { fill: var(--paper-red-pencil); }
    .hour { cursor: pointer; }
    .hour .hit { fill: transparent; stroke: transparent; stroke-width: 1.5; }
    .hour text { font: 600 15px var(--font-mono); fill: var(--paper-ink); text-anchor: middle; pointer-events: none; }
    .hour.chosen .hit { stroke: var(--paper-red-pencil); }
    .hour.chosen text { fill: var(--paper-red-pencil); }
    .caption { margin: 0; align-self: stretch; font: 500 var(--type-label) / 18px var(--font-mono); }
  `,
})
export class WindClockSchemeComponent {
  protected readonly clockHours = signal(DEFAULT_HOUR);
  protected readonly view = computed(() => windClockView(this.clockHours()));
  protected readonly hours = HOURS.map(value => ({ value, ...pointAt(windClockView(value).arrowFromDeg, HOUR_RADIUS) }));
  protected readonly arrow = computed(() => {
    const angleDeg = this.view().arrowFromDeg;
    const from = pointAt(angleDeg, ARROW_START_RADIUS);
    const to = pointAt(angleDeg, ARROW_END_RADIUS);
    const headLeft = pointAt(angleDeg - ARROW_HEAD_SPREAD_DEG, ARROW_END_RADIUS + ARROW_HEAD);
    const headRight = pointAt(angleDeg + ARROW_HEAD_SPREAD_DEG, ARROW_END_RADIUS + ARROW_HEAD);
    return { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, head: `${to.x},${to.y} ${headLeft.x},${headLeft.y} ${headRight.x},${headRight.y}` };
  });
}

function pointAt(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.sin(angleRad), y: -radius * Math.cos(angleRad) };
}
