import { Component, computed, input } from '@angular/core';
import { text } from '../../../i18n';
import { CartridgeId } from '../../../core/types';
import { CardsByCartridge } from '../terms';
import { cartridgesView } from './scheme.model';

const CHART_WIDTH = 150;
const CHART_HEIGHT = 96;
const CHART_LEFT = 6;
const CHART_RIGHT = 144;
const CHART_TOP = 8;
const CHART_BOTTOM = 84;
const MAX_DISTANCE_M = 1000;
const LINE_STYLES: Record<CartridgeId, string> = { A: '6 3', B: 'none', C: '1.5 2.5' };

const T = text.textbook.schemes.cartridges;

type Curve = readonly { distanceM: number; mil: number }[];

@Component({
  selector: 'or-cartridges-scheme',
  template: `
    @let items = cartridges();
    <div class="facts">
      @for (item of items; track item.id) {
        <div class="cartridge" data-test="cartridge-fact">
          <svg class="swatch" viewBox="0 0 24 6"><line x1="0" y1="3" x2="24" y2="3" [attr.stroke-dasharray]="lineStyles[item.id]" /></svg>
          <b>{{ item.name }}</b>
          @for (fact of item.facts; track fact) {
            <span>{{ fact }}</span>
          }
        </div>
      }
    </div>
    <div class="charts">
      @for (chart of charts(); track chart.title) {
        <figure class="chart">
          <svg [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" role="img" [attr.aria-label]="chart.title" [attr.data-test]="chart.test">
            <line class="axis" [attr.x1]="chartLeft" [attr.y1]="chartTop" [attr.x2]="chartRight" [attr.y2]="chartTop" />
            @for (line of chart.lines; track line.id) {
              <polyline class="curve" [attr.points]="line.points" [attr.stroke-dasharray]="lineStyles[line.id]" />
            }
            <text class="small" [attr.x]="chartRight" [attr.y]="chartHeight - 2" text-anchor="end">{{ chart.axisText }}</text>
          </svg>
          <figcaption class="mono">{{ chart.title }}</figcaption>
        </figure>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
    .cartridge { display: flex; flex-direction: column; font: 500 var(--type-label) / 17px var(--font-mono); }
    .swatch { width: 32px; height: 8px; stroke: var(--paper-ink); stroke-width: 2; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .chart { margin: 0; display: flex; flex-direction: column; gap: 2px; }
    .chart svg { width: 100%; }
    .axis { stroke: var(--paper-graphite); stroke-width: 0.8; stroke-dasharray: 3 2; }
    .curve { fill: none; stroke: var(--paper-ink); stroke-width: 1.6; }
    .small { font: 500 9px var(--font-mono); fill: var(--paper-graphite); }
    figcaption { font: 500 var(--type-label) / 17px var(--font-mono); color: var(--paper-graphite); }
  `,
})
export class CartridgesSchemeComponent {
  readonly cards = input.required<CardsByCartridge>();

  protected readonly chartWidth = CHART_WIDTH;
  protected readonly chartHeight = CHART_HEIGHT;
  protected readonly chartLeft = CHART_LEFT;
  protected readonly chartRight = CHART_RIGHT;
  protected readonly chartTop = CHART_TOP;
  protected readonly lineStyles = LINE_STYLES;
  protected readonly cartridges = computed(() => cartridgesView(this.cards()));
  protected readonly charts = computed(() => {
    const items = this.cartridges();
    return [
      chart(T.dropTitle, 'cartridges-drop', items.map(item => ({ id: item.id, curve: item.drop }))),
      chart(T.driftTitle, 'cartridges-drift', items.map(item => ({ id: item.id, curve: item.driftPerMps }))),
    ];
  });
}

function chart(title: string, test: string, curves: readonly { id: CartridgeId; curve: Curve }[]) {
  const maxMil = Math.max(...curves.flatMap(item => item.curve.map(point => point.mil)));
  const x = (distanceM: number): number => CHART_LEFT + (distanceM / MAX_DISTANCE_M) * (CHART_RIGHT - CHART_LEFT);
  const y = (mil: number): number => CHART_TOP + (mil / maxMil) * (CHART_BOTTOM - CHART_TOP);
  return {
    title,
    test,
    axisText: T.axis({ distanceM: MAX_DISTANCE_M, maxMil }),
    lines: curves.map(item => ({ id: item.id, points: item.curve.map(point => `${x(point.distanceM)},${y(point.mil)}`).join(' ') })),
  };
}
