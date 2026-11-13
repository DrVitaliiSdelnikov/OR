import { CHECK_ERROR_TERMS } from '../textbook/term-links';
import { CalcStepInput, CheckedRow, CheckErrorType, CheckVerdict, PreparationRowInput } from '../../core/calc-check';
import { DopeCard } from '../../core/dope-card';
import { calcPoints, FIRST_SHOT_POINTS, modeMultiplier, NotebookMode, SECOND_SHOT_POINTS } from '../../core/exercise-scoring';
import { ScreenDirection, text } from '../../i18n';
import { rangeByMilling, roundToClicks } from '../../core/game-formulas';
import { CartridgeId, Correction } from '../../core/types';
import { ExerciseShotRecord, PositionTask } from '../../sim/course';
import { factorContributions, Notebook, NotebookFactor, stepSheet, total } from '../../sim/notebook';
import { CauseKind, MissBreakdown, MissCause } from '../../sim/miss-breakdown';
import { analyseGroup, MIN_GROUP_SHOTS, ShotDiagnosis, TurretCorrection } from '../../sim/shot-review';
import { SLOT_LABELS, STEP_TITLES } from '../notebook/calc-sheet.model';
import { clockText, FACTOR_NAMES } from '../notebook/notebook.model';
import { ShotCheck } from '../position/position-session';

export interface CheckRowView {
  label: string;
  player: string;
  reference: string;
  diff: string;
  status: CheckVerdict;
}

export interface CheckSheetView {
  stamp: string;
  verdict: CheckVerdict;
  subtitle: string;
  isAuto: boolean;
  rows: CheckRowView[];
  mainError: { label: string; phrase: string; term: string } | null;
  others: string | null;
  pointsText: string;
  dialed: string;
}

export interface DopeNote {
  distanceM: number;
  elevationMil: number;
}

export type DopeNotes = Partial<Record<CartridgeId, DopeNote[]>>;

export interface CauseRowView {
  kind: CauseKind;
  name: string;
  text: string;
  isPlayerError: boolean;
  isMain: boolean;
  share: number;
}

export interface CausesView {
  conclusion: string;
  rows: CauseRowView[];
}

const VERTICAL_STEPS: ReadonlySet<string> = new Set(['dope', 'atmosphere']);
const FACTOR_ORDER: readonly NotebookFactor[] = ['dope', 'conditions', 'wind', 'lead'];
const ARROWS_FROM_RIGHT = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
const ARROW_SECTOR_RAD = Math.PI / 4;
const T = text.review;
const MOA_PER_MIL = 3.44;
const DECIMALS = 100;

export function shotPointsText(isHit: boolean, isFirstShotAtTarget: boolean, isPaperTarget: boolean): string {
  if (isPaperTarget) {
    return isHit ? T.paperHit : T.paperMiss;
  }
  if (!isHit) {
    return T.miss;
  }
  return isFirstShotAtTarget ? T.firstShotPoints({ points: FIRST_SHOT_POINTS }) : T.secondShotPoints({ points: SECOND_SHOT_POINTS });
}

export function diagnosisText(diagnosis: ShotDiagnosis, call: Correction): string {
  if (diagnosis === 'clean') {
    return T.diagnosisClean;
  }
  if (diagnosis === 'data') {
    return T.diagnosisData;
  }
  const isVertical = Math.abs(call.upMrad) >= Math.abs(call.rightMrad);
  const direction = isVertical ? verticalDirection(call.upMrad) : horizontalDirection(call.rightMrad);
  return T.diagnosisExecution({ direction, mil: Math.hypot(call.upMrad, call.rightMrad) });
}

