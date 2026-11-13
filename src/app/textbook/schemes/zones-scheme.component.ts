import { Component, computed, input } from '@angular/core';
import { decimal } from '../../../i18n/format';
import { text } from '../../../i18n';
import { DopeCard } from '../../../core/dope-card';
import { zonesView } from './scheme.model';

const WIDTH = 320;
const HEIGHT = 112;
const LEFT = 18;
const RIGHT = 302;
const TRACK_Y = 70;
const BAND_TOP = 52;
const BAND_HEIGHT = 36;
const FLAG_HEIGHT = 26;

@Component({
  selector: 'or-zones-scheme',
  template: `
    @let view = zonesScene();
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="texts.label" data-test="zones-scheme">
      @for (zone of view.zones; track zone.fromX; let index = $index) {
        <rect class="band" [class.odd]="index % 2 === 1" [attr.x]="zone.fromX" [attr.y]="bandTop" [attr.width]="zone.width" [attr.height]="bandHeight" />
        <text class="weight" [attr.x]="zone.fromX + zone.width / 2" [attr.y]="bandTop + bandHeight + 16" data-test="zone-weight">{{ zone.weightText }}</text>
      }
      <line class="track" [attr.x1]="left" [attr.y1]="trackY" [attr.x2]="right" [attr.y2]="trackY" />
      <circle class="shooter" [attr.cx]="left" [attr.cy]="trackY" r="4" />
      <circle class="target" [attr.cx]="right" [attr.cy]="trackY" r="5" />
      @for (flag of view.flags; track flag.text) {
        <line class="pole" [attr.x1]="flag.x" [attr.y1]="trackY" [attr.x2]="flag.x" [attr.y2]="trackY - flagHeight" />
        <polygon class="cloth" [attr.points]="flag.cloth" />
        <text class="small" [attr.x]="flag.x" [attr.y]="trackY - flagHeight - 6">{{ flag.text }}</text>
      }
      <text class="small" [attr.x]="left" [attr.y]="trackY - 12">{{ texts.shooter }}</text>
    </svg>
    <p class="caption mono" data-test="scheme-caption">{{ view.caption }}</p>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--space-2); }
    svg { width: 100%; }
    .band { fill: color-mix(in srgb, var(--paper-graphite) 10%, transparent); }
    .band.odd { fill: color-mix(in srgb, var(--paper-graphite) 22%, transparent); }
    .track { stroke: var(--paper-ink); stroke-width: 1.5; stroke-dasharray: 5 3; }
    .shooter, .target { fill: var(--paper-ink); }
    .pole { stroke: var(--paper-ink); stroke-width: 1.5; }
    .cloth { fill: var(--paper-red-pencil); }
    .weight { font: 700 12px var(--font-mono); fill: var(--paper-ink); text-anchor: middle; }
    .small { font: 500 10px var(--font-mono); fill: var(--paper-graphite); text-anchor: middle; }
    .caption { margin: 0; font: 500 var(--type-label) / 18px var(--font-mono); }
  `,
})
export class ZonesSchemeComponent {
  readonly card = input.required<DopeCard>();

  protected readonly texts = text.textbook.schemes.zones;
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly left = LEFT;
  protected readonly right = RIGHT;
  protected readonly trackY = TRACK_Y;
  protected readonly bandTop = BAND_TOP;
  protected readonly bandHeight = BAND_HEIGHT;
  protected readonly flagHeight = FLAG_HEIGHT;

  protected readonly zonesScene = computed(() => {
    const view = zonesView(this.card());
    const x = (distanceM: number): number => LEFT + (distanceM / view.distanceM) * (RIGHT - LEFT);
    return {
      caption: this.texts.caption({ distanceM: view.distanceM }),
      zones: view.zones.map(zone => ({
        fromX: x(zone.fromM),
        width: x(zone.toM) - x(zone.fromM),
        weightText: decimal(zone.weight),
      })),
      flags: view.flagsM.map(distanceM => {
        const flagX = x(distanceM);
        const poleTop = TRACK_Y - FLAG_HEIGHT;
        return { x: flagX, text: `${distanceM}`, cloth: `${flagX},${poleTop} ${flagX + 12},${poleTop + 4} ${flagX},${poleTop + 8}` };
      }),
    };
  });
}
