import { CHECK_ERROR_TERMS } from '../textbook/term-links';
import { decimal } from '../../i18n/format';
import { CalcStepInput, CheckedRow, CheckErrorType, CheckVerdict, PreparationRowInput } from '../../core/calc-check';
import { DopeCard } from '../../core/dope-card';
import { calcPoints, FIRST_SHOT_POINTS, modeMultiplier, NotebookMode, SECOND_SHOT_POINTS } from '../../core/exercise-scoring';
import { ScreenDirection, text } from '../../i18n';
import { rangeByMilling, roundToClicks } from '../../core/game-formulas';
import { Correction } from '../../core/types';
import { inSystem, UnitSystem } from '../../core/units';
import { ExerciseShotRecord, PositionTask } from '../../sim/course';
import { factorContributions, Notebook, NOTEBOOK_FACTORS, NotebookFactor, stepSheet, total } from '../../sim/notebook';
import { CauseKind, MissBreakdown, MissCause } from '../../sim/miss-breakdown';
import { ChainLinkKind, ChainQuantity, ChainValue } from '../../sim/miss-chain';
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

export type DopeNotes = Partial<Record<string, DopeNote[]>>;

export interface CauseRowView {
  kind: CauseKind;
  name: string;
  values: string | null;
  text: string;
  isPlayerError: boolean;
  isMain: boolean;
  share: number;
}

export interface CausesView {
  conclusion: string;
  rows: CauseRowView[];
}

export type ValueAxis = 'vertical' | 'horizontal' | null;

export interface ValuePair {
  player: string;
  truth: string;
  unit: string;
}

const VERTICAL_STEPS: ReadonlySet<string> = new Set(['dope', 'atmosphere', 'angle', 'eotvos']);
const FACTOR_ORDER: readonly NotebookFactor[] = NOTEBOOK_FACTORS;
const ARROWS_FROM_RIGHT = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
const ARROW_SECTOR_RAD = Math.PI / 4;
const T = text.review;
const UNITS = text.units;
const DISTANCE_DIGITS = 0;
const SPEED_DIGITS = 1;
const MOA_PER_MIL = 3.44;
const DECIMALS = 100;
const MIL_DIGITS = 1;
const FINE_MIL_DIGITS = 2;
const TENTHS_PER_MIL = 10;
const CLICK_EPSILON = 1e-9;
const CLOCK_HALF_HOURS = 2;
const LINK_AXES: Partial<Record<ChainLinkKind, ValueAxis>> = { dope: 'vertical', conditions: 'vertical', angle: 'vertical', 'wind-calc': 'horizontal' };

export function shotPointsText(isHit: boolean, isFirstShotAtTarget: boolean, isPaperTarget: boolean): string {
  if (isPaperTarget) {
    return isHit ? T.paperHit : T.paperMiss;
  }
  if (!isHit) {
    return T.miss;
  }
  return isFirstShotAtTarget ? T.firstShotPoints({ points: FIRST_SHOT_POINTS }) : T.secondShotPoints({ points: SECOND_SHOT_POINTS });
}

export function diagnosisText(diagnosis: ShotDiagnosis, call: Correction, isLeadBackward = false, hasDataError = false): string {
  if (isLeadBackward) {
    return T.diagnosisLeadBackward;
  }
  if (diagnosis === 'clean') {
    return T.diagnosisClean;
  }
  if (diagnosis === 'data') {
    return T.diagnosisData;
  }
  const isVertical = Math.abs(call.upMrad) >= Math.abs(call.rightMrad);
  const direction = isVertical ? verticalDirection(call.upMrad) : horizontalDirection(call.rightMrad);
  const drift = { direction, mil: Math.hypot(call.upMrad, call.rightMrad) };
  return hasDataError ? T.diagnosisExecutionAndData(drift) : T.diagnosisExecution(drift);
}