export function correctionText(correction: TurretCorrection | null, diagnosis: ShotDiagnosis): string | null {
  if (!correction) {
    return null;
  }
  if (diagnosis === 'execution') {
    return T.repeatClean;
  }
  const parts: string[] = [];
  if (correction.upClicks !== 0) {
    const clicks = Math.abs(correction.upClicks);
    parts.push(T.correctionVertical({ isLow: correction.upClicks > 0, mil: clicks / 10, clicks }));
  }
  if (correction.rightClicks !== 0) {
    const clicks = Math.abs(correction.rightClicks);
    parts.push(T.correctionHorizontal({ isLeft: correction.rightClicks > 0, mil: clicks / 10, clicks }));
  }
  return parts.length === 0 ? T.noCorrection : parts.join(' · ');
}

export function checkSheet(check: ShotCheck, mode: NotebookMode): CheckSheetView {
  const { notebook, result } = check;
  const isAuto = notebook.mode === 'auto';
  const rows = isAuto ? preparationRows(check) : manualRows(check);
  const main = result.mainError;
  const otherLabels = rows.filter((row, index) => row.status !== 'exact' && index !== main?.rowIndex).map(row => row.label);
  const multiplier = modeMultiplier(mode, false);
  return {
    stamp: T.stamps[result.verdict],
    verdict: result.verdict,
    subtitle: isAuto ? autoSubtitle(rows) : manualSubtitle(result.counts, rows.length),
    isAuto,
    rows,
    mainError: main ? { label: errorLabel(isAuto, rows[main.rowIndex].label, main.rowIndex, main.type), phrase: errorPhrase(check, main.rowIndex, main.type), term: CHECK_ERROR_TERMS[main.type] } : null,
    others: result.otherErrorsCount > 0 && otherLabels.length > 0 ? T.others({ count: result.otherErrorsCount, labels: otherLabels }) : null,
    pointsText: T.points({ points: Math.round(calcPoints(result.verdict) * multiplier), multiplier }),
    dialed: dialedText(notebook, check.truth.dialedElevationClicks, check.truth.dialedWindageLeftClicks),
  };
}

export function targetPlaques(def: PositionTask, records: readonly ExerciseShotRecord[], current: { stageIndex: number; targetIndex: number }, isFinished: boolean): string[] {
  const count = def.targets?.count ?? 0;
  const isPaper = def.stages.some(stage => !stage.closesOnHit);
  const plaques: string[] = [];
  def.stages.forEach((stage, stageIndex) => {
    for (let targetIndex = 0; targetIndex < count; targetIndex++) {
      const number = plaques.length + 1;
      const shots = records.filter(record => record.stageIndex === stageIndex && record.targetIndex === targetIndex);
      const isCurrent = !isFinished && current.stageIndex === stageIndex && current.targetIndex === targetIndex;
      if (isPaper && shots.length > 0) {
        plaques.push(T.plaquePaper({ number, hits: shots.filter(shot => shot.isHit).length, shots: shots.length }));
      } else if (isCurrent) {
        plaques.push(T.plaqueCurrent({ number }));
      } else if (shots.length === 0) {
        plaques.push(T.plaqueEmpty({ number }));
      } else {
        const hitIndex = shots.findIndex(shot => shot.isHit);
        plaques.push(T.plaqueScored({ number, points: hitIndex === 0 ? FIRST_SHOT_POINTS : hitIndex === 1 ? SECOND_SHOT_POINTS : null }));
      }
    }
  });
  return plaques;
}

export function withDopeNote(notes: DopeNotes, cartridgeId: CartridgeId, distanceM: number, elevationMil: number): DopeNotes {
  const others = (notes[cartridgeId] ?? []).filter(note => note.distanceM !== distanceM);
  return { ...notes, [cartridgeId]: [...others, { distanceM, elevationMil }] };
}

export function dopeNoteTexts(notes: readonly DopeNote[], card: DopeCard): Map<number, string> {
  const texts = new Map<number, string>();
  for (const note of notes) {
    const row = card.rows.reduce((best, candidate) => (Math.abs(candidate.distanceM - note.distanceM) <= Math.abs(best.distanceM - note.distanceM) ? candidate : best));
    const value = `${note.elevationMil < 0 ? '↓' : '↑'} ${Math.abs(note.elevationMil).toFixed(1)}`;
    texts.set(row.distanceM, row.distanceM === note.distanceM ? value : T.dopeNoteAt({ value, distanceM: note.distanceM }));
  }
  return texts;
}

