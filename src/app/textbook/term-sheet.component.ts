import { afterNextRender, Component, computed, effect, ElementRef, inject, input, linkedSignal, output, viewChild } from '@angular/core';
import { FeedbackService } from '../services/feedback.service';
import { ProgressStore } from '../services/progress.store';
import { TextbookCards } from './textbook-cards.service';
import { openedTerms, termSheetView } from './textbook.model';

@Component({
  selector: 'or-term-sheet',
  template: `
    @let sheet = view();
    <div class="scrim" (click)="close.emit()" data-test="term-scrim"></div>
    <section class="sheet" role="dialog" [attr.aria-label]="sheet.term" data-test="term-sheet">
      <div class="body" #body>
        <div class="chapter mono">{{ sheet.chapter }}</div>
        <h2 class="term" data-test="term-title">{{ sheet.term }}</h2>
        <p class="phrase" data-test="term-phrase">{{ sheet.phrase }}</p>

        @if (sheet.formula; as formula) {
          <div class="formula" data-test="term-formula">
            <div class="formula-line mono">{{ formula.line }}</div>
            @for (variable of formula.variables; track variable.symbol) {
              <div class="variable mono" data-test="term-variable"><b>{{ variable.symbol }}</b> — {{ variable.meaning }}</div>
            }
          </div>
        }

        @if (sheet.example; as example) {
          <div class="example mono" data-test="term-example"><span class="label">пример</span> {{ example }}</div>
        }

        <div class="block">
          <div class="label mono">где встречается</div>
          @for (line of sheet.whereLines; track line) {
            <div class="where mono" data-test="term-where">{{ line }}</div>
          }
        </div>

        @if (sheet.related.length > 0) {
          <div class="block">
            <div class="label mono">рядом</div>
            <div class="related">
              @for (item of sheet.related; track item.term) {
                @if (item.isOpen) {
                  <button class="link mono" type="button" (click)="term.set(item.term)" data-test="term-related">{{ item.term }}</button>
                } @else {
                  <span class="locked mono" data-test="term-related-locked">{{ item.term }}</span>
                }
              }
            </div>
          </div>
        }
      </div>
      <button class="close mono" type="button" (click)="close.emit()" data-test="term-close">Закрыть</button>
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 40; display: flex; flex-direction: column; justify-content: flex-end; }
    .scrim { position: absolute; inset: 0; background: color-mix(in srgb, var(--device-bg) 60%, transparent); }
    .sheet { position: relative; display: flex; flex-direction: column; gap: var(--space-3); max-height: 85%; padding: var(--space-3) var(--gutter) var(--space-4); border-top: 2px solid var(--device-accent); border-radius: 14px 14px 0 0; background: var(--paper-bg); color: var(--paper-ink); }
    .body { display: flex; flex-direction: column; gap: var(--space-3); min-height: 0; overflow-y: auto; }
    .chapter, .label { font: 500 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--paper-graphite); }
    .term { margin: -8px 0 0; font: 700 var(--type-title) / 26px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .phrase { margin: 0; font: 400 var(--type-body) / 22px var(--font-text); }
    .formula { display: flex; flex-direction: column; gap: 4px; padding: var(--space-2) var(--space-3); border-left: 2px solid var(--paper-ink); }
    .formula-line { font: 700 var(--type-value) / 26px var(--font-mono); }
    .variable, .where { font: 500 var(--type-label) / 18px var(--font-mono); }
    .example { font: 500 var(--type-label) / 18px var(--font-mono); }
    .example .label { margin-right: 4px; }
    .block { display: flex; flex-direction: column; gap: 4px; }
    .related { display: flex; flex-wrap: wrap; gap: var(--space-1); }
    .link, .locked { min-height: var(--touch-min); padding: 0 var(--space-3); border-radius: var(--radius-paper); font: 500 var(--type-label) / 16px var(--font-mono); }
    .link { border: 1.5px solid var(--paper-ink); background: transparent; color: var(--paper-ink); }
    .locked { display: inline-grid; place-items: center; border: 1.5px dashed var(--paper-graphite); color: var(--paper-graphite); }
    .close { min-height: var(--touch-min); border: 1.5px solid var(--paper-graphite); border-radius: var(--radius-device); background: transparent; color: var(--paper-graphite); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
  `,
})
export class TermSheetComponent {
  readonly openTerm = input.required<string>();
  readonly close = output<void>();

  private readonly progress = inject(ProgressStore);
  private readonly textbookCards = inject(TextbookCards);
  private readonly feedback = inject(FeedbackService);
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly openingClick = afterNextRender(() => this.feedback.emit('sheet'));

  protected readonly term = linkedSignal(() => this.openTerm());
  protected readonly view = computed(() =>
    termSheetView(this.term(), openedTerms(this.progress.course(), this.progress.settings().isEverythingUnlocked), this.textbookCards.cards()),
  );

  constructor() {
    this.textbookCards.ensureBuilt();
    effect(() => {
      this.term();
      this.body().nativeElement.scrollTop = 0;
    });
  }
}
