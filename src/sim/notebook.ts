import { CalcStepInput, CalcStepKind, CheckErrorType, checkManualSteps, PreparationRowInput } from '../core/calc-check';
import { DopeCard, dopeRowAt } from '../core/dope-card';
import { NotebookMode } from '../core/exercise-scoring';
import { atmosphereCorrectionMil, averageCrosswindMps, crosswindMps, leadMil, rangeByMilling, roundToClicks, windCorrectionMil } from '../core/game-formulas';
import { mulberry32 } from '../core/rng';
import { GaugeReading } from '../core/scenario';
import { Correction } from '../core/types';
import { ScopeModel, Turret } from './scope-model';
import { TurretTarget, turretTarget } from './turret-target';

export type NotebookStepId = 'distance' | 'dope' | 'atmosphere' | 'zones' | 'wind' | 'lead';
export type NotebookFactor = 'dope' | 'conditions' | 'wind' | 'lead';
export type StaleReason = 'cartridge' | 'distance' | 'conditions' | 'wind';
export type ChipGroup = 'instruments' | 'steps' | 'cartridge';
export type ChipKind =
  | 'target-size'
  | 'reticle-mil'
  | 'distance'
  | 'neighbor-distance'
  | 'temperature'
  | 'pressure'
  | 'humidity'
  | 'speed'
  | 'crosswind'
  | 'colder-column'
  | 'pressure-column'
  | 'wind-constant'
  | 'zone-station'
  | 'zone-200'
  | 'zone-400'
  | 'zone-600'
  | 'target-crosswind'
  | 'target-speed'
  | 'time-of-flight'
  | 'neighbor-time';

export interface TargetMovement {
  speedMps: number;
  clock: number;
}

export interface NotebookTarget {
  sizeM: number;
  distanceM: number | null;
  neighborDistanceM?: number;
  movement?: TargetMovement;
}

export interface NotebookContext {
  card: DopeCard;
  scope: ScopeModel;
  target: NotebookTarget;
  hasZones: boolean;
  canTakeWindFromStation: boolean;
  seed: number;
}

export interface StationRecord extends GaugeReading {
  timeS: number;
  isShort: boolean;
}

export interface NotebookReadings {
  reticleMil: number | null;
  station: StationRecord | null;
  wind: { speedMps: number; clock: number } | null;
  flagCrosswindsMps: readonly number[] | null;
  stationVersion: number;
  windVersion: number;
}

export interface StepState {
  slots: readonly (ChipKind | null)[];
  tape: readonly (number | null)[];
  sign: 1 | -1 | null;
  units: 'mil' | 'moa';
  isRecorded: boolean;
  snapshot: StepSnapshot | null;
  staleReason: StaleReason | null;
}

export interface Notebook {
  context: NotebookContext;
  mode: NotebookMode;
  readings: NotebookReadings;
  factorsOn: Readonly<Record<NotebookFactor, boolean>>;
  steps: Readonly<Record<NotebookStepId, StepState>>;
  distanceM: number | null;
  hasOpenedReference: boolean;
}

export interface Chip {
  kind: ChipKind;
  value: number;
  group: ChipGroup;
}

export interface SheetSlot {
  chipKind: ChipKind;
  placed: ChipKind | null;
  waitsFor: ChipKind | null;
}

export interface StepSheet {
  step: NotebookStepId;
  slots: SheetSlot[];
  printedConstants: Chip[];
  chips: Chip[];
  isGrouped: boolean;
  tapeLength: number;
}

export interface FactorContribution {
  isOn: boolean;
  mil: number | null;
  clicks: number | null;
}

export interface NotebookTotal {
  isEmpty: boolean;
  upMil: number;
  rightMil: number;
  elevation: TurretTarget;
  windageLeft: TurretTarget;
  holdUpMil: number;
  holdRightMil: number;
  leadMil: number;
}

export interface CheckTruth {
  trueWindClock: number;
  dialedElevationClicks: number;
  dialedWindageLeftClicks: number;
}

export interface FormulaInputs {
  distanceM: number;
  temperatureC: number;
  pressureHpa: number;
  wind: { speedMps: number; clock: number };
  flagCrosswindsMps: readonly number[] | null;
}

export interface NotebookCheckInputs {
  steps: CalcStepInput[];
  preparation: PreparationRowInput[];
}

interface StepSnapshot {
  cartridgeId: string;
  distanceM: number | null;
  stationVersion: number;
  windVersion: number;
}

