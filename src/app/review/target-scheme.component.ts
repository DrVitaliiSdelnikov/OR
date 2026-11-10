import { Component, computed, input, output } from '@angular/core';
import { Correction } from '../../core/types';

const VIEW_SIZE = 200;
const VIEW_CENTER = VIEW_SIZE / 2;
const EDGE_MARGIN = 10;
const GONG_SHARE_OF_VIEW = 0.32;
const GRID_STEP_MIL = 0.1;
const MIN_VIEW_HALF_MIL = 1;

interface ScenePoint {
  x: number;
  y: number;
  isClamped: boolean;
}

@Component({
  selector: 'or-target-scheme',
  template: `
    <svg
      class="scheme"
      [attr.viewBox]="'0 0 ' + size + ' ' + size"
      role="img"
      [attr.aria-label]="isPicking() ? 'Отметь, где была сетка' : 'Схема мишени: вызов и попадание'"
      (pointerdown)="tap($event)"
      data-test="target-scheme"
    >
      @for (line of gridLines(); track $index) {
        <line class="grid" [attr.x1]="line.x1" [attr.y1]="line.y1" [attr.x2]="line.x2" [attr.y2]="line.y2" />
      }
      <circle class="gong" [attr.cx]="center" [attr.cy]="center" [attr.r]="gongRadius()" />
      @if (callPoint(); as call) {
        @if (impactPoint(); as impact) {
          <line class="link" [attr.x1]="call.x" [attr.y1]="call.y" [attr.x2]="impact.x" [attr.y2]="impact.y" />
        }
        <g class="call" data-test="scheme-call">
          <line [attr.x1]="call.x - 7" [attr.y1]="call.y" [attr.x2]="call.x + 7" [attr.y2]="call.y" />
          <line [attr.x1]="call.x" [attr.y1]="call.y - 7" [attr.x2]="call.x" [attr.y2]="call.y + 7" />
        </g>
      }
      @if (playerCallPoint(); as mark) {
        <g class="player-call" data-test="scheme-player-call">
          <line [attr.x1]="mark.x - 7" [attr.y1]="mark.y" [attr.x2]="mark.x + 7" [attr.y2]="mark.y" />
          <line [attr.x1]="mark.x" [attr.y1]="mark.y - 7" [attr.x2]="mark.x" [attr.y2]="mark.y + 7" />
        </g>
      }
      @for (mark of callScenePoints(); track $index) {
        <g class="series-call" data-test="scheme-series-call">
          <line [attr.x1]="mark.x - 4" [attr.y1]="mark.y" [attr.x2]="mark.x + 4" [attr.y2]="mark.y" />
          <line [attr.x1]="mark.x" [attr.y1]="mark.y - 4" [attr.x2]="mark.x" [attr.y2]="mark.y + 4" />
        </g>
      }
      @for (point of groupScenePoints(); track $index) {
        <circle class="group-point" [attr.cx]="point.x" [attr.cy]="point.y" r="4" data-test="scheme-group-point" />
      }
      @if (meanScenePoint(); as mean) {
        <g class="mean" data-test="scheme-mean">
          <line class="transfer" [attr.x1]="mean.x" [attr.y1]="mean.y" [attr.x2]="center" [attr.y2]="center" />
          <line [attr.x1]="mean.x - 8" [attr.y1]="mean.y" [attr.x2]="mean.x + 8" [attr.y2]="mean.y" />
          <line [attr.x1]="mean.x" [attr.y1]="mean.y - 8" [attr.x2]="mean.x" [attr.y2]="mean.y + 8" />
        </g>
      }
      @if (impactPoint(); as impact) {
        <circle class="impact" [class.clamped]="impact.isClamped" [attr.cx]="impact.x" [attr.cy]="impact.y" r="5" data-test="scheme-impact" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    .scheme { display: block; width: 100%; max-width: 220px; aspect-ratio: 1; border: 1px solid var(--paper-grid); background: var(--paper-bg); touch-action: none; }
    .grid { stroke: var(--paper-grid); stroke-width: 0.5; }
    .gong { fill: color-mix(in srgb, var(--paper-graphite) 18%, transparent); stroke: var(--paper-graphite); stroke-width: 1.5; }
    .link { stroke: var(--paper-graphite); stroke-width: 1.2; stroke-dasharray: 3 3; }
    .call line { stroke: var(--paper-ink); stroke-width: 2; }
    .player-call line { stroke: var(--paper-red-pencil); stroke-width: 2; }
    .impact { fill: var(--paper-ink); }
    .series-call line { stroke: var(--paper-graphite); stroke-width: 1.2; }
    .group-point { fill: none; stroke: var(--paper-ink); stroke-width: 2; }
    .impact.clamped { fill: var(--paper-red-pencil); }
    .mean line { stroke: var(--paper-red-pencil); stroke-width: 2; }
    .mean .transfer { stroke-width: 1.5; stroke-dasharray: 4 3; }
  `,
})
export class TargetSchemeComponent {
  readonly radiusMil = input.required<number>();
  readonly call = input<Correction | null>(null);
  readonly impact = input<Correction | null>(null);
  readonly playerCall = input<Correction | null>(null);
  readonly groupPoints = input<readonly Correction[]>([]);
  readonly callPoints = input<readonly Correction[]>([]);
  readonly meanPoint = input<Correction | null>(null);
  readonly isPicking = input(false);
  readonly pick = output<Correction>();

