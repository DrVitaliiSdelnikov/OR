import { CalcStepKind, CheckErrorType, CheckVerdict, PreparationRowKind } from '../core/calc-check';
import {
  calcPoints,
  ExerciseClass,
  exerciseClass,
  hitShare,
  modeMultiplier,
  NotebookMode,
  Rank,
  rankFor,
  seriesTotal,
  targetPoints,
} from '../core/exercise-scoring';
import { isRangeWithinTolerance } from '../core/game-formulas';
import { mulberry32, RandomSource } from '../core/rng';
import { ScenarioOptions } from '../core/scenario';
import { CartridgeId, Correction, Target } from '../core/types';
import { FiringPlan } from './firing-line';
import { ScopeId } from './scope-model';
import { ShotDiagnosis } from './shot-review';

export type ExerciseId = '00' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';

export type TargetDistance =
  | { kind: 'fixed'; distanceM: number }
  | { kind: 'known'; fromM: number; toM: number }
  | { kind: 'unknown'; fromM: number; toM: number };

export interface ExerciseTargets {
  count: number;
  distance: TargetDistance;
  diameterM?: number;
  isOutAndBack?: boolean;
}

export interface ExerciseStage {
  cartridgeId: CartridgeId;
  maxShotsPerTarget: number;
  closesOnHit: boolean;
}

export interface ExerciseDef {
  id: ExerciseId;
  title: string;
  targets: ExerciseTargets | null;
  stages: readonly ExerciseStage[];
  hasColdBore: boolean;
  hasKnockedSight: boolean;
  notebookMode: NotebookMode | null;
  scopeId: ScopeId;
  conditions: ScenarioOptions;
  terms: readonly string[];
}

export interface ExerciseSetup {
  targets: Target[];
  plan: FiringPlan;
  scenarioOptions: ScenarioOptions;
  sightOffset: Correction;
}

export type CheckRowKind = CalcStepKind | PreparationRowKind;

export interface ShotCheckSummary {
  verdict: CheckVerdict;
  rowVerdicts: Partial<Record<CheckRowKind, CheckVerdict>>;
  errorTypes: readonly CheckErrorType[];
}

export interface ExerciseShotRecord {
  stageIndex: number;
  targetIndex: number;
  distanceM: number;
  isHit: boolean;
  isColdBore: boolean;
  impact: Correction;
  diagnosis: ShotDiagnosis;
  check?: ShotCheckSummary;
  isDialExactFirstTry?: boolean;
  isBreathHeld?: boolean;
  rangeEstimateM?: number;
  isCallAccurate?: boolean;
  isAmbush?: boolean;
}

export interface ExerciseRun {
  mode: NotebookMode;
  hasOpenedReference: boolean;
  shots: readonly ExerciseShotRecord[];
}

export interface SkillGoals {
  isSkillGoalMet: boolean;
  isTopSkillGoalMet: boolean;
}

export interface ExerciseResult {
  targetPoints: number[];
  hitShare: number;
  total: number;
  exerciseClass: ExerciseClass;
  isAdmitted: boolean;
}

export interface CourseResults {
  isIntroCompleted: boolean;
  bestClasses: Partial<Record<ExerciseId, ExerciseClass>>;
}

export interface FreePlayUnlocks {
  unknownDistance: boolean;
  manualEasy: boolean;
  moaScope: boolean;
  cartridgesAC: boolean;
  gustyWind: boolean;
  manualHard: boolean;
}

export interface CourseProgress {
  admissions: number;
  unlockedIds: ExerciseId[];
  nextExerciseId: ExerciseId | null;
  rank: Rank;
  freePlayUnlocks: FreePlayUnlocks;
}

const TWO_SHOTS: ExerciseStage = { cartridgeId: 'B', maxShotsPerTarget: 2, closesOnHit: true };
const CALM: ScenarioOptions = { windScale: 0, isWindUniform: true };
const LIGHT_WIND: ScenarioOptions = { isWindUniform: true, windSpeedRangeMps: [2, 2.5] };
const MODERATE_WIND: ScenarioOptions = { isWindUniform: true, windSpeedRangeMps: [4, 6] };
const ZONE_WIND: ScenarioOptions = { isWindUniform: false };
const OBLIQUE_CLOCKS = [1, 2, 4, 5, 7, 8, 10, 11];
const KNOWN_DISTANCE_STEP_M = 50;
const UNKNOWN_DISTANCE_STEP_M = 5;
const GONG_DIAMETER_M = 0.5;
const LARGE_GONG_DIAMETER_M = 0.7;
const LARGE_GONG_FROM_M = 600;
const SIGHT_OFFSET_MIL: readonly [number, number] = [0.5, 1.5];
const NO_OFFSET: Correction = { upMrad: 0, rightMrad: 0 };
const ZERO_GROUP_SHOTS = [1, 2, 3];
const ZERO_CONTROL_SHOT = 4;
const ZERO_GROUP_MAX_MIL = 1;
const ZERO_CONTROL_MAX_MIL = 0.3;
const RANGE_TOLERANCE_SECOND_CLASS = 0.1;
const RANGE_TOLERANCE_FIRST_CLASS = 0.05;
const PATROL_MIN_TARGETS_HIT = 7;
const PATROL_TARGETS = 10;
const POINTS_PER_PAPER_HIT = 10;
const DISTANCE_EPSILON_MIL = 1e-9;

