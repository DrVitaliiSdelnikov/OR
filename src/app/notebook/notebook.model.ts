import { FLAG_DISTANCES_M } from '../../core/content';
import { REFERENCE_PENALTY } from '../../core/exercise-scoring';
import { windClockShare } from '../../core/field';
import { text } from '../../i18n';
import { decimal } from '../../i18n/format';
import { atmosphereCorrectionMil, crosswindMps, windCorrectionMil } from '../../core/game-formulas';
import { DopeCard, dopeRowAt } from '../../core/dope-card';
import { CartridgeId } from '../../core/types';
import { ExerciseShotRecord } from '../../sim/course';
import { FactorContribution, Notebook, NotebookFactor, NotebookTotal } from '../../sim/notebook';
import { formatScopeValue, isHoldoverSettled, MRAD_PER_MOA, ScopeModel } from '../../sim/scope-model';

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

const T = text.notebook.model;
const ZONE_LABELS = [T.zoneStation, ...FLAG_DISTANCES_M.map(distanceM => T.meters({ distanceM }))];
const TAB_ORDER: readonly NotebookTab[] = ['total', 'distance', 'conditions', 'wind', 'dope'];

export const NOTEBOOK_TABS: readonly { id: NotebookTab; label: string }[] = TAB_ORDER.map(id => ({ id, label: T.tabs[id] }));
export const LOCKED_TABS: readonly string[] = T.lockedTabs;
export const FACTOR_NAMES: Record<NotebookFactor, string> = T.factorNames;
export const CARTRIDGE_LETTERS: Record<CartridgeId, string> = T.cartridgeLetters;
export const MILLING_PT_PER_MIL = 45;
export const MILLING_GRID_MIL = 4;
export const MAX_WIND_SPEED_MPS = 15;

const HOURS_ON_DIAL = 12;
const HALF_HOURS_ON_DIAL = 24;
const FULL_TURN_DEG = 360;
export const SPEED_STEP_MPS = 0.1;
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
    parts.push(T.clicksUp({ clicks: elevationClicks }));
  }
  if (windageLeftClicks !== 0) {
    parts.push(T.clicksSideways({ clicks: Math.abs(windageLeftClicks), isLeft: windageLeftClicks > 0 }));
  }
  if (!isHoldoverSettled(scope, total.holdUpMil)) {
    parts.push(T.hold({ arrow: total.holdUpMil < 0 ? '↓' : '↑', amount: formatScopeValue(scope, Math.abs(total.holdUpMil)) }));
  }
  if (!isHoldoverSettled(scope, total.holdRightMil)) {
    parts.push(T.hold({ arrow: total.holdRightMil < 0 ? '←' : '→', amount: formatScopeValue(scope, Math.abs(total.holdRightMil)) }));
  }
  return parts.join(' · ');
}

export function contributionText(factor: NotebookFactor, contribution: FactorContribution): string {
  if (contribution.clicks === null) {
    return '—';
  }
  if (contribution.clicks === 0) {
    return T.clicks({ clicks: 0 });
  }
  const isPositive = contribution.clicks > 0;
  const arrow = VERTICAL_FACTORS.has(factor) ? (isPositive ? '↑' : '↓') : isPositive ? '→' : '←';
  return `${arrow} ${T.clicks({ clicks: Math.abs(contribution.clicks) })}`;
}

export function correctionLine(factor: NotebookFactor, contribution: FactorContribution): string {
  if (contribution.mil === null || contribution.clicks === null) {
    return T.correctionMissing;
  }
  const isPositive = contribution.mil > 0;
  const arrow = contribution.clicks === 0 ? '' : VERTICAL_FACTORS.has(factor) ? (isPositive ? '↑ ' : '↓ ') : isPositive ? '→ ' : '← ';
  return T.correction({ arrow, mil: Math.abs(contribution.mil), clicks: Math.abs(contribution.clicks) });
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
  return T.clock({ hours, isHalfHour: !Number.isInteger(clock) });
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
    return T.distanceNotMeasured;
  }
  const row = dopeRowAt(card, distanceM);
  const distanceText = String(Math.round(distanceM));
  switch (factor) {
    case 'dope':
      return T.dopeDetail({ distanceM: Math.round(distanceM), elevationMil: row.elevationMil });
    case 'conditions': {
      const station = notebook.readings.station;
      if (!station) {
        return T.noStationReading;
      }
      const mil = atmosphereCorrectionMil(row, station.temperatureC, station.pressureHpa);
      return `(15 − ${station.temperatureC}) / 10 × ${row.colderBy10CMil.toFixed(2)} + (${station.pressureHpa} − 1013) / 10 × ${row.pressureUp10HpaMil.toFixed(2)} = ${mil < 0 ? '↓' : '↑'} ${Math.abs(mil).toFixed(2)}`;
    }
    case 'wind': {
      const wind = notebook.readings.wind;
      if (!wind) {
        return T.windNotEntered;
      }
      const crosswind = crosswindMps(wind.speedMps, wind.clock);
      const mil = windCorrectionMil(wind.speedMps, wind.clock, distanceM, row.windConstant);
      const side = mil === 0 ? '' : mil < 0 ? '← ' : '→ ';
      return `${T.windReading({ speedMps: wind.speedMps, clock: clockText(wind.clock) })} · V⊥ ${crosswind.toFixed(1)} · W = V⊥ × ${distanceText} / ${row.windConstant} = ${side}${Math.abs(mil).toFixed(2)}`;
    }
    case 'lead':
      return T.leadDetail;
  }
}

export function zoneTable(notebook: Notebook): ZoneTable | null {
  if (!notebook.context.hasZones) {
    return null;
  }
  const weights = notebook.distanceM === null ? null : dopeRowAt(notebook.context.card, notebook.distanceM).zoneWeights;
  const { flagCrosswindsMps, flagsBehindBerm } = notebook.readings;
  return {
    weights: ZONE_LABELS.map((label, index) => ({ label, value: weights ? decimal(weights[index], 2) : '—' })),
    flags: FLAG_DISTANCES_M.map((distanceM, index) => {
      if (flagsBehindBerm.includes(index)) {
        return { distanceM, text: T.flagBehindBerm, isRead: true };
      }
      const crosswindMps = flagCrosswindsMps?.[index] ?? null;
      return crosswindMps === null ? { distanceM, text: T.flagUnread, isRead: false } : { distanceM, text: flagCrosswindText(crosswindMps), isRead: true };
    }),
  };
}

export function flagCrosswindText(crosswindMps: number): string {
  if (crosswindMps === 0) {
    return T.calm;
  }
  return T.flagCrosswind({ crosswindMps });
}

const CLOCK_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const SHARE_DIGITS = 2;
const MOA_DIGITS = 2;

export function clockShareLines(): string[] {
  const clocksByShare = new Map<number, number[]>();
  for (const clock of CLOCK_HOURS) {
    const share = Number(windClockShare(clock).toFixed(SHARE_DIGITS));
    clocksByShare.set(share, [...(clocksByShare.get(share) ?? []), clock]);
  }
  return [...clocksByShare].map(([share, clocks]) => T.clockShare({ clocks, share }));
}

export function referencePriceText(penalty = REFERENCE_PENALTY): string {
  return T.referencePrice({ penalty });
}

export function moaPerMilText(): string {
  return decimal(1 / MRAD_PER_MOA, MOA_DIGITS);
}
