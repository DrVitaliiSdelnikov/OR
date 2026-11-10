import { Component, computed, signal } from '@angular/core';
import { focalPlaneView } from './scheme.model';

const MIN_MAGNIFICATION = 3;
const MAX_MAGNIFICATION = 12;
const DOTS_EACH_SIDE = [-3, -2, -1, 1, 2, 3];

@Component({
  selector: 'or-focal-plane-scheme',
  template: `
    @let view = plane();
    <div class="planes">
      @for (plane of [
        { name: 'первая плоскость', spacing: view.firstPlaneMilSpacing, caption: view.firstPlaneCaption, test: 'focal-first' },
        { name: 'вторая плоскость', spacing: view.secondPlaneMilSpacing, caption: view.secondPlaneCaption, test: 'focal-second' }
      ]; track plane.test) {
        <figure class="plane" [attr.data-test]="plane.test">
          <svg viewBox="-50 -50 100 100" role="img" [attr.aria-label]="plane.name">
            <clipPath id="focal-glass-{{ plane.test }}"><circle r="48" /></clipPath>
            <g [attr.clip-path]="'url(#focal-glass-' + plane.test + ')'">
              <circle class="glass" r="48" />
              <circle class="gong" [attr.r]="view.gongRadius" />
              <line class="hair" x1="-50" y1="0" x2="50" y2="0" />
              <line class="hair" x1="0" y1="-50" x2="0" y2="50" />
              @for (step of dots; track step) {
                <circle class="dot" [attr.cx]="step * plane.spacing" cy="0" r="1.4" />
                <circle class="dot" cx="0" [attr.cy]="step * plane.spacing" r="1.4" />
              }
            </g>
            <circle class="rim" r="48" />
          </svg>
          <figcaption class="mono"><b>{{ plane.name }}</b><span data-test="focal-caption">{{ plane.caption }}</span></figcaption>
        </figure>
      }
    </div>
    <label class="zoom mono">
      <span>кратность <b data-test="focal-magnification">{{ magnification() }}×</b></span>
      <input type="range" [min]="minMagnification" [max]="maxMagnification" step="1" [value]="magnification()" (input)="setMagnification($event)" data-test="focal-slider" />
    </label>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    .planes { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    .plane { margin: 0; display: flex; flex-direction: column; gap: 4px; }
    svg { width: 100%; aspect-ratio: 1; }
    .glass { fill: color-mix(in srgb, var(--paper-graphite) 8%, transparent); }
    .rim { fill: none; stroke: var(--paper-graphite); stroke-width: 1; }
    .gong { fill: color-mix(in srgb, var(--paper-graphite) 30%, transparent); stroke: var(--paper-graphite); stroke-width: 0.8; }
    .hair { stroke: var(--paper-ink); stroke-width: 0.6; }
    .dot { fill: var(--paper-ink); }
    figcaption { display: flex; flex-direction: column; font: 500 var(--type-label) / 17px var(--font-mono); }
    figcaption b { font-weight: 700; text-transform: uppercase; color: var(--paper-graphite); }
    .zoom { display: flex; flex-direction: column; gap: 4px; font: 500 var(--type-label) / 18px var(--font-mono); }
    input { width: 100%; min-height: var(--touch-min); accent-color: var(--paper-ink); }
  `,
})
export class FocalPlaneSchemeComponent {
  protected readonly minMagnification = MIN_MAGNIFICATION;
  protected readonly maxMagnification = MAX_MAGNIFICATION;
  protected readonly dots = DOTS_EACH_SIDE;
  protected readonly magnification = signal(MIN_MAGNIFICATION * 2);
  protected readonly plane = computed(() => focalPlaneView(this.magnification()));

  protected setMagnification(event: Event): void {
    this.magnification.set(Number((event.target as HTMLInputElement).value));
  }
}
