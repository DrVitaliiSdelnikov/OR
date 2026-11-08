import { Component, computed, input, output, signal } from '@angular/core';
import { Correction } from '../../core/types';
import { PositionSession, PositionShot } from '../position/position-session';
import { CheckSheetComponent } from './check-sheet.component';
import { checkSheet, correctionText, diagnosisText, shotPointsText, targetPlaques } from './review.model';
import { TargetSchemeComponent } from './target-scheme.component';

const CALL_DISTANCE_DECIMALS = 1;

@Component({
  selector: 'or-review-sheet',
  imports: [TargetSchemeComponent, CheckSheetComponent],
  template: `
    @let state = view();
    <section class="review" role="dialog" aria-label="Разбор выстрела" data-test="review-sheet">
      <header class="head">
        <div class="title">Разбор выстрела</div>
        <div class="points mono" data-test="review-points">{{ isCallPending() ? '?' : state.points }}</div>
      </header>

      <div class="body">
        <div class="scheme-row">
          <or-target-scheme
            [radiusMil]="shot().review.targetRadiusMil"
            [call]="isCallPending() ? null : shot().review.call"
            [impact]="isCallPending() ? null : shot().review.impact"
            [playerCall]="playerCall()"
            [isPicking]="isCallPending()"
            (pick)="playerCall.set($event)"
          />
          <div class="legend mono">
            @if (isCallPending()) {
              <div class="ask" data-test="call-ask">Отметь, где была сетка</div>
              <button class="reveal mono" type="button" [disabled]="playerCall() === null" (click)="revealImpact()" data-test="call-reveal">Показать попадание</button>
            } @else {
              <div>✛ сетка в момент выстрела</div>
              <div>● попадание</div>
              @if (callVerdict(); as verdict) {
                <div class="call-verdict" data-test="call-verdict">{{ verdict }}</div>
              }
              @if (state.coldBoreNote; as note) {
                <div class="cold">{{ note }}</div>
              }
            }
          </div>
        </div>

        @if (!isCallPending()) {
          <div class="diagnosis" data-test="review-diagnosis">{{ state.diagnosis }}</div>
          @if (state.correction; as correction) {
            <div class="correction mono" data-test="review-correction">{{ correction }}</div>
          }
          @if (state.check; as check) {
            <or-check-sheet [view]="check" [isInitiallyOpen]="shot().review.diagnosis === 'data'" />
          } @else {
            <div class="no-check mono" data-test="review-no-check">{{ state.noCheckText }}</div>
          }
        }
      </div>

      <footer class="foot">
        <div class="plaques mono" data-test="review-plaques">
          @for (plaque of state.plaques; track $index) {
            <span class="plaque">{{ plaque }}</span>
          }
        </div>
        @if (state.canSaveDope && !isCallPending()) {
          <button class="dope-link mono" type="button" [disabled]="isDopeSaved()" (click)="saveToDope()" data-test="review-dope">{{ isDopeSaved() ? 'записано в ДОПЕ' : 'в ДОПЕ →' }}</button>
        }
        <div class="actions">
          <button class="recalc mono" type="button" [disabled]="isCallPending()" (click)="recalc.emit()" data-test="review-recalc">Пересчитать и повторить</button>
          <button class="next mono" type="button" [disabled]="isCallPending()" (click)="next.emit()" data-test="review-next">Дальше</button>
        </div>
      </footer>
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .review { display: flex; flex-direction: column; height: 100%; border-top: 2px solid var(--device-accent); border-radius: 14px 14px 0 0; background: var(--device-surface); }
    .head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--gutter); color: var(--device-text); }
    .title { font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; }
    .points { font: 700 var(--type-value) / 24px var(--font-mono); color: var(--device-accent); }
    .body { display: flex; flex: 1; flex-direction: column; gap: var(--space-2); min-height: 0; overflow-y: auto; padding: var(--space-2) var(--gutter); background-color: var(--paper-bg); color: var(--paper-ink); }
    .scheme-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-2); align-items: center; }
    .legend { display: flex; flex-direction: column; gap: 4px; font: 500 12px / 16px var(--font-mono); color: var(--paper-graphite); }
    .ask { font: 700 var(--type-label) / 18px var(--font-mono); color: var(--paper-red-pencil); }
    .reveal { min-height: var(--touch-min); border: none; border-radius: var(--radius-device); background: var(--device-accent); color: var(--device-on-accent); font: 700 12px / 16px var(--font-mono); text-transform: uppercase; }
    .reveal:disabled { opacity: 0.45; }
    .call-verdict { font-weight: 700; color: var(--paper-ink); }
    .cold { font-size: 11px; }
    .diagnosis { font: 700 var(--type-body) / 22px var(--font-mono); }
    .correction { padding: 6px 8px; border: 1.5px solid var(--paper-ink); border-radius: var(--radius-paper); font: 700 var(--type-label) / 18px var(--font-mono); }
    .no-check { font: 500 var(--type-label) / 16px var(--font-mono); color: var(--paper-graphite); }
    .foot { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2) var(--gutter) var(--space-3); }
    .plaques { display: flex; flex-wrap: wrap; gap: 6px; }
    .plaque { padding: 2px 8px; border: 1px solid var(--device-line); border-radius: var(--radius-device); font: 500 12px / 18px var(--font-mono); color: var(--device-text-muted); }
    .dope-link { align-self: flex-start; min-height: var(--touch-min); padding: 0 var(--space-3); border: 1px dashed var(--device-line-muted); border-radius: var(--radius-device); background: transparent; color: var(--device-text); font: 700 12px / 16px var(--font-mono); }
    .actions { display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--space-2); }
    .recalc, .next { min-height: 52px; border-radius: var(--radius-device); font: 700 12px / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .recalc { border: 1px solid var(--device-line-strong); background: transparent; color: var(--device-text); }
    .next { border: none; background: var(--device-accent); color: var(--device-on-accent); }
    .recalc:disabled, .next:disabled { opacity: 0.45; }
  `,
})
export class ReviewSheetComponent {
  readonly session = input.required<PositionSession>();
  readonly shot = input.required<PositionShot>();
  readonly next = output<void>();
  readonly recalc = output<void>();
  readonly saveDope = output<void>();

