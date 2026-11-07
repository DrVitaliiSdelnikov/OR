import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { GameSession } from '../services/game-session';
import { ProgressStore } from '../services/progress.store';
import { continueCard, rankHeader } from './home.model';

const INTRO_ID = '00';

@Component({
  selector: 'or-home',
  imports: [IonContent, RouterLink],
  template: `
    <ion-content>
      <div class="home">
        <header class="header">
          <div>
            <div class="rank" data-test="rank">{{ header().rankLabel }}</div>
            <div class="admissions" data-test="admissions">допуски {{ header().admissions }} / {{ header().admissionsTotal }}</div>
          </div>
          <a class="gear" routerLink="/settings" aria-label="Настройки" data-test="open-settings">⚙</a>
        </header>

        <h1 class="title">Огневой рубеж</h1>

        <nav class="menu">
          <a class="tile" routerLink="/course" data-test="tile-course"><span class="number">01</span>Снайперская подготовка</a>
          <button class="tile" type="button" (click)="startFreePlay()" data-test="tile-free"><span class="number">02</span>Свободная игра</button>
          <button class="tile" type="button" (click)="showLater()" data-test="tile-textbook"><span class="number">03</span>Учебник курсанта</button>
          <a class="tile" routerLink="/journal" data-test="tile-journal"><span class="number">04</span>Журнал стрелка</a>
        </nav>

        @if (laterMessage()) {
          <div class="later" data-test="later-message">Откроется позже</div>
        }

        <button class="continue" type="button" (click)="openContinue()" data-test="continue-card">
          @switch (card().kind) {
            @case ('start') {
              <span class="continue-label">Начать</span>
              <span class="continue-title">{{ cardExercise() }}</span>
            }
            @case ('continue') {
              <span class="continue-label">Продолжить</span>
              <span class="continue-title">{{ cardExercise() }}</span>
              <span class="continue-status">{{ cardStatus() }}</span>
            }
            @case ('free-play') {
              <span class="continue-label">Свободная игра</span>
              <span class="continue-title">курс пройден</span>
            }
          }
        </button>
      </div>
    </ion-content>
  `,
  styles: `
    .home { display: flex; flex-direction: column; gap: var(--space-4); min-height: 100%; padding: var(--space-3) var(--gutter) var(--space-6); }
    .header { display: flex; align-items: flex-start; justify-content: space-between; }
    .rank { font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--device-accent); }
    .admissions { font: 500 var(--type-label) / 18px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .gear { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); font-size: var(--type-title); text-decoration: none; }
    .title { margin: var(--space-4) 0 var(--space-2); font: 700 var(--type-hero) / 44px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--device-text); }
    .menu { display: flex; flex-direction: column; gap: var(--space-2); }
    .tile { display: flex; align-items: center; gap: var(--space-3); min-height: var(--button-main-height); padding: 0 var(--space-4); border: var(--border-width) solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; text-align: left; text-decoration: none; cursor: pointer; }
    .number { font: 700 var(--type-label) / 16px var(--font-mono); color: var(--device-accent); }
    .later { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--device-text-muted); text-transform: uppercase; letter-spacing: var(--tracking-label); }
    .continue { display: flex; flex-direction: column; gap: var(--space-1); margin-top: auto; min-height: var(--button-main-height); padding: var(--space-3) var(--space-4); border: 0; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); text-align: left; cursor: pointer; }
    .continue-label { font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .continue-title { font: 700 var(--type-value) / 22px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .continue-status { font: 500 var(--type-label) / 16px var(--font-mono); }
  `,
})
export class HomePage {
  private readonly progress = inject(ProgressStore);
  private readonly game = inject(GameSession);
  private readonly router = inject(Router);

  protected readonly laterMessage = signal(false);
  protected readonly header = computed(() => rankHeader(this.progress.course()));
  protected readonly card = computed(() => continueCard(this.progress.course()));
  protected readonly cardExercise = computed(() => {
    const card = this.card();
    return card.kind === 'free-play' ? '' : `${card.exerciseId} · ${card.title}`;
  });
  protected readonly cardStatus = computed(() => {
    const card = this.card();
    return card.kind === 'continue' && card.status === 'not-admitted' ? 'не зачтено' : 'новое';
  });

  protected startFreePlay(): void {
    this.game.startFreePlay();
    void this.router.navigate(['/weather']);
  }

  protected showLater(): void {
    this.laterMessage.set(true);
  }

  protected openContinue(): void {
    const card = this.card();
    if (card.kind === 'free-play') {
      this.startFreePlay();
      return;
    }
    if (card.exerciseId === INTRO_ID) {
      this.showLater();
      return;
    }
    void this.router.navigate(['/course', card.exerciseId]);
  }
}
