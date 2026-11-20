import { Component, input, output } from '@angular/core';
import { text } from '../../i18n';
import { DraftKey, SideOption } from '../notebook/calc-sheet.model';
import { KeypadComponent } from '../notebook/keypad.component';

@Component({
  selector: 'or-drill-answer',
  imports: [KeypadComponent],
  template: `
    <section class="answer" data-test="drill-answer">
      <div class="paper">
        <div class="formula mono">{{ formula() }}</div>
        <div class="value-row mono">
          <span class="label">{{ texts.answer }}</span>
          <span class="value" data-test="drill-answer-value">{{ valueText() || '·' }}</span>
          <span class="unit">{{ unit() }}</span>
        </div>
        @if (sides().length > 0) {
          <div class="sides">
            @for (side of sides(); track side.sign) {
              <button class="side mono" type="button" [class.chosen]="sign() === side.sign" (click)="sideChange.emit(side.sign)" [attr.data-test]="'side-' + side.sign">{{ side.label }}</button>
            }
          </div>
        }
      </div>
      <div class="device">
        <or-keypad (press)="key.emit($event)" />
        <button class="record mono" type="button" [disabled]="!canRecord()" (click)="record.emit()" data-test="calc-record">{{ texts.record }}</button>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .answer { display: flex; flex-direction: column; height: 100%; }
    .paper { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3) var(--gutter); background-color: var(--paper-bg); background-image: linear-gradient(var(--paper-grid) 1px, transparent 1px), linear-gradient(90deg, var(--paper-grid) 1px, transparent 1px); background-size: 16px 16px; color: var(--paper-ink); }
    .formula { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--paper-graphite); }
    .value-row { display: flex; align-items: baseline; gap: var(--space-2); min-height: var(--touch-min); border-bottom: 2px solid var(--paper-stamp-gold); font: 700 var(--type-title) / 32px var(--font-mono); }
    .label { flex: 1; font: 500 var(--type-label) / 18px var(--font-mono); }
    .unit { font: 500 var(--type-label) / 18px var(--font-mono); }
    .sides { display: flex; gap: var(--space-2); }
    .side { flex: 1; min-height: var(--touch-min); border: 1.5px solid var(--paper-graphite); border-radius: var(--radius-device); background: transparent; color: var(--paper-graphite); font: 700 var(--type-label) / 16px var(--font-mono); text-transform: uppercase; }
    .side.chosen { background: var(--paper-graphite); color: var(--paper-bg); }
    .device { display: flex; flex: 1; flex-direction: column; justify-content: flex-end; gap: var(--space-2); padding: var(--space-2) var(--gutter) var(--space-3); }
    .record { min-height: 52px; border: none; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .record:disabled { opacity: 0.45; }
  `,
})
export class DrillAnswerComponent {
  readonly formula = input.required<string>();
  readonly valueText = input.required<string>();
  readonly unit = input.required<string>();
  readonly sides = input.required<readonly SideOption[]>();
  readonly sign = input<1 | -1 | null>(null);
  readonly canRecord = input(false);
  readonly key = output<DraftKey>();
  readonly sideChange = output<1 | -1>();
  readonly record = output<void>();
  protected readonly texts = text.drills.answer;
}
