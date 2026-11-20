import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { BallisticsEngine } from '../../core/engine';
import { text } from '../../i18n';
import { DrillRound, drillContext } from '../../sim/drill-round';
import { COUNT_DRILL_IDS, CountDrillId, drillTitle } from '../../sim/drills';
import { CalcSheetComponent } from '../notebook/calc-sheet.component';
import { STEP_TITLES, stepFormula } from '../notebook/calc-sheet.model';
import { FormulasSheetComponent } from '../notebook/formulas-sheet.component';
import { CheckSheetComponent } from '../review/check-sheet.component';
import { checkSheet } from '../review/review.model';
import { BackLinkDirective } from '../services/back-link.directive';
import { backLayer } from '../services/back-stack.service';
import { ProgressStore } from '../services/progress.store';
import { conditionsText, summaryView } from './drill-cards.model';

const MS_PER_S = 1000;
const SEED_RANGE = 1_000_000_000;

@Component({
  selector: 'or-drill-round',
  imports: [BackLinkDirective, CalcSheetComponent, CheckSheetComponent, FormulasSheetComponent],
  template: `
    <div class="round" data-test="drill-round">
      <header class="header">
        <a class="back mono" orBackLink="/drills" data-test="drill-leave">{{ texts.card.leave }}</a>
        <h1 class="title">{{ title() }}</h1>
      </header>
      @if (view(); as state) {
        @if (state.summary; as summary) {
          <section class="summary" data-test="drill-summary">
            <h2 class="summary-title">{{ texts.summary.title }}</h2>
            <div class="summary-line mono" data-test="drill-summary-counts">{{ summary.counts }}</div>
            <div class="summary-line mono" data-test="drill-summary-accuracy">{{ summary.accuracy }}</div>
            <div class="summary-line mono" data-test="drill-summary-time">{{ summary.averageTime }}</div>
            <ul class="errors mono" data-test="drill-summary-errors">
              @for (error of summary.errors; track error) {
                <li>{{ error }}</li>
              } @empty {
                <li>{{ texts.summary.noErrors }}</li>
              }
            </ul>
            <div class="actions">
              <button class="action main mono" type="button" (click)="restart(false)" data-test="drill-again">{{ texts.summary.again }}</button>
              <button class="action mono" type="button" (click)="restart(true)" data-test="drill-same">{{ texts.summary.same }}</button>
              <button class="action mono" type="button" (click)="leave()" data-test="drill-exit">{{ texts.summary.leave }}</button>
            </div>
          </section>
        } @else {
          <div class="conditions mono" data-test="drill-conditions">{{ state.conditions }}</div>
          @if (state.check; as check) {
            <section class="verdict">
              <or-check-sheet [view]="check" [isInitiallyOpen]="true" [isScoreShown]="false" />
              <button class="action main mono" type="button" (click)="next()" data-test="drill-next">{{ state.isLast ? texts.card.finish : texts.card.next }}</button>
            </section>
          } @else {
            <div class="sheet">
              <or-calc-sheet [editor]="state.round" [revision]="revision()" [step]="state.step" [heading]="state.heading" (changed)="touch()" (back)="onSheetBack()" (formulas)="isFormulasOpen.set(true)" />
            </div>
          }
        }
      } @else {
        <div class="loading mono">{{ texts.card.loading }}</div>
      }
      @if (isFormulasOpen() && view(); as state) {
        <or-formulas-sheet [lines]="state.formulaLines" (close)="isFormulasOpen.set(false)" />
      }
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .round { display: flex; flex-direction: column; height: 100%; padding-bottom: env(safe-area-inset-bottom); background: var(--device-bg); color: var(--device-text); }
    .header { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--gutter) var(--space-2); }
    .back { display: grid; place-items: center; min-height: var(--touch-min); padding: 0 var(--space-2); border: var(--border-width) solid var(--device-line); border-radius: var(--radius-device); color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); text-decoration: none; }
    .title { margin: 0; font: 700 var(--type-value) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .conditions { padding: 0 var(--gutter) var(--space-2); font: 700 var(--type-body) / 22px var(--font-mono); color: var(--device-accent); }
    .sheet { flex: 1; min-height: 0; }
    .verdict, .summary { display: flex; flex-direction: column; gap: var(--space-3); flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--gutter) var(--space-4); }
    .summary-title { margin: 0; font: 700 var(--type-title) / 1.2 var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .summary-line { font: 700 var(--type-body) / 22px var(--font-mono); }
    .errors { margin: 0; padding-left: var(--space-4); font: 500 var(--type-label) / 20px var(--font-mono); color: var(--device-text-muted); }
    .actions { display: flex; flex-direction: column; gap: var(--space-2); margin-top: auto; }
    .action { min-height: 52px; border: 1px solid var(--device-line-strong); border-radius: var(--radius-device); background: var(--device-surface); color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .action.main { border: none; background: var(--device-accent); color: var(--device-on-accent); }
    .loading { padding: var(--space-4) var(--gutter); color: var(--device-text-muted); }
  `,
})
export class DrillRoundPage {
  readonly drillId = input.required<string>();

