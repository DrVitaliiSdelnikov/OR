import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { text } from '../../i18n';
import { BackLinkDirective } from '../services/back-link.directive';
import { drillListRows } from './drill-cards.model';

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
        <nav class="list">
          @for (row of rows; track row.id) {
            <a class="drill" [routerLink]="['/drill', row.id]" [attr.data-test]="'drill-item-' + row.id">
              <span class="drill-title">{{ row.title }}</span>
              <span class="drill-meta mono">{{ row.skill }}@if (row.taughtIn) { · {{ row.taughtIn }}}</span>
            </a>
          }
        </nav>
      </div>
    </ion-content>
  `,
  styles: `
    .drills { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) calc(var(--space-6) + env(safe-area-inset-bottom)); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .subtitle { margin: 0; font: 500 var(--type-body) / 1.4 var(--font-text); color: var(--device-text-muted); }
    .list { display: flex; flex-direction: column; gap: var(--space-2); }
    .drill { display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: var(--button-main-height); padding: var(--space-2) var(--space-4); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); text-decoration: none; }
    .drill-title { font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .drill-meta { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--device-text-muted); }
  `,
})
export class DrillListPage {
  protected readonly texts = text.drills.list;
  protected readonly rows = drillListRows();
}