interface StepDefinition {
  kind: CalcStepKind;
  slots: readonly ChipKind[];
  constants: readonly ChipKind[];
  traps: readonly ChipKind[];
  tapeLength: number;
  dependsOn: readonly StaleReason[];
}

const STEP_ORDER: readonly NotebookStepId[] = ['distance', 'dope', 'atmosphere', 'zones', 'wind', 'lead'];
const STALE_ORDER: readonly StaleReason[] = ['cartridge', 'distance', 'conditions', 'wind'];
const FULL_MEASUREMENT_S = 3;
const TRAPS_IN_HARD = 2;
const GROUPED_FROM_CHIPS = 6;
const NEIGHBOR_ROW_M = 100;
const CLOCK_HALF_TURN = 6;

const STEPS: Record<NotebookStepId, StepDefinition> = {
  distance: { kind: 'distance', slots: ['target-size', 'reticle-mil'], constants: [], traps: ['neighbor-distance', 'temperature'], tapeLength: 1, dependsOn: [] },
  dope: { kind: 'dope', slots: ['distance'], constants: [], traps: ['neighbor-distance', 'temperature'], tapeLength: 1, dependsOn: ['cartridge', 'distance'] },
  atmosphere: {
    kind: 'atmosphere',
    slots: ['temperature', 'pressure'],
    constants: ['colder-column', 'pressure-column'],
    traps: ['humidity', 'speed'],
    tapeLength: 1,
    dependsOn: ['cartridge', 'distance', 'conditions'],
  },
  zones: {
    kind: 'zones',
    slots: ['zone-station', 'zone-200', 'zone-400', 'zone-600'],
    constants: [],
    traps: ['speed', 'temperature'],
    tapeLength: 1,
    dependsOn: ['cartridge', 'distance', 'wind'],
  },
  wind: {
    kind: 'wind',
    slots: ['crosswind', 'distance'],
    constants: ['wind-constant'],
    traps: ['speed', 'neighbor-distance', 'temperature', 'pressure'],
    tapeLength: 3,
    dependsOn: ['cartridge', 'distance', 'wind'],
  },
  lead: {
    kind: 'lead',
    slots: ['target-crosswind', 'time-of-flight', 'distance'],
    constants: [],
    traps: ['target-speed', 'neighbor-time'],
    tapeLength: 3,
    dependsOn: ['cartridge', 'distance'],
  },
};

const CHIP_GROUPS: Record<ChipKind, ChipGroup> = {
  'target-size': 'instruments',
  'reticle-mil': 'instruments',
  distance: 'instruments',
  'neighbor-distance': 'instruments',
  temperature: 'instruments',
  pressure: 'instruments',
  humidity: 'instruments',
  speed: 'instruments',
  crosswind: 'instruments',
  'colder-column': 'cartridge',
  'pressure-column': 'cartridge',
  'wind-constant': 'cartridge',
  'zone-station': 'instruments',
  'zone-200': 'instruments',
  'zone-400': 'instruments',
  'zone-600': 'instruments',
  'target-crosswind': 'instruments',
  'target-speed': 'instruments',
  'time-of-flight': 'cartridge',
  'neighbor-time': 'cartridge',
};

export function createNotebook(context: NotebookContext, mode: NotebookMode): Notebook {
  const steps = Object.fromEntries(STEP_ORDER.map(step => [step, emptyStep(step)])) as Record<NotebookStepId, StepState>;
  return {
    context,
    mode,
    readings: { reticleMil: null, station: null, wind: null, flagCrosswindsMps: null, stationVersion: 0, windVersion: 0 },
    factorsOn: { dope: true, conditions: false, wind: true, lead: context.target.movement !== undefined },
    steps,
    distanceM: context.target.distanceM,
    hasOpenedReference: false,
  };
}

export function measureRange(notebook: Notebook, reticleMil: number): Notebook {
  const readings = { ...notebook.readings, reticleMil };
  const distanceM = notebook.mode === 'auto' ? rangeByMilling(notebook.context.target.sizeM, reticleMil) : notebook.distanceM;
  return refreshStale({ ...notebook, readings, distanceM });
}

export function recordStation(notebook: Notebook, reading: GaugeReading, holdS: number, timeS: number): Notebook {
  const station: StationRecord = { ...reading, timeS, isShort: holdS < FULL_MEASUREMENT_S };
  return refreshStale({ ...notebook, readings: { ...notebook.readings, station, stationVersion: notebook.readings.stationVersion + 1 } });
}

