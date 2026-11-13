import { Component, computed, input, signal } from '@angular/core';
import { Correction } from '../../core/types';
import { text } from '../../i18n';
import { FlightPaths, FlightPoint } from '../../sim/flight-path';
import { groupText } from './review.model';
import { TargetSchemeComponent } from './target-scheme.component';

type FlightViewKind = 'front' | 'side' | 'top';

const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 150;
const PLOT_LEFT = 8;
const PLOT_RIGHT = 284;
const PLOT_HALF_HEIGHT = 60;
const HEADROOM = 1.15;
const CM_PER_MIL_PER_M = 0.1;
const T = text.screens.flightView;
const VIEW_TABS: readonly { kind: FlightViewKind; label: string }[] = (Object.keys(T.tabs) as FlightViewKind[]).map(kind => ({ kind, label: T.tabs[kind] }));

@Component({
  selector: 'or-flight-view',
  imports: [TargetSchemeComponent],
  template: `
    <section class="flight" data-test="flight-view">
      <div class="title">{{ texts.title }}</div>
      <div class="tabs" role="tablist">
        @for (tab of tabs; track tab.kind) {
          <button class="tab mono" type="button" role="tab" [class.active]="kind() === tab.kind" [attr.aria-selected]="kind() === tab.kind" (click)="kind.set(tab.kind)" [attr.data-test]="'flight-tab-' + tab.kind">{{ tab.label }}</button>
        }
      </div>
      @if (kind() === 'front') {
        <div class="front">
          <or-target-scheme [radiusMil]="radiusMil()" [groupPoints]="group()" />
          <div class="group-text mono" data-test="group-text">{{ groupLine() }}</div>
        </div>
      } @else {
        @let plot = scene();
        <svg class="plot" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="kind() === 'side' ? texts.plotSide : texts.plotTop" [attr.data-test]="'flight-plot-' + kind()">
          <line class="sight" [attr.x1]="left" [attr.y1]="middle" [attr.x2]="right" [attr.y2]="middle" />
          <line class="gong" [attr.x1]="right" [attr.y1]="middle - plot.gongHalf" [attr.x2]="right" [attr.y2]="middle + plot.gongHalf" />
          <polyline class="centre" [attr.points]="plot.centre" data-test="flight-centre" />
          <polyline class="bullet" [attr.points]="plot.bullet" data-test="flight-bullet" />
          <text class="axis-caption" [attr.x]="left" [attr.y]="height - 4">{{ texts.axisStart }}</text>
          <text class="axis-caption end" [attr.x]="right" [attr.y]="height - 4">{{ texts.axisEnd({ distanceM: distanceM() }) }}</text>
          <text class="axis-caption" [attr.x]="left" y="12">{{ texts.scale({ isSide: kind() === 'side', scaleCm: plot.scaleCm }) }}</text>
        </svg>
        <div class="legend mono">{{ texts.legend }}</div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .title { font: 700 var(--type-label) / 16px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin: var(--space-2) 0; }
    .tab { min-height: var(--touch-min); border: 1px solid var(--paper-grid); border-radius: var(--radius-paper); background: transparent; color: var(--paper-graphite); font: 700 12px / 16px var(--font-mono); text-transform: uppercase; }
    .tab.active { border-color: var(--paper-ink); color: var(--paper-ink); background: color-mix(in srgb, var(--paper-ink) 8%, transparent); }
    .front { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-2); align-items: center; }
    .group-text { font: 700 var(--type-label) / 18px var(--font-mono); }
    .plot { display: block; width: 100%; border: 1px solid var(--paper-grid); background: var(--paper-bg); }
    .sight { stroke: var(--paper-grid); stroke-width: 1; }
    .gong { stroke: var(--paper-graphite); stroke-width: 4; }
    .centre { fill: none; stroke: var(--paper-graphite); stroke-width: 1.5; stroke-dasharray: 4 3; }
    .bullet { fill: none; stroke: var(--paper-red-pencil); stroke-width: 2; }
    .axis-caption { fill: var(--paper-graphite); font: 500 10px var(--font-mono); }
    .axis-caption.end { text-anchor: end; }
    .legend { margin-top: 4px; font: 500 11px / 14px var(--font-mono); color: var(--paper-graphite); }
  `,
})
export class FlightViewComponent {
  readonly flight = input.required<FlightPaths>();
  readonly group = input.required<readonly Correction[]>();
  readonly radiusMil = input.required<number>();
  readonly distanceM = input.required<number>();

  protected readonly tabs = VIEW_TABS;
  protected readonly width = VIEW_WIDTH;
  protected readonly height = VIEW_HEIGHT;
  protected readonly texts = T;
  protected readonly left = PLOT_LEFT;
  protected readonly right = PLOT_RIGHT;
  protected readonly middle = VIEW_HEIGHT / 2;
  protected readonly kind = signal<FlightViewKind>('side');
  protected readonly groupLine = computed(() => groupText(this.group()));
  protected readonly scene = computed(() => {
    const valueOf = (point: FlightPoint): number => (this.kind() === 'side' ? point.heightCm : -point.sideCm);
    const { bullet, centre } = this.flight();
    const radiusCm = this.radiusMil() * this.distanceM() * CM_PER_MIL_PER_M;
    const scaleCm = Math.ceil(Math.max(radiusCm, ...[...bullet, ...centre].map(point => Math.abs(valueOf(point)))) * HEADROOM);
    const ptPerCm = PLOT_HALF_HEIGHT / scaleCm;
    const ptPerM = (PLOT_RIGHT - PLOT_LEFT) / this.distanceM();
    const polyline = (points: readonly FlightPoint[]): string =>
      points.map(point => `${(PLOT_LEFT + point.distanceM * ptPerM).toFixed(1)},${(VIEW_HEIGHT / 2 - valueOf(point) * ptPerCm).toFixed(1)}`).join(' ');
    return { bullet: polyline(bullet), centre: polyline(centre), gongHalf: radiusCm * ptPerCm, scaleCm };
  });
}
