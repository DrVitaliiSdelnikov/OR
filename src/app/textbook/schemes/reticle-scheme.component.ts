import { Component, signal } from '@angular/core';
import { reticleMarks } from '../../../sim/reticle';
import { ReticleKind } from '../../../sim/scope-model';
import { nearestReticleMark, RETICLE_SCHEME_HALF_MIL, reticleSchemeMarks, TappedReticleMark } from './scheme.model';

const UNITS_PER_MIL = 10;
const HALF_VIEW = RETICLE_SCHEME_HALF_MIL * UNITS_PER_MIL + 5;
const LONG_TICK_HALF = 2.5;
const SHORT_TICK_HALF = 1.3;
const LABEL_RAISE = 4;
const RETICLES: readonly { kind: ReticleKind; name: string }[] = [
  { kind: 'tree', name: 'Ёлка' },
  { kind: 'mil-dot', name: 'MIL-dot' },
  { kind: 'moa-grid', name: 'MOA' },
];

interface DrawnMark {
  kind: TappedReticleMark['kind'];
  x: number;
  y: number;
  text: string;
  isOnHorizontalAxis: boolean;
}

@Component({
  selector: 'or-reticle-scheme',
  template: `
    <div class="reticles">
      @for (reticle of reticles; track reticle.kind) {
        <figure class="reticle">
          <svg [attr.viewBox]="viewBox" role="img" [attr.aria-label]="'Сетка ' + reticle.name" (pointerdown)="tap($event, reticle.kind)" [attr.data-test]="'reticle-scheme-' + reticle.kind">
            <circle class="glass" [attr.r]="glassRadius" />
            <line class="hair" [attr.x1]="-glassRadius" y1="0" [attr.x2]="glassRadius" y2="0" />
            <line class="hair" x1="0" [attr.y1]="-glassRadius" x2="0" [attr.y2]="glassRadius" />
            @if (reticle.kind === 'mil-dot') {
              @for (side of sides; track side) {
                <line class="post" [attr.x1]="side * postFrom" y1="0" [attr.x2]="side * glassRadius" y2="0" />
                <line class="post" x1="0" [attr.y1]="side * postFrom" x2="0" [attr.y2]="side * glassRadius" />
              }
            }
            @for (mark of drawn[reticle.kind]; track $index) {
              @switch (mark.kind) {
                @case ('label') {
                  <text class="label" [attr.x]="mark.x" [attr.y]="-labelRaise">{{ mark.text }}</text>
                }
                @case ('mil-dot') {
                  <circle class="dot" [attr.cx]="mark.x" [attr.cy]="mark.y" r="1.2" />
                }
                @case ('holdover-dot') {
                  <circle class="dot" [attr.cx]="mark.x" [attr.cy]="mark.y" r="0.55" />
                }
                @default {
                  <line
                    class="tick"
                    [attr.x1]="mark.isOnHorizontalAxis ? mark.x : mark.x - tickHalf(mark.kind)"
                    [attr.y1]="mark.isOnHorizontalAxis ? mark.y - tickHalf(mark.kind) : mark.y"
                    [attr.x2]="mark.isOnHorizontalAxis ? mark.x : mark.x + tickHalf(mark.kind)"
                    [attr.y2]="mark.isOnHorizontalAxis ? mark.y + tickHalf(mark.kind) : mark.y"
                  />
                }
              }
            }
            @if (selected(); as chosen) {
              @if (chosen.reticle === reticle.kind) {
                <circle class="selected" [attr.cx]="chosen.mark.rightMil * unitsPerMil" [attr.cy]="chosen.mark.downMil * unitsPerMil" r="4" data-test="reticle-mark-selected" />
              }
            }
          </svg>
          <figcaption class="name mono">{{ reticle.name }}</figcaption>
        </figure>
      }
    </div>
    <p class="caption mono" data-test="scheme-caption">{{ selected()?.mark?.caption ?? 'Тапни по метке сетки' }}</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .reticles { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
    .reticle { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    svg { width: 100%; aspect-ratio: 1; touch-action: manipulation; }
    .glass { fill: color-mix(in srgb, var(--paper-graphite) 8%, transparent); stroke: var(--paper-graphite); stroke-width: 1; }
    .hair, .tick { stroke: var(--paper-ink); stroke-width: 0.5; }
    .post { stroke: var(--paper-ink); stroke-width: 2.5; }
    .dot { fill: var(--paper-ink); }
    .label { font: 600 5px var(--font-mono); fill: var(--paper-ink); text-anchor: middle; }
    .selected { fill: none; stroke: var(--paper-red-pencil); stroke-width: 1.2; }
    .name { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .caption { margin: 0; min-height: 18px; font: 500 var(--type-label) / 18px var(--font-mono); }
  `,
})
export class ReticleSchemeComponent {
  protected readonly reticles = RETICLES;
  protected readonly glassRadius = RETICLE_SCHEME_HALF_MIL * UNITS_PER_MIL + 2;
  protected readonly viewBox = `${-HALF_VIEW} ${-HALF_VIEW} ${HALF_VIEW * 2} ${HALF_VIEW * 2}`;
  protected readonly unitsPerMil = UNITS_PER_MIL;
  protected readonly labelRaise = LABEL_RAISE;
  protected readonly sides = [-1, 1];
  protected readonly postFrom = reticleMarks('mil-dot').thickPostFromMil! * UNITS_PER_MIL;
  protected readonly drawn = Object.fromEntries(RETICLES.map(reticle => [reticle.kind, drawnMarks(reticle.kind)])) as Record<ReticleKind, DrawnMark[]>;
  protected readonly selected = signal<{ reticle: ReticleKind; mark: TappedReticleMark } | null>(null);

  protected tickHalf(kind: TappedReticleMark['kind']): number {
    return kind === 'mil-tick' || kind === 'five-moa-tick' ? LONG_TICK_HALF : SHORT_TICK_HALF;
  }

  protected tap(event: PointerEvent, reticle: ReticleKind): void {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const rightMil = (((event.clientX - rect.left) / rect.width) * 2 - 1) * (HALF_VIEW / UNITS_PER_MIL);
    const downMil = (((event.clientY - rect.top) / rect.height) * 2 - 1) * (HALF_VIEW / UNITS_PER_MIL);
    const mark = nearestReticleMark(reticle, rightMil, downMil);
    this.selected.set(mark ? { reticle, mark } : null);
  }
}

function drawnMarks(kind: ReticleKind): DrawnMark[] {
  return reticleSchemeMarks(kind).map(mark => ({
    kind: mark.kind,
    x: mark.rightMil * UNITS_PER_MIL,
    y: mark.downMil * UNITS_PER_MIL,
    text: mark.text ?? '',
    isOnHorizontalAxis: mark.downMil === 0,
  }));
}
