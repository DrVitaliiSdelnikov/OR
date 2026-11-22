import { DopeCard } from '../core/dope-card';
import { rangeByMilling } from '../core/game-formulas';
import { mulberry32, RandomSource } from '../core/rng';
import { fromInput, inSystem, UnitSystem } from '../core/units';
import { text } from '../i18n';
import { ExerciseId, FreePlayTask, PositionTask } from './course';
import { DEFAULT_FREE_PLAY, freePlayTask, WIND_PRESETS } from './free-play';
import { createNotebook, enterWind, FULL_MEASUREMENT_S, measureRange, Notebook, NotebookContext, NotebookStepId, NotebookTarget, recordStation, stepHasSide, stepReferenceMil } from './notebook';
import { RifleProfile } from './rifle-profile';
import { ScopeModel } from './scope-model';

export type CountDrillId = 'milling' | 'dope' | 'wind' | 'conditions' | 'angle' | 'lead';
export type PositionDrillId = 'cold-bore' | 'wind-bracket' | 'distance-ladder' | 'patrol' | 'timed-stage';
export type DrillId = CountDrillId | PositionDrillId;
export type DrillSkill = 'distance' | 'dope' | 'wind' | 'conditions' | 'angle' | 'lead' | 'execution' | 'speed';
export type DrillLevel = 'learn' | 'timed';

interface DrillBase {
  skill: DrillSkill;
  levels: readonly DrillLevel[];
  taughtIn: ExerciseId | null;
}

export interface CountDrillDef extends DrillBase {
  id: CountDrillId;
  kind: 'count';
  step: NotebookStepId;
}

export interface PositionDrillDef extends DrillBase {
  id: PositionDrillId;
  kind: 'position';
}

export type DrillDef = CountDrillDef | PositionDrillDef;

export interface DrillContext {
  card: DopeCard;
  scope: ScopeModel;
}

export interface CountCard {
  drillId: CountDrillId;
  seed: number;
  step: NotebookStepId;
  distanceM: number;
  notebook: Notebook;
  answer: { value: number; sign: 1 | -1 | null };
}

const LEVELS: readonly DrillLevel[] = ['learn', 'timed'];
export const COUNT_DRILL_IDS: readonly CountDrillId[] = ['milling', 'dope', 'wind', 'conditions', 'angle', 'lead'];
export const POSITION_DRILL_IDS: readonly PositionDrillId[] = ['cold-bore', 'wind-bracket', 'distance-ladder', 'patrol', 'timed-stage'];
export const DRILLS: readonly DrillDef[] = [
  { id: 'milling', kind: 'count', skill: 'distance', step: 'distance', taughtIn: '05', levels: LEVELS },
  { id: 'dope', kind: 'count', skill: 'dope', step: 'dope', taughtIn: '01', levels: LEVELS },
  { id: 'wind', kind: 'count', skill: 'wind', step: 'wind', taughtIn: '04', levels: LEVELS },
  { id: 'conditions', kind: 'count', skill: 'conditions', step: 'atmosphere', taughtIn: '07', levels: LEVELS },
  { id: 'angle', kind: 'count', skill: 'angle', step: 'angle', taughtIn: '13', levels: LEVELS },
  { id: 'lead', kind: 'count', skill: 'lead', step: 'lead', taughtIn: '11', levels: LEVELS },
  { id: 'cold-bore', kind: 'position', skill: 'execution', taughtIn: '02', levels: LEVELS },
  { id: 'wind-bracket', kind: 'position', skill: 'wind', taughtIn: '09', levels: LEVELS },
  { id: 'distance-ladder', kind: 'position', skill: 'dope', taughtIn: '12', levels: LEVELS },
  { id: 'patrol', kind: 'position', skill: 'lead', taughtIn: '11', levels: LEVELS },
  { id: 'timed-stage', kind: 'position', skill: 'speed', taughtIn: null, levels: LEVELS },
];

