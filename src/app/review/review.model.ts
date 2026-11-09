import { CalcStepInput, CheckedRow, CheckErrorType, CheckVerdict, PreparationRowInput } from '../../core/calc-check';
import { DopeCard } from '../../core/dope-card';
import { calcPoints, modeMultiplier, NotebookMode } from '../../core/exercise-scoring';
import { rangeByMilling, roundToClicks } from '../../core/game-formulas';
import { CartridgeId, Correction } from '../../core/types';
import { ExerciseDef, ExerciseShotRecord } from '../../sim/course';
import { factorContributions, Notebook, NotebookFactor, stepSheet, total } from '../../sim/notebook';
import { CauseKind, MissBreakdown, MissCause } from '../../sim/miss-breakdown';
import { analyseGroup, GroupShape, ShotDiagnosis, TurretCorrection } from '../../sim/shot-review';
import { SLOT_LABELS, STEP_TITLES } from '../notebook/calc-sheet.model';
import { clockText, FACTOR_NAMES } from '../notebook/notebook.model';
import { ShotCheck } from '../position/position-session';

export type CheckStamp = 'ТОЧНО' | 'ПОЧТИ' | 'ОШИБКА';

export interface CheckRowView {
  label: string;
  player: string;
  reference: string;
  diff: string;
  status: CheckVerdict;
}

