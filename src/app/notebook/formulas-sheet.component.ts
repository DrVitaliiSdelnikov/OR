import { Component, input, output } from '@angular/core';
import { text } from '../../i18n';
import { clockShareLines, moaPerMilText, referencePriceText } from './notebook.model';

export interface FormulaLine {
  title: string;
  formula: string;
}

@Component({
  selector: 'or-formulas-sheet',
  template: `
    <div class="scrim" (click)="close.emit()"></div>
    <section class="sheet" role="dialog" [attr.aria-label]="texts.label" data-test="formulas-sheet">
      @if (needsConfirm()) {
        <div class="confirm" data-test="formulas-confirm">
          <div class="question">{{ referencePrice }}</div>
          <div class="confirm-actions">
            <button class="primary mono" type="button" (click)="confirm.emit()" data-test="formulas-open">{{ texts.open }}</button>
            <button class="secondary mono" type="button" (click)="close.emit()" data-test="formulas-cancel">{{ texts.cancel }}</button>
          </div>
        </div>
      } @else {
        <div class="title">{{ title }}</div>
        <div class="lines mono" data-test="formulas-list">
          @for (line of lines(); track line.title) {
            <div class="line"><b>{{ line.title }}</b> {{ line.formula }}</div>
          }
          <div class="line"><b>{{ texts.clockShares }}</b></div>
          @for (share of shares; track share) {
            <div class="line share">{{ share }}</div>
          }
          <div class="line"><b>{{ texts.units }}</b> 1 MIL = {{ moaPerMil }} MOA</div>
        </div>
        <button class="secondary mono" type="button" (click)="close.emit()" data-test="formulas-close">{{ texts.close }}</button>
      }
    </section>
  `,
  styles: `
    :host { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; justify-content: flex-end; }
    .scrim { position: absolute; inset: 0; background: color-mix(in srgb, var(--device-bg) 60%, transparent); }
    .sheet { position: relative; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) var(--gutter) var(--space-4); border-top: 2px solid var(--device-accent); border-radius: 14px 14px 0 0; background: var(--paper-bg); color: var(--paper-ink); }
    .title, .question { font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .lines { display: flex; flex-direction: column; gap: 6px; font: 500 var(--type-label) / 18px var(--font-mono); }
    .share { padding-left: var(--space-3); }
    .confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .primary, .secondary { min-height: var(--touch-min); border-radius: var(--radius-device); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .primary { border: none; background: var(--device-accent); color: var(--device-on-accent); }
    .secondary { border: 1.5px solid var(--paper-graphite); background: transparent; color: var(--paper-graphite); }
  `,
})
export class FormulasSheetComponent {
  protected readonly texts = text.notebook.formulasSheet;
  protected readonly title = text.notebook.formulas.title;
  protected readonly referencePrice = referencePriceText();
  protected readonly moaPerMil = moaPerMilText();
  readonly lines = input.required<FormulaLine[]>();
  readonly needsConfirm = input(false);
  readonly confirm = output<void>();
  readonly close = output<void>();
  protected readonly shares = clockShareLines();
}
