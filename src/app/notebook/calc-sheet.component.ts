import { Component, computed, input, output, signal } from '@angular/core';
import { REFERENCE_PENALTY } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { ChipKind, NotebookStepId, stepHasSide } from '../../sim/notebook';
import { PositionSession } from '../position/position-session';
import { DraftKey, editDraft, formulaTokens, hubSteps, missingInput, modeBadge, sideOptions, STEP_TITLES, TAPE_UNITS, tapeLabels } from './calc-sheet.model';
import { ChipTrayComponent } from './chip-tray.component';
import { KeypadComponent } from './keypad.component';

const FORMULAS_TEXTS = text.notebook.formulas;

@Component({
  selector: 'or-calc-sheet',
  imports: [ChipTrayComponent, KeypadComponent],
  template: `
    @let state = view();
    <section class="calc" data-test="calc-sheet">
      <header class="head">
        <button class="back" type="button" (click)="back.emit()" data-test="calc-back">{{ texts.back }}</button>
        <div class="titles">
          <div class="title" data-test="calc-title">{{ state.title }}</div>
          <div class="badge mono" data-test="calc-mode">{{ state.badge }}</div>
        </div>
      </header>

      <div class="paper">
        @if (state.missing; as missing) {
          <div class="missing mono" data-test="calc-missing">{{ missing }}</div>
        }
        <div class="substitution mono" data-test="calc-formula" data-hint="calc-formula">
          @for (token of state.tokens; track $index) {
            @if (token.kind === 'text') {
              <span class="print">{{ token.text }}</span>
            } @else {
              <button
                class="slot"
                type="button"
                [class.active]="activeSlot() === token.index"
                [class.filled]="token.placedText !== null"
                (click)="tapSlot(token.index, token.placedText !== null)"
                [attr.aria-label]="texts.slot({ label: token.label })"
                [attr.data-test]="'slot-' + token.index"
              >
                @if (token.placedText !== null) {
                  {{ token.placedText }}
                } @else {
                  <span class="slot-label">{{ token.label }}</span>
                }
              </button>
            }
          }
        </div>

        <div class="tape" data-hint="calc-tape">
          @for (label of state.tapeLabels; track $index) {
            <div class="tape-row mono">
              <span>{{ label }}</span>
              <button class="cell" type="button" [class.active]="activeTape() === $index" (click)="tapTape($index)" [attr.data-test]="'tape-' + $index">
                {{ cellText($index) }}
                @if ($last && state.unit) {
                  <span class="unit">{{ state.unit }}</span>
                }
              </button>
            </div>
          }
        </div>

        @if (state.sides.length > 0 || state.hasUnits) {
          <div class="answer-options">
            @for (side of state.sides; track side.sign) {
              <button class="option mono" type="button" [class.chosen]="state.sign === side.sign" (click)="chooseSide(side.sign)" [attr.data-test]="'side-' + side.sign">{{ side.label }}</button>
            }
            @if (state.hasUnits) {
              <button class="option mono units" type="button" (click)="toggleUnits()" data-test="units">{{ state.units === 'mil' ? 'MIL' : 'MOA' }} ▾</button>
            }
          </div>
        }
      </div>

      <div class="device">
        @if (activeSlot() !== null) {
          <or-chip-tray [chips]="state.chips" [usedKinds]="state.usedKinds" [awaitedKind]="state.awaitedKind" [isGrouped]="state.isGrouped" [distanceM]="state.distanceM" (pick)="pickChip($event)" />
        } @else if (activeTape() !== null) {
          <or-keypad (press)="pressKey($event)" />
        } @else {
          <div class="idle mono">{{ texts.idle }}</div>
        }
      </div>

      <footer class="actions">
        <button class="formulas mono" type="button" (click)="formulas.emit()" data-test="calc-formulas">{{ state.formulasLabel }}</button>
        <button class="record mono" type="button" [disabled]="!state.canRecord" (click)="record()" data-test="calc-record">{{ texts.record }}</button>
      </footer>
    </section>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .calc { display: flex; flex-direction: column; height: 100%; border-top: 2px solid var(--device-accent); border-radius: 14px 14px 0 0; background: var(--device-surface); }
    .head { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--gutter); }
    .back { min-height: var(--touch-min); padding: 0 var(--space-2); border: 1px solid var(--device-line); border-radius: var(--radius-device); background: transparent; color: var(--device-text); font: 700 var(--type-label) / 16px var(--font-mono); }
    .titles { display: flex; flex: 1; flex-direction: column; align-items: flex-end; }
    .title { font: 700 var(--type-body) / 20px var(--font-title); letter-spacing: var(--tracking-title); text-transform: uppercase; color: var(--device-text); }
    .badge { font: 700 11px / 14px var(--font-mono); letter-spacing: var(--tracking-label); color: var(--device-accent); }
    .paper { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3) var(--gutter); background-color: var(--paper-bg); background-image: linear-gradient(var(--paper-grid) 1px, transparent 1px), linear-gradient(90deg, var(--paper-grid) 1px, transparent 1px); background-size: 16px 16px; color: var(--paper-ink); }
    .missing { padding: 4px 8px; border: 1.5px dashed var(--paper-red-pencil); border-radius: 4px; color: var(--paper-red-pencil); font: 500 var(--type-label) / 16px var(--font-mono); }
    .substitution { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font: 500 var(--type-body) / 24px var(--font-mono); }
    .slot { min-width: 64px; min-height: var(--touch-min); padding: 0 6px; border: none; border-bottom: 2px dashed var(--paper-graphite); background: transparent; color: var(--paper-graphite); font: 700 var(--type-body) / 24px var(--font-mono); }
    .slot.active { border-bottom-color: var(--paper-stamp-gold); background: color-mix(in srgb, var(--paper-stamp-gold) 12%, transparent); }
    .slot.filled { border-bottom-style: solid; }
    .slot-label { font-size: 12px; font-weight: 500; }
    .tape { display: flex; flex-direction: column; }
    .tape-row { display: flex; align-items: center; justify-content: space-between; min-height: var(--touch-min); border-bottom: 1px solid var(--paper-grid); font: 500 var(--type-label) / 18px var(--font-mono); }
    .cell { min-width: 96px; min-height: var(--touch-min); border: none; border-bottom: 2px dotted var(--paper-graphite); background: transparent; color: var(--paper-graphite); font: 700 var(--type-body) / 20px var(--font-mono); text-align: right; }
    .cell.active { border-bottom: 2px solid var(--paper-stamp-gold); }
    .unit { margin-left: 4px; font-size: 12px; font-weight: 500; }
    .answer-options { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .option { flex: 1; min-height: var(--touch-min); border: 1.5px solid var(--paper-graphite); border-radius: var(--radius-device); background: transparent; color: var(--paper-graphite); font: 700 var(--type-label) / 16px var(--font-mono); text-transform: uppercase; }
    .option.chosen { background: var(--paper-graphite); color: var(--paper-bg); }
    .option.units { flex: 0 0 96px; }
    .device { display: flex; flex: 1; flex-direction: column; justify-content: flex-end; min-height: 0; overflow-y: auto; padding: var(--space-2) var(--gutter); }
    .idle { font: 500 var(--type-label) / 18px var(--font-mono); color: var(--device-text-muted); }
    .actions { display: grid; grid-template-columns: 1fr 1.3fr; gap: var(--space-2); padding: var(--space-2) var(--gutter) var(--space-3); }
    .formulas, .record { min-height: 52px; border-radius: var(--radius-device); font: 700 var(--type-label) / 16px var(--font-mono); letter-spacing: var(--tracking-label); text-transform: uppercase; }
    .formulas { border: 1px solid var(--device-line-strong); background: var(--device-surface); color: var(--device-text); }
    .record { border: none; background: var(--device-accent); color: var(--device-on-accent); }
    .record:disabled { opacity: 0.45; }
  `,
})
export class CalcSheetComponent {
  readonly session = input.required<PositionSession>();
  readonly revision = input(0);
  readonly step = input.required<NotebookStepId>();
  readonly back = output<void>();
  readonly changed = output<void>();
  readonly formulas = output<void>();