export function enterWind(notebook: Notebook, speedMps: number, clock: number): Notebook {
  return refreshStale({ ...notebook, readings: { ...notebook.readings, wind: { speedMps, clock }, windVersion: notebook.readings.windVersion + 1 } });
}

export function takeWindFromStation(notebook: Notebook): Notebook {
  const station = notebook.readings.station;
  if (!notebook.context.canTakeWindFromStation || !station) {
    throw new RangeError('wind is taken from the station only in AUTO exercises 01–03, after a measurement');
  }
  return enterWind(notebook, station.windSpeedMps, station.windClock);
}

export function readFlags(notebook: Notebook, flagCrosswindsMps: readonly number[]): Notebook {
  return refreshStale({ ...notebook, readings: { ...notebook.readings, flagCrosswindsMps, windVersion: notebook.readings.windVersion + 1 } });
}

export function openReference(notebook: Notebook): Notebook {
  return { ...notebook, hasOpenedReference: true };
}

export function changeContext(notebook: Notebook, change: Partial<NotebookContext>): Notebook {
  const context = { ...notebook.context, ...change };
  const distanceM = change.target ? change.target.distanceM : notebook.distanceM;
  const readings = change.target ? { ...notebook.readings, reticleMil: null } : notebook.readings;
  return refreshStale({ ...notebook, context, readings, distanceM, factorsOn: { ...notebook.factorsOn, lead: context.target.movement !== undefined } });
}

export function toggleFactor(notebook: Notebook, factor: NotebookFactor): Notebook {
  return { ...notebook, factorsOn: { ...notebook.factorsOn, [factor]: !notebook.factorsOn[factor] } };
}

export function factorContributions(notebook: Notebook): Record<NotebookFactor, FactorContribution> {
  const contribution = (factor: NotebookFactor, mil: number | null): FactorContribution => ({
    isOn: notebook.factorsOn[factor],
    mil,
    clicks: mil === null ? null : roundToClicks(mil, notebook.context.card.clickMil),
  });
  return {
    dope: contribution('dope', autoDopeMil(notebook)),
    conditions: contribution('conditions', autoConditionsMil(notebook)),
    wind: contribution('wind', autoWindMil(notebook, notebook.readings.wind)),
    lead: contribution('lead', autoLeadMil(notebook)),
  };
}

export function stepSheet(notebook: Notebook, step: NotebookStepId): StepSheet {
  const definition = STEPS[step];
  const isHard = notebook.mode === 'manual-hard';
  const available = chipValues(notebook);
  const slotKinds = isHard ? [...definition.slots, ...definition.constants] : [...definition.slots];
  const state = notebook.steps[step];
  const slots = slotKinds.map((chipKind, index) => ({ chipKind, placed: state.slots[index] ?? null, waitsFor: isHard ? null : chipKind }));
  const traps = isHard ? definition.traps.filter(kind => available[kind] !== undefined).slice(0, TRAPS_IN_HARD) : [];
  const chipKinds = [...slotKinds, ...traps].filter(kind => available[kind] !== undefined);
  const chips = shuffleInPlace(
    chipKinds.map(kind => ({ kind, value: available[kind]!, group: CHIP_GROUPS[kind] })),
    notebook.context.seed + STEP_ORDER.indexOf(step),
  );
  const printedConstants = isHard ? [] : definition.constants.filter(kind => available[kind] !== undefined).map(kind => ({ kind, value: available[kind]!, group: CHIP_GROUPS[kind] }));
  return { step, slots, printedConstants, chips, isGrouped: chips.length >= GROUPED_FROM_CHIPS, tapeLength: definition.tapeLength };
}

export function placeChip(notebook: Notebook, step: NotebookStepId, chipKind: ChipKind, slotIndex?: number): Notebook {
  const slotCount = stepSheet(notebook, step).slots.length;
  const state = notebook.steps[step];
  const current = Array.from({ length: slotCount }, (_, index) => state.slots[index] ?? null);
  const firstEmpty = current.indexOf(null);
  const targetIndex = slotIndex ?? (firstEmpty >= 0 ? firstEmpty : slotCount - 1);
  const slots = current.map((placed, index) => (index === targetIndex ? chipKind : placed));
  return withStep(notebook, step, { ...state, slots, isRecorded: false });
}