export const COURSE: readonly ExerciseDef[] = [
  exerciseDef('00', 'Винтовка и прицел', null, { stages: [], hasColdBore: false, notebookMode: null, conditions: CALM, terms: ['винтовка', 'прицел', 'сетка', 'кратность', 'фокальная плоскость'] }),
  exerciseDef('01', 'Первые щелчки', { count: 3, distance: { kind: 'fixed', distanceM: 300 } }, {
    hasColdBore: false,
    conditions: { ...CALM, temperatureRangeC: [15, 15], pressureRangeHpa: [1013, 1013] },
    terms: ['клик', 'MIL', 'MOA', 'барабан', 'ДОПЕ', 'ZERO STOP'],
  }),
  exerciseDef('02', 'Ноль и холодный ствол', { count: 1, distance: { kind: 'fixed', distanceM: 100 }, diameterM: 0.5 }, {
    stages: [{ cartridgeId: 'B', maxShotsPerTarget: 5, closesOnHit: false }],
    hasKnockedSight: true,
    conditions: CALM,
    terms: ['ноль', 'СТП', 'группа', 'холодный выстрел', 'вызов'],
  }),
  exerciseDef('03', 'Дыхание и спуск', { count: 5, distance: { kind: 'fixed', distanceM: 300 }, diameterM: 0.35 }, { conditions: CALM, terms: ['дыхание', 'спуск', 'затвор', 'пульс'] }),
  exerciseDef('04', 'Флажок на бруствере', { count: 3, distance: { kind: 'fixed', distanceM: 300 } }, {
    conditions: { ...LIGHT_WIND, windClocks: [3, 9] },
    terms: ['ветер', 'правило часов', 'флажок', 'метеостанция', 'боковая составляющая'],
  }),
  exerciseDef('05', 'Дистанции: ДОПЕ и дальномер', { count: 3, distance: { kind: 'unknown', fromM: 300, toM: 600 } }, { conditions: LIGHT_WIND, terms: ['миллинг', 'формула тысячной', 'строка ДОПЕ'] }),
  exerciseDef('06', 'Часы ветра', { count: 4, distance: { kind: 'known', fromM: 400, toM: 500 } }, {
    notebookMode: 'manual-easy',
    conditions: { ...MODERATE_WIND, windClocks: OBLIQUE_CLOCKS },
    terms: ['доля по часам', 'константа ветра', 'САМ'],
  }),
  exerciseDef('07', 'Холодное утро', { count: 4, distance: { kind: 'known', fromM: 500, toM: 600 } }, {
    notebookMode: 'manual-easy',
    conditions: { ...LIGHT_WIND, temperatureRangeC: [-5, 0], pressureRangeHpa: [1025, 1035] },
    terms: ['плотность воздуха', 'эталон +15 / 1013', 'поправка условий'],
  }),
  exerciseDef('08', 'Три патрона', { count: 1, distance: { kind: 'fixed', distanceM: 600 } }, {
    stages: (['A', 'B', 'C'] as const).map(cartridgeId => ({ ...TWO_SHOTS, cartridgeId })),
    notebookMode: 'manual-easy',
    conditions: MODERATE_WIND,
    terms: ['баллистический коэффициент', 'энергия', 'разброс скорости', 'карточка патрона'],
  }),
  exerciseDef('09', 'Флажки по трассе', { count: 4, distance: { kind: 'known', fromM: 500, toM: 700 } }, { notebookMode: 'manual-easy', conditions: ZONE_WIND, terms: ['зоны ветра', 'средний ветер', 'мираж'] }),
  exerciseDef('10', 'Пристрелка на 400', { count: 3, distance: { kind: 'fixed', distanceM: 400 } }, {
    notebookMode: 'manual-hard',
    conditions: LIGHT_WIND,
    terms: ['поправка по второму выстрелу', 'своя карточка', 'вызов'],
  }),
  exerciseDef('11', 'Движущийся дозор', { count: 10, distance: { kind: 'known', fromM: 300, toM: 500 } }, {
    notebookMode: 'manual-easy',
    conditions: LIGHT_WIND,
    terms: ['упреждение', 'сопровождение', 'засада', 'время полёта'],
  }),
  exerciseDef('12', 'Полевой рубеж', { count: 10, distance: { kind: 'unknown', fromM: 200, toM: 700 }, isOutAndBack: true }, { notebookMode: 'manual-easy', conditions: ZONE_WIND, terms: [] }),
];