  private readonly progress = inject(ProgressStore);
  private readonly router = inject(Router);
  private readonly engine = new BallisticsEngine();
  protected readonly texts = text.drills;
  protected readonly round = signal<DrillRound | null>(null);
  protected readonly revision = signal(0);
  protected readonly isFormulasOpen = signal(false);
  private readonly isSummaryShown = signal(false);
  private readonly formulasLayer = backLayer(() => this.isFormulasOpen(), () => this.isFormulasOpen.set(false));
  private readonly countDrillId = computed(() => (COUNT_DRILL_IDS as readonly string[]).includes(this.drillId()) ? (this.drillId() as CountDrillId) : null);
  protected readonly title = computed(() => {
    const id = this.countDrillId();
    return id ? drillTitle(id) : '';
  });
  protected readonly view = computed(() => {
    this.revision();
    const round = this.round();
    if (!round) {
      return null;
    }
    const system = round.notebook.context.card.system;
    const check = round.check;
    return {
      round,
      step: round.card.step,
      heading: this.texts.card.heading({ number: round.cardIndex + 1, count: round.cards.length }),
      conditions: conditionsText(round.card),
      check: check ? checkSheet(check, 'manual-easy', system) : null,
      isLast: round.cardIndex === round.cards.length - 1,
      summary: this.isSummaryShown() ? summaryView(round.summary()!) : null,
      formulaLines: [{ title: STEP_TITLES[round.card.step], formula: stepFormula(round.card.step, system) }],
    };
  });

  constructor() {
    effect(() => {
      const id = this.countDrillId();
      if (!id) {
        void this.router.navigate(['/drills']);
        return;
      }
      untracked(() => void this.startRound(id, randomSeed()));
    });
  }

  protected touch(): void {
    this.revision.update(value => value + 1);
  }

  protected onSheetBack(): void {
    if (!this.round()?.check) {
      this.leave();
    }
  }

  protected next(): void {
    const round = this.round();
    if (!round) {
      return;
    }
    if (round.isFinished) {
      const record = round.toRecord();
      if (record) {
        this.progress.addDrillRound(record);
      }
      this.isSummaryShown.set(true);
    } else {
      round.next();
    }
    this.touch();
  }

  protected restart(isSameSeed: boolean): void {
    const round = this.round();
    const id = this.countDrillId();
    if (round && id) {
      void this.startRound(id, isSameSeed ? round.seed : randomSeed());
    }
  }

  protected leave(): void {
    void this.router.navigate(['/drills']);
  }

  private async startRound(id: CountDrillId, seed: number): Promise<void> {
    const context = await drillContext(this.engine, this.progress.activeProfile(), this.progress.settings().unitSystem);
    this.isSummaryShown.set(false);
    this.round.set(DrillRound.start({ drillId: id, seed, context, startedAtIso: new Date().toISOString(), clockS: () => performance.now() / MS_PER_S }));
    this.touch();
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * SEED_RANGE);
}
