import { FLAG_DISTANCES_M } from '../../core/content';
import { atmosphereCorrectionMil, crosswindMps, windCorrectionMil } from '../../core/game-formulas';
import { DopeCard, dopeRowAt } from '../../core/dope-card';
import { CartridgeId } from '../../core/types';
import { ExerciseShotRecord } from '../../sim/course';
import { FactorContribution, Notebook, NotebookFactor, NotebookTotal } from '../../sim/notebook';
import { formatScopeValue, isHoldoverSettled, ScopeModel } from '../../sim/scope-model';

export type NotebookTab = 'total' | 'distance' | 'conditions' | 'wind' | 'dope';

export interface DopeTableRow {
  distanceM: number;
  elevation: string;
  clicks: string;
  timeOfFlight: string;
  windConstant: string;
  colderBy10C: string;
  pressureUp10Hpa: string;
  note: string;
  isCurrent: boolean;
}

export interface ZoneTable {
  weights: { label: string; value: string }[];
  flags: { distanceM: number; text: string; isRead: boolean }[];
}

const ZONE_LABELS = ['станция', '200 м', '400 м', '600 м'] as const;

export const NOTEBOOK_TABS: readonly { id: NotebookTab; label: string }[] = [
  { id: 'total', label: 'Итог' },
  { id: 'distance', label: 'Дистанция' },
  { id: 'conditions', label: 'Условия' },
  { id: 'wind', label: 'Ветер' },
  { id: 'dope', label: 'ДОПЕ' },
];
export const LOCKED_TABS: readonly string[] = ['Угол', 'Патрон', 'Ещё'];
export const FACTOR_NAMES: Record<NotebookFactor, string> = { dope: 'ДОПЕ', conditions: 'Условия', wind: 'Ветер', lead: 'Упреждение' };
export const CARTRIDGE_LETTERS: Record<CartridgeId, string> = { A: 'А', B: 'Б', C: 'В' };
export const MILLING_PT_PER_MIL = 45;
export const MILLING_GRID_MIL = 4;
export const MAX_WIND_SPEED_MPS = 15;

const HOURS_ON_DIAL = 12;
const HALF_HOURS_ON_DIAL = 24;
const FULL_TURN_DEG = 360;
const SPEED_STEP_MPS = 0.1;
const SPEED_DECIMALS = 10;
const MILLING_STEP_MIL = 0.05;
const SHOTS_IN_STRIP = 5;
const RANGE_DAY_START_MIN = 14 * 60;
const MINUTES_PER_HOUR = 60;
const VERTICAL_FACTORS: ReadonlySet<NotebookFactor> = new Set(['dope', 'conditions']);

export function totalLine(scope: ScopeModel, total: NotebookTotal): string {
  if (total.isEmpty) {
    return '→ —';
  }
  const elevationClicks = total.elevation.targetClicks;
  const windageLeftClicks = total.windageLeft.targetClicks;
  const parts = [`↑ ${formatScopeValue(scope, elevationClicks * scope.clickMrad)}`];
  if (windageLeftClicks !== 0) {
    parts.push(`${windageLeftClicks > 0 ? '←' : '→'} ${formatScopeValue(scope, Math.abs(windageLeftClicks) * scope.clickMrad)}`);
  }
  if (elevationClicks !== 0) {
    parts.push(`${elevationClicks} кл. вверх`);
  }
  if (windageLeftClicks !== 0) {
    parts.push(`${Math.abs(windageLeftClicks)} кл. ${windageLeftClicks > 0 ? 'влево' : 'вправо'}`);
  }
  if (!isHoldoverSettled(scope, total.holdUpMil)) {
    parts.push(`удержание ${total.holdUpMil < 0 ? '↓' : '↑'} ${formatScopeValue(scope, Math.abs(total.holdUpMil))}`);
  }
  if (!isHoldoverSettled(scope, total.holdRightMil)) {
    parts.push(`удержание ${total.holdRightMil < 0 ? '←' : '→'} ${formatScopeValue(scope, Math.abs(total.holdRightMil))}`);
  }
  return parts.join(' · ');
}

export function contributionText(factor: NotebookFactor, contribution: FactorContribution): string {
  if (contribution.clicks === null) {
    return '—';
  }
  if (contribution.clicks === 0) {
    return '0 кл.';
  }
  const isPositive = contribution.clicks > 0;
  const arrow = VERTICAL_FACTORS.has(factor) ? (isPositive ? '↑' : '↓') : isPositive ? '→' : '←';
  return `${arrow} ${Math.abs(contribution.clicks)} кл.`;
}

export function correctionLine(factor: NotebookFactor, contribution: FactorContribution): string {
  if (contribution.mil === null || contribution.clicks === null) {
    return 'поправка: —';
  }
  const isPositive = contribution.mil > 0;
  const arrow = contribution.clicks === 0 ? '' : VERTICAL_FACTORS.has(factor) ? (isPositive ? '↑ ' : '↓ ') : isPositive ? '→ ' : '← ';
  return `поправка ${arrow}${Math.abs(contribution.mil).toFixed(2)} MIL · ${Math.abs(contribution.clicks)} кл.`;
}

