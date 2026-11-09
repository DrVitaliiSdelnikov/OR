import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { FeedbackService } from './services/feedback.service';
import { TermSheetComponent } from './textbook/term-sheet.component';
import { TermSheetService } from './textbook/term-sheet.service';

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

  protected clickButton(event: MouseEvent): void {
    const button = (event.target as Element | null)?.closest('button');
    if (button && !button.disabled && !button.closest('[data-own-feedback]')) {
      this.feedback.emit('button');
    }
  }
}