const SKILL_GOALS: Record<ExerciseId, (run: ExerciseRun) => SkillGoals> = {
  '00': () => ({ isSkillGoalMet: false, isTopSkillGoalMet: false }),
  '01': run => ({ isSkillGoalMet: everyRecord(firstShots(run), record => record.isDialExactFirstTry === true), isTopSkillGoalMet: true }),
  '02': zeroingGoals,
  '03': run => ({
    isSkillGoalMet: everyRecord(run.shots, record => record.diagnosis !== 'execution'),
    isTopSkillGoalMet: everyRecord(run.shots, record => record.isBreathHeld === true),
  }),
  '04': run => ({
    isSkillGoalMet: everyCheck(run, check => check.rowVerdicts['reading-speed'] !== undefined && check.rowVerdicts['reading-speed'] !== 'error'),
    isTopSkillGoalMet: everyCheck(run, check => check.rowVerdicts['turret-windage'] === 'exact'),
  }),
  '05': run => ({
    isSkillGoalMet: everyRecord(run.shots, record => isRangeEstimated(record, RANGE_TOLERANCE_SECOND_CLASS)),
    isTopSkillGoalMet: everyRecord(run.shots, record => isRangeEstimated(record, RANGE_TOLERANCE_FIRST_CLASS)),
  }),
  '06': checkVerdictGoals,
  '07': run => ({
    isSkillGoalMet: everyCheck(run, check => check.rowVerdicts.atmosphere !== undefined && check.rowVerdicts.atmosphere !== 'error'),
    isTopSkillGoalMet: everyCheck(run, check => check.verdict === 'exact'),
  }),
  '08': checkVerdictGoals,
  '09': run => ({
    isSkillGoalMet: everyCheck(run, check => !check.errorTypes.includes('side')),
    isTopSkillGoalMet: everyCheck(run, check => check.verdict === 'exact'),
  }),
  '10': run => ({
    isSkillGoalMet: run.shots.length > 0 && targetShots(run).every(shots => shots.some(record => record.isHit)),
    isTopSkillGoalMet: everyRecord(run.shots, record => record.isCallAccurate === true),
  }),
  '11': patrolGoals,
  '12': run => ({ isSkillGoalMet: run.shots.length > 0 && !run.hasOpenedReference, isTopSkillGoalMet: run.mode === 'manual-hard' }),
};

export function exerciseById(id: ExerciseId): ExerciseDef | undefined {
  return COURSE.find(def => def.id === id);
}

export function setupExercise(def: ExerciseDef, seed: number): ExerciseSetup {
  const random = mulberry32(seed);
  const targets = def.targets ? targetsFor(def, def.targets, random) : [];
  return {
    targets,
    plan: {
      kind: 'exercise',
      hasColdBore: def.hasColdBore,
      stages: def.stages.map(stage => ({ ...stage, targetCount: targets.length })),
    },
    scenarioOptions: def.conditions,
    sightOffset: def.hasKnockedSight ? knockedSightOffset(random) : NO_OFFSET,
  };
}

export function skillGoals(def: ExerciseDef, run: ExerciseRun): SkillGoals {
  return SKILL_GOALS[def.id](run);
}

