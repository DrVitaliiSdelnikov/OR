import { Component, output } from '@angular/core';
import { DraftKey } from './calc-sheet.model';

const KEYS: readonly DraftKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

@Component({
  selector: 'or-keypad',
  template: `
    <div class="keypad" data-test="keypad">
      @for (key of keys; track key) {
        <button class="key mono" type="button" [class.secondary]="key === '.' || key === 'back'" (click)="press.emit(key)" [attr.aria-label]="key === 'back' ? 'Стереть' : key" [attr.data-test]="'key-' + key">
          {{ key === 'back' ? '⌫' : key }}
        </button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
    .key { min-height: var(--touch-min); border: 1px solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-sunken); color: var(--device-text); font: 700 var(--type-value) / 24px var(--font-mono); }
    .key.secondary { background: var(--device-surface); }
  `,
})
export class KeypadComponent {
  readonly press = output<DraftKey>();
  protected readonly keys = KEYS;
}
