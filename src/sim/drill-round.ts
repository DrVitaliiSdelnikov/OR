import { CheckErrorType, checkManualSteps, CheckResult, CheckVerdict } from '../core/calc-check';
import { courseLoadout } from '../core/content';
import { buildDopeCard } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { UnitSystem } from '../core/units';
import { drillRoundSummary } from './drill-levels';
import { CountCard, CountDrillId, countRound, DrillContext, DrillId, DrillLevel, TIME_LIMITS } from './drills';
import { MainCause } from './miss-breakdown';
import { DEFAULT_FREE_PLAY } from './free-play';
import { checkInputs, CheckTruth, ChipKind, Notebook, NotebookCheckInputs, NotebookStepId, placeChip, recordStep, removeChip, setSign, setUnits, stepSheet, StepSheet, typeTape } from './notebook';
import { NotebookEditor } from './notebook-editor';
import { PencilMark } from './pencil-marks';
import { loadoutOf, RifleProfile, scopeOf } from './rifle-profile';
import { scopeById } from './scope-model';

export interface DrillCardCheck {
  notebook: Notebook;
  truth: CheckTruth;
  inputs: NotebookCheckInputs;
  result: CheckResult;
}

export interface DrillCardResult {
  verdict: CheckVerdict;
  errorTypes: CheckErrorType[];
  seconds: number;
  isTimedOut?: boolean;
  missCause?: MainCause | null;
}

export type DrillErrorKind = CheckErrorType | 'time' | `miss-${MainCause}`;

export interface DrillRoundRecord {
  drillId: DrillId;
  level: DrillLevel;
  seed: number;
  startedAtIso: string;
  cards: DrillCardResult[];
}

export interface DrillRoundSummary {
  exact: number;
  close: number;
  error: number;
  accuracy: number;
  averageSeconds: number;
  errorCounts: { type: DrillErrorKind; count: number }[];
}

export interface DrillRoundStart {
  drillId: CountDrillId;
  seed: number;
  context: DrillContext;
  startedAtIso: string;
  clockS: () => number;
  level?: DrillLevel;
}

export const DRILL_ROUNDS_KEPT = 200;
const NO_DIAL_TRUTH: CheckTruth = { trueWindClock: 12, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 };
const NO_PENCIL_MARKS: readonly PencilMark[] = [];

export class DrillRound implements NotebookEditor {
  readonly cards: readonly CountCard[];
  private currentIndex = 0;
  private currentNotebook: Notebook;
  private currentCheck: DrillCardCheck | null = null;
  private isCardTimedOut = false;
  private cardStartedS: number;
  private readonly cardResults: DrillCardResult[] = [];

  private constructor(private readonly start: DrillRoundStart) {
    this.cards = countRound(start.drillId, start.seed, start.context);
    this.currentNotebook = this.preparedNotebook(this.cards[0]);
    this.cardStartedS = start.clockS();
  }

  static start(start: DrillRoundStart): DrillRound {
    return new DrillRound(start);
  }

  get drillId(): CountDrillId {
    return this.start.drillId;
  }

  get seed(): number {
    return this.start.seed;
  }

  get level(): DrillLevel {
    return this.start.level ?? 'learn';
  }

  get isTimedOut(): boolean {
    return this.isCardTimedOut;
  }

  get cardIndex(): number {
    return this.currentIndex;
  }

  get card(): CountCard {
    return this.cards[this.currentIndex];
  }

  get notebook(): Notebook {
    return this.currentNotebook;
  }

  get check(): DrillCardCheck | null {
    return this.currentCheck;
  }

  get results(): readonly DrillCardResult[] {
    return this.cardResults;
  }

  get isFinished(): boolean {
    return this.cardResults.length === this.cards.length;
  }

  stepSheet(step: NotebookStepId): StepSheet {
    return stepSheet(this.currentNotebook, step);
  }

  pencilMarks(): readonly PencilMark[] {
    return NO_PENCIL_MARKS;
  }

