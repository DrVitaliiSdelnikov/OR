import { Component, input, output } from '@angular/core';
import { RADIO_CALLSIGN, RadioLine } from './radio.model';

@Component({
  selector: 'or-radio-plate',
  template: `
    <button class="plate mono" type="button" [class.important]="line().isImportant" (click)="dismiss.emit()" data-test="radio">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="6" y="7" width="12" height="15" rx="1.5" />
        <line x1="15" y1="7" x2="18" y2="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
      <span class="callsign">{{ callsign }}:</span>
      <span class="text" data-test="radio-text">{{ line().text }}</span>
    </button>
  `,
  styles: `
    :host { position: absolute; top: var(--space-2); left: var(--gutter); right: var(--gutter); z-index: 30; animation: drop var(--motion-hint) ease-out; }
    .plate { display: flex; align-items: center; gap: var(--space-2); width: 100%; min-height: var(--touch-min); padding: var(--space-2) var(--space-3); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-sunken); color: var(--device-text); font: 500 var(--type-label) / 18px var(--font-mono); text-align: left; }
    .important { border-color: var(--device-accent); }
    .icon { flex: none; width: 20px; height: 20px; fill: none; stroke: var(--device-accent); stroke-width: 1.6; }
    .callsign { flex: none; color: var(--device-accent); }
    @keyframes drop { from { transform: translateY(-12px); opacity: 0; } }
  `,
})
export class RadioPlateComponent {
  readonly line = input.required<RadioLine>();
  readonly dismiss = output<void>();
  protected readonly callsign = RADIO_CALLSIGN;
}