function manualRows(check: ShotCheck): CheckRowView[] {
  const clickMil = check.notebook.context.card.clickMil;
  return check.inputs.steps.map((input, index) => {
    const checked = check.result.rows[index];
    if (input.step === 'distance') {
      const reticleMil = check.notebook.readings.reticleMil ?? 0;
      return {
        label: STEP_TITLES.distance,
        player: T.metres({ distanceM: check.notebook.distanceM ?? 0 }),
        reference: T.metres({ distanceM: rangeByMilling(check.notebook.context.target.sizeM, reticleMil) }),
        diff: diffText(checked),
        status: checked.status,
      };
    }
    const unit = input.playerUnits === 'moa' ? T.moaUnit : '';
    return {
      label: STEP_TITLES[input.step],
      player: `${arrowed(input.step, input.playerMil, trimmed(Math.abs(input.playerMil)))}${unit}`,
      reference: arrowed(input.step, input.expectedRawMil, (Math.abs(roundToClicks(input.expectedRawMil, clickMil)) * clickMil).toFixed(1)),
      diff: diffText(checked),
      status: checked.status,
    };
  });
}

function preparationRows(check: ShotCheck): CheckRowView[] {
  const { notebook, truth } = check;
  const station = notebook.readings.station;
  const wind = notebook.readings.wind;
  const factors = factorContributions(notebook);
  const onNames = FACTOR_ORDER.filter(factor => notebook.factorsOn[factor] && factors[factor].mil !== null).map(factor => FACTOR_NAMES[factor]);
  const neededNames = FACTOR_ORDER.filter(factor => Math.abs(factors[factor].clicks ?? 0) >= 1).map(factor => FACTOR_NAMES[factor]);
  const clickMil = notebook.context.card.clickMil;
  const planned = total(notebook);
  const values: Record<PreparationRowInput['row'], { player: string; reference: string }> = {
    'reading-speed': { player: wind ? T.speed({ speedMps: wind.speedMps }) : T.none, reference: station ? T.speed({ speedMps: station.windSpeedMps }) : T.none },
    'reading-direction': { player: wind ? clockText(wind.clock) : '—', reference: clockText(truth.trueWindClock) },
    factors: { player: onNames.join(', ') || T.none, reference: neededNames.join(', ') || T.none },
    'turret-elevation': { player: verticalClicks(truth.dialedElevationClicks, clickMil), reference: T.planned({ value: verticalClicks(planned.elevation.targetClicks, clickMil) }) },
    'turret-windage': { player: horizontalClicks(truth.dialedWindageLeftClicks, clickMil), reference: T.planned({ value: horizontalClicks(planned.windageLeft.targetClicks, clickMil) }) },
  };
  return check.inputs.preparation.map((input, index) => ({
    label: T.preparationLabels[input.row],
    ...values[input.row],
    diff: diffText(check.result.rows[index]),
    status: check.result.rows[index].status,
  }));
}

function errorLabel(isAuto: boolean, rowLabel: string, rowIndex: number, type: CheckErrorType): string {
  if (!isAuto) {
    return T.stepError({ stepNumber: rowIndex + 1, label: T.errorLabels[type] });
  }
  const label = rowLabel.toUpperCase();
  return label.includes(T.errorLabels[type]) ? label : `${label} · ${T.errorLabels[type]}`;
}