export function removeChip(notebook: Notebook, step: NotebookStepId, slotIndex: number): Notebook {
  const state = notebook.steps[step];
  const slots = state.slots.map((chip, index) => (index === slotIndex ? null : chip));
  return withStep(notebook, step, { ...state, slots, isRecorded: false });
}

export function typeTape(notebook: Notebook, step: NotebookStepId, index: number, value: number | null): Notebook {
  const state = notebook.steps[step];
  const tape = Array.from({ length: STEPS[step].tapeLength }, (_, cell) => (cell === index ? value : (state.tape[cell] ?? null)));
  return withStep(notebook, step, { ...state, tape, isRecorded: false });
}

export function setSign(notebook: Notebook, step: NotebookStepId, sign: 1 | -1): Notebook {
  return withStep(notebook, step, { ...notebook.steps[step], sign, isRecorded: false });
}

export function setUnits(notebook: Notebook, step: NotebookStepId, units: 'mil' | 'moa'): Notebook {
  return withStep(notebook, step, { ...notebook.steps[step], units, isRecorded: false });
}

export function recordStep(notebook: Notebook, step: NotebookStepId): Notebook {
  const sheet = stepSheet(notebook, step);
  const state = notebook.steps[step];
  const isFilled = sheet.slots.every((_, index) => state.slots[index] != null);
  const finalValue = state.tape[STEPS[step].tapeLength - 1];
  if (!isFilled || finalValue === null || finalValue === undefined) {
    throw new RangeError(`step ${step} has empty slots or no result`);
  }
  if (stepHasSide(step) && finalValue !== 0 && state.sign === null) {
    throw new RangeError(`step ${step} has no side`);
  }
  const recorded = withStep(notebook, step, { ...state, isRecorded: true, snapshot: snapshotOf(notebook), staleReason: null });
  return step === 'distance' ? refreshStale({ ...recorded, distanceM: finalValue }) : recorded;
}

export function stepHasSide(step: NotebookStepId): boolean {
  return step !== 'distance';
}

export function softHint(notebook: Notebook, step: NotebookStepId): CheckErrorType | null {
  if (notebook.mode !== 'manual-easy' || !notebook.steps[step].isRecorded) {
    return null;
  }
  const input = stepCheckInput(notebook, step);
  if (!input) {
    return null;
  }
  return checkManualSteps([input], notebook.context.card.clickMil).mainError?.type ?? null;
}

export function staleness(notebook: Notebook): Record<NotebookStepId, StaleReason | null> {
  return Object.fromEntries(STEP_ORDER.map(step => [step, notebook.steps[step].staleReason])) as Record<NotebookStepId, StaleReason | null>;
}

export function tabs(notebook: Notebook): { total: boolean; distance: boolean; conditions: boolean; wind: boolean; dope: boolean } {
  return {
    total: true,
    distance: notebook.context.target.distanceM !== null || notebook.readings.reticleMil !== null,
    conditions: notebook.readings.station !== null,
    wind: notebook.readings.wind !== null,
    dope: true,
  };
}

export function total(notebook: Notebook): NotebookTotal {
  const { scope, card } = notebook.context;
  const isAuto = notebook.mode === 'auto';
  const factors = factorContributions(notebook);
  const take = (factor: NotebookFactor, step: NotebookStepId): number | null =>
    isAuto ? (notebook.factorsOn[factor] ? factors[factor].mil : 0) : playerStepMil(notebook, step);
  const dopeMil = isAuto ? (notebook.factorsOn.dope ? factors.dope.mil : null) : playerStepMil(notebook, 'dope');
  const upMil = (dopeMil ?? 0) + (take('conditions', 'atmosphere') ?? 0);
  const rightMil = take('wind', 'wind') ?? 0;
  const leadValue = take('lead', 'lead') ?? 0;
  const elevation = turretTarget(Turret.elevation(scope), upMil, card.clickMil);
  const windageLeft = turretTarget(Turret.windage(scope), -rightMil, card.clickMil);
  return {
    isEmpty: dopeMil === null,
    upMil,
    rightMil,
    elevation,
    windageLeft,
    holdUpMil: elevation.holdMil,
    holdRightMil: -windageLeft.holdMil,
    leadMil: leadValue,
  };
}

