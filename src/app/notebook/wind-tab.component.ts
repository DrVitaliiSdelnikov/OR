import { Component, input, output } from '@angular/core';
import { text } from '../../i18n';
import { ZoneTable } from './notebook.model';
import { SpeedWheelComponent } from './speed-wheel.component';
import { WindClockComponent } from './wind-clock.component';

export interface WindInput {
  speedMps: number;
  clock: number;
}

@Component({
  selector: 'or-wind-tab',
  imports: [WindClockComponent, SpeedWheelComponent],
  template: `
    <div class="wind">
      <div class="caption mono" data-test="wind-caption">{{ caption() }}</div>
      <div class="instruments">
        <or-wind-clock [clock]="wind()?.clock ?? null" [showShares]="showShares()" (clockChange)="windChange.emit({ speedMps: wind()?.speedMps ?? 0, clock: $event })" />
        <or-speed-wheel [speed]="wind()?.speedMps ?? null" (speedChange)="windChange.emit({ speedMps: $event, clock: wind()?.clock ?? 12 })" />
      </div>
      <div class="station mono" data-test="wind-station">{{ stationText() }}</div>
      @if (zones(); as table) {
        <div class="zones" data-test="zone-weights" data-hint="zone-weights">
          <div class="zones-title mono">{{ texts.zoneWeights }}</div>
          @for (weight of table.weights; track weight.label) {
            <div class="zone mono"><span class="zone-label">{{ weight.label }}</span><span class="zone-weight" data-test="zone-weight">{{ weight.value }}</span></div>
          }
        </div>
        <div class="flags" data-test="flag-readings">
          @for (flag of table.flags; track flag.distanceM) {
            <div class="flag mono" [class.unread]="!flag.isRead" [attr.data-test]="'flag-' + flag.distanceM">{{ texts.flag({ distanceM: flag.distanceM, text: flag.text }) }}</div>
          }
        </div>
      }
      @if (stepLinkText(); as link) {
        <button class="step-link mono" type="button" (click)="toStep.emit()" data-test="wind-step-link" data-hint="wind-step-link">{{ link }}</button>
      } @else {
        <div class="correction mono" data-test="wind-correction">{{ correctionText() }}</div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wind { display: flex; flex-direction: column; gap: var(--space-2); }
    .instruments { display: grid; grid-template-columns: 1fr 132px; align-items: center; gap: var(--space-2); }
    .caption { text-align: center; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-ink); }
    .station { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .zones { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-1); border-top: 1px dashed var(--paper-graphite); padding-top: var(--space-2); }
    .zones-title { grid-column: 1 / -1; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .zone { display: flex; flex-direction: column; align-items: center; }
    .zone-label { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .zone-weight { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-ink); }
    .flags { display: flex; flex-direction: column; gap: 2px; }
    .flag { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-ink); }
    .flag.unread { color: var(--paper-graphite); }
    .correction { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-ink); }
    .step-link { min-height: var(--touch-min); border: 1.5px solid var(--paper-graphite); border-radius: var(--radius-device); background: transparent; color: var(--paper-ink); font: 700 var(--type-label) / 16px var(--font-mono); text-align: left; padding: 0 var(--space-3); }
  `,
})
export class WindTabComponent {
  readonly wind = input<WindInput | null>(null);
  readonly caption = input.required<string>();
  readonly stationText = input.required<string>();
  readonly correctionText = input.required<string>();
  readonly stepLinkText = input<string | null>(null);
  readonly showShares = input(false);
  readonly zones = input<ZoneTable | null>(null);
  readonly windChange = output<WindInput>();
  readonly toStep = output<void>();

  protected readonly texts = text.notebook.windTab;
}
