import { Component, computed, input } from '@angular/core';
import { text } from '../../i18n';
import { MissBreakdown } from '../../sim/miss-breakdown';
import { CAUSE_TERMS } from '../textbook/term-links';
import { TermTextComponent } from '../textbook/term-text.component';
import { causesView } from './review.model';

@Component({
  selector: 'or-causes',
  imports: [TermTextComponent],
  template: `
    @let state = view();
    <section class="causes" data-test="causes">
      <div class="title">{{ texts.title }}</div>
      <div class="conclusion" data-test="causes-conclusion"><or-term-text [text]="state.conclusion" /></div>
      <ul class="rows">
        @for (row of state.rows; track row.kind) {
          <li class="row" [class.grey]="!row.isPlayerError" [class.main]="row.isMain" [attr.data-test]="'cause-' + row.kind">
            <span class="name"><or-term-text [text]="row.name" [term]="causeTerms[row.kind]" /></span>
            <span class="bar"><span class="fill" [style.width.%]="row.share * 100"></span></span>
            <span class="value mono">{{ row.text }}</span>
          </li>
        }
      </ul>
      @if (hasGrey()) {
        <div class="note mono">{{ texts.greyNote }}</div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .title { font: 700 var(--type-label) / 16px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .conclusion { margin: 4px 0 var(--space-2); font: 700 var(--type-label) / 18px var(--font-mono); }
    .rows { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .row { display: grid; grid-template-columns: 120px minmax(0, 1fr) 64px; gap: var(--space-2); align-items: center; font: 500 12px / 16px var(--font-mono); color: var(--paper-ink); }
    .bar { height: 8px; border-bottom: 1px solid var(--paper-grid); }
    .fill { display: block; height: 100%; background: var(--paper-ink); }
    .value { text-align: right; white-space: nowrap; }
    .row.grey { color: var(--paper-graphite); }
    .row.grey .fill { background: var(--paper-graphite); opacity: 0.5; }
    .row.main { color: var(--paper-red-pencil); font-weight: 700; }
    .row.main .fill { background: var(--paper-red-pencil); }
    .note { margin-top: 4px; font: 500 11px / 14px var(--font-mono); color: var(--paper-graphite); }
  `,
})
export class CausesComponent {
  protected readonly texts = text.screens.causes;
  protected readonly causeTerms = CAUSE_TERMS;
  readonly breakdown = input.required<MissBreakdown>();
  protected readonly view = computed(() => causesView(this.breakdown()));
  protected readonly hasGrey = computed(() => this.view().rows.some(row => !row.isPlayerError));
}
