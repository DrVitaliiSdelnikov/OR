import { Component, input, output } from '@angular/core';

export interface FormulaLine {
  title: string;
  formula: string;
}

const CLOCK_SHARES: readonly string[] = ['12, 6 ч → 0', '1, 5, 7, 11 ч → 0.5', '2, 4, 8, 10 ч → 0.87', '3, 9 ч → 1'];

@Component({
  selector: 'or-formulas-sheet',
  template: `
    <div class="scrim" (click)="close.emit()"></div>
    <section class="sheet" role="dialog" aria-label="Справочник формул" data-test="formulas-sheet">
      @if (needsConfirm()) {
        <div class="confirm" data-test="formulas-confirm">
          <div class="question">Справочник стоит 30 очков</div>
          <div class="confirm-actions">
            <button class="primary mono" type="button" (click)="confirm.emit()" data-test="formulas-open">Открыть</button>
            <button class="secondary mono" type="button" (click)="close.emit()" data-test="formulas-cancel">Нет</button>
          </div>
        </div>
      } @else {
        <div class="title">Формулы</div>
        <div class="lines mono" data-test="formulas-list">
          @for (line of lines(); track line.title) {
            <div class="line"><b>{{ line.title }}</b> {{ line.formula }}</div>
          }
          <div class="line"><b>Доля по часам</b></div>
          @for (share of shares; track share) {
            <div class="line share">{{ share }}</div>
          }
          <div class="line"><b>Единицы</b> 1 MIL = 3.44 MOA</div>
        </div>
        <button class="secondary mono" type="button" (click)="close.emit()" data-test="formulas-close">Закрыть</button>
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
  readonly lines = input.required<FormulaLine[]>();
  readonly needsConfirm = input(false);
  readonly confirm = output<void>();
  readonly close = output<void>();
  protected readonly shares = CLOCK_SHARES;
}
