import { Component, input, output } from '@angular/core';
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
        <or-wind-clock [clock]="wind()?.clock ?? null" (clockChange)="windChange.emit({ speedMps: wind()?.speedMps ?? 0, clock: $event })" />
        <or-speed-wheel [speed]="wind()?.speedMps ?? null" (speedChange)="windChange.emit({ speedMps: $event, clock: wind()?.clock ?? 12 })" />
      </div>
      <div class="station mono" data-test="wind-station">{{ stationText() }}</div>
      <div class="correction mono" data-test="wind-correction">{{ correctionText() }}</div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wind { display: flex; flex-direction: column; gap: var(--space-2); }
    .instruments { display: grid; grid-template-columns: 1fr 132px; align-items: center; gap: var(--space-2); }
    .caption { text-align: center; font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-ink); }
    .station { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .correction { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-ink); }
  `,
})
export class WindTabComponent {
  readonly wind = input<WindInput | null>(null);
  readonly caption = input.required<string>();
  readonly stationText = input.required<string>();
  readonly correctionText = input.required<string>();
  readonly windChange = output<WindInput>();
}
