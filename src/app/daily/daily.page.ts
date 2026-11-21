import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { text } from '../../i18n';
import { dailyDateKey } from '../../sim/daily';
import { BackLinkDirective } from '../services/back-link.directive';
import { ProgressStore } from '../services/progress.store';
import { dailyView } from './daily.model';

@Component({
  selector: 'or-daily',
  imports: [BackLinkDirective, IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="daily" data-test="daily">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="daily-back">←</a>
          <h1 class="title">{{ texts.title }}</h1>
        </header>
        <p class="date mono" data-test="daily-date">{{ view().date }}</p>

        <section class="task">
          <div class="task-line" data-test="daily-task">{{ view().taskLine }}</div>
          <div class="rule">{{ view().rule }}</div>
        </section>

        @if (view().result; as result) {
          <section class="result" data-test="daily-result">
            <div class="result-title mono">{{ texts.resultTitle }}</div>
            <div class="result-line" data-test="daily-result-line">{{ result.line }}</div>
            @if (result.wind; as wind) {
              <div class="result-wind mono" data-test="daily-result-wind">{{ wind }}</div>
            }
            @if (view().streak; as streak) {
              <div class="streak mono" data-test="daily-streak">{{ streak }}</div>
            }
            <button class="share mono" type="button" (click)="share()" data-test="daily-share">{{ isCopied() ? texts.copied : texts.share }}</button>
          </section>
        }

        <a class="start" [routerLink]="view().link.path" [queryParams]="view().link.query" data-test="daily-start">{{ view().startLabel }}</a>
      </div>
    </ion-content>
  `,
  styles: `
    .daily { display: flex; flex-direction: column; gap: var(--space-4); min-height: 100%; padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .date { margin: 0; font: 500 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .task { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3) var(--space-4); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); }
    .task-line { font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .rule { font: 500 var(--type-body) / 1.4 var(--font-text); color: var(--device-text-muted); }
    .result { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3) var(--space-4); border: 2px dashed var(--device-accent); border-radius: var(--radius-device); }
    .result-title { font: 500 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .result-line { font: 700 var(--type-hero) / 1.1 var(--font-title); color: var(--device-accent); }
    .result-wind, .streak { font: 700 var(--type-label) / 18px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .share { min-height: var(--touch-min); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; cursor: pointer; }
    .start { display: grid; place-items: center; margin-top: auto; min-height: var(--button-main-height); border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; text-decoration: none; }
  `,
})
export class DailyPage {
  private readonly progress = inject(ProgressStore);
  protected readonly texts = text.daily;
  protected readonly isCopied = signal(false);
  protected readonly view = computed(() => dailyView(this.progress.daily(), dailyDateKey(new Date().toISOString())));

  protected async share(): Promise<void> {
    const shareText = this.view().shareText;
    if (!shareText) {
      return;
    }
    if (navigator.share) {
      await navigator.share({ text: shareText }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(shareText);
    this.isCopied.set(true);
  }
}