export function clockFromDialAngle(angleDeg: number): number {
  const turnShare = (((angleDeg % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) / FULL_TURN_DEG;
  const halfHours = Math.round(turnShare * HALF_HOURS_ON_DIAL) % HALF_HOURS_ON_DIAL;
  return halfHours === 0 ? HOURS_ON_DIAL : halfHours / 2;
}

export function dialAngleFromClock(clock: number): number {
  return (clock % HOURS_ON_DIAL) * (FULL_TURN_DEG / HOURS_ON_DIAL);
}

export function clockText(clock: number): string {
  const hours = Math.floor(clock) === 0 ? HOURS_ON_DIAL : Math.floor(clock);
  return Number.isInteger(clock) ? `${hours} ч` : `${hours}:30`;
}

export function stepSpeed(speedMps: number, steps: number): number {
  const next = Math.round((speedMps + steps * SPEED_STEP_MPS) * SPEED_DECIMALS) / SPEED_DECIMALS;
  return Math.min(MAX_WIND_SPEED_MPS, Math.max(0, next));
}

export function dopeTable(card: DopeCard, distanceM: number | null, noteTexts: ReadonlyMap<number, string> = new Map()): DopeTableRow[] {
  const nearest =
    distanceM === null ? null : card.rows.reduce((best, row) => (Math.abs(row.distanceM - distanceM) < Math.abs(best.distanceM - distanceM) ? row : best)).distanceM;
  return card.rows.map(row => ({
    distanceM: row.distanceM,
    elevation: row.elevationMil.toFixed(1),
    clicks: String(row.clicks),
    timeOfFlight: row.timeOfFlightS.toFixed(2),
    windConstant: String(row.windConstant),
    colderBy10C: row.colderBy10CMil.toFixed(2),
    pressureUp10Hpa: row.pressureUp10HpaMil.toFixed(2),
    note: noteTexts.get(row.distanceM) ?? '—',
    isCurrent: row.distanceM === nearest,
  }));
}

export function snapMilling(mil: number): number {
  return Math.round(mil / MILLING_STEP_MIL) * MILLING_STEP_MIL;
}

export function millingSize(firstMil: number, secondMil: number): number {
  return snapMilling(Math.abs(firstMil - secondMil));
}

export function shotStrip(records: readonly ExerciseShotRecord[]): string[] {
  return records.slice(-SHOTS_IN_STRIP).map(record => `${record.isHit ? '✓' : '✕'} ${Math.round(record.rangeEstimateM ?? record.distanceM)}`);
}

export function rangeClockText(elapsedS: number): string {
  const minutes = RANGE_DAY_START_MIN + Math.floor(elapsedS / MINUTES_PER_HOUR);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  return `${hours}:${String(minutes % MINUTES_PER_HOUR).padStart(2, '0')}`;
}

export function factorDetail(notebook: Notebook, factor: NotebookFactor): string {
  const { card } = notebook.context;
  const distanceM = notebook.distanceM;
  if (distanceM === null) {
    return 'дистанция не измерена';
  }
  const row = dopeRowAt(card, distanceM);
  const distanceText = String(Math.round(distanceM));
  switch (factor) {
    case 'dope':
      return `строка ${distanceText} м карточки: ↑ ${row.elevationMil.toFixed(1)}`;
    case 'conditions': {
      const station = notebook.readings.station;
      if (!station) {
        return 'нет замера';
      }
      const mil = atmosphereCorrectionMil(row, station.temperatureC, station.pressureHpa);
      return `(15 − ${station.temperatureC}) / 10 × ${row.colderBy10CMil.toFixed(2)} + (${station.pressureHpa} − 1013) / 10 × ${row.pressureUp10HpaMil.toFixed(2)} = ${mil < 0 ? '↓' : '↑'} ${Math.abs(mil).toFixed(2)}`;
    }
    case 'wind': {
      const wind = notebook.readings.wind;
      if (!wind) {
        return 'ветер не введён';
      }
      const crosswind = crosswindMps(wind.speedMps, wind.clock);
      const mil = windCorrectionMil(wind.speedMps, wind.clock, distanceM, row.windConstant);
      const side = mil === 0 ? '' : mil < 0 ? '← ' : '→ ';
      return `${wind.speedMps.toFixed(1)} м/с с ${clockText(wind.clock)} · V⊥ ${crosswind.toFixed(1)} · W = V⊥ × ${distanceText} / ${row.windConstant} = ${side}${Math.abs(mil).toFixed(2)}`;
    }
    case 'lead':
      return 'упреждение — сеткой, на барабаны не идёт';
  }
}

export function zoneTable(notebook: Notebook): ZoneTable | null {
  if (!notebook.context.hasZones) {
    return null;
  }
  const weights = notebook.distanceM === null ? null : dopeRowAt(notebook.context.card, notebook.distanceM).zoneWeights;
  const { flagCrosswindsMps, flagsBehindBerm } = notebook.readings;
  return {
    weights: ZONE_LABELS.map((label, index) => ({ label, value: weights ? weights[index].toFixed(2).replace('.', ',') : '—' })),
    flags: FLAG_DISTANCES_M.map((distanceM, index) => {
      if (flagsBehindBerm.includes(index)) {
        return { distanceM, text: 'за валом', isRead: true };
      }
      const crosswindMps = flagCrosswindsMps?.[index] ?? null;
      return crosswindMps === null ? { distanceM, text: 'тапни флажок в стекле', isRead: false } : { distanceM, text: flagCrosswindText(crosswindMps), isRead: true };
    }),
  };
}

export function flagCrosswindText(crosswindMps: number): string {
  if (crosswindMps === 0) {
    return 'штиль';
  }
  return `${Math.abs(crosswindMps).toFixed(1).replace('.', ',')} м/с ${crosswindMps > 0 ? 'слева' : 'справа'}`;
}
