import { FLAG_DISTANCES_M, isCourseCartridgeId, STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C } from '../../core/content';
import { REFERENCE_PENALTY } from '../../core/exercise-scoring';
import { windClockShare } from '../../core/field';
import { text } from '../../i18n';
import { decimal } from '../../i18n/format';
import {
  atmosphereCorrectionMil,
  atmosphereCorrectionMilImperial,
  crosswindMps,
  imperialWindConstant,
  STANDARD_PRESSURE_INHG,
  STANDARD_TEMPERATURE_F,
  windCorrectionMil,
} from '../../core/game-formulas';
import { DopeCard, DopeRow, dopeRowAt } from '../../core/dope-card';
import { CartridgeId } from '../../core/types';
import { fromInput, inSystem, UnitSystem } from '../../core/units';
import { ExerciseShotRecord } from '../../sim/course';
import { FactorContribution, factorContributions, geometryOf, Notebook, NotebookFactor, NotebookTotal } from '../../sim/notebook';
import { formatScopeValue, isHoldoverSettled, MRAD_PER_MOA, ScopeModel } from '../../sim/scope-model';

export type NotebookTab = 'total' | 'distance' | 'conditions' | 'wind' | 'dope';

export interface DopeTableRow {
  distanceM: number;
  distance: string;
  elevation: string;
  clicks: string;
  timeOfFlight: string;
  windConstant: string;
  colderStep: string;
  pressureStep: string;
  note: string;
  isCurrent: boolean;
}

export interface ZoneTable {
  weights: { label: string; value: string }[];
  flags: { distanceM: number; text: string; isRead: boolean }[];
}

const T = text.notebook.model;
const SPEED_DIGITS = 1;
const PRESSURE_HUNDREDTHS = 100;
const TARGET_SIZE_TENTHS = 10;
const IMPERIAL_MILLING_FACTOR_TEXT = '27,78';
const METRIC_MILLING_FACTOR_TEXT = '1000';
const DISTANCE_DIGITS = 0;
const STATION_TEMPERATURE_DIGITS = 0;
const STATION_PRESSURE_DIGITS: Record<UnitSystem, number> = { metric: 0, imperial: 2 };
const UNITS = text.units;
const SHEET_TEXTS = text.notebook.notebookSheet;
const MAX_WIND_SPEED_DISPLAY: Record<UnitSystem, number> = { metric: 15, imperial: 33.5 };
const WHEEL_NEIGHBORS = 2;
const WHEEL_FADE_PER_ROW = 0.3;
const WHEEL_EDGE_EPSILON = 1e-9;
const TAB_ORDER: readonly NotebookTab[] = ['total', 'distance', 'conditions', 'wind', 'dope'];

export const NOTEBOOK_TABS: readonly { id: NotebookTab; label: string }[] = TAB_ORDER.map(id => ({ id, label: T.tabs[id] }));
export const LOCKED_TABS: readonly string[] = T.lockedTabs;
export const FACTOR_NAMES: Record<NotebookFactor, string> = T.factorNames;
export const CARTRIDGE_LETTERS: Record<CartridgeId, string> = T.cartridgeLetters;

export function cartridgeLetter(card: Pick<DopeCard, 'cartridgeId' | 'cartridgeName'>): string {
  return isCourseCartridgeId(card.cartridgeId) ? CARTRIDGE_LETTERS[card.cartridgeId] : card.cartridgeName;
}
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
const VERTICAL_FACTORS: ReadonlySet<NotebookFactor> = new Set(['dope', 'conditions', 'angle', 'eotvos']);
const RADIANS_PER_DEGREE = Math.PI / 180;
const TRIG_DECIMALS = 100;

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