  protected readonly texts = text.notebook.calcSheet;
  protected readonly activeSlot = signal<number | null>(null);
  protected readonly activeTape = signal<number | null>(null);
  protected readonly draft = signal('');
  protected readonly view = computed(() => {
    this.revision();
    const session = this.session();
    const step = this.step();
    const notebook = session.notebook;
    const sheet = session.stepSheet(step);
    const state = notebook.steps[step];
    const steps = hubSteps(notebook);
    const tape = state.tape;
    const lastValue = tape[tape.length - 1];
    const activeSlot = this.activeSlot();
    const isSideMissing = stepHasSide(step) && lastValue !== null && lastValue !== 0 && state.sign === null;
    return {
      title: this.texts.title({ stepTitle: STEP_TITLES[step], number: steps.indexOf(step) + 1, count: steps.length }),
      badge: modeBadge(notebook.mode),
      missing: missingInput(notebook, step),
      tokens: formulaTokens(notebook, step),
      tapeLabels: tapeLabels(notebook, step),
      tape,
      unit: TAPE_UNITS[step] ?? (state.units === 'mil' ? 'MIL' : 'MOA'),
      sides: sideOptions(step),
      sign: state.sign,
      hasUnits: TAPE_UNITS[step] === undefined,
      units: state.units,
      chips: sheet.chips,
      usedKinds: sheet.slots.flatMap(slot => (slot.placed ? [slot.placed] : [])),
      awaitedKind: activeSlot === null ? null : (sheet.slots[activeSlot]?.waitsFor ?? null),
      isGrouped: sheet.isGrouped,
      distanceM: notebook.distanceM,
      formulasLabel: notebook.mode === 'manual-hard' && !notebook.hasOpenedReference ? FORMULAS_TEXTS.withPenalty({ penalty: REFERENCE_PENALTY }) : FORMULAS_TEXTS.title,
      canRecord: sheet.slots.every(slot => slot.placed !== null) && lastValue !== null && lastValue !== undefined && !isSideMissing,
    };
  });

