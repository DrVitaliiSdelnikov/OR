import { TermTextComponent } from '../textbook/term-text.component';
import { Component, effect, input, signal } from '@angular/core';
import { CheckSheetView } from './review.model';

@Component({
  selector: 'or-check-sheet',
  imports: [TermTextComponent],
  template: `
    @let sheet = view();
    <section class="check" [class.collapsed]="!isOpen()" data-test="check-sheet">
      <button class="head" type="button" (click)="isOpen.set(!isOpen())" [attr.aria-expanded]="isOpen()" data-test="check-toggle">
        <span class="title">Проверка расчёта</span>
        <span class="stamp" [class.exact]="sheet.verdict === 'exact'" [class.close]="sheet.verdict === 'close'" [class.error]="sheet.verdict === 'error'" data-test="check-stamp">{{ sheet.stamp }}</span>
      </button>
      @if (isOpen()) {
        <div class="subtitle mono" data-test="check-subtitle">{{ sheet.subtitle }}</div>
        <table class="table mono">
          <thead>
            <tr>
              <th>{{ sheet.isAuto ? 'Что' : 'Шаг' }}</th>
              <th>Ты</th>
              <th>{{ sheet.isAuto ? 'Эталон' : 'Формула' }}</th>
              <th>Разн.</th>
            </tr>
          </thead>
          <tbody>
            @for (row of sheet.rows; track $index) {
              <tr [class.error]="row.status === 'error'" [attr.data-test]="'check-row-' + $index">
                <td>{{ row.label }}</td>
                <td class="player" [class.struck]="row.status === 'error'">{{ row.player }}</td>
                <td class="reference">{{ row.reference }}</td>
                <td class="diff">{{ row.diff }}</td>
              </tr>
            }
          </tbody>
        </table>
        @if (sheet.mainError; as main) {
          <div class="margin-note" data-test="check-main-error">
            <div class="label mono"><or-term-text [text]="main.label" [term]="main.term" /></div>
            <div class="phrase"><or-term-text [text]="main.phrase" /></div>
            @if (sheet.others; as others) {
              <div class="others mono" data-test="check-others">{{ others }}</div>
            }
          </div>
        } @else {
          <div class="clean mono">Расчёт чистый</div>
        }
        <div class="footer mono">
          <span data-test="check-points">{{ sheet.pointsText }}</span>
          <span data-test="check-dialed">на барабанах {{ sheet.dialed }}</span>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .check { padding: var(--space-2) var(--space-3); border: 1px solid var(--paper-grid); border-radius: var(--radius-paper); background: var(--paper-bg); color: var(--paper-ink); }
    .head { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: var(--touch-min); padding: 0; border: none; background: none; color: var(--paper-ink); }
    .title { font: 700 var(--type-label) / 16px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .stamp { padding: 2px 8px; border: 2.5px solid currentColor; border-radius: 3px; font: 700 var(--type-label) / 16px var(--font-title); letter-spacing: var(--tracking-title); transform: rotate(-5deg); }
    .stamp.exact { color: var(--paper-stamp-gold); }
    .stamp.close { color: var(--paper-stamp-gold); border-style: dashed; }
    .stamp.error { color: var(--paper-red-pencil); }
    .subtitle { margin-bottom: var(--space-2); font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .table { width: 100%; border-collapse: collapse; font: 500 12px / 16px var(--font-mono); }
    th { text-align: left; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid var(--paper-ink); padding: 4px 2px; }
    td { padding: 6px 2px; border-bottom: 1px solid var(--paper-grid); vertical-align: top; }
    tr.error { background: color-mix(in srgb, var(--paper-red-pencil) 8%, transparent); }
    .player { color: var(--paper-graphite); }
    .struck { text-decoration: line-through; text-decoration-color: var(--paper-red-pencil); }
    .diff { text-align: right; white-space: nowrap; }
    .margin-note { margin-top: var(--space-2); padding-left: var(--space-2); border-left: 2px solid var(--paper-red-pencil); color: var(--paper-red-pencil); }
    .label { font: 700 11px / 14px var(--font-mono); letter-spacing: var(--tracking-label); }
    .phrase { font: 500 var(--type-label) / 18px var(--font-mono); }
    .others { margin-top: 4px; font: 500 11px / 14px var(--font-mono); }
    .clean { margin-top: var(--space-2); font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .footer { display: flex; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-2); font: 700 12px / 16px var(--font-mono); }
  `,
})
export class CheckSheetComponent {
  readonly view = input.required<CheckSheetView>();
  readonly isInitiallyOpen = input(false);
  protected readonly isOpen = signal(false);

  constructor() {
    effect(() => this.isOpen.set(this.isInitiallyOpen()));
  }
}