export interface CheckSheetView {
  stamp: CheckStamp;
  verdict: CheckVerdict;
  subtitle: string;
  isAuto: boolean;
  rows: CheckRowView[];
  mainError: { label: string; phrase: string } | null;
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

const STAMPS: Record<CheckVerdict, CheckStamp> = { exact: 'ТОЧНО', close: 'ПОЧТИ', error: 'ОШИБКА' };
const ERROR_LABELS: Record<CheckErrorType, string> = {
  substitution: 'ПОДСТАНОВКА',
  arithmetic: 'АРИФМЕТИКА',
  side: 'СТОРОНА',
  units: 'ЕДИНИЦЫ',
  rounding: 'ОКРУГЛЕНИЕ',
  lead: 'УПРЕЖДЕНИЕ',
  reading: 'ПОКАЗАНИЯ',
  factor: 'ФАКТОР',
  turret: 'БАРАБАН',
};
const PREPARATION_LABELS: Record<PreparationRowInput['row'], string> = {
  'reading-speed': 'Ветер: скорость',
  'reading-direction': 'Ветер: направление',
  factors: 'Учтённые факторы',
  'turret-elevation': 'Барабан ВЕРТ',
  'turret-windage': 'Барабан ГОР',
};
const VERTICAL_STEPS: ReadonlySet<string> = new Set(['dope', 'atmosphere']);
const FACTOR_ORDER: readonly NotebookFactor[] = ['dope', 'conditions', 'wind', 'lead'];
const CAUSE_NAMES: Record<CauseKind, string> = {
  calc: 'Расчёт',
  wind: 'Оценка ветра',
  hold: 'Удержание',
  trigger: 'Спуск',
  zero: 'Ноль прицела',
  formula: 'Упрощение формулы',
  rifle: 'Винтовка',
  'cold-bore': 'Холодный ствол',
};
const ARROWS_FROM_RIGHT = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
const ARROW_SECTOR_RAD = Math.PI / 4;
const GROUP_TEXTS: Record<GroupShape, string> = {
  scattered: 'Разброс — позиция, окуляр',
  'vertical-string': 'Вертикальная струна — дыхание',
  'horizontal-string': 'Горизонтальная струна — завал оружия',
  'low-right': 'Низко-вправо — кисть, спуск',
  offset: 'Плотная, но не в центре — ноль прицела',
  tight: 'Плотная группа — основы в порядке',
};
const MOA_PER_MIL = 3.44;
const DECIMALS = 100;

export function shotPointsText(isHit: boolean, isFirstShotAtTarget: boolean, isPaperTarget: boolean): string {
  if (isPaperTarget) {
    return isHit ? 'попадание' : 'мимо';
  }
  if (!isHit) {
    return 'промах';
  }
  return isFirstShotAtTarget ? '10 · первым' : '5 · вторым';
}

export function diagnosisText(diagnosis: ShotDiagnosis, call: Correction): string {
  if (diagnosis === 'clean') {
    return 'Чисто: сетка на цели, попадание';
  }
  if (diagnosis === 'data') {
    return 'Сетка была на цели — ошибка в данных';
  }
  const isVertical = Math.abs(call.upMrad) >= Math.abs(call.rightMrad);
  const direction = isVertical ? (call.upMrad > 0 ? 'вверх' : 'вниз') : call.rightMrad > 0 ? 'вправо' : 'влево';
  return `Сетка ушла ${direction} на ${Math.hypot(call.upMrad, call.rightMrad).toFixed(1)} — ошибка выполнения`;
}

export function correctionText(correction: TurretCorrection | null, diagnosis: ShotDiagnosis): string | null {
  if (!correction) {
    return null;
  }
  if (diagnosis === 'execution') {
    return 'Данные верны — повтори чисто';
  }
  const parts: string[] = [];
  if (correction.upClicks !== 0) {
    const clicks = Math.abs(correction.upClicks);
    parts.push(`Пуля ${correction.upClicks > 0 ? 'ниже' : 'выше'} на ${(clicks / 10).toFixed(1)} → ${clicks} кл. ${correction.upClicks > 0 ? 'вверх' : 'вниз'} на барабане`);
  }
  if (correction.rightClicks !== 0) {
    const clicks = Math.abs(correction.rightClicks);
    parts.push(`Пуля ${correction.rightClicks > 0 ? 'левее' : 'правее'} на ${(clicks / 10).toFixed(1)} → ${clicks} кл. ${correction.rightClicks > 0 ? 'вправо' : 'влево'} на барабане`);
  }
  return parts.length === 0 ? 'Поправка не нужна' : parts.join(' · ');
}

export function checkSheet(check: ShotCheck, mode: NotebookMode): CheckSheetView {
  const { notebook, result } = check;
  const isAuto = notebook.mode === 'auto';
  const rows = isAuto ? preparationRows(check) : manualRows(check);
  const main = result.mainError;
  const otherLabels = rows.filter((row, index) => row.status !== 'exact' && index !== main?.rowIndex).map(row => row.label);
  const multiplier = modeMultiplier(mode, false);
  return {
    stamp: STAMPS[result.verdict],
    verdict: result.verdict,
    subtitle: isAuto ? autoSubtitle(rows) : manualSubtitle(result.counts, rows.length),
    isAuto,
    rows,
    mainError: main ? { label: errorLabel(isAuto, rows[main.rowIndex].label, main.rowIndex, main.type), phrase: errorPhrase(check, main.rowIndex, main.type) } : null,
    others: result.otherErrorsCount > 0 && otherLabels.length > 0 ? `ещё ${result.otherErrorsCount} · ${otherLabels.join(', ')}` : null,
    pointsText: `+${Math.round(calcPoints(result.verdict) * multiplier)} за расчёт · ×${multiplier}`,
    dialed: dialedText(notebook, check.truth.dialedElevationClicks, check.truth.dialedWindageLeftClicks),
  };
}

export function targetPlaques(def: ExerciseDef, records: readonly ExerciseShotRecord[], current: { stageIndex: number; targetIndex: number }, isFinished: boolean): string[] {
  const count = def.targets?.count ?? 0;
  const isPaper = def.stages.some(stage => !stage.closesOnHit);
  const plaques: string[] = [];
  def.stages.forEach((stage, stageIndex) => {
    for (let targetIndex = 0; targetIndex < count; targetIndex++) {
      const number = plaques.length + 1;
      const shots = records.filter(record => record.stageIndex === stageIndex && record.targetIndex === targetIndex);
      const isCurrent = !isFinished && current.stageIndex === stageIndex && current.targetIndex === targetIndex;
      if (isPaper && shots.length > 0) {
        plaques.push(`${number} · ${shots.filter(shot => shot.isHit).length} из ${shots.length}`);
      } else if (isCurrent) {
        plaques.push(`${number} · сейчас`);
      } else if (shots.length === 0) {
        plaques.push(`${number} · ·`);
      } else {
        const hitIndex = shots.findIndex(shot => shot.isHit);
        plaques.push(`${number} · ${hitIndex === 0 ? '10' : hitIndex === 1 ? '5' : '✕'}`);
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
    texts.set(row.distanceM, row.distanceM === note.distanceM ? value : `${value} · ${note.distanceM} м`);
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
        player: `${Math.round(check.notebook.distanceM ?? 0)} м`,
        reference: `${Math.round(rangeByMilling(check.notebook.context.target.sizeM, reticleMil))} м`,
        diff: diffText(checked),
        status: checked.status,
      };
    }
    const unit = input.playerUnits === 'moa' ? ' MOA' : '';
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
    'reading-speed': { player: wind ? `${wind.speedMps.toFixed(1)} м/с` : '—', reference: station ? `${station.windSpeedMps.toFixed(1)} м/с` : '—' },
    'reading-direction': { player: wind ? clockText(wind.clock) : '—', reference: clockText(truth.trueWindClock) },
    factors: { player: onNames.join(', ') || '—', reference: neededNames.join(', ') || '—' },
    'turret-elevation': { player: verticalClicks(truth.dialedElevationClicks, clickMil), reference: `итог ${verticalClicks(planned.elevation.targetClicks, clickMil)}` },
    'turret-windage': { player: horizontalClicks(truth.dialedWindageLeftClicks, clickMil), reference: `итог ${horizontalClicks(planned.windageLeft.targetClicks, clickMil)}` },
  };
  return check.inputs.preparation.map((input, index) => ({
    label: PREPARATION_LABELS[input.row],
    ...values[input.row],
    diff: diffText(check.result.rows[index]),
    status: check.result.rows[index].status,
  }));
}

function errorLabel(isAuto: boolean, rowLabel: string, rowIndex: number, type: CheckErrorType): string {
  if (!isAuto) {
    return `ШАГ ${rowIndex + 1} · ${ERROR_LABELS[type]}`;
  }
  const label = rowLabel.toUpperCase();
  return label.includes(ERROR_LABELS[type]) ? label : `${label} · ${ERROR_LABELS[type]}`;
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
      return `Число верное, сторона обратная: брать ${sideWord(input.step, input.expectedRawMil)}`;
    case 'units':
      return `Ответ в MOA, а барабан в MIL: ${reference} MIL = ${(Number(reference) * MOA_PER_MIL).toFixed(2)} MOA`;
    case 'rounding':
      return `${Math.abs(input.expectedRawMil).toFixed(2)} до ближайшего клика — ${reference}, у тебя ${player}`;
    case 'lead':
      return `Упреждение ${Math.abs(input.expectedRawMil).toFixed(2)} MIL, у тебя ${player}`;
    default:
      return `Формула и подстановка верны, но выходит ${Math.abs(input.expectedRawMil).toFixed(2)}, а у тебя ${player}`;
  }
}

function substitutionPhrase(notebook: Notebook, input: CalcStepInput): string {
  const slotIndex = input.expectedInputs.findIndex((value, index) => value !== input.playerInputs[index]);
  const slot = stepSheet(notebook, input.step).slots[slotIndex];
  const label = slot ? SLOT_LABELS[slot.chipKind] : 'слот';
  return `В слот ${label} поставлено ${trimmed(input.playerInputs[slotIndex])}, а нужно ${trimmed(input.expectedInputs[slotIndex])}`;
}

function preparationPhrase(check: ShotCheck, input: PreparationRowInput, type: CheckErrorType): string {
  const row = preparationRows(check)[check.inputs.preparation.indexOf(input)];
  switch (input.row) {
    case 'reading-speed':
      return `Станция показала ${row.reference}, ты ввёл ${row.player.replace(' м/с', '')}`;
    case 'reading-direction':
      return type === 'side' ? `Ветер с ${row.reference}, ты ввёл ${row.player}: поправка в другую сторону` : `Ветер с ${row.reference}, ты ввёл ${row.player}`;
    case 'factors':
      return `Не учтено: ${missingFactorNames(check.notebook)} — ${input.clicksOff} кл.`;
    default:
      return `В блокноте ${row.reference.replace('итог ', '')}, на барабане ${row.player}: ${input.isWrongSide ? 'в другую сторону' : `${input.clicksOff} кл.`}`;
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

function sideWord(step: string, signedMil: number): string {
  if (VERTICAL_STEPS.has(step)) {
    return signedMil > 0 ? 'вверх' : 'вниз';
  }
  return signedMil > 0 ? 'вправо' : 'влево';
}

function diffText(row: CheckedRow): string {
  if (row.errorTypes.includes('side')) {
    return 'СТОРОНА';
  }
  return row.clicksOff === 0 ? '0' : `${row.clicksOff} кл.`;
}

function manualSubtitle(counts: Record<CheckVerdict, number>, total: number): string {
  if (counts.exact === total) {
    return `${total} из ${total} шагов верны`;
  }
  const parts = [counts.exact > 0 ? `${counts.exact} верны` : '', counts.close > 0 ? `${counts.close} почти` : '', counts.error > 0 ? `${counts.error} ошибка` : ''];
  return parts.filter(Boolean).join(' · ');
}

function autoSubtitle(rows: readonly CheckRowView[]): string {
  const wrong = rows.filter(row => row.status !== 'exact');
  return wrong.length === 0 ? 'Показания, факторы и барабаны совпали' : wrong.map(row => `${row.label} ${row.diff}`).join(' · ');
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
      name: CAUSE_NAMES[cause.kind],
      text: cause.clicks === 0 ? 'чисто' : `${directionArrow(cause.vector)} ${cause.clicks} кл.`,
      isPlayerError: cause.isPlayerError,
      isMain: cause.kind === breakdown.main,
      share: cause.clicks / largestClicks,
    })),
  };
}