export function exerciseResult(def: ExerciseDef, run: ExerciseRun): ExerciseResult {
  if (!def.targets) {
    return { targetPoints: [], hitShare: 0, total: 0, exerciseClass: 0, isAdmitted: false };
  }
  const isPaperTarget = def.stages.every(stage => !stage.closesOnHit);
  const shotsByTarget = def.stages.flatMap((stage, stageIndex) =>
    Array.from({ length: def.targets!.count }, (_, targetIndex) =>
      run.shots.filter(record => record.stageIndex === stageIndex && record.targetIndex === targetIndex),
    ),
  );
  const pointsPerTarget = isPaperTarget
    ? shotsByTarget.map(shots => shots.filter(record => record.isHit).length * POINTS_PER_PAPER_HIT)
    : shotsByTarget.map((shots, index) => targetPoints(shots.map(record => record.isHit), def.stages[stageOfTarget(def, index)].maxShotsPerTarget));
  const share = isPaperTarget ? paperHitShare(def, run) : hitShare(pointsPerTarget);
  const calculationPoints = shotsByTarget.flatMap(shots => (shots[0]?.check ? [calcPoints(shots[0].check.verdict)] : []));
  const total = seriesTotal({
    targetPoints: pointsPerTarget,
    calcPoints: calculationPoints,
    multiplier: modeMultiplier(run.mode, false),
    hasOpenedReference: run.hasOpenedReference,
  });
  const goals = skillGoals(def, run);
  const resultClass = exerciseClass({ hitShare: share, isSkillGoalMet: goals.isSkillGoalMet, isTopSkillGoalMet: goals.isTopSkillGoalMet });
  return { targetPoints: pointsPerTarget, hitShare: share, total, exerciseClass: resultClass, isAdmitted: resultClass !== 0 };
}

export function mergeBestClass(previous: ExerciseClass | undefined, next: ExerciseClass): ExerciseClass {
  if (previous === undefined || previous === 0) {
    return next;
  }
  if (next === 0) {
    return previous;
  }
  return Math.min(previous, next) as ExerciseClass;
}

export function courseProgress(results: CourseResults, isEverythingUnlocked = false): CourseProgress {
  const exercises = COURSE.filter(def => def.targets);
  const isAdmitted = (id: ExerciseId): boolean => (results.bestClasses[id] ?? 0) !== 0;
  const admissions = exercises.filter(def => isAdmitted(def.id)).length;
  const isEveryExerciseTopClass = exercises.every(def => results.bestClasses[def.id] === 1);
  const unlockedIds = COURSE.filter((def, index) => {
    if (isEverythingUnlocked || index === 0) {
      return true;
    }
    const previousId = COURSE[index - 1].id;
    return previousId === '00' ? results.isIntroCompleted : isAdmitted(previousId);
  }).map(def => def.id);
  const nextExercise = COURSE.find(def => unlockedIds.includes(def.id) && (def.targets ? !isAdmitted(def.id) : !results.isIntroCompleted));
  const isOpenedBy = (id: ExerciseId): boolean => isEverythingUnlocked || isAdmitted(id);
  return {
    admissions,
    unlockedIds,
    nextExerciseId: nextExercise?.id ?? null,
    rank: rankFor(admissions, isEveryExerciseTopClass),
    freePlayUnlocks: {
      unknownDistance: isOpenedBy('05'),
      manualEasy: isOpenedBy('06'),
      moaScope: isOpenedBy('06'),
      cartridgesAC: isOpenedBy('08'),
      gustyWind: isOpenedBy('09'),
      manualHard: isOpenedBy('10'),
    },
  };
}

function exerciseDef(id: ExerciseId, title: string, targets: ExerciseTargets | null, fields: Partial<Omit<ExerciseDef, 'id' | 'title' | 'targets'>>): ExerciseDef {
  return {
    id,
    title,
    targets,
    stages: [TWO_SHOTS],
    hasColdBore: true,
    hasKnockedSight: false,
    notebookMode: 'auto',
    scopeId: 'tree',
    conditions: {},
    terms: [],
    ...fields,
  };
}

function targetsFor(def: ExerciseDef, targets: ExerciseTargets, random: RandomSource): Target[] {
  const distances = Array.from({ length: targets.count }, () => distanceFor(targets.distance, random));
  const ordered = targets.isOutAndBack ? outAndBack(distances) : distances;
  return ordered.map(distanceM => ({ distanceM, diameterM: targets.diameterM ?? gongDiameterM(distanceM) }));
}

function distanceFor(distance: TargetDistance, random: RandomSource): number {
  switch (distance.kind) {
    case 'fixed':
      return distance.distanceM;
    case 'known':
      return pickStep(distance.fromM, distance.toM, KNOWN_DISTANCE_STEP_M, random);
    case 'unknown': {
      const candidates = steps(distance.fromM, distance.toM, UNKNOWN_DISTANCE_STEP_M).filter(distanceM => distanceM % KNOWN_DISTANCE_STEP_M !== 0);
      return candidates[Math.floor(random() * candidates.length)];
    }
  }
}

function pickStep(fromM: number, toM: number, stepM: number, random: RandomSource): number {
  const candidates = steps(fromM, toM, stepM);
  return candidates[Math.floor(random() * candidates.length)];
}

function steps(fromM: number, toM: number, stepM: number): number[] {
  return Array.from({ length: Math.floor((toM - fromM) / stepM) + 1 }, (_, index) => fromM + index * stepM);
}