function errorPhrase(check: ShotCheck, rowIndex: number, type: CheckErrorType): string {
  if (check.notebook.mode === 'auto') {
    return preparationPhrase(check, check.inputs.preparation[rowIndex], type);
  }
  const input = check.inputs.steps[rowIndex];
  const clickMil = check.notebook.context.card.clickMil;
  const reference = (Math.abs(roundToClicks(input.expectedRawMil, clickMil)) * clickMil).toFixed(1);
  const player = trimmed(Math.abs(input.playerMil));
  switch (type) {
    case 'substitution':
      return substitutionPhrase(check.notebook, input);
    case 'side':
      return T.sidePhrase({ direction: sideDirection(input.step, input.expectedRawMil) });
    case 'units':
      return T.unitsPhrase({ mil: reference, moa: (Number(reference) * MOA_PER_MIL).toFixed(2) });
    case 'rounding':
      return T.roundingPhrase({ raw: Math.abs(input.expectedRawMil).toFixed(2), reference, player });
    case 'lead':
      return T.leadPhrase({ raw: Math.abs(input.expectedRawMil).toFixed(2), player });
    default:
      return T.arithmeticPhrase({ raw: Math.abs(input.expectedRawMil).toFixed(2), player });
  }
}

function substitutionPhrase(notebook: Notebook, input: CalcStepInput): string {
  const slotIndex = input.expectedInputs.findIndex((value, index) => value !== input.playerInputs[index]);
  const slot = stepSheet(notebook, input.step).slots[slotIndex];
  const label = slot ? SLOT_LABELS[slot.chipKind] : T.anySlot;
  return T.substitutionPhrase({ slot: label, player: trimmed(input.playerInputs[slotIndex]), expected: trimmed(input.expectedInputs[slotIndex]) });
}

function preparationPhrase(check: ShotCheck, input: PreparationRowInput, type: CheckErrorType): string {
  const row = preparationRows(check)[check.inputs.preparation.indexOf(input)];
  switch (input.row) {
    case 'reading-speed':
      return T.readingSpeedPhrase({ reference: row.reference, player: row.player.replace(T.speedUnit, '') });
    case 'reading-direction':
      return type === 'side' ? T.readingSidePhrase(row) : T.readingDirectionPhrase(row);
    case 'factors':
      return T.factorsPhrase({ names: missingFactorNames(check.notebook), clicks: input.clicksOff });
    default:
      return T.turretPhrase({ planned: row.reference.replace(T.plannedPrefix, ''), dialed: row.player, isWrongSide: input.isWrongSide === true, clicks: input.clicksOff });
  }
}

function missingFactorNames(notebook: Notebook): string {
  const factors = factorContributions(notebook);
  return FACTOR_ORDER.filter(factor => !notebook.factorsOn[factor] && Math.abs(factors[factor].clicks ?? 0) >= 1)
    .map(factor => FACTOR_NAMES[factor].toLowerCase())
    .join(', ');
}

function dialedText(notebook: Notebook, elevationClicks: number, windageLeftClicks: number): string {
  const clickMil = notebook.context.card.clickMil;
  const parts = [verticalClicks(elevationClicks, clickMil)];
  if (windageLeftClicks !== 0) {
    parts.push(horizontalClicks(windageLeftClicks, clickMil));
  }
  return parts.join(' · ');
}

function verticalClicks(clicks: number, clickMil: number): string {
  return `${clicks < 0 ? '↓' : '↑'} ${(Math.abs(clicks) * clickMil).toFixed(1)}`;
}

function horizontalClicks(windageLeftClicks: number, clickMil: number): string {
  if (windageLeftClicks === 0) {
    return '0.0';
  }
  return `${windageLeftClicks > 0 ? '←' : '→'} ${(Math.abs(windageLeftClicks) * clickMil).toFixed(1)}`;
}

function arrowed(step: string, signedMil: number, valueText: string): string {
  if (signedMil === 0) {
    return valueText;
  }
  const arrow = VERTICAL_STEPS.has(step) ? (signedMil > 0 ? '↑' : '↓') : signedMil > 0 ? '→' : '←';
  return `${arrow} ${valueText}`;
}

function verticalDirection(upMil: number): ScreenDirection {
  return upMil > 0 ? 'up' : 'down';
}

