import { Component, effect, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { FeedbackService } from './services/feedback.service';
import { ProgressStore } from './services/progress.store';
import { TermSheetComponent } from './textbook/term-sheet.component';
import { TermSheetService } from './textbook/term-sheet.service';

const TEXT_SIZE_ATTRIBUTE = 'data-text';
const LARGE_TEXT = 'large';

@Component({
  selector: 'or-root',
  imports: [IonApp, IonRouterOutlet, TermSheetComponent],
  template: `
    <ion-app>
      <ion-router-outlet />
      @if (termSheet.openTerm(); as term) {
        <or-term-sheet [openTerm]="term" (close)="termSheet.close()" />
      }
    </ion-app>
  `,
  host: { '(document:click)': 'clickButton($event)' },
})
export class App {
  private readonly feedback = inject(FeedbackService);
  protected readonly termSheet = inject(TermSheetService);
  private readonly progress = inject(ProgressStore);
  private readonly applyTextSize = effect(() => {
    if (this.progress.settings().isTextLarge) {
      document.documentElement.setAttribute(TEXT_SIZE_ATTRIBUTE, LARGE_TEXT);
    } else {
      document.documentElement.removeAttribute(TEXT_SIZE_ATTRIBUTE);
    }
  });

  protected clickButton(event: MouseEvent): void {
    const button = (event.target as Element | null)?.closest('button');
    if (button && !button.disabled && !button.closest('[data-own-feedback]')) {
      this.feedback.emit('button');
    }
  }
}