export function formulaCorrectionMil(notebook: Notebook, inputs: FormulaInputs): Correction {
  const station: StationRecord = {
    temperatureC: inputs.temperatureC,
    pressureHpa: inputs.pressureHpa,
    relativeHumidity: notebook.readings.station?.relativeHumidity ?? 0.5,
    windSpeedMps: inputs.wind.speedMps,
    windClock: inputs.wind.clock,
    timeS: 0,
    isShort: false,
  };
  const probe: Notebook = {
    ...notebook,
    mode: 'auto',
    distanceM: inputs.distanceM,
    factorsOn: { dope: true, conditions: true, wind: true, lead: true },
    readings: { ...notebook.readings, station, wind: inputs.wind, flagCrosswindsMps: inputs.flagCrosswindsMps },
  };
  const formula = total(probe);
  return { upMrad: formula.upMil, rightMrad: formula.rightMil };
}

export function checkInputs(notebook: Notebook, truth: CheckTruth): NotebookCheckInputs {
  if (notebook.mode !== 'auto') {
    const steps = STEP_ORDER.flatMap(step => {
      const input = notebook.steps[step].isRecorded ? stepCheckInput(notebook, step) : null;
      return input ? [input] : [];
    });
    return { steps, preparation: [] };
  }
  return { steps: [], preparation: preparationRows(notebook, truth) };
}

function preparationRows(notebook: Notebook, truth: CheckTruth): PreparationRowInput[] {
  const { clickMil } = notebook.context.card;
  const clicks = (mil: number | null): number => (mil === null ? 0 : roundToClicks(mil, clickMil));
  const wind = notebook.readings.wind ?? { speedMps: 0, clock: truth.trueWindClock };
  const stationSpeedMps = notebook.readings.station?.windSpeedMps ?? wind.speedMps;
  const playerWindClicks = clicks(autoWindMil(notebook, wind));
  const stationSpeedClicks = clicks(autoWindMil(notebook, { speedMps: stationSpeedMps, clock: wind.clock }));
  const trueClockClicks = clicks(autoWindMil(notebook, { speedMps: wind.speedMps, clock: truth.trueWindClock }));
  const factors = factorContributions(notebook);
  const missedFactorClicks = (['dope', 'conditions', 'wind', 'lead'] as const)
    .filter(factor => !factors[factor].isOn)
    .reduce((sum, factor) => sum + Math.abs(factors[factor].clicks ?? 0), 0);
  const planned = total(notebook);
  const turretRow = (row: 'turret-elevation' | 'turret-windage', planned: number, dialed: number): PreparationRowInput => ({
    row,
    clicksOff: Math.abs(dialed - planned),
    isWrongSide: planned !== 0 && dialed !== 0 && Math.sign(planned) !== Math.sign(dialed),
  });
  return [
    { row: 'reading-speed', clicksOff: Math.abs(playerWindClicks - stationSpeedClicks), isWrongSide: false },
    {
      row: 'reading-direction',
      clicksOff: Math.abs(playerWindClicks - trueClockClicks),
      isWrongSide: playerWindClicks !== 0 && trueClockClicks !== 0 && Math.sign(playerWindClicks) !== Math.sign(trueClockClicks),
    },
    { row: 'factors', clicksOff: missedFactorClicks, isWrongSide: false },
    turretRow('turret-elevation', planned.elevation.targetClicks, truth.dialedElevationClicks),
    turretRow('turret-windage', planned.windageLeft.targetClicks, truth.dialedWindageLeftClicks),
  ];
}

function stepCheckInput(notebook: Notebook, step: NotebookStepId): CalcStepInput | null {
  const state = notebook.steps[step];
  const sheet = stepSheet(notebook, step);
  const available = chipValues(notebook);
  const expectedInputs = sheet.slots.map(slot => available[slot.chipKind] ?? Number.NaN);
  const playerInputs = sheet.slots.map((_, index) => {
    const placed = state.slots[index];
    return placed ? (available[placed] ?? Number.NaN) : Number.NaN;
  });
  const expectedRawMil = expectedStepMil(notebook, step);
  const playerMil = playerStepMil(notebook, step);
  if (expectedRawMil === null || playerMil === null) {
    return null;
  }
  return { step: STEPS[step].kind, expectedInputs, playerInputs, expectedRawMil, playerMil, playerUnits: state.units };
}

