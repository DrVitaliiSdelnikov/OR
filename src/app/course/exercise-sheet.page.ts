import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonToggle } from '@ionic/angular/standalone';
import { exerciseById, ExerciseId } from '../../sim/course';
import { playability } from '../position/position.model';
import { ProgressStore } from '../services/progress.store';
import { TermTextComponent } from '../textbook/term-text.component';
import { briefingCard } from './briefing.model';

const SCHEME_WIDTH = 300;
const SCHEME_HEIGHT = 90;
const SHOOTER_X = 28;
const TARGETS_FROM_X = 220;
const TARGETS_TO_X = 280;
const GROUND_Y = 66;

@Component({
  selector: 'or-exercise-sheet',
  imports: [IonContent, IonToggle, RouterLink, TermTextComponent],
  template: `
    <ion-content>
      <div class="briefing-screen">
        <header class="header">
          <a class="back" routerLink="/course" aria-label="Назад" data-test="sheet-back">←</a>
        </header>

        @if (card(); as briefing) {
          <article class="order" data-test="briefing-card">
            <div class="order-header mono" data-test="briefing-header">{{ briefing.header }}</div>
            <h1 data-test="sheet-title">{{ briefing.title }}</h1>

            <svg class="scheme" [attr.viewBox]="'0 0 ' + schemeWidth + ' ' + schemeHeight" role="img" [attr.aria-label]="'Схема: ты — цели, ' + briefing.scheme.distanceText" data-test="briefing-scheme">
              <line class="ground" x1="8" [attr.y1]="groundY" [attr.x2]="schemeWidth - 8" [attr.y2]="groundY" />
              <circle class="shooter" [attr.cx]="shooterX" [attr.cy]="groundY - 10" r="6" />
              <text class="scheme-caption" [attr.x]="shooterX" [attr.y]="groundY + 16">ты</text>
              @if (briefing.scheme.hasFlag) {
                <g class="flag" data-test="briefing-flag">
                  <line [attr.x1]="shooterX + 24" [attr.y1]="groundY" [attr.x2]="shooterX + 24" [attr.y2]="groundY - 30" />
                  <path [attr.d]="'M' + (shooterX + 24) + ' ' + (groundY - 30) + ' l16 5 l-16 5 z'" />
                </g>
              }
              <line class="line-of-fire" [attr.x1]="shooterX + 8" [attr.y1]="groundY - 10" [attr.x2]="targetXs()[0]" [attr.y2]="groundY - 14" />
              @for (x of targetXs(); track $index) {
                @if (briefing.scheme.isPaper) {
                  <rect class="target paper" [attr.x]="x - 6" [attr.y]="groundY - 26" width="12" height="16" />
                } @else {
                  <circle class="target" [attr.cx]="x" [attr.cy]="groundY - 14" r="5" />
                }
              }
              <text class="scheme-caption" [attr.x]="targetsMidX" [attr.y]="groundY + 16" data-test="briefing-distance">{{ briefing.scheme.distanceText }}</text>
            </svg>

            <dl class="facts">
              <dt>Цели</dt>
              <dd data-test="sheet-targets">{{ briefing.facts.targets }}</dd>
              <dt>Выстрелы</dt>
              <dd data-test="sheet-shots">{{ briefing.facts.shots }}</dd>
              <dt>Ветер</dt>
              <dd data-test="sheet-wind">{{ briefing.facts.wind }}</dd>
              <dt>Условия</dt>
              <dd data-test="sheet-atmosphere">{{ briefing.facts.atmosphere }}</dd>
              <dt>Режим</dt>
              <dd data-test="sheet-mode">{{ briefing.mode }}</dd>
            </dl>

            <div class="section-title mono">Зачёт</div>
            <ul class="standards">
              @for (row of briefing.classRows; track $index) {
                <li class="standard" [attr.data-test]="'briefing-class-' + $index">
                  <span [class]="'marker class-' + (3 - $index)"></span>
                  <span>{{ row }}</span>
                </li>
              }
            </ul>

            @if (briefing.novelty; as novelty) {
              <div class="novelty" data-test="briefing-novelty">{{ novelty }}</div>
            }
            @if (briefing.best; as best) {
              <div class="best mono" data-test="briefing-best">{{ best }}</div>
            }
            @if (briefing.instructor) {
              <ion-toggle class="instructor" [checked]="isInstructorOn()" (ionChange)="isInstructorOn.set($event.detail.checked)" justify="space-between" data-test="briefing-instructor">с инструктором</ion-toggle>
            }
            <div class="order-stamp" aria-hidden="true">к исполнению</div>
          </article>

          @if (briefing.termsLine; as terms) {
            <div class="terms mono" data-test="sheet-terms"><or-term-text [text]="terms" /></div>
          }
          @if (availability()?.reason; as reason) {
            <div class="note" data-test="to-position-reason">{{ reason }}</div>
          }
          <div class="dock">
            <button class="to-position" type="button" [disabled]="!availability()?.isPlayable" (click)="toPosition()" data-test="to-position">На позицию</button>
          </div>
        } @else {
          <div class="note" data-test="sheet-missing">Такого упражнения нет</div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .briefing-screen { display: flex; flex-direction: column; gap: var(--space-3); min-height: 100%; padding: var(--space-3) var(--gutter) 0; }
    .header { display: flex; align-items: center; }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .order { position: relative; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); background: var(--paper-bg); border-radius: var(--radius-paper); box-shadow: var(--paper-shadow); color: var(--paper-ink); }
    .order-header { font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); color: var(--paper-graphite); }
    h1 { margin: 0; font: 700 var(--type-title) / 26px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .scheme { display: block; width: 100%; border-top: 1px solid var(--paper-grid); border-bottom: 1px solid var(--paper-grid); }
    .ground { stroke: var(--paper-graphite); stroke-width: 1; }
    .shooter { fill: var(--paper-ink); }
    .flag line { stroke: var(--paper-ink); stroke-width: 1.5; }
    .flag path { fill: var(--paper-red-pencil); }
    .line-of-fire { stroke: var(--paper-graphite); stroke-width: 1; stroke-dasharray: 3 3; }
    .target { fill: var(--paper-graphite); }
    .target.paper { fill: none; stroke: var(--paper-ink); stroke-width: 1.5; }
    .scheme-caption { fill: var(--paper-graphite); font: 500 11px var(--font-mono); text-anchor: middle; }
    .facts { display: grid; grid-template-columns: auto 1fr; gap: var(--space-2) var(--space-4); margin: 0; }
    dt { font: 500 var(--type-label) / 20px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--paper-graphite); }
    dd { margin: 0; font: 400 var(--type-body) / 20px var(--font-text); }
    .section-title { font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .standards { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .standard { display: grid; grid-template-columns: 6px minmax(0, 1fr); gap: var(--space-2); font: 400 var(--type-label) / 18px var(--font-text); }
    .marker { border-radius: 2px; }
    .class-1 { background: var(--paper-stamp-gold); }
    .class-2 { background: var(--paper-stamp-silver); }
    .class-3 { background: var(--paper-stamp-bronze); }
    .novelty { font: 700 var(--type-label) / 18px var(--font-text); }
    .best { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--paper-graphite); }
    .instructor { --track-background: var(--paper-grid); --track-background-checked: var(--paper-stamp-green); --handle-background: var(--paper-bg); --handle-background-checked: var(--paper-bg); min-height: var(--touch-min); color: var(--paper-ink); font: 500 var(--type-label) / 18px var(--font-mono); }
    .order-stamp { align-self: flex-end; padding: 2px 10px; border: 2.5px solid var(--paper-red-pencil); border-radius: 3px; color: var(--paper-red-pencil); font: 700 var(--type-label) / 18px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; transform: rotate(-4deg); }
    .terms { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--device-text-muted); }
    .note { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--device-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-label); }
    .dock { position: sticky; bottom: 0; margin-top: auto; padding: var(--space-3) 0 calc(var(--space-3) + env(safe-area-inset-bottom)); background: var(--device-bg); }
    .to-position { width: 100%; min-height: var(--button-main-height); border: 0; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .to-position:disabled { opacity: 0.45; }
  `,
})
export class ExerciseSheetPage {
  readonly exerciseId = input.required<string>();
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressStore);

  protected readonly schemeWidth = SCHEME_WIDTH;
  protected readonly schemeHeight = SCHEME_HEIGHT;
  protected readonly shooterX = SHOOTER_X;
  protected readonly groundY = GROUND_Y;
  protected readonly targetsMidX = (TARGETS_FROM_X + TARGETS_TO_X) / 2;

  private readonly def = computed(() => exerciseById(this.exerciseId() as ExerciseId) ?? null);
  protected readonly card = computed(() => {
    const def = this.def();
    return def ? briefingCard(def, this.progress.course()) : null;
  });
  protected readonly isInstructorOn = linkedSignal(() => this.card()?.instructor?.isDefaultOn ?? false);
  protected readonly availability = computed(() => {
    const def = this.def();
    return def ? playability(def) : null;
  });
  protected readonly targetXs = computed(() => {
    const count = Math.max(1, this.card()?.scheme.targetCount ?? 1);
    return Array.from({ length: count }, (_, index) => (count === 1 ? TARGETS_TO_X : TARGETS_FROM_X + ((TARGETS_TO_X - TARGETS_FROM_X) * index) / (count - 1)));
  });

  protected toPosition(): void {
    const isWithInstructor = this.card()?.instructor !== null && this.isInstructorOn();
    void this.router.navigate(['/position', this.exerciseId()], isWithInstructor ? { queryParams: { instructor: 'on' } } : {});
  }
}