  protected cellText(index: number): string {
    if (this.activeTape() === index) {
      return this.draft() || '·';
    }
    const value = this.view().tape[index];
    return value === null || value === undefined ? '·' : String(value);
  }

  protected tapSlot(index: number, isFilled: boolean): void {
    if (isFilled) {
      this.session().removeChip(this.step(), index);
      this.changed.emit();
    }
    this.activeTape.set(null);
    this.activeSlot.set(index);
  }

  protected pickChip(kind: ChipKind): void {
    const slotIndex = this.activeSlot();
    if (slotIndex === null) {
      return;
    }
    this.session().placeChip(this.step(), kind, slotIndex);
    const nextEmpty = this.session()
      .stepSheet(this.step())
      .slots.findIndex(slot => slot.placed === null);
    this.activeSlot.set(nextEmpty >= 0 ? nextEmpty : null);
    this.changed.emit();
  }

  protected tapTape(index: number): void {
    const value = this.view().tape[index];
    this.activeSlot.set(null);
    this.activeTape.set(index);
    this.draft.set(value === null || value === undefined ? '' : String(value));
  }

  protected pressKey(key: DraftKey): void {
    const index = this.activeTape();
    if (index === null) {
      return;
    }
    const draft = editDraft(this.draft(), key);
    this.draft.set(draft);
    const value = draft === '' ? null : Number.parseFloat(draft);
    this.session().typeTape(this.step(), index, value !== null && Number.isFinite(value) ? value : null);
    this.changed.emit();
  }

  protected chooseSide(sign: 1 | -1): void {
    this.session().setSign(this.step(), sign);
    this.changed.emit();
  }

  protected toggleUnits(): void {
    this.session().setUnits(this.step(), this.view().units === 'mil' ? 'moa' : 'mil');
    this.changed.emit();
  }

  protected record(): void {
    this.session().recordStep(this.step());
    this.activeSlot.set(null);
    this.activeTape.set(null);
    this.changed.emit();
    this.back.emit();
  }
}