  protected readonly playerCall = signal<Correction | null>(null);
  protected readonly callVerdict = signal<string | null>(null);
  protected readonly isCallRevealed = signal(false);
  protected readonly isDopeSaved = signal(false);
  protected readonly isCallPending = computed(() => this.session().def.notebookMode === 'manual-hard' && !this.isCallRevealed());
  protected readonly view = computed(() => {
    const session = this.session();
    const shot = this.shot();
    const review = shot.review;
    const isPaper = session.def.stages.some(stage => !stage.closesOnHit);
    const coldBore = shot.result.coldBore;
    return {
      points: shotPointsText(shot.record.isHit, review.isFirstShotAtTarget, isPaper),
      diagnosis: diagnosisText(review.diagnosis, review.call),
      correction: correctionText(review.correction, review.diagnosis),
      check: review.check ? checkSheet(review.check, session.def.notebookMode ?? 'auto') : null,
      noCheckText: review.isFirstShotAtTarget ? 'Расчёт не записан — проверять нечего' : 'Проверка — по первому выстрелу',
      plaques: targetPlaques(session.def, session.records, { stageIndex: session.firingLine.stageIndex, targetIndex: session.firingLine.targetIndex }, session.isFinished),
      canSaveDope: review.dopeNoteMil !== null,
      coldBoreNote: shot.record.isColdBore ? `холодный ствол: ↑ ${coldBore.upMrad.toFixed(2)} · → ${coldBore.rightMrad.toFixed(2)}` : null,
    };
  });

  protected revealImpact(): void {
    const call = this.playerCall();
    if (!call) {
      return;
    }
    const isAccurate = this.session().recordCall(call);
    const actual = this.shot().review.call;
    const missMil = Math.hypot(call.upMrad - actual.upMrad, call.rightMrad - actual.rightMrad);
    this.callVerdict.set(isAccurate ? 'вызов точный' : `вызов мимо на ${missMil.toFixed(CALL_DISTANCE_DECIMALS)}`);
    this.isCallRevealed.set(true);
  }

  protected saveToDope(): void {
    this.isDopeSaved.set(true);
    this.saveDope.emit();
  }
}
