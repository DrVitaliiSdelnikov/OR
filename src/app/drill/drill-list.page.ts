import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { text } from '../../i18n';
import { BackLinkDirective } from '../services/back-link.directive';
import { ProgressStore } from '../services/progress.store';
import { drillLink, drillListGroups } from './drill-cards.model';

@Component({
  selector: 'or-drill-list',
  imports: [BackLinkDirective, IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="drills" data-test="drill-list">
        <header class="header">
          <a class="back" orBackLink="/" [attr.aria-label]="texts.back" data-test="drills-back">←</a>
          <h1 class="title">{{ texts.title }}</h1>
        </header>
        <p class="subtitle">{{ texts.subtitle }}</p>
        @for (group of groups(); track group.title) {
          <section class="group">
            <h2 class="group-title mono">{{ group.title }}</h2>
            @for (row of group.rows; track row.id) {
              <div class="drill">
                <a class="learn" [routerLink]="links(row.id).learn.path" [attr.data-test]="'drill-item-' + row.id">
                  <span class="drill-title">{{ row.title }}</span>
                  <span class="drill-meta mono">{{ row.skill }}@if (row.taughtIn) { · {{ row.taughtIn }}}</span>
                </a>
                @if (row.timed.isOpen) {
                  <a class="timed mono" [routerLink]="links(row.id).timed.path" [queryParams]="links(row.id).timed.query" [attr.data-test]="'drill-timed-' + row.id">{{ row.timed.label }}</a>
                } @else {
                  <span class="timed locked mono" aria-disabled="true" [attr.data-test]="'drill-timed-' + row.id">{{ row.timed.label }}</span>
                }
              </div>
            }
          </section>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .drills { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .subtitle { margin: 0; font: 500 var(--type-body) / 1.4 var(--font-text); color: var(--device-text-muted); }
    .group { display: flex; flex-direction: column; gap: var(--space-2); }
    .group-title { margin: 0; font: 500 var(--type-label) / 1.25 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .drill { display: flex; flex-direction: column; border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); }
    .learn { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: var(--button-main-height); padding: var(--space-2) var(--space-4); color: var(--device-text); text-decoration: none; }
    .drill-title { font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .drill-meta { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
    .timed { display: grid; place-items: center start; min-height: var(--touch-min); padding: 0 var(--space-4); border-top: 1px solid var(--device-line); color: var(--device-accent); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-decoration: none; }
    .timed.locked { color: var(--device-text-muted); }
  `,
})
export class DrillListPage {
  private readonly progress = inject(ProgressStore);
  protected readonly texts = text.drills.list;
  protected readonly groups = computed(() => drillListGroups(this.progress.drillRounds(), this.progress.settings().isEverythingUnlocked));

  protected links(id: Parameters<typeof drillLink>[0]) {
    return { learn: drillLink(id, 'learn'), timed: drillLink(id, 'timed') };
  }
}