function horizontalDirection(rightMil: number): ScreenDirection {
  return rightMil > 0 ? 'right' : 'left';
}

function sideDirection(step: string, signedMil: number): ScreenDirection {
  return VERTICAL_STEPS.has(step) ? verticalDirection(signedMil) : horizontalDirection(signedMil);
}

function diffText(row: CheckedRow): string {
  if (row.errorTypes.includes('side')) {
    return T.diffSide;
  }
  return row.clicksOff === 0 ? '0' : T.clicks({ clicks: row.clicksOff });
}

function manualSubtitle(counts: Record<CheckVerdict, number>, total: number): string {
  if (counts.exact === total) {
    return T.allStepsRight({ total });
  }
  const parts = [
    counts.exact > 0 ? T.stepsRight({ count: counts.exact }) : '',
    counts.close > 0 ? T.stepsClose({ count: counts.close }) : '',
    counts.error > 0 ? T.stepsWrong({ count: counts.error }) : '',
  ];
  return parts.filter(Boolean).join(' · ');
}

function autoSubtitle(rows: readonly CheckRowView[]): string {
  const wrong = rows.filter(row => row.status !== 'exact');
  return wrong.length === 0 ? T.autoAllMatched : wrong.map(row => `${row.label} ${row.diff}`).join(' · ');
}

function trimmed(value: number): string {
  return String(Math.round(value * DECIMALS) / DECIMALS);
}

export function directionArrow(vector: Correction): string {
  if (vector.upMrad === 0 && vector.rightMrad === 0) {
    return '';
  }
  const sector = Math.round(Math.atan2(vector.upMrad, vector.rightMrad) / ARROW_SECTOR_RAD);
  return ARROWS_FROM_RIGHT[(sector + ARROWS_FROM_RIGHT.length) % ARROWS_FROM_RIGHT.length];
}

export function causesView(breakdown: MissBreakdown): CausesView {
  const shown = breakdown.causes.filter(cause => cause.isShown);
  const largestClicks = Math.max(1, ...shown.map(cause => cause.clicks));
  return {
    conclusion: conclusionText(breakdown),
    rows: shown.map(cause => ({
      kind: cause.kind,
      name: T.causeNames[cause.kind],
      text: cause.clicks === 0 ? T.causeClean : T.causeShift({ arrow: directionArrow(cause.vector), clicks: cause.clicks }),
      isPlayerError: cause.isPlayerError,
      isMain: cause.kind === breakdown.main,
      share: cause.clicks / largestClicks,
    })),
  };
}

export function groupText(points: readonly Correction[]): string {
  const group = analyseGroup(points);
  return group ? T.groupTexts[group.shape] : T.groupTooSmall({ minShots: MIN_GROUP_SHOTS });
}

function conclusionText(breakdown: MissBreakdown): string {
  const main = breakdown.causes.find(cause => cause.kind === breakdown.main);
  if (!main) {
    return breakdown.causes.some(cause => !cause.isPlayerError && cause.isShown) ? T.noPlayerErrors : T.clean;
  }
  const phrase = mainCausePhrase(main, breakdown);
  return main.kind !== 'trigger' && breakdown.isTriggerClean ? T.cleanTrigger({ phrase }) : phrase;
}

function mainCausePhrase(main: MissCause, breakdown: MissBreakdown): string {
  const arrow = directionArrow(main.vector);
  const shift = T.causeShift({ arrow, clicks: main.clicks });
  switch (main.kind) {
    case 'wind':
      return T.windCause({ isUnder: breakdown.windVerdict === 'under', clicks: main.clicks });
    case 'calc':
      return T.calcCause({ arrow, clicks: main.clicks });
    case 'hold':
      return T.holdCause({ arrow, clicks: main.clicks });
    case 'lead':
      return T.leadCause({ arrow, clicks: main.clicks });
    case 'trigger':
      return T.triggerCause({ shift });
    default:
      return T.zeroCause({ shift });
  }
}