export const ROUND_CARDS = 10;
export const TIME_LIMITS = { cardS: 30, shotS: 90, stageS: 120 } as const;
const SEED_SALT = 0x0d7111;
const MILLING_TARGET_SIZES_M: readonly number[] = [0.5, 0.75, 1, 1.5, 1.8];
const RETICLE_READING_DECIMALS = 10;
const ROW_STEP_IN_SYSTEM = 100;
const WIND_CLOCKS: readonly number[] = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
const TARGET_CLOCKS: readonly number[] = [2, 3, 4, 8, 9, 10];
const STATION_HUMIDITY = 50;
const CALM_CLOCK = 12;
const COUNT_DISTANCES: Record<CountDrillId, { from: number; to: number; step: number }> = {
  milling: { from: 200, to: 900, step: 25 },
  dope: { from: 150, to: 950, step: 10 },
  wind: { from: 200, to: 900, step: 50 },
  conditions: { from: 200, to: 900, step: 50 },
  angle: { from: 200, to: 900, step: 50 },
  lead: { from: 200, to: 600, step: 50 },
};
const CONDITIONS: Record<UnitSystem, { temperature: [number, number, number]; pressure: [number, number, number] }> = {
  metric: { temperature: [-20, 35, 1], pressure: [950, 1050, 1] },
  imperial: { temperature: [-4, 95, 1], pressure: [28.1, 31, 0.01] },
};
const LOOK_ANGLE_DEG: [number, number, number] = [5, 30, 1];
const WIND_SPEED_MPS: [number, number, number] = [1, 8, 0.5];
const TARGET_SPEED_MPS: [number, number, number] = [1, 4, 0.5];

const LADDER = { fromInSystem: 200, toInSystem: 700, rungs: 6 };
const KNOWN_SPAN_IN_SYSTEM = { from: 300, to: 600 };
const STAGE_SPAN_IN_SYSTEM = { from: 300, to: 700 };
const BRACKET_TARGETS = 3;
const BRACKET_SHOTS = 2;
const STAGE_TARGETS = 5;
const PATROL_TARGETS = 10;
const PATROL_SPAN_IN_SYSTEM = { from: 300, to: 500 };

export function drillById(id: DrillId): DrillDef | undefined {
  return DRILLS.find(drill => drill.id === id);
}

export function drillTitle(id: DrillId): string {
  return text.drills.titles[id];
}

export function countRound(id: CountDrillId, seed: number, context: DrillContext, cards = ROUND_CARDS): CountCard[] {
  return Array.from({ length: cards }, (_, index) => countCard(id, seed * cards + index, context));
}

export function countCard(id: CountDrillId, seed: number, context: DrillContext): CountCard {
  const random = mulberry32((seed ^ SEED_SALT) >>> 0);
  const system = context.card.system;
  const step = (drillById(id) as CountDrillDef).step;
  const distanceM = fromInput('distance', cardDistance(id, random), system);
  const notebook = preparedNotebook(id, random, context, distanceM, seed);
  return { drillId: id, seed, step, distanceM, notebook, answer: answerOf(notebook, step) };
}

function cardDistance(id: CountDrillId, random: RandomSource): number {
  const bounds = COUNT_DISTANCES[id];
  const candidates = range(bounds.from, bounds.to, bounds.step).filter(distance => id !== 'dope' || distance % ROW_STEP_IN_SYSTEM !== 0);
  return pick(candidates, random);
}

function preparedNotebook(id: CountDrillId, random: RandomSource, context: DrillContext, distanceM: number, seed: number): Notebook {
  const system = context.card.system;
  const target: NotebookTarget = { sizeM: pick(MILLING_TARGET_SIZES_M, random), distanceM: id === 'milling' ? null : distanceM };
  const base: NotebookContext = { card: context.card, scope: context.scope, target, hasZones: false, canTakeWindFromStation: false, seed };
  switch (id) {
    case 'milling': {
      const reticleMil = Math.round(((target.sizeM * 1000) / distanceM) * RETICLE_READING_DECIMALS) / RETICLE_READING_DECIMALS;
      return measureRange(createNotebook(base, 'manual-easy'), reticleMil);
    }
    case 'dope':
      return createNotebook(base, 'manual-easy');
    case 'wind':
      return enterWind(createNotebook(base, 'manual-easy'), pickRange(WIND_SPEED_MPS, random), pick(WIND_CLOCKS, random));
    case 'conditions': {
      const [temperature, pressure] = [CONDITIONS[system].temperature, CONDITIONS[system].pressure];
      const reading = {
        temperatureC: fromInput('temperature', pickRange(temperature, random), system),
        pressureHpa: fromInput('pressure', pickRange(pressure, random), system),
        relativeHumidity: STATION_HUMIDITY,
        windSpeedMps: 0,
        windClock: CALM_CLOCK,
      };
      return recordStation(createNotebook(base, 'manual-easy'), reading, FULL_MEASUREMENT_S, 0);
    }
    case 'angle': {
      const lookAngleDeg = pickRange(LOOK_ANGLE_DEG, random) * (random() < 0.5 ? -1 : 1);
      return createNotebook({ ...base, geometry: { lookAngleDeg, coriolis: null, isSpinDriftOn: false } }, 'manual-easy');
    }
    case 'lead': {
      const movement = { speedMps: pickRange(TARGET_SPEED_MPS, random), clock: pick(TARGET_CLOCKS, random) };
      return createNotebook({ ...base, target: { ...target, movement } }, 'manual-easy');
    }
  }
}

