import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { exerciseById, ExerciseId } from '../../sim/course';
import { exerciseSheet } from './course-trail.model';

@Component({
  selector: 'or-exercise-sheet',
  imports: [IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="sheet-screen">
        <header class="header">
          <a class="back" routerLink="/course" aria-label="Назад" data-test="sheet-back">←</a>
          @if (sheet(); as current) {
            <h1 data-test="sheet-title">{{ current.id }} · {{ current.title }}</h1>
          }
        </header>

        @if (sheet(); as current) {
          <dl class="facts">
            <dt>Цели</dt>
            <dd data-test="sheet-targets">{{ current.targets }}</dd>
            <dt>Выстрелы</dt>
            <dd data-test="sheet-shots">{{ current.shots }}</dd>
            <dt>Ветер</dt>
            <dd data-test="sheet-wind">{{ current.wind }}</dd>
            <dt>Условия</dt>
            <dd data-test="sheet-atmosphere">{{ current.atmosphere }}</dd>
            <dt>Блокнот</dt>
            <dd data-test="sheet-mode">{{ current.mode }}</dd>
          </dl>
          @if (current.terms.length > 0) {
            <div class="terms" data-test="sheet-terms">
              @for (term of current.terms; track term) {
                <span class="term">{{ term }}</span>
              }
            </div>
          }
          <button class="to-position" type="button" disabled data-test="to-position">На позицию</button>
          <div class="note">позиция — следующий этап</div>
        } @else {
          <div class="note" data-test="sheet-missing">Такого упражнения нет</div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .sheet-screen { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-3) var(--gutter) var(--space-6); }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    h1 { margin: 0; font: 700 var(--type-title) / 26px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .facts { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-4); margin: 0; padding: var(--space-4); background: var(--paper-bg); border-radius: var(--radius-paper); box-shadow: var(--paper-shadow); color: var(--paper-ink); }
    dt { font: 500 var(--type-label) / 20px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    dd { margin: 0; font: 400 var(--type-body) / 20px var(--font-text); }
    .terms { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .term { padding: var(--space-1) var(--space-2); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); font: 500 var(--type-label) / 18px var(--font-mono); color: var(--device-text-muted); }
    .to-position { min-height: var(--button-main-height); border: 0; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .to-position:disabled { opacity: 0.45; }
    .note { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--device-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-label); }
  `,
})
export class ExerciseSheetPage {
  readonly exerciseId = input.required<string>();

  protected readonly sheet = computed(() => {
    const def = exerciseById(this.exerciseId() as ExerciseId);
    return def ? exerciseSheet(def) : null;
  });
}
