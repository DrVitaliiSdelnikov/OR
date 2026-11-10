import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { CARTRIDGES } from '../../core/content';
import { Vector2 } from '../../sim/noise';
import { BoltAction, MAGAZINE_CAPACITY } from '../../sim/bolt';
import { ptPerMil, scopeById } from '../../sim/scope-model';
import { BoltTrackComponent } from '../position/bolt-track.component';
import { BOLT_SCREEN_X_MIRROR } from '../position/position-session';
import { TurretDrumComponent } from '../position/turret-drum.component';
import { GLASS_SIZE_PT, ScopeRenderer } from '../scene/scope-renderer';
import { FeedbackService } from '../services/feedback.service';
import { ProgressStore } from '../services/progress.store';
import { CartridgesSchemeComponent } from '../textbook/schemes/cartridges-scheme.component';
import { ReticleSchemeComponent } from '../textbook/schemes/reticle-scheme.component';
import { TextbookCards } from '../textbook/textbook-cards.service';
import { gongRadiusPt, impactShiftPt, INTRO_SCENE, INTRO_STEPS, IntroProgress, isStepDone, MEASURE, measureHint, partKey, START_PROGRESS } from './intro.model';
import { PartSchemeComponent } from './part-scheme.component';

const MIN_MAGNIFICATION = scopeById(INTRO_SCENE.scopeId).magnificationMin;
const MAX_MAGNIFICATION = scopeById(INTRO_SCENE.scopeId).magnificationMax;
const GLASS_CENTER_PT = GLASS_SIZE_PT / 2;