function answerOf(notebook: Notebook, step: NotebookStepId): CountCard['answer'] {
  if (step === 'distance') {
    const { sizeM } = notebook.context.target;
    return { value: inSystem('distance', rangeByMilling(sizeM, notebook.readings.reticleMil!), notebook.context.card.system), sign: null };
  }
  const mil = stepReferenceMil(notebook, step)!;
  if (!stepHasSide(step)) {
    return { value: mil, sign: null };
  }
  return { value: Math.abs(mil), sign: mil < 0 ? -1 : 1 };
}

export function positionDrillTask(id: PositionDrillId, system: UnitSystem, ownProfile: RifleProfile | null = null, level: DrillLevel = 'learn'): FreePlayTask {
  const base = freePlayTask({ ...DEFAULT_FREE_PLAY, rifle: ownProfile ? 'own' : 'course' }, ownProfile, system);
  const inMetres = (value: number) => fromInput('distance', value, system);
  const known = (span: { from: number; to: number }) => ({ kind: 'known' as const, fromM: inMetres(span.from), toM: inMetres(span.to) });
  const stage = base.stages[0];
  const task: FreePlayTask = { ...base, isOpenFire: false, title: drillTitle(id), drill: { id, level } };
  switch (id) {
    case 'cold-bore':
      return { ...task, targets: { count: 1, distance: known(KNOWN_SPAN_IN_SYSTEM) }, stages: [{ ...stage, maxShotsPerTarget: 1, closesOnHit: true }], hasColdBore: true };
    case 'wind-bracket':
      return {
        ...task,
        targets: { count: BRACKET_TARGETS, distance: { kind: 'fixed', distanceM: inMetres(KNOWN_SPAN_IN_SYSTEM.to) } },
        stages: [{ ...stage, maxShotsPerTarget: BRACKET_SHOTS, closesOnHit: true }],
        conditions: { ...WIND_PRESETS.gusty },
      };
    case 'distance-ladder':
      return {
        ...task,
        targets: { count: LADDER.rungs, distance: known({ from: LADDER.fromInSystem, to: LADDER.toInSystem }), isLadder: true },
        stages: [{ ...stage, maxShotsPerTarget: BRACKET_SHOTS, closesOnHit: true }],
      };
    case 'patrol':
      return { ...task, targets: { count: PATROL_TARGETS, distance: known(PATROL_SPAN_IN_SYSTEM) }, hasPatrol: true };
    case 'timed-stage':
      return { ...task, targets: { count: STAGE_TARGETS, distance: known(STAGE_SPAN_IN_SYSTEM) }, stages: [{ ...stage, maxShotsPerTarget: 1, closesOnHit: true }] };
  }
}

export function positionTimeLimit(task: PositionTask): { scope: 'shot' | 'stage'; seconds: number } | null {
  if (task.drill?.level !== 'timed') {
    return null;
  }
  return task.drill.id === 'timed-stage' ? { scope: 'stage', seconds: TIME_LIMITS.stageS } : { scope: 'shot', seconds: TIME_LIMITS.shotS };
}

function range(from: number, to: number, step: number): number[] {
  const count = Math.round((to - from) / step) + 1;
  return Array.from({ length: count }, (_, index) => Math.round((from + index * step) * 100) / 100);
}

function pick<Value>(values: readonly Value[], random: RandomSource): Value {
  return values[Math.floor(random() * values.length)];
}

function pickRange([from, to, step]: readonly [number, number, number], random: RandomSource): number {
  return pick(range(from, to, step), random);
}