// Эталон шага — игровая формула от входов игрока (его дистанция, его ветер), чтобы ошибка считалась один раз (Б23).
function expectedStepMil(notebook: Notebook, step: NotebookStepId): number | null {
  const { card, target } = notebook.context;
  switch (step) {
    case 'distance': {
      if (notebook.readings.reticleMil === null) {
        return null;
      }
      return dopeRowAt(card, rangeByMilling(target.sizeM, notebook.readings.reticleMil)).elevationMil;
    }
    case 'dope':
      return autoDopeMil(notebook);
    case 'atmosphere':
      return autoConditionsMil(notebook);
    case 'zones':
      return zoneWindMil(notebook, zoneCrosswindsMps(notebook));
    case 'wind':
      return crosswindWindMil(notebook, playerCrosswindMps(notebook));
    case 'lead':
      return autoLeadMil(notebook);
  }
}

function playerStepMil(notebook: Notebook, step: NotebookStepId): number | null {
  const state = notebook.steps[step];
  const finalValue = state.tape[STEPS[step].tapeLength - 1];
  if (!state.isRecorded || finalValue === null || finalValue === undefined) {
    return null;
  }
  if (step === 'distance') {
    return dopeRowAt(notebook.context.card, finalValue).elevationMil;
  }
  if (step === 'zones') {
    return zoneWindMil(notebook, [(state.sign ?? 1) * finalValue]);
  }
  return (state.sign ?? 1) * finalValue;
}

function autoDopeMil(notebook: Notebook): number | null {
  return notebook.distanceM === null ? null : dopeRowAt(notebook.context.card, notebook.distanceM).elevationMil;
}

function autoConditionsMil(notebook: Notebook): number | null {
  const station = notebook.readings.station;
  if (!station || notebook.distanceM === null) {
    return null;
  }
  return atmosphereCorrectionMil(dopeRowAt(notebook.context.card, notebook.distanceM), station.temperatureC, station.pressureHpa);
}

function autoWindMil(notebook: Notebook, wind: { speedMps: number; clock: number } | null): number | null {
  if (!wind || notebook.distanceM === null) {
    return null;
  }
  if (notebook.context.hasZones && notebook.readings.flagCrosswindsMps) {
    return zoneWindMil(notebook, [signedCrosswindMps(wind), ...notebook.readings.flagCrosswindsMps]);
  }
  return windCorrectionMil(wind.speedMps, wind.clock, notebook.distanceM, dopeRowAt(notebook.context.card, notebook.distanceM).windConstant);
}

function autoLeadMil(notebook: Notebook): number | null {
  const movement = notebook.context.target.movement;
  if (!movement || notebook.distanceM === null) {
    return null;
  }
  const row = dopeRowAt(notebook.context.card, notebook.distanceM);
  return movementSign(movement.clock) * leadMil(movement.speedMps, movement.clock, row.timeOfFlightS, notebook.distanceM);
}

function zoneCrosswindsMps(notebook: Notebook): number[] {
  const wind = notebook.readings.wind;
  return [wind ? signedCrosswindMps(wind) : 0, ...(notebook.readings.flagCrosswindsMps ?? [0, 0, 0])];
}

// Средний ветер одной цифрой (шаг «зоны» игрока) или по зонам: снос влево — минус, ветер слева — плюс.
function zoneWindMil(notebook: Notebook, crosswindsMps: readonly number[]): number | null {
  if (notebook.distanceM === null) {
    return null;
  }
  const row = dopeRowAt(notebook.context.card, notebook.distanceM);
  const averageMps = crosswindsMps.length === 1 ? crosswindsMps[0] : averageCrosswindMps(crosswindsMps, row.zoneWeights);
  const mil = (-averageMps * notebook.distanceM) / row.windConstant;
  return mil === 0 ? 0 : mil;
}

function crosswindWindMil(notebook: Notebook, signedMps: number | null): number | null {
  if (signedMps === null || notebook.distanceM === null) {
    return null;
  }
  const mil = (-signedMps * notebook.distanceM) / dopeRowAt(notebook.context.card, notebook.distanceM).windConstant;
  return mil === 0 ? 0 : mil;
}

function playerCrosswindMps(notebook: Notebook): number | null {
  if (notebook.context.hasZones) {
    const zones = notebook.steps.zones;
    const finalValue = zones.tape[STEPS.zones.tapeLength - 1];
    return zones.isRecorded && finalValue != null ? (zones.sign ?? 1) * finalValue : null;
  }
  const wind = notebook.readings.wind;
  return wind ? signedCrosswindMps(wind) : null;
}