function conditionsDetail(row: DopeRow, temperatureC: number, pressureHpa: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const temperatureF = Math.round(inSystem('temperature', temperatureC, system));
    const pressureInHg = Math.round(inSystem('pressure', pressureHpa, system) * PRESSURE_HUNDREDTHS) / PRESSURE_HUNDREDTHS;
    const mil = atmosphereCorrectionMilImperial(row, temperatureF, pressureInHg);
    return `(${STANDARD_TEMPERATURE_F} − ${decimal(temperatureF)}) / 10 × ${decimal(row.colderStepMil, 2)} + (${decimal(pressureInHg, 2)} − ${decimal(STANDARD_PRESSURE_INHG, 2)}) / 0,3 × ${decimal(row.pressureStepMil, 2)} = ${mil < 0 ? '↓' : '↑'} ${decimal(Math.abs(mil), 2)}`;
  }
  const mil = atmosphereCorrectionMil(row, temperatureC, pressureHpa);
  return `(15 − ${decimal(temperatureC)}) / 10 × ${decimal(row.colderStepMil, 2)} + (${pressureHpa} − 1013) / 10 × ${decimal(row.pressureStepMil, 2)} = ${mil < 0 ? '↓' : '↑'} ${decimal(Math.abs(mil), 2)}`;
}

export function dopeColumnHeaders(system: UnitSystem): { colder: string; colderTitle: string; pressure: string; pressureTitle: string } {
  return text.notebook.dopeTab.columns[system];
}

export function millingResultText(sizeM: number, reticleMil: number, distanceM: number, system: UnitSystem): string {
  const isImperial = system === 'imperial';
  return SHEET_TEXTS.millingResult({
    size: isImperial ? decimal(Math.round(inSystem('targetSize', sizeM, system) * TARGET_SIZE_TENTHS) / TARGET_SIZE_TENTHS) : decimal(sizeM),
    factor: isImperial ? IMPERIAL_MILLING_FACTOR_TEXT : METRIC_MILLING_FACTOR_TEXT,
    reticleMil,
    distance: UNITS.valueText('distance', distanceM, system, DISTANCE_DIGITS),
  });
}

export function stepSpeed(speedMps: number, steps: number, system: UnitSystem = 'metric'): number {
  const shown = Math.round(inSystem('windSpeed', speedMps, system) * SPEED_DECIMALS) / SPEED_DECIMALS;
  const next = Math.round((shown + steps * SPEED_STEP_MPS) * SPEED_DECIMALS) / SPEED_DECIMALS;
  const clamped = Math.min(MAX_WIND_SPEED_DISPLAY[system], Math.max(0, next));
  return system === 'metric' ? clamped : fromInput('windSpeed', clamped, system);
}

export function speedWheelRows(speedMps: number | null, system: UnitSystem): { offset: number; text: string; opacity: number }[] {
  return Array.from({ length: WHEEL_NEIGHBORS * 2 + 1 }, (_, index) => {
    const offset = index - WHEEL_NEIGHBORS;
    if (speedMps === null) {
      return { offset, text: offset === 0 ? '—' : '', opacity: 1 };
    }
    const value = Math.round(inSystem('windSpeed', speedMps, system) * SPEED_DECIMALS) / SPEED_DECIMALS + offset * SPEED_STEP_MPS;
    const isOutside = value < -WHEEL_EDGE_EPSILON || value > MAX_WIND_SPEED_DISPLAY[system] + WHEEL_EDGE_EPSILON;
    return { offset, text: isOutside ? '' : decimal(value, SPEED_DIGITS), opacity: 1 - Math.abs(offset) * WHEEL_FADE_PER_ROW };
  });
}

export function maxWheelSpeed(system: UnitSystem): number {
  return MAX_WIND_SPEED_DISPLAY[system];
}

export function stationTexts(station: { temperatureC: number; pressureHpa: number; windSpeedMps: number }, system: UnitSystem): { temperature: string; pressure: string; wind: string } {
  return {
    temperature: UNITS.valueText('temperature', station.temperatureC, system, STATION_TEMPERATURE_DIGITS),
    pressure: UNITS.valueText('pressure', station.pressureHpa, system, STATION_PRESSURE_DIGITS[system]),
    wind: UNITS.valueText('windSpeed', station.windSpeedMps, system, SPEED_DIGITS),
  };
}

