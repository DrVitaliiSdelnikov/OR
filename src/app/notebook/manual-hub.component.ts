import { Component, input, output } from '@angular/core';
import { NotebookStepId } from '../../sim/notebook';
import { HubRow } from './calc-sheet.model';

@Component({
  selector: 'or-manual-hub',
  template: `
    <div class="head">
      <span class="badge mono" data-test="manual-mode" data-hint="manual-mode">{{ badge() }}</span>
      <button class="formulas mono" type="button" (click)="formulas.emit()" data-test="hub-formulas">{{ formulasLabel() }}</button>
    </div>
    <div class="steps">
      @for (row of rows(); track row.step) {
        <button class="step" type="button" [class.recorded]="row.state === 'recorded'" [class.stale]="row.state === 'stale'" (click)="openStep.emit(row.step)" [attr.data-test]="'step-' + row.step" [attr.data-hint]="'step-' + row.step">
          <span class="number mono">{{ row.number }}</span>
          <span class="text">
            <span class="title">{{ row.title }}</span>
            <span class="formula mono">{{ row.formula }}</span>
            <span class="note mono" [attr.data-test]="'step-note-' + row.step">{{ row.note }}</span>
          </span>
          <span class="value mono" [attr.data-test]="'step-value-' + row.step">{{ row.valueText }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-2); }
    .badge { font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); color: var(--paper-ink); }
    .formulas { min-height: var(--touch-min); padding: 0 var(--space-3); border: 1.5px solid var(--paper-graphite); border-radius: var(--radius-device); background: transparent; color: var(--paper-graphite); font: 700 var(--type-label) / 16px var(--font-mono); text-transform: uppercase; }
    .steps { display: flex; flex-direction: column; gap: 6px; }
    .step { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: var(--space-2); min-height: 60px; padding: 6px 8px; border: 1.5px dashed var(--paper-graphite); border-radius: var(--radius-paper); background: transparent; color: var(--paper-ink); text-align: left; }
    .step.recorded { border-style: solid; }
    .step.stale .title, .step.stale .formula { text-decoration: line-through dashed; color: var(--paper-graphite); }
    .step.stale .note { color: var(--paper-red-pencil); }
    .number { display: grid; place-items: center; width: 28px; height: 28px; border: 1.5px solid var(--paper-ink); border-radius: 2px; font: 700 var(--type-label) / 16px var(--font-mono); }
    .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .title { font: 700 var(--type-label) / 16px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .formula, .note { font: 500 11px / 14px var(--font-mono); color: var(--paper-graphite); }
    .value { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-graphite); white-space: nowrap; }
  `,
})
export class ManualHubComponent {
  readonly rows = input.required<HubRow[]>();
  readonly badge = input.required<string>();
  readonly formulasLabel = input.required<string>();
  readonly openStep = output<NotebookStepId>();
  readonly formulas = output<void>();
}