export function groupText(points: readonly Correction[]): string {
  const group = analyseGroup(points);
  return group ? GROUP_TEXTS[group.shape] : 'Диагноз группы — от 3 выстрелов';
}

function conclusionText(breakdown: MissBreakdown): string {
  const main = breakdown.causes.find(cause => cause.kind === breakdown.main);
  if (!main) {
    return breakdown.causes.some(cause => !cause.isPlayerError && cause.isShown) ? 'Твоих ошибок нет — это разброс винтовки' : 'Чисто';
  }
  const phrase = mainCausePhrase(main, breakdown);
  return main.kind !== 'trigger' && breakdown.isTriggerClean ? `${phrase}, спуск чистый` : phrase;
}

function mainCausePhrase(main: MissCause, breakdown: MissBreakdown): string {
  const shift = `${directionArrow(main.vector)} ${main.clicks} кл.`;
  switch (main.kind) {
    case 'wind':
      return `${breakdown.windVerdict === 'under' ? 'Недокрут' : 'Перекрут'} по ветру ${main.clicks} кл.`;
    case 'calc':
      return `Расчёт увёл пулю ${directionArrow(main.vector)} на ${main.clicks} кл.`;
    case 'hold':
      return `Сетку увело ${directionArrow(main.vector)} на ${main.clicks} кл.`;
    case 'trigger':
      return `Сорвал спуск: ${shift}`;
    default:
      return `Ноль прицела: СТП ${shift}`;
  }
}
