import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { ProgressStore } from '../services/progress.store';
import { DebriefView } from './debrief-view';

@Component({
  selector: 'or-debrief-page',
  imports: [IonContent, RouterLink, DebriefView],
  template: `
    <ion-content>
      <div class="screen">
        <div class="top-bar">
          <a class="button" routerLink="/journal" aria-label="Назад">←</a>
          <h1>Разбор</h1>
        </div>
        @if (shot(); as record) {
          <or-debrief-view [shot]="record" (proceed)="router.navigate(['/'])" />
        } @else {
          <p>Выстрел не найден.</p>
        }
      </div>
    </ion-content>
  `,
  styles: `a { text-decoration: none; }`,
})
export class DebriefPage {
  private readonly progress = inject(ProgressStore);
  protected readonly router = inject(Router);
  readonly shotId = input.required<string>();
  protected readonly shot = computed(() => this.progress.shotById(this.shotId()));
}
