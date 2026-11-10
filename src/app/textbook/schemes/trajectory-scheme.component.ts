import { Component, computed, input } from '@angular/core';
import { DopeCard } from '../../../core/dope-card';
import { trajectoryView } from './scheme.model';

const WIDTH = 320;
const HEIGHT = 170;
const LEFT = 24;
const RIGHT = 306;
const TOP = 22;
const BOTTOM = 150;
const MAX_DISTANCE_M = 1000;
const DISTANCE_TICKS_M = [0, 500, 1000];

@Component({
  selector: 'or-trajectory-scheme',
  template: `
    @let chart = chartView();
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" aria-label="Траектория патрона Б: поправка по дистанции" data-test="trajectory-scheme">
      <line class="sight" [attr.x1]="left" [attr.y1]="top" [attr.x2]="right" [attr.y2]="top" />
      <text class="small" [attr.x]="right" [attr.y]="top - 6" text-anchor="end">линия прицеливания</text>
      <polyline class="curve" [attr.points]="chart.curve" data-test="trajectory-curve" />
      <circle class="zero" [attr.cx]="chart.zeroX" [attr.cy]="top" r="3.5" />
      <text class="small" [attr.x]="chart.zeroX" [attr.y]="top - 6" text-anchor="middle">ноль {{ chart.zeroM }} м</text>
      @for (mark of chart.timeMarks; track mark.distanceM) {
        <circle class="time-dot" [attr.cx]="mark.x" [attr.cy]="mark.y" r="2.5" />
        <text class="small" [attr.x]="mark.x - 6" [attr.y]="mark.y + 12" text-anchor="end" data-test="trajectory-time">{{ mark.text }}</text>
      }
      @for (tick of chart.distanceTicks; track tick.text) {
        <text class="small" [attr.x]="tick.x" [attr.y]="height - 4" text-anchor="middle">{{ tick.text }}</text>
      }
      <text class="small" [attr.x]="left" [attr.y]="chart.bottomY">на 1000 м: ↑ {{ chart.maxText }} MIL</text>
    </svg>
    <p class="caption mono" data-test="scheme-caption">Патрон Б: на сколько поднять прицел, чтобы попасть — та же кривая, что строки ДОПЕ. Точки — время полёта.</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    svg { width: 100%; }
    .sight { stroke: var(--paper-graphite); stroke-width: 1; stroke-dasharray: 4 3; }
    .curve { fill: none; stroke: var(--paper-ink); stroke-width: 2; }
    .zero { fill: var(--paper-red-pencil); }
    .time-dot { fill: var(--paper-ink); }
    .small { font: 500 10px var(--font-mono); fill: var(--paper-graphite); }
    .caption { margin: 0; font: 500 var(--type-label) / 18px var(--font-mono); }
  `,
})
export class TrajectorySchemeComponent {
  readonly card = input.required<DopeCard>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly left = LEFT;
  protected readonly right = RIGHT;
  protected readonly top = TOP;

  protected readonly chartView = computed(() => {
    const view = trajectoryView(this.card());
    const maxMil = Math.max(...view.points.map(point => point.elevationMil));
    const x = (distanceM: number): number => LEFT + (distanceM / MAX_DISTANCE_M) * (RIGHT - LEFT);
    const y = (elevationMil: number): number => TOP + (elevationMil / maxMil) * (BOTTOM - TOP);
    return {
      curve: view.points.map(point => `${x(point.distanceM)},${y(point.elevationMil)}`).join(' '),
      zeroX: x(view.zeroM),
      zeroM: view.zeroM,
      timeMarks: view.timeMarks.map(mark => ({
        distanceM: mark.distanceM,
        x: x(mark.distanceM),
        y: y(mark.elevationMil),
        text: `${String(mark.timeOfFlightS).replace('.', ',')} с`,
      })),
      distanceTicks: DISTANCE_TICKS_M.map(distanceM => ({ x: x(distanceM), text: `${distanceM} м` })),
      bottomY: BOTTOM,
      maxText: String(maxMil).replace('.', ','),
    };
  });
}
