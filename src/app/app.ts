import { afterNextRender, Component, effect, inject, viewChild } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { text } from '../i18n';
import { BackStackService, backLayer } from './services/back-stack.service';
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
      @if (backStack.isExitHintShown()) {
        <div class="exit-hint" role="status" data-test="exit-hint">{{ texts.exitHint }}</div>
      }
    </ion-app>
  `,
  styles: `
    .exit-hint { position: fixed; left: 50%; bottom: calc(var(--space-6) + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 20; padding: var(--space-2) var(--space-4); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-sunken); color: var(--device-text); font: 500 var(--type-body) / 1.35 var(--font-text); white-space: nowrap; pointer-events: none; }
  `,
  host: { '(document:click)': 'clickButton($event)' },
})
export class App {
  protected readonly texts = text.shell.app;
  private readonly feedback = inject(FeedbackService);
  protected readonly termSheet = inject(TermSheetService);
  protected readonly backStack = inject(BackStackService);
  private readonly outlet = viewChild.required(IonRouterOutlet);
  private readonly startBackStack = afterNextRender(() => this.backStack.start(this.outlet()));
  private readonly progress = inject(ProgressStore);
  private readonly termSheetLayer = backLayer(() => this.termSheet.openTerm() !== null, () => this.termSheet.close());
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