export function stationWindText(speedMps: number, time: string, system: UnitSystem): string {
  return SHEET_TEXTS.stationWind({ speed: UNITS.valueText('windSpeed', speedMps, system, SPEED_DIGITS), time });
}

export function knownDistanceText(distanceM: number, system: UnitSystem): string {
  return SHEET_TEXTS.knownDistance({ distance: UNITS.valueText('distance', distanceM, system, DISTANCE_DIGITS) });
}

export function windReadingText(wind: { speedMps: number; clock: number }, system: UnitSystem): string {
  return T.windReading({ speed: UNITS.valueText('windSpeed', wind.speedMps, system, SPEED_DIGITS), clock: clockText(wind.clock) });
}

export function windCaptionText(wind: { speedMps: number; clock: number } | null, system: UnitSystem): string {
  return wind ? SHEET_TEXTS.windCaption({ reading: windReadingText(wind, system) }) : SHEET_TEXTS.windCaptionEmpty;
}

export function dopeHeadingText(card: DopeCard, system: UnitSystem): string {
  return SHEET_TEXTS.dopeHeading({ cartridge: cartridgeLetter(card), zero: UNITS.valueText('distance', card.zeroM, system, DISTANCE_DIGITS), ...standardAtmosphereTexts(system) });
}

export function conditionsReferenceText(system: UnitSystem): string {
  return text.notebook.conditionsTab.reference(standardAtmosphereTexts(system));
}

export function windFlagText(distanceM: number, readingText: string, system: UnitSystem): string {
  return text.notebook.windTab.flag({ distance: UNITS.valueText('distance', distanceM, system, DISTANCE_DIGITS), text: readingText });
}

function standardAtmosphereTexts(system: UnitSystem): { temperature: string; pressure: string } {
  return {
    temperature: UNITS.valueText('temperature', STANDARD_TEMPERATURE_C, system, STATION_TEMPERATURE_DIGITS),
    pressure: UNITS.valueText('pressure', STANDARD_PRESSURE_HPA, system, STATION_PRESSURE_DIGITS[system]),
  };
}