export function signedCrosswindMps(wind: { speedMps: number; clock: number }): number {
  const fromLeftSign = normalizedClock(wind.clock) > CLOCK_HALF_TURN ? 1 : -1;
  return fromLeftSign * crosswindMps(wind.speedMps, wind.clock);
}

function movementSign(clock: number): number {
  const hours = normalizedClock(clock);
  return hours > 0 && hours < CLOCK_HALF_TURN ? 1 : -1;
}

function normalizedClock(clock: number): number {
  return ((clock % 12) + 12) % 12;
}

function chipValues(notebook: Notebook): Partial<Record<ChipKind, number>> {
  const { card, target } = notebook.context;
  const { station, wind, reticleMil, flagCrosswindsMps } = notebook.readings;
  const distanceM = notebook.distanceM;
  const row = distanceM === null ? null : dopeRowAt(card, distanceM);
  const neighborDistanceM = target.neighborDistanceM ?? (distanceM === null ? null : distanceM + NEIGHBOR_ROW_M);
  const values: Partial<Record<ChipKind, number>> = {
    'target-size': target.sizeM,
    'reticle-mil': reticleMil ?? undefined,
    distance: distanceM ?? undefined,
    'neighbor-distance': neighborDistanceM ?? undefined,
    temperature: station?.temperatureC,
    pressure: station?.pressureHpa,
    humidity: station?.relativeHumidity,
    speed: wind?.speedMps,
    crosswind: notebook.context.hasZones ? absOrUndefined(playerCrosswindMps(notebook)) : wind ? crosswindMps(wind.speedMps, wind.clock) : undefined,
    'colder-column': row?.colderBy10CMil,
    'pressure-column': row?.pressureUp10HpaMil,
    'wind-constant': row?.windConstant,
    'zone-station': wind ? signedCrosswindMps(wind) : undefined,
    'zone-200': flagCrosswindsMps?.[0],
    'zone-400': flagCrosswindsMps?.[1],
    'zone-600': flagCrosswindsMps?.[2],
    'target-crosswind': target.movement ? crosswindMps(target.movement.speedMps, target.movement.clock) : undefined,
    'target-speed': target.movement?.speedMps,
    'time-of-flight': row?.timeOfFlightS,
    'neighbor-time': neighborDistanceM === null ? undefined : dopeRowAt(card, Math.min(neighborDistanceM, lastRowM(card))).timeOfFlightS,
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Partial<Record<ChipKind, number>>;
}

function lastRowM(card: DopeCard): number {
  return card.rows[card.rows.length - 1].distanceM;
}

function absOrUndefined(value: number | null): number | undefined {
  return value === null ? undefined : Math.abs(value);
}

function withStep(notebook: Notebook, step: NotebookStepId, state: StepState): Notebook {
  return { ...notebook, steps: { ...notebook.steps, [step]: state } };
}

function emptyStep(step: NotebookStepId, staleReason: StaleReason | null = null): StepState {
  return { slots: [], tape: Array.from({ length: STEPS[step].tapeLength }, () => null), sign: null, units: 'mil', isRecorded: false, snapshot: null, staleReason };
}

function snapshotOf(notebook: Notebook): StepSnapshot {
  return {
    cartridgeId: notebook.context.card.cartridgeId,
    distanceM: notebook.distanceM,
    stationVersion: notebook.readings.stationVersion,
    windVersion: notebook.readings.windVersion,
  };
}

function staleReasonFor(step: NotebookStepId, snapshot: StepSnapshot, current: StepSnapshot): StaleReason | null {
  const changed: Record<StaleReason, boolean> = {
    cartridge: snapshot.cartridgeId !== current.cartridgeId,
    distance: snapshot.distanceM !== current.distanceM,
    conditions: snapshot.stationVersion !== current.stationVersion,
    wind: snapshot.windVersion !== current.windVersion,
  };
  return STALE_ORDER.find(reason => STEPS[step].dependsOn.includes(reason) && changed[reason]) ?? null;
}

function refreshStale(notebook: Notebook): Notebook {
  const current = snapshotOf(notebook);
  let next = notebook;
  for (const step of STEP_ORDER) {
    const state = notebook.steps[step];
    if (!state.isRecorded || !state.snapshot) {
      continue;
    }
    const reason = staleReasonFor(step, state.snapshot, current);
    if (reason) {
      next = withStep(next, step, emptyStep(step, reason));
    }
  }
  return next;
}

function shuffleInPlace<T>(items: T[], seed: number): T[] {
  const random = mulberry32(seed);
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

