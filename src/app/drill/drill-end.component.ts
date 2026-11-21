import { Component, input, output } from '@angular/core';
import { text } from '../../i18n';
import { SummaryView } from './drill-cards.model';

@Component({
  selector: 'or-drill-end',
  template: `
    <section class="end" role="dialog" [attr.aria-label]="texts.summary.title" data-test="drill-end">
      <h2 class="title">{{ texts.summary.title }}</h2>
      <div class="line mono" data-test="drill-summary-counts">{{ view().counts }}</div>
      <div class="line mono" data-test="drill-summary-accuracy">{{ view().accuracy }}</div>
      <div class="line mono" data-test="drill-summary-time">{{ view().averageTime }}</div>
      <ul class="errors mono" data-test="drill-summary-errors">
        @for (error of view().errors; track error) {
          <li>{{ error }}</li>
        } @empty {
          <li>{{ texts.summary.noErrors }}</li>
        }
      </ul>
      <div class="actions">
        <button class="action main mono" type="button" (click)="again.emit()" data-test="drill-again">{{ texts.summary.again }}</button>
        <button class="action mono" type="button" (click)="leave.emit()" data-test="drill-exit">{{ leaveLabel() ?? texts.summary.toDrills }}</button>
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .end { display: flex; flex-direction: column; gap: var(--space-3); height: 100%; overflow-y: auto; padding: var(--space-4) var(--gutter); border-top: 2px solid var(--device-accent); border-radius: 14px 14px 0 0; background: var(--device-surface); color: var(--device-text); }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .line { font: 700 var(--type-body) / 22px var(--font-mono); }
    .errors { margin: 0; padding-left: var(--space-4); font: 500 var(--type-label) / 20px var(--font-mono); color: var(--device-text-muted); }
    .actions { display: flex; flex-direction: column; gap: var(--space-2); margin-top: auto; }
    .action { min-height: 52px; border: 1px solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .action.main { border: none; background: var(--device-accent); color: var(--device-on-accent); }
  `,
})
export class DrillEndComponent {
  readonly view = input.required<SummaryView>();
  readonly leaveLabel = input<string | null>(null);
  readonly again = output<void>();
  readonly leave = output<void>();
  protected readonly texts = text.drills;
}