export function correctionText(correction: TurretCorrection | null, diagnosis: ShotDiagnosis, hasDataError = false): string | null {
  if (!correction) {
    return null;
  }
  if (diagnosis === 'execution' && !hasDataError) {
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

export function checkSheet(check: ShotCheck, mode: NotebookMode, system: UnitSystem = 'metric'): CheckSheetView {
  const { notebook, result } = check;
  const isAuto = notebook.mode === 'auto';
  const rows = isAuto ? preparationRows(check, system) : manualRows(check, system);
  const main = result.mainError;
  const otherLabels = rows.filter((row, index) => row.status !== 'exact' && index !== main?.rowIndex).map(row => row.label);
  const multiplier = modeMultiplier(mode, false);
  return {
    stamp: T.stamps[result.verdict],
    verdict: result.verdict,
    subtitle: isAuto ? autoSubtitle(rows) : manualSubtitle(result.counts, rows.length),
    isAuto,
    rows,
    mainError: main ? { label: errorLabel(isAuto, rows[main.rowIndex].label, main.rowIndex, main.type), phrase: errorPhrase(check, main.rowIndex, main.type, system), term: CHECK_ERROR_TERMS[main.type] } : null,
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

export function withDopeNote(notes: DopeNotes, cartridgeId: string, distanceM: number, elevationMil: number): DopeNotes {
  const others = (notes[cartridgeId] ?? []).filter(note => note.distanceM !== distanceM);
  return { ...notes, [cartridgeId]: [...others, { distanceM, elevationMil }] };
}

export function dopeNoteTexts(notes: readonly DopeNote[], card: DopeCard, system: UnitSystem = 'metric'): Map<number, string> {
  const texts = new Map<number, string>();
  for (const note of notes) {
    const row = card.rows.reduce((best, candidate) => (Math.abs(candidate.distanceM - note.distanceM) <= Math.abs(best.distanceM - note.distanceM) ? candidate : best));
    const value = `${note.elevationMil < 0 ? '↓' : '↑'} ${decimal(Math.abs(note.elevationMil), 1)}`;
    texts.set(row.distanceM, row.distanceM === note.distanceM ? value : T.dopeNoteAt({ value, distance: UNITS.valueText('distance', note.distanceM, system, DISTANCE_DIGITS) }));
  }
  return texts;
}

function manualRows(check: ShotCheck, system: UnitSystem): CheckRowView[] {
  const clickMil = check.notebook.context.card.clickMil;
  return check.inputs.steps.map((input, index) => {
    const checked = check.result.rows[index];
    if (input.step === 'distance') {
      const reticleMil = check.notebook.readings.reticleMil ?? 0;
      return {
        label: STEP_TITLES.distance,
        player: UNITS.valueText('distance', check.notebook.distanceM ?? 0, system, DISTANCE_DIGITS),
        reference: UNITS.valueText('distance', rangeByMilling(check.notebook.context.target.sizeM, reticleMil), system, DISTANCE_DIGITS),
        diff: diffText(checked),
        status: checked.status,
      };
    }
    const unit = input.playerUnits === 'moa' ? T.moaUnit : '';
    return {
      label: STEP_TITLES[input.step],
      player: `${arrowed(input.step, input.playerMil, trimmed(Math.abs(input.playerMil)))}${unit}`,
      reference: arrowed(input.step, input.expectedRawMil, decimal(Math.abs(roundToClicks(input.expectedRawMil, clickMil)) * clickMil, clickDigits(clickMil))),
      diff: diffText(checked),
      status: checked.status,
    };
  });
}

function preparationRows(check: ShotCheck, system: UnitSystem): CheckRowView[] {
  const { notebook, truth } = check;
  const station = notebook.readings.station;
  const wind = notebook.readings.wind;
  const factors = factorContributions(notebook);
  const onNames = FACTOR_ORDER.filter(factor => notebook.factorsOn[factor] && factors[factor].mil !== null).map(factor => FACTOR_NAMES[factor]);
  const neededNames = FACTOR_ORDER.filter(factor => Math.abs(factors[factor].clicks ?? 0) >= 1).map(factor => FACTOR_NAMES[factor]);
  const clickMil = notebook.context.card.clickMil;
  const planned = total(notebook);
  const values: Record<PreparationRowInput['row'], { player: string; reference: string }> = {
    'reading-speed': {
      player: wind ? UNITS.valueText('windSpeed', wind.speedMps, system, SPEED_DIGITS) : T.none,
      reference: referenceStationText(station?.windSpeedMps ?? truth.stationWindSpeedMps, system),
    },
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

function errorPhrase(check: ShotCheck, rowIndex: number, type: CheckErrorType, system: UnitSystem): string {
  if (check.notebook.mode === 'auto') {
    return preparationPhrase(check, check.inputs.preparation[rowIndex], type, system);
  }
  const input = check.inputs.steps[rowIndex];
  if (input.step === 'distance' && (type === 'arithmetic' || type === 'rounding')) {
    return milledDistancePhrase(check.notebook, system);
  }
  const clickMil = check.notebook.context.card.clickMil;
  const digits = clickDigits(clickMil);
  const referenceMil = Number((Math.abs(roundToClicks(input.expectedRawMil, clickMil)) * clickMil).toFixed(digits));
  const reference = decimal(referenceMil, digits);
  const player = trimmed(Math.abs(input.playerMil));
  switch (type) {
    case 'substitution':
      return substitutionPhrase(check.notebook, input);
    case 'side':
      return T.sidePhrase({ direction: sideDirection(input.step, input.expectedRawMil) });
    case 'units':
      return T.unitsPhrase({ mil: reference, moa: decimal(referenceMil * MOA_PER_MIL, 2) });
    case 'rounding':
      return T.roundingPhrase({ raw: decimal(Math.abs(input.expectedRawMil), 2), reference, player });
    case 'lead':
      return T.leadPhrase({ raw: decimal(Math.abs(input.expectedRawMil), 2), player });
    default: {
      const raw = decimal(Math.abs(input.expectedRawMil), 2);
      return Math.abs(Math.abs(input.expectedRawMil) - referenceMil) < CLICK_EPSILON
        ? T.arithmeticPhrase({ raw, player })
        : T.arithmeticBetweenClicksPhrase({ raw, reference, player });
    }
  }
}

function clickDigits(clickMil: number): number {
  return Math.abs(clickMil * TENTHS_PER_MIL - Math.round(clickMil * TENTHS_PER_MIL)) < CLICK_EPSILON ? 1 : 2;
}

function milledDistancePhrase(notebook: Notebook, system: UnitSystem): string {
  const milledM = rangeByMilling(notebook.context.target.sizeM, notebook.readings.reticleMil ?? 0);
  return T.arithmeticPhrase({ raw: UNITS.valueText('distance', milledM, system, DISTANCE_DIGITS), player: UNITS.valueText('distance', notebook.distanceM ?? 0, system, DISTANCE_DIGITS) });
}

function substitutionPhrase(notebook: Notebook, input: CalcStepInput): string {
  const slotIndex = input.expectedInputs.findIndex((value, index) => value !== input.playerInputs[index]);
  const slot = stepSheet(notebook, input.step).slots[slotIndex];
  const label = slot ? SLOT_LABELS[slot.chipKind] : T.anySlot;
  return T.substitutionPhrase({ slot: label, player: trimmed(input.playerInputs[slotIndex]), expected: trimmed(input.expectedInputs[slotIndex]) });
}

function preparationPhrase(check: ShotCheck, input: PreparationRowInput, type: CheckErrorType, system: UnitSystem): string {
  const row = preparationRows(check, system)[check.inputs.preparation.indexOf(input)];
  switch (input.row) {
    case 'reading-speed':
      return T.readingSpeedPhrase({ reference: row.reference, player: row.player.replace(` ${UNITS.unitLabel('windSpeed', system)}`, '') });
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
  return `${clicks < 0 ? '↓' : '↑'} ${decimal(Math.abs(clicks) * clickMil, 1)}`;
}

function horizontalClicks(windageLeftClicks: number, clickMil: number): string {
  if (windageLeftClicks === 0) {
    return decimal(0, 1);
  }
  return `${windageLeftClicks > 0 ? '←' : '→'} ${decimal(Math.abs(windageLeftClicks) * clickMil, 1)}`;
}

function arrowed(step: string, signedMil: number, valueText: string): string {
  if (signedMil === 0 || step === 'lead') {
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

function referenceStationText(stationWindSpeedMps: number | undefined, system: UnitSystem): string {
  return stationWindSpeedMps === undefined ? T.none : UNITS.valueText('windSpeed', stationWindSpeedMps, system, SPEED_DIGITS);
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
  return decimal(Math.round(value * DECIMALS) / DECIMALS);
}

export function directionArrow(vector: Correction): string {
  if (vector.upMrad === 0 && vector.rightMrad === 0) {
    return '';
  }
  const sector = Math.round(Math.atan2(vector.upMrad, vector.rightMrad) / ARROW_SECTOR_RAD);
  return ARROWS_FROM_RIGHT[(sector + ARROWS_FROM_RIGHT.length) % ARROWS_FROM_RIGHT.length];
}

export function causesView(breakdown: MissBreakdown, system: UnitSystem = 'metric'): CausesView {
  const shown = breakdown.causes.filter(cause => cause.isShown);
  const byClicks = (first: MissCause, second: MissCause): number => second.clicks - first.clicks;
  const ordered = [...shown.filter(cause => cause.isPlayerError).sort(byClicks), ...shown.filter(cause => !cause.isPlayerError).sort(byClicks)];
  const largestClicks = Math.max(1, ...shown.map(cause => cause.clicks));
  return {
    conclusion: conclusionText(breakdown, system),
    rows: ordered.map(cause => ({
      kind: cause.kind,
      name: T.causeNames[cause.kind],
      values: causeValues(cause, system, breakdown.clickMil),
      text: cause.clicks === 0 ? T.causeClean : T.causeShift({ arrow: directionArrow(cause.vector), clicks: cause.clicks }),
      isPlayerError: cause.isPlayerError,
      isMain: cause.kind === breakdown.main,
      share: cause.clicks / largestClicks,
    })),
  };
}

function causeValues(cause: MissCause, system: UnitSystem, clickMil: number): string | null {
  const link = cause.link;
  if (!link) {
    return null;
  }
  const pair = chainValuePair(link.quantity, link.player, link.truth, LINK_AXES[link.kind] ?? null, system, clickMil);
  if (!pair) {
    return null;
  }
  return link.quantity === 'dial' ? T.turretValues(pair) : T.valuesInstead(pair);
}

export function chainValuePair(quantity: ChainQuantity, player: ChainValue, truth: ChainValue, axis: ValueAxis, system: UnitSystem, clickMil: number): ValuePair | null {
  if (player === null || truth === null) {
    return null;
  }
  switch (quantity) {
    case 'distance':
      return { player: UNITS.numberText('distance', player as number, system, DISTANCE_DIGITS), truth: UNITS.numberText('distance', truth as number, system, DISTANCE_DIGITS), unit: ` ${UNITS.unitName('distance', system, Math.round(inSystem('distance', truth as number, system)))}` };
    case 'windSpeed':
      return { player: speedText(player as number, system), truth: speedText(truth as number, system), unit: ` ${UNITS.unitLabel('windSpeed', system)}` };
    case 'clock':
      return { player: clockText(halfHour(player as number)), truth: clockText(halfHour(truth as number)), unit: '' };
    case 'crosswinds':
      return { player: crosswindsText(player as readonly (number | null)[], system), truth: crosswindsText(truth as readonly (number | null)[], system), unit: ` ${UNITS.unitLabel('windSpeed', system)}` };
    case 'mil': {
      const digits = fineDigits([player as number, truth as number], MIL_DIGITS);
      return { player: milText(player as number, axis, digits), truth: milText(truth as number, axis, digits), unit: T.milUnit };
    }
    case 'mil-vector': {
      const [playerVector, truthVector] = [player as Correction, truth as Correction];
      const digits = fineDigits([playerVector.upMrad, truthVector.upMrad], MIL_DIGITS) === MIL_DIGITS ? fineDigits([playerVector.rightMrad, truthVector.rightMrad], MIL_DIGITS) : FINE_MIL_DIGITS;
      return { player: milVectorText(playerVector, digits), truth: milVectorText(truthVector, digits), unit: T.milUnit };
    }
    case 'dial':
      return dialPair(player as Correction, truth as Correction, clickMil);
  }
}

function speedText(speedMps: number, system: UnitSystem): string {
  return roundedText(inSystem('windSpeed', speedMps, system), SPEED_DIGITS);
}

function halfHour(clock: number): number {
  return Math.round(clock * CLOCK_HALF_HOURS) / CLOCK_HALF_HOURS;
}

function crosswindsText(crosswindsMps: readonly (number | null)[], system: UnitSystem): string {
  return crosswindsMps.map(speedMps => (speedMps === null ? T.none : speedText(speedMps, system))).join(' · ');
}

// Две разные величины, что совпали бы при одном знаке после запятой, показываются с двумя.
function fineDigits(values: readonly [number, number], digits: number): number {
  return roundedText(values[0], digits) === roundedText(values[1], digits) && values[0] !== values[1] ? FINE_MIL_DIGITS : digits;
}

function milText(valueMil: number, axis: ValueAxis, digits: number): string {
  const text = roundedText(Math.abs(valueMil), digits);
  if (axis === null || Number(text.replace(',', '.')) === 0) {
    return text;
  }
  const arrow = axis === 'vertical' ? (valueMil > 0 ? '↑' : '↓') : valueMil > 0 ? '→' : '←';
  return `${arrow} ${text}`;
}

function milVectorText(vector: Correction, digits: number): string {
  const parts = [milText(vector.upMrad, 'vertical', digits), milText(vector.rightMrad, 'horizontal', digits)].filter(part => part.includes(' '));
  return parts.length === 0 ? roundedText(0, digits) : parts.join(' · ');
}

function dialPair(player: Correction, truth: Correction, clickMil: number): ValuePair {
  const clicksOf = (mil: number): number => Math.round(mil / clickMil);
  const axes: ['vertical' | 'horizontal', number, number][] = [
    ['vertical', clicksOf(player.upMrad), clicksOf(truth.upMrad)],
    ['horizontal', clicksOf(player.rightMrad), clicksOf(truth.rightMrad)],
  ];
  const differing = axes.filter(([, playerClicks, truthClicks]) => playerClicks !== truthClicks);
  const shown = differing.length > 0 ? differing : axes.slice(0, 1);
  const side = (index: 1 | 2) => shown.map(axis => milText(axis[index], axis[0], 0)).join(' · ');
  return { player: side(1), truth: side(2), unit: T.clicksUnit };
}

function roundedText(value: number, digits: number): string {
  const scale = 10 ** digits;
  return decimal(Math.round(value * scale) / scale);
}

export function flightAxisTexts(distanceM: number, scaleCm: number, isSide: boolean, system: UnitSystem): { start: string; end: string; scale: string } {
  return {
    start: UNITS.valueText('distance', 0, system, DISTANCE_DIGITS),
    end: UNITS.valueText('distance', distanceM, system, DISTANCE_DIGITS),
    scale: text.screens.flightView.scale({ isSide, offset: UNITS.valueText('impactOffset', scaleCm, system, system === 'metric' ? 0 : 1) }),
  };
}

export function groupText(points: readonly Correction[], rifleSpreadMil: number): string {
  const group = analyseGroup(points, rifleSpreadMil);
  return group ? T.groupTexts[group.shape] : T.groupTooSmall({ minShots: MIN_GROUP_SHOTS });
}

function conclusionText(breakdown: MissBreakdown, system: UnitSystem): string {
  const main = breakdown.causes.find(cause => cause.kind === breakdown.main);
  if (!main) {
    return breakdown.causes.some(cause => !cause.isPlayerError && cause.isShown) ? T.noPlayerErrors : T.clean;
  }
  const phrase = mainCausePhrase(main, system, breakdown.clickMil);
  return main.kind !== 'trigger' && breakdown.isTriggerClean ? T.cleanTrigger({ phrase }) : phrase;
}

function mainCausePhrase(main: MissCause, system: UnitSystem, clickMil: number): string {
  const arrow = directionArrow(main.vector);
  const shift = T.causeShift({ arrow, clicks: main.clicks });
  switch (main.kind) {
    case 'hold':
      return T.holdCause({ arrow, clicks: main.clicks });
    case 'lead':
      return T.leadCause({ arrow, clicks: main.clicks });
    case 'trigger':
      return T.triggerCause({ shift });
    case 'zero':
      return T.zeroCause({ shift });
    default:
      return T.linkCause({ name: T.causeNames[main.kind], values: causeValues(main, system, clickMil), shift });
  }
}
