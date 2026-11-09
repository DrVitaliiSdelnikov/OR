import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { FeedbackService } from './services/feedback.service';

@Component({
  selector: 'or-root',
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet /></ion-app>`,
  host: { '(document:click)': 'clickButton($event)' },
})
export class App {
  private readonly feedback = inject(FeedbackService);

  protected clickButton(event: MouseEvent): void {
    const button = (event.target as Element | null)?.closest('button');
    if (button && !button.disabled && !button.closest('[data-own-feedback]')) {
      this.feedback.emit('button');
    }
  }
}