function outAndBack(distances: readonly number[]): number[] {
  const sorted = [...distances].sort((a, b) => a - b);
  const outward = sorted.filter((_, index) => index % 2 === 0);
  const back = sorted.filter((_, index) => index % 2 === 1).reverse();
  return [...outward, ...back];
}

function gongDiameterM(distanceM: number): number {
  return distanceM > LARGE_GONG_FROM_M ? LARGE_GONG_DIAMETER_M : GONG_DIAMETER_M;
}

function knockedSightOffset(random: RandomSource): Correction {
  const [minMil, maxMil] = SIGHT_OFFSET_MIL;
  const offsetMil = minMil + random() * (maxMil - minMil);
  const angle = random() * 2 * Math.PI;
  return { upMrad: offsetMil * Math.sin(angle), rightMrad: offsetMil * Math.cos(angle) };
}

function stageOfTarget(def: ExerciseDef, flatIndex: number): number {
  return Math.floor(flatIndex / def.targets!.count);
}

function paperHitShare(def: ExerciseDef, run: ExerciseRun): number {
  const plannedShots = def.stages.reduce((total, stage) => total + stage.maxShotsPerTarget * def.targets!.count, 0);
  return run.shots.filter(record => record.isHit).length / plannedShots;
}

function zeroingGoals(run: ExerciseRun): SkillGoals {
  const groupImpacts = ZERO_GROUP_SHOTS.map(index => run.shots[index]?.impact).filter((impact): impact is Correction => impact !== undefined);
  const coldShot = run.shots[0];
  const controlShot = run.shots[ZERO_CONTROL_SHOT];
  return {
    isSkillGoalMet: groupImpacts.length === ZERO_GROUP_SHOTS.length && extremeSpreadMil(groupImpacts) <= ZERO_GROUP_MAX_MIL + DISTANCE_EPSILON_MIL,
    isTopSkillGoalMet:
      coldShot !== undefined &&
      coldShot.diagnosis !== 'execution' &&
      controlShot !== undefined &&
      Math.hypot(controlShot.impact.upMrad, controlShot.impact.rightMrad) <= ZERO_CONTROL_MAX_MIL + DISTANCE_EPSILON_MIL,
  };
}

function checkVerdictGoals(run: ExerciseRun): SkillGoals {
  return {
    isSkillGoalMet: everyCheck(run, check => check.verdict !== 'error'),
    isTopSkillGoalMet: everyCheck(run, check => check.verdict === 'exact'),
  };
}

function patrolGoals(run: ExerciseRun): SkillGoals {
  const targets = targetShots(run);
  const hitTargets = targets.filter(shots => shots.some(record => record.isHit)).length;
  const hasNoSideError = everyCheck(run, check => !check.errorTypes.includes('side'));
  const isEveryAmbushFirstShot = targets.every(shots => !shots[0].isAmbush || shots[0].isHit);
  return {
    isSkillGoalMet: hitTargets >= PATROL_MIN_TARGETS_HIT && hasNoSideError,
    isTopSkillGoalMet: hitTargets === PATROL_TARGETS && isEveryAmbushFirstShot,
  };
}

function targetShots(run: ExerciseRun): ExerciseShotRecord[][] {
  const byTarget = new Map<string, ExerciseShotRecord[]>();
  for (const record of run.shots) {
    const key = `${record.stageIndex}:${record.targetIndex}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), record]);
  }
  return [...byTarget.values()];
}

function firstShots(run: ExerciseRun): ExerciseShotRecord[] {
  return targetShots(run).map(shots => shots[0]);
}

function everyRecord(records: readonly ExerciseShotRecord[], predicate: (record: ExerciseShotRecord) => boolean): boolean {
  return records.length > 0 && records.every(predicate);
}

function everyCheck(run: ExerciseRun, predicate: (check: ShotCheckSummary) => boolean): boolean {
  return everyRecord(run.shots, record => record.check !== undefined && predicate(record.check));
}

function isRangeEstimated(record: ExerciseShotRecord, toleranceShare: number): boolean {
  return record.rangeEstimateM !== undefined && isRangeWithinTolerance(record.rangeEstimateM, record.distanceM, toleranceShare);
}

function extremeSpreadMil(impacts: readonly Correction[]): number {
  let spreadMil = 0;
  for (const from of impacts) {
    for (const to of impacts) {
      spreadMil = Math.max(spreadMil, Math.hypot(from.upMrad - to.upMrad, from.rightMrad - to.rightMrad));
    }
  }
  return spreadMil;
}
