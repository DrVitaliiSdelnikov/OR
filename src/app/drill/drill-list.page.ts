import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { text } from '../../i18n';
import { BackLinkDirective } from '../services/back-link.directive';
import { ProgressStore } from '../services/progress.store';
import { progressCoachView } from './coach.model';
import { drillLink, drillSkillGroups } from './drill-cards.model';

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
        <a class="coach" [routerLink]="coach().link.path" [queryParams]="coach().link.query" data-test="coach-advice">
          <span class="coach-title">{{ coach().title }}</span>
          <span class="coach-drill mono" data-test="coach-drill">{{ coach().drill }}</span>
          <span class="coach-reason" data-test="coach-reason">{{ coach().reason }}</span>
        </a>
        @for (group of groups(); track group.skill) {
          <section class="group" [attr.data-test]="'drill-group-' + group.skill">
            <h2 class="group-title mono" [attr.data-test]="'drill-group-title-' + group.skill">{{ group.title }}</h2>
            @for (row of group.rows; track row.id) {
              <div class="drill">
                <a class="learn" [routerLink]="links(row.id).learn.path" [attr.data-test]="'drill-item-' + row.id">
                  <span class="drill-title">{{ row.title }}</span>
                  <span class="drill-meta mono">{{ row.kindLabel }}@if (row.taughtIn) { · {{ row.taughtIn }}}</span>
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
        <a class="own" routerLink="/free" data-test="drills-free">
          <span class="drill-title">{{ texts.ownDrill }}</span>
          <span class="drill-meta mono">{{ texts.ownDrillLine }}</span>
        </a>
      </div>
    </ion-content>
  `,
  styles: `
    .drills { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .subtitle { margin: 0; font: 500 var(--type-body) / 1.4 var(--font-text); color: var(--device-text-muted); }
    .coach { display: flex; flex-direction: column; gap: var(--space-1); min-height: var(--button-main-height); padding: var(--space-3) var(--space-4); border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); text-decoration: none; }
    .coach-title { font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .coach-drill { font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .coach-reason { font: 500 var(--type-body) / 1.4 var(--font-text); }
    .group { display: flex; flex-direction: column; gap: var(--space-2); }
    .group-title { margin: 0; font: 500 var(--type-label) / 1.25 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .drill { display: flex; flex-direction: column; border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); }
    .learn { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: var(--button-main-height); padding: var(--space-2) var(--space-4); color: var(--device-text); text-decoration: none; }
    .drill-title { font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .drill-meta { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
    .timed { display: grid; place-items: center start; min-height: var(--touch-min); padding: 0 var(--space-4); border-top: 1px solid var(--device-line); color: var(--device-accent); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-decoration: none; }
    .own { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: var(--button-main-height); padding: var(--space-2) var(--space-4); border: var(--border-width) dashed var(--device-line-strong); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .timed.locked { color: var(--device-text-muted); }
  `,
})
export class DrillListPage {
  private readonly progress = inject(ProgressStore);
  protected readonly texts = text.drills.list;
  protected readonly groups = computed(() => drillSkillGroups(this.progress.drillRounds(), this.progress.skills(), this.progress.settings().isEverythingUnlocked));
  protected readonly coach = computed(() =>
    progressCoachView({
      journal: this.progress.journal(),
      rounds: this.progress.drillRounds(),
      ratings: this.progress.skills(),
      isEverythingUnlocked: this.progress.settings().isEverythingUnlocked,
      nowIso: new Date().toISOString(),
    }),
  );

  protected links(id: Parameters<typeof drillLink>[0]) {
    return { learn: drillLink(id, 'learn'), timed: drillLink(id, 'timed') };
  }
}