@Component({
  selector: 'or-intro',
  imports: [IonContent, RouterLink, PartSchemeComponent, TurretDrumComponent, BoltTrackComponent, ReticleSchemeComponent, CartridgesSchemeComponent],
  template: `
    @let current = step();
    <ion-content>
      <div class="intro" data-test="intro">
        <header class="header">
          <a class="back" routerLink="/course/00" aria-label="Назад" data-test="intro-back">←</a>
          <div>
            <h1 class="title">00 · Винтовка и прицел</h1>
            <div class="subtitle mono" data-test="intro-step">шаг {{ stepIndex() + 1 }} из {{ steps.length }} · {{ current.title }}</div>
          </div>
        </header>

        <div class="instructor" data-test="intro-instruction"><span class="callsign mono">Старший:</span> {{ current.instruction }}</div>

        <section class="station" [attr.data-test]="'station-' + current.id">
          @switch (current.id) {
            @case ('rifle') {
              <or-part-scheme kind="rifle" [parts]="current.parts!" [seen]="seenIn('rifle')" [chosenId]="chosenPart()" (tapPart)="tapPart('rifle', $event)" />
            }
            @case ('scope') {
              <or-part-scheme kind="scope" [parts]="current.parts!" [seen]="seenIn('scope')" [chosenId]="chosenPart()" (tapPart)="tapPart('scope', $event)" />
            }
            @case ('reticles') {
              <div class="paper"><or-reticle-scheme /></div>
              <div class="question mono">Гонг {{ measureSizeText }} м на {{ measure.distanceM }} м — сколько MIL?</div>
              <div class="answers">
                @for (option of measure.optionsMil; track option) {
                  <button class="answer" type="button" [class.chosen]="progress().answerMil === option" (click)="answer(option)" [attr.data-test]="'measure-' + option">{{ milText(option) }} MIL</button>
                }
              </div>
              @if (hint(); as text) {
                <div class="hint mono" data-test="measure-hint">{{ text }}</div>
              }
            }
            @case ('cartridges') {
              @if (allCards(); as cards) {
                <div class="paper"><or-cartridges-scheme [cards]="cards" /></div>
              } @else {
                <p class="pending mono" data-test="cartridges-pending">считаю карточки патронов…</p>
              }
            }
            @case ('bolt') {
              <or-bolt-track [isFireWaitingShown]="false" [step]="boltView().step" [progress]="boltView().progress" (drag)="dragBolt($event)" />
              @if (progress().isBoltCycled) {
                <div class="done mono" data-test="bolt-done">Патрон в стволе — затвор закрыт</div>
              }
            }
            @default {
              <div class="glass-wrap">
                <canvas #glass class="glass" data-test="intro-glass"></canvas>
                @if (current.id === 'drum') {
                  <svg class="overlay" [attr.viewBox]="'0 0 ' + glassSize + ' ' + glassSize" aria-hidden="true">
                    <circle class="impact" [attr.cx]="glassCenter" [attr.cy]="impactY()" r="4" data-test="intro-impact" [attr.data-up-mil]="impactUpMil()" />
                  </svg>
                }
              </div>
              @if (current.id === 'drum') {
                <or-turret-drum axis="elevation" [clicks]="progress().dialledClicks" [minClicks]="0" [valueText]="drumValueText()" [counter]="drumCounter()" (turn)="turn($event)" />
              } @else {
                <div class="zoom">
                  <button class="zoom-step" type="button" (click)="zoom(-1)" aria-label="Уменьшить кратность" data-test="intro-zoom-out">−</button>
                  <span class="mono" data-test="intro-magnification">{{ magnification() }}×</span>
                  <button class="zoom-step" type="button" (click)="zoom(1)" aria-label="Увеличить кратность" data-test="intro-zoom-in">+</button>
                </div>
              }
            }
          }
        </section>

        <div class="dock">
          @if (isLastStep()) {
            <button class="next" type="button" [disabled]="!isCurrentDone()" (click)="finish()" data-test="intro-finish">Готов к упражнению 01</button>
          } @else {
            <button class="next" type="button" [disabled]="!isCurrentDone()" (click)="next()" data-test="intro-next">Дальше</button>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .intro { display: flex; flex-direction: column; gap: var(--space-3); min-height: 100%; padding: var(--space-3) var(--gutter) 0; }
    .header { display: flex; align-items: center; gap: var(--space-3); }
    .back { display: grid; place-items: center; min-width: var(--touch-min); min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .subtitle { font: 500 var(--type-label) / 1.3 var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--device-text-muted); }
    .instructor { padding: var(--space-2) var(--space-3); border-radius: var(--radius-paper); background: var(--paper-bg); color: var(--paper-ink); font: 600 var(--type-body) / 1.35 var(--font-text); }
    .callsign { font-size: var(--type-label); letter-spacing: var(--tracking-label); text-transform: uppercase; color: var(--paper-graphite); }
    .station { display: flex; flex-direction: column; gap: var(--space-3); }
    .glass-wrap { position: relative; align-self: center; width: min(100%, 276px); aspect-ratio: 1; }
    .glass, .overlay { position: absolute; inset: 0; width: 100%; height: 100%; border-radius: 50%; }
    .glass { border: 3px solid var(--device-line-strong); }
    .impact { fill: var(--device-error); stroke: var(--device-text); stroke-width: 1.5; }
    .zoom { display: grid; grid-template-columns: var(--touch-min) 1fr var(--touch-min); align-items: center; text-align: center; border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); font: 700 var(--type-value) / 1 var(--font-mono); color: var(--device-accent); }
    .zoom-step { min-height: var(--touch-min); border: 0; background: var(--device-surface-2); color: var(--device-text); font: 700 var(--type-value) / 1 var(--font-mono); }
    .paper { padding: var(--space-3); border-radius: var(--radius-paper); background: var(--paper-bg); color: var(--paper-ink); }
    .question { font: 600 var(--type-body) / 1.35 var(--font-mono); }
    .answers { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); }
    .answer { min-height: var(--touch-min); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 700 var(--type-body) / 1 var(--font-mono); }
    .answer.chosen { border-color: var(--device-accent); color: var(--device-accent); }
    .hint { color: var(--device-error-text); font: 500 var(--type-label) / 1.4 var(--font-mono); }
    .pending, .done { margin: 0; font: 500 var(--type-label) / 1.4 var(--font-mono); color: var(--device-text-muted); }
    .done { color: var(--device-ok); }
    .dock { position: sticky; bottom: 0; margin-top: auto; padding: var(--space-3) 0 calc(var(--space-3) + env(safe-area-inset-bottom)); background: var(--device-bg); }
    .next { width: 100%; min-height: var(--button-main-height); border: 0; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 var(--type-value) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .next:disabled { opacity: 0.45; }
  `,
})
export class IntroPage {
  private readonly router = inject(Router);
  private readonly progressStore = inject(ProgressStore);
  private readonly feedback = inject(FeedbackService);
  private readonly textbookCards = inject(TextbookCards);
  private readonly glassCanvas = viewChild<ElementRef<HTMLCanvasElement>>('glass');
  private readonly bolt = new BoltAction(MAGAZINE_CAPACITY, 'spent');
  private renderer: { canvas: HTMLCanvasElement; scope: ScopeRenderer } | null = null;
  private frameHandle = 0;