export function dopeTable(card: DopeCard, distanceM: number | null, noteTexts: ReadonlyMap<number, string> = new Map(), system: UnitSystem = 'metric'): DopeTableRow[] {
  const nearest =
    distanceM === null ? null : card.rows.reduce((best, row) => (Math.abs(row.distanceM - distanceM) < Math.abs(best.distanceM - distanceM) ? row : best)).distanceM;
  return card.rows.map(row => ({
    distanceM: row.distanceM,
    distance: UNITS.numberText('distance', row.distanceM, system, DISTANCE_DIGITS),
    elevation: decimal(row.elevationMil, 1),
    clicks: String(row.clicks),
    timeOfFlight: decimal(row.timeOfFlightS, 2),
    windConstant: String(card.system === 'imperial' ? imperialWindConstant(row.windConstant) : row.windConstant),
    colderStep: decimal(row.colderStepMil, 2),
    pressureStep: decimal(row.pressureStepMil, 2),
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
  const system = card.system;
  const distanceText = UNITS.numberText('distance', distanceM, system, DISTANCE_DIGITS);
  switch (factor) {
    case 'dope':
      return T.dopeDetail({ distance: UNITS.valueText('distance', distanceM, system, DISTANCE_DIGITS), elevationMil: row.elevationMil });
    case 'conditions': {
      const station = notebook.readings.station;
      return station ? conditionsDetail(row, station.temperatureC, station.pressureHpa, system) : T.noStationReading;
    }
    case 'wind': {
      const wind = notebook.readings.wind;
      if (!wind) {
        return T.windNotEntered;
      }
      const speed = inSystem('windSpeed', wind.speedMps, system);
      const windConstant = system === 'imperial' ? imperialWindConstant(row.windConstant) : row.windConstant;
      const crosswind = crosswindMps(speed, wind.clock);
      const mil = windCorrectionMil(speed, wind.clock, inSystem('distance', distanceM, system), windConstant);
      const side = mil === 0 ? '' : mil < 0 ? '← ' : '→ ';
      return `${windReadingText(wind, system)} · V⊥ ${decimal(crosswind, 1)} · W = V⊥ × ${distanceText} / ${windConstant} = ${side}${decimal(Math.abs(mil), 2)}`;
    }
    case 'lead':
      return T.leadDetail;
    case 'angle':
    case 'spin':
    case 'coriolis':
    case 'eotvos':
      return geometryFactorDetail(notebook, factor, row.elevationMil, row.spinDriftMil, row.timeOfFlightS);
  }
}

function geometryFactorDetail(notebook: Notebook, factor: 'angle' | 'spin' | 'coriolis' | 'eotvos', elevationMil: number, spinDriftMil: number, timeS: number): string {
  const geometry = geometryOf(notebook.context);
  const mil = factorContributions(notebook)[factor].mil ?? 0;
  const trig = (value: number): number => Math.round(Math.abs(value) * TRIG_DECIMALS) / TRIG_DECIMALS;
  const latitudeRad = (geometry.coriolis?.latitudeDeg ?? 0) * RADIANS_PER_DEGREE;
  const azimuthRad = (geometry.coriolis?.azimuthDeg ?? 0) * RADIANS_PER_DEGREE;
  switch (factor) {
    case 'angle':
      return T.angleDetail({
        elevationMil,
        zeroAngleMil: notebook.context.card.zeroAngleMil,
        cosAngle: trig(Math.cos(geometry.lookAngleDeg * RADIANS_PER_DEGREE)),
        inclinedMil: elevationMil + mil,
      });
    case 'spin':
      return T.spinDetail({ spinDriftMil });
    case 'coriolis':
      return T.coriolisDetail({ timeS, sinLatitude: trig(Math.sin(latitudeRad)), mil });
    case 'eotvos':
      return T.eotvosDetail({ timeS, cosLatitude: trig(Math.cos(latitudeRad)), sinAzimuth: trig(Math.sin(azimuthRad)), mil });
  }
}

export function zoneTable(notebook: Notebook, system: UnitSystem = 'metric'): ZoneTable | null {
  if (!notebook.context.hasZones) {
    return null;
  }
  const weights = notebook.distanceM === null ? null : dopeRowAt(notebook.context.card, notebook.distanceM).zoneWeights;
  const { flagCrosswindsMps, flagsBehindBerm } = notebook.readings;
  return {
    weights: [T.zoneStation, ...FLAG_DISTANCES_M.map(flagDistanceM => UNITS.valueText('distance', flagDistanceM, system, DISTANCE_DIGITS))].map((label, index) => ({ label, value: weights ? decimal(weights[index], 2) : '—' })),
    flags: FLAG_DISTANCES_M.map((distanceM, index) => {
      if (flagsBehindBerm.includes(index)) {
        return { distanceM, text: T.flagBehindBerm, isRead: true };
      }
      const crosswindMps = flagCrosswindsMps?.[index] ?? null;
      return crosswindMps === null ? { distanceM, text: T.flagUnread, isRead: false } : { distanceM, text: flagCrosswindText(crosswindMps, system), isRead: true };
    }),
  };
}

export function flagCrosswindText(crosswindMps: number, system: UnitSystem = 'metric'): string {
  if (crosswindMps === 0) {
    return T.calm;
  }
  return T.flagCrosswind({ speed: text.units.valueText('windSpeed', Math.abs(crosswindMps), system, SPEED_DIGITS), isFromLeft: crosswindMps > 0 });
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