  protected readonly size = VIEW_SIZE;
  protected readonly center = VIEW_CENTER;
  private readonly halfViewMil = computed(() => Math.max(MIN_VIEW_HALF_MIL, this.radiusMil() / GONG_SHARE_OF_VIEW / 2));
  private readonly ptPerMil = computed(() => (VIEW_CENTER - EDGE_MARGIN) / this.halfViewMil());
  protected readonly gongRadius = computed(() => this.radiusMil() * this.ptPerMil());
  protected readonly callPoint = computed(() => this.toScene(this.call()));
  protected readonly impactPoint = computed(() => this.toScene(this.impact()));
  protected readonly playerCallPoint = computed(() => this.toScene(this.playerCall()));
  protected readonly groupScenePoints = computed(() => this.groupPoints().map(point => this.toScene(point)!));
  protected readonly meanScenePoint = computed(() => this.toScene(this.meanPoint()));
  protected readonly callScenePoints = computed(() => this.callPoints().map(point => this.toScene(point)!));
  protected readonly gridLines = computed(() => {
    const stepPt = GRID_STEP_MIL * 5 * this.ptPerMil();
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let offset = stepPt; offset < VIEW_CENTER; offset += stepPt) {
      for (const position of [VIEW_CENTER - offset, VIEW_CENTER + offset]) {
        lines.push({ x1: position, y1: 0, x2: position, y2: VIEW_SIZE }, { x1: 0, y1: position, x2: VIEW_SIZE, y2: position });
      }
    }
    lines.push({ x1: VIEW_CENTER, y1: 0, x2: VIEW_CENTER, y2: VIEW_SIZE }, { x1: 0, y1: VIEW_CENTER, x2: VIEW_SIZE, y2: VIEW_CENTER });
    return lines;
  });

  protected tap(event: PointerEvent): void {
    if (!this.isPicking()) {
      return;
    }
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const xPt = ((event.clientX - rect.left) / rect.width) * VIEW_SIZE;
    const yPt = ((event.clientY - rect.top) / rect.height) * VIEW_SIZE;
    this.pick.emit({ upMrad: (VIEW_CENTER - yPt) / this.ptPerMil(), rightMrad: (xPt - VIEW_CENTER) / this.ptPerMil() });
  }

  private toScene(point: Correction | null): ScenePoint | null {
    if (!point) {
      return null;
    }
    const limit = VIEW_CENTER - EDGE_MARGIN / 2;
    const x = point.rightMrad * this.ptPerMil();
    const y = -point.upMrad * this.ptPerMil();
    const isClamped = Math.abs(x) > limit || Math.abs(y) > limit;
    const scale = isClamped ? limit / Math.max(Math.abs(x), Math.abs(y)) : 1;
    return { x: VIEW_CENTER + x * scale, y: VIEW_CENTER + y * scale, isClamped };
  }
}