  protected readonly steps = INTRO_STEPS;
  protected readonly measure = MEASURE;
  protected readonly measureSizeText = String(MEASURE.gongSizeM).replace('.', ',');
  protected readonly glassSize = GLASS_SIZE_PT;
  protected readonly glassCenter = GLASS_CENTER_PT;
  protected readonly stepIndex = signal(0);
  protected readonly step = computed(() => INTRO_STEPS[this.stepIndex()]);
  protected readonly progress = signal<IntroProgress>(START_PROGRESS);
  protected readonly chosenPart = signal<string | null>(null);
  protected readonly magnification = signal(INTRO_SCENE.startMagnification);
  protected readonly boltView = signal({ step: this.bolt.currentStep, progress: this.bolt.progress });
  protected readonly isCurrentDone = computed(() => isStepDone(this.step().id, this.progress()));
  protected readonly isLastStep = computed(() => this.stepIndex() === INTRO_STEPS.length - 1);
  protected readonly hint = computed(() => measureHint(this.progress().answerMil));
  protected readonly impactUpMil = computed(() => this.progress().dialledClicks * scopeById(INTRO_SCENE.scopeId).clickMrad);
  protected readonly impactY = computed(() => GLASS_CENTER_PT - impactShiftPt(this.progress().dialledClicks, INTRO_SCENE.startMagnification));
  protected readonly drumValueText = computed(() => `↑ ${this.impactUpMil().toFixed(1)}`);
  protected readonly drumCounter = computed(() => `${this.progress().dialledClicks} кл.`);
  protected readonly allCards = computed(() => {
    const cards = this.textbookCards.cards();
    return cards && cards.size === CARTRIDGES.length ? cards : null;
  });

  constructor() {
    this.textbookCards.ensureBuilt();
    effect(() => {
      const canvas = this.glassCanvas()?.nativeElement ?? null;
      if (canvas && this.renderer?.canvas !== canvas) {
        this.renderer = { canvas, scope: new ScopeRenderer(canvas) };
      }
      if (!canvas) {
        this.renderer = null;
      }
    });
    const frame = (): void => {
      this.drawGlass();
      this.frameHandle = requestAnimationFrame(frame);
    };
    this.frameHandle = requestAnimationFrame(frame);
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frameHandle));
  }

  protected seenIn(stepId: 'rifle' | 'scope'): ReadonlySet<string> {
    const prefix = partKey(stepId, '');
    return new Set([...this.progress().seenParts].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length)));
  }

  protected tapPart(stepId: 'rifle' | 'scope', partId: string): void {
    this.chosenPart.set(partId);
    this.progress.update(progress => ({ ...progress, seenParts: new Set([...progress.seenParts, partKey(stepId, partId)]) }));
  }

  protected turn(clicks: number): void {
    const dialled = Math.max(0, this.progress().dialledClicks + clicks);
    this.feedback.emit(dialled === this.progress().dialledClicks ? 'drum-stop' : 'drum-click');
    this.progress.update(progress => ({ ...progress, dialledClicks: dialled }));
  }

  protected zoom(step: number): void {
    const next = Math.min(MAX_MAGNIFICATION, Math.max(MIN_MAGNIFICATION, this.magnification() + step));
    if (next === this.magnification()) {
      return;
    }
    this.feedback.emit('detent');
    this.progress.update(progress => ({
      ...progress,
      wasZoomedIn: progress.wasZoomedIn || next > INTRO_SCENE.startMagnification,
      wasZoomedOut: progress.wasZoomedOut || next < INTRO_SCENE.startMagnification,
    }));
    this.magnification.set(next);
  }

  protected answer(optionMil: number): void {
    this.progress.update(progress => ({ ...progress, answerMil: optionMil }));
  }

  protected milText(mil: number): string {
    return String(mil).replace('.', ',');
  }

  protected dragBolt(delta: Vector2): void {
    const result = this.bolt.drag(delta.x * BOLT_SCREEN_X_MIRROR, delta.y, performance.now() / 1000);
    if (result.stepCompleted === 'down') {
      this.progress.update(progress => ({ ...progress, isBoltCycled: true }));
    }
    this.boltView.set({ step: this.bolt.currentStep, progress: this.bolt.progress });
  }

  protected next(): void {
    this.chosenPart.set(null);
    this.stepIndex.update(index => index + 1);
  }

  protected finish(): void {
    this.progressStore.completeIntro();
    void this.router.navigate(['/course']);
  }

  private drawGlass(): void {
    if (!this.renderer) {
      return;
    }
    const scope = scopeById(INTRO_SCENE.scopeId);
    const magnification = this.step().id === 'zoom' ? this.magnification() : INTRO_SCENE.startMagnification;
    this.renderer.scope.draw({
      scope,
      ptPerMil: ptPerMil(magnification),
      reticleScale: 1,
      targetOffsetPt: { x: 0, y: 0 },
      targetRadiusMil: gongRadiusPt(magnification) / ptPerMil(magnification),
      targetDistanceM: INTRO_SCENE.distanceM,
      nearWindMps: 0,
      marks: [],
      flags: [],
      timeS: performance.now() / 1000,
    });
  }
}
