import { Component, computed, inject, input } from '@angular/core';
import { ProgressStore } from '../services/progress.store';
import { termSegments } from './term-links';
import { TermSheetService } from './term-sheet.service';
import { openedTerms } from './textbook.model';

@Component({
  selector: 'or-term-text',
  template: `@for (segment of segments(); track $index) {@if (segment.term; as term) {<button class="term-link" type="button" (click)="termSheet.open(term)" data-test="term-link">{{ segment.text }}</button>} @else {{{ segment.text }}}}`,
  styles: `
    .term-link { position: relative; padding: 0; border: 0; background: none; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; text-decoration: underline dashed; text-underline-offset: 3px; cursor: pointer; }
    .term-link::after { content: ''; position: absolute; inset: -10px -2px; }
  `,
})
export class TermTextComponent {
  readonly text = input.required<string>();
  readonly term = input<string | null>(null);

  private readonly progress = inject(ProgressStore);
  protected readonly termSheet = inject(TermSheetService);

  protected readonly segments = computed(() => {
    const opened = openedTerms(this.progress.course(), this.progress.settings().isEverythingUnlocked);
    const wholeTerm = this.term();
    if (wholeTerm !== null) {
      return [{ text: this.text(), term: opened.has(wholeTerm) ? wholeTerm : null }];
    }
    return termSegments(this.text(), opened);
  });
}
