import { Component, input, output, signal } from '@angular/core';
import { NotebookFactor } from '../../sim/notebook';

export interface FactorRow {
  factor: NotebookFactor;
  name: string;
  isOn: boolean;
  contribution: string;
  detail: string;
}

@Component({
  selector: 'or-total-tab',
  template: `
    <div class="mode mono" data-test="notebook-mode">Авто · отметь, что учесть</div>
    <div class="factors">
      @for (row of rows(); track row.factor) {
        <div class="factor" [class.off]="!row.isOn" [attr.data-test]="'factor-' + row.factor">
          <div class="factor-head">
            <button class="factor-name" type="button" (click)="toggleOpen(row.factor)" [attr.aria-expanded]="openFactor() === row.factor">{{ row.name }}</button>
            <span class="contribution mono" [attr.data-test]="'contribution-' + row.factor">{{ row.contribution }}</span>
            <button
              class="switch"
              type="button"
              role="switch"
              [attr.aria-checked]="row.isOn"
              [attr.aria-label]="'Учитывать: ' + row.name"
              (click)="toggle.emit(row.factor)"
              [attr.data-test]="'toggle-' + row.factor"
            >
              <span class="track"><span class="knob"></span></span>
            </button>
          </div>
          @if (openFactor() === row.factor) {
            <div class="detail mono" [attr.data-test]="'detail-' + row.factor">
              <span>{{ row.detail }}</span>
              <span class="stamp">подставлено игрой</span>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .mode { margin-bottom: var(--space-2); font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); text-transform: uppercase; letter-spacing: var(--tracking-label); }
    .factors { display: flex; flex-direction: column; }
    .factor { border-bottom: 1px solid var(--paper-grid); }
    .factor-head { display: grid; grid-template-columns: 1fr auto 52px; align-items: center; gap: var(--space-2); min-height: var(--touch-min); }
    .factor-name { min-height: var(--touch-min); padding: 0; border: none; background: none; text-align: left; color: var(--paper-ink); font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .off .factor-name, .off .contribution { color: var(--paper-graphite); }
    .contribution { font: 700 var(--type-body) / 20px var(--font-mono); color: var(--paper-ink); }
    .switch { display: grid; place-items: center; width: 52px; height: var(--touch-min); padding: 0; border: none; background: none; }
    .track { position: relative; width: 44px; height: 26px; border: 2px solid var(--paper-ink); border-radius: 13px; background: var(--paper-bg); }
    .switch[aria-checked='true'] .track { background: var(--paper-ink); }
    .knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--paper-ink); transition: transform var(--motion-paper); }
    .switch[aria-checked='true'] .knob { transform: translateX(18px); background: var(--paper-bg); }
    .detail { display: flex; flex-direction: column; gap: 4px; padding: 0 0 var(--space-2); font: 500 var(--type-label) / 18px var(--font-mono); color: var(--paper-ink); }
    .stamp { align-self: flex-start; padding: 0 6px; border: 1.5px solid var(--paper-stamp-silver); border-radius: 3px; color: var(--paper-stamp-silver); font-size: 11px; text-transform: uppercase; letter-spacing: var(--tracking-label); transform: rotate(-2deg); }
  `,
})
export class TotalTabComponent {
  readonly rows = input.required<FactorRow[]>();
  readonly toggle = output<NotebookFactor>();

  protected readonly openFactor = signal<NotebookFactor | null>(null);

  protected toggleOpen(factor: NotebookFactor): void {
    this.openFactor.update(open => (open === factor ? null : factor));
  }
}