  placeChip(step: NotebookStepId, chipKind: ChipKind, slotIndex?: number): void {
    this.edit(notebook => placeChip(notebook, step, chipKind, slotIndex));
  }

  removeChip(step: NotebookStepId, slotIndex: number): void {
    this.edit(notebook => removeChip(notebook, step, slotIndex));
  }

  typeTape(step: NotebookStepId, index: number, value: number | null): void {
    this.edit(notebook => typeTape(notebook, step, index, value));
  }

  setSign(step: NotebookStepId, sign: 1 | -1): void {
    this.edit(notebook => setSign(notebook, step, sign));
  }

  setUnits(step: NotebookStepId, units: 'mil' | 'moa'): void {
    this.edit(notebook => setUnits(notebook, step, units));
  }

  recordStep(step: NotebookStepId): void {
    if (this.currentCheck || this.isCardTimedOut) {
      return;
    }
    this.currentNotebook = recordStep(this.currentNotebook, step);
    const inputs = checkInputs(this.currentNotebook, NO_DIAL_TRUTH);
    const result = checkManualSteps(inputs.steps, this.currentNotebook.context.card.clickMil);
    this.currentCheck = { notebook: this.currentNotebook, truth: NO_DIAL_TRUTH, inputs, result };
    this.cardResults.push({
      verdict: result.verdict,
      errorTypes: [...new Set(result.rows.flatMap(row => row.errorTypes))],
      seconds: this.start.clockS() - this.cardStartedS,
    });
  }

  timeLeftS(): number | null {
    if (this.level !== 'timed') {
      return null;
    }
    return Math.max(0, TIME_LIMITS.cardS - (this.start.clockS() - this.cardStartedS));
  }

  expireIfLate(): boolean {
    const timeLeftS = this.timeLeftS();
    if (timeLeftS === null || timeLeftS > 0 || this.currentCheck || this.isCardTimedOut) {
      return false;
    }
    this.isCardTimedOut = true;
    this.cardResults.push({ verdict: 'error', errorTypes: [], seconds: TIME_LIMITS.cardS, isTimedOut: true });
    return true;
  }

  next(): boolean {
    if ((!this.currentCheck && !this.isCardTimedOut) || this.currentIndex === this.cards.length - 1) {
      return false;
    }
    this.currentIndex++;
    this.currentNotebook = this.preparedNotebook(this.card);
    this.currentCheck = null;
    this.isCardTimedOut = false;
    this.cardStartedS = this.start.clockS();
    return true;
  }

  summary(): DrillRoundSummary | null {
    return this.isFinished ? drillRoundSummary(this.cardResults) : null;
  }

  toRecord(): DrillRoundRecord | null {
    if (!this.isFinished) {
      return null;
    }
    return { drillId: this.start.drillId, level: this.level, seed: this.start.seed, startedAtIso: this.start.startedAtIso, cards: [...this.cardResults] };
  }

  private preparedNotebook(card: CountCard): Notebook {
    if (this.level !== 'timed') {
      return card.notebook;
    }
    return stepSheet(card.notebook, card.step).slots.reduce((notebook, slot, index) => placeChip(notebook, card.step, slot.chipKind, index), card.notebook);
  }

  private edit(change: (notebook: Notebook) => Notebook): void {
    if (!this.currentCheck && !this.isCardTimedOut) {
      this.currentNotebook = change(this.currentNotebook);
    }
  }
}

export async function drillContext(engine: BallisticsEngine, ownProfile: RifleProfile | null, system: UnitSystem): Promise<DrillContext> {
  const scope = ownProfile ? scopeOf(ownProfile) : scopeById(DEFAULT_FREE_PLAY.scopeId);
  const loadout = ownProfile ? loadoutOf(ownProfile) : courseLoadout(DEFAULT_FREE_PLAY.cartridgeId, system);
  return { card: await buildDopeCard(engine, loadout, scope.clickMrad, system), scope };
}

export function withDrillRound(rounds: readonly DrillRoundRecord[], round: DrillRoundRecord): DrillRoundRecord[] {
  return [...rounds, round].slice(-DRILL_ROUNDS_KEPT);
}
