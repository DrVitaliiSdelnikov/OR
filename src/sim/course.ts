import type { DrillLevel, PositionDrillId } from './drills';
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
  REFERENCE_PENALTY,
  seriesTotal,
  targetPoints,
} from '../core/exercise-scoring';
import { isRangeWithinTolerance } from '../core/game-formulas';
import { mulberry32, RandomSource } from '../core/rng';
import { ScenarioOptions } from '../core/scenario';
import { CartridgeId, Correction, Loadout, Target } from '../core/types';
import { fromInput, inSystem, toDisplay, UnitSystem } from '../core/units';
import { FiringPlan } from './firing-line';
import { PatrolTarget, patrolPlan } from './patrol';
import { FreePlayScopeUnlocks, ScopeId, ScopeModel } from './scope-model';
import { CauseAmount, MainCause } from './miss-breakdown';
import { CALL_TOLERANCE_MIL, ShotDiagnosis } from './shot-review';
import { text } from '../i18n';

export type ExerciseId = '00' | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14';

export type TargetDistance =
  | { kind: 'fixed'; distanceM: number }
  | { kind: 'known'; fromM: number; toM: number }
  | { kind: 'unknown'; fromM: number; toM: number };

export interface ExerciseTargets {
  count: number;
  distance: TargetDistance;
  diameterM?: number;
  isOutAndBack?: boolean;
  isLadder?: boolean;
}

export interface ExerciseStage {
  cartridgeId: CartridgeId;
  maxShotsPerTarget: number;
  closesOnHit: boolean;
}

export interface PositionTask {
  kind: 'exercise' | 'free';
  title: string;
  targets: ExerciseTargets | null;
  stages: readonly ExerciseStage[];
  hasColdBore: boolean;
  hasKnockedSight: boolean;
  hasPatrol: boolean;
  trigger: 'tap' | 'pressure';
  notebookMode: NotebookMode | null;
  modeChoices?: readonly NotebookMode[];
  scopeId: ScopeId;
  conditions: ScenarioOptions;
  rifle?: OwnRifle;
  drill?: PositionDrillTag;
}

export interface PositionDrillTag {
  id: PositionDrillId;
  level: DrillLevel;
}

export interface OwnRifle {
  loadout: Loadout;
  scope: ScopeModel;
}

export interface ExerciseDef extends PositionTask {
  kind: 'exercise';
  id: ExerciseId;
  terms: readonly string[];
  goals: ExerciseGoalTexts;
  novelty: string | null;
}

export interface FreePlayTask extends PositionTask {
  kind: 'free';
}

export interface ExerciseGoalTexts {
  second: string;
  first: string | null;
}

export interface ExerciseSetup {
  targets: Target[];
  plan: FiringPlan;
  scenarioOptions: ScenarioOptions;
  sightOffset: Correction;
  patrol?: PatrolTarget[];
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
  isLeadBackward?: boolean;
  mainCause?: MainCause | null;
  causes?: CauseAmount[];
  clickMil?: number;
  windSpeedMps?: number;
  isTimedOut?: boolean;
  shotSeconds?: number;
}

export interface ExerciseRun {
  mode: NotebookMode;
  hasOpenedReference: boolean;
  shots: readonly ExerciseShotRecord[];
  isRepeatAfterRecalc?: boolean;
}

export interface GoalCheck {
  isMet: boolean;
  passed?: number;
  total?: number;
  valueMil?: number;
  limitMil?: number;
}

export interface SkillGoals {
  skill: GoalCheck;
  top: GoalCheck;
}

export interface ScoreParts {
  targetSum: number;
  calcSum: number;
  multiplier: number;
  referencePenalty: number;
}

export interface ExerciseResult {
  targetPoints: number[];
  hitShare: number;
  total: number;
  exerciseClass: ExerciseClass;
  isAdmitted: boolean;
  score: ScoreParts;
  goals: SkillGoals;
}

export interface CourseResults {
  isIntroCompleted: boolean;
  bestClasses: Partial<Record<ExerciseId, ExerciseClass>>;
  bestTotals?: Partial<Record<ExerciseId, number>>;
}

export interface FreePlayUnlocks extends FreePlayScopeUnlocks {
  unknownDistance: boolean;
  manualEasy: boolean;
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

const MIL_DOT_FROM_EXERCISE = 6;
const LAST_TAP_TRIGGER_EXERCISE = 2;
const TWO_SHOTS: ExerciseStage = { cartridgeId: 'B', maxShotsPerTarget: 2, closesOnHit: true };
const CALM: ScenarioOptions = { windScale: 0, isWindUniform: true };
const LIGHT_WIND: ScenarioOptions = { isWindUniform: true, windSpeedRangeMps: [2, 2.5] };
const MODERATE_WIND: ScenarioOptions = { isWindUniform: true, windSpeedRangeMps: [4, 6] };
const ZONE_WIND: ScenarioOptions = { isWindUniform: false };
const OBLIQUE_CLOCKS = [1, 2, 4, 5, 7, 8, 10, 11];
const MOUNTAIN_SLOPE: ScenarioOptions = { lookAngleRangeDeg: [10, 25], isLookAngleEitherWay: true, altitudeRangeM: [1000, 1500] };
const EARTH_ROTATION: ScenarioOptions = { isSpinDriftOn: true, coriolisLatitudeRangeDeg: [40, 60] };
const KNOWN_DISTANCE_STEP = 50;
const UNKNOWN_DISTANCE_STEP = 5;
const FIXED_DISTANCE_STEP = 25;
const MAX_DISTANCE_IN_SYSTEM = 1000;
const SAME_DISTANCE_EPSILON = 1e-6;
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
const BREATHING_TARGETS = 5;
const CONFIRM_ZERO_DISTANCE_M = 400;
const POINTS_PER_PAPER_HIT = 10;
const DISTANCE_EPSILON_MIL = 1e-9;
const MET: GoalCheck = { isMet: true };
const NOT_MET: GoalCheck = { isMet: false };
const EARTH_ROTATION_STEPS: readonly CheckRowKind[] = ['spin', 'coriolis', 'eotvos'];
const NO_SCORE: ScoreParts = { targetSum: 0, calcSum: 0, multiplier: 1, referencePenalty: 0 };

const GOALS = text.content.goals;
const GOAL_TEXTS: Record<ExerciseId, ExerciseGoalTexts> = {
  ...GOALS,
  '02': GOALS['02']({
    groupFirstShot: ZERO_GROUP_SHOTS[0] + 1,
    groupLastShot: ZERO_GROUP_SHOTS[ZERO_GROUP_SHOTS.length - 1] + 1,
    groupMaxMil: ZERO_GROUP_MAX_MIL,
    controlMaxMil: ZERO_CONTROL_MAX_MIL,
  }),
  '03': GOALS['03']({ targets: BREATHING_TARGETS }),
  '05': GOALS['05']({ secondClassTolerance: RANGE_TOLERANCE_SECOND_CLASS, firstClassTolerance: RANGE_TOLERANCE_FIRST_CLASS }),
  '10': GOALS['10']({ callToleranceMil: CALL_TOLERANCE_MIL }),
  '11': GOALS['11']({ minTargetsHit: PATROL_MIN_TARGETS_HIT, targets: PATROL_TARGETS }),
};

const TITLES = text.content.exerciseTitles;

export const FIRST_FIRING_EXERCISE_ID: ExerciseId = '01';
export const ATTESTATION_ID: ExerciseId = '12';
const INTRO_ID: ExerciseId = '00';
const ALL_FREE_PLAY_OPEN: FreePlayUnlocks = {
  unknownDistance: true,
  manualEasy: true,
  moaScope: true,
  milDotScope: true,
  longRangeScope: true,
  secondFocalPlaneScope: true,
  cartridgesAC: true,
  gustyWind: true,
  manualHard: true,
};

export const COURSE: readonly ExerciseDef[] = [
  exerciseDef('00', TITLES['00'], null, { stages: [], hasColdBore: false, notebookMode: null, conditions: CALM }),
  exerciseDef('01', TITLES['01'], { count: 3, distance: { kind: 'fixed', distanceM: 300 } }, {
    hasColdBore: false,
    conditions: { ...CALM, temperatureRangeC: [15, 15], pressureRangeHpa: [1013, 1013] },
  }),
  exerciseDef('02', TITLES['02'], { count: 1, distance: { kind: 'fixed', distanceM: 100 }, diameterM: 0.5 }, {
    stages: [{ cartridgeId: 'B', maxShotsPerTarget: 5, closesOnHit: false }],
    hasKnockedSight: true,
    conditions: CALM,
  }),
  exerciseDef('03', TITLES['03'], { count: BREATHING_TARGETS, distance: { kind: 'fixed', distanceM: 300 }, diameterM: 0.35 }, { conditions: CALM }),
  exerciseDef('04', TITLES['04'], { count: 3, distance: { kind: 'fixed', distanceM: 300 } }, {
    conditions: { ...LIGHT_WIND, windClocks: [3, 9] },
  }),
  exerciseDef('05', TITLES['05'], { count: 3, distance: { kind: 'unknown', fromM: 300, toM: 600 } }, { conditions: LIGHT_WIND }),
  exerciseDef('06', TITLES['06'], { count: 4, distance: { kind: 'known', fromM: 400, toM: 500 } }, {
    notebookMode: 'manual-easy',
    conditions: { ...MODERATE_WIND, windClocks: OBLIQUE_CLOCKS },
  }),
  exerciseDef('07', TITLES['07'], { count: 4, distance: { kind: 'known', fromM: 500, toM: 600 } }, {
    notebookMode: 'manual-easy',
    conditions: { ...LIGHT_WIND, temperatureRangeC: [-5, 0], pressureRangeHpa: [1025, 1035] },
  }),
  exerciseDef('08', TITLES['08'], { count: 1, distance: { kind: 'fixed', distanceM: 600 } }, {
    stages: (['A', 'B', 'C'] as const).map(cartridgeId => ({ ...TWO_SHOTS, cartridgeId })),
    notebookMode: 'manual-easy',
    conditions: MODERATE_WIND,
  }),
  exerciseDef('09', TITLES['09'], { count: 4, distance: { kind: 'known', fromM: 500, toM: 700 } }, { notebookMode: 'manual-easy', conditions: ZONE_WIND }),
  exerciseDef('10', TITLES['10']({ distance: CONFIRM_ZERO_DISTANCE_M }), { count: 3, distance: { kind: 'fixed', distanceM: CONFIRM_ZERO_DISTANCE_M } }, {
    notebookMode: 'manual-hard',
    conditions: LIGHT_WIND,
  }),
  exerciseDef('11', TITLES['11'], { count: PATROL_TARGETS, distance: { kind: 'known', fromM: 300, toM: 500 } }, {
    hasPatrol: true,
    notebookMode: 'manual-easy',
    conditions: LIGHT_WIND,
  }),
  exerciseDef('12', TITLES['12'], { count: 10, distance: { kind: 'unknown', fromM: 200, toM: 700 }, isOutAndBack: true }, {
    notebookMode: 'manual-easy',
    modeChoices: ['manual-easy', 'manual-hard'],
    conditions: ZONE_WIND,
  }),
  exerciseDef('13', TITLES['13'], { count: 4, distance: { kind: 'known', fromM: 400, toM: 700 } }, {
    notebookMode: 'manual-easy',
    conditions: { ...LIGHT_WIND, ...MOUNTAIN_SLOPE },
  }),
  exerciseDef('14', TITLES['14'], { count: 4, distance: { kind: 'known', fromM: 800, toM: 1000 } }, {
    notebookMode: 'manual-easy',
    conditions: { ...LIGHT_WIND, ...EARTH_ROTATION },
  }),
];

const SKILL_GOALS: Record<ExerciseId, (run: ExerciseRun) => SkillGoals> = {
  '00': () => ({ skill: NOT_MET, top: NOT_MET }),
  '01': run => ({ skill: tally(firstShots(run), record => record.isDialExactFirstTry === true), top: MET }),
  '02': zeroingGoals,
  '03': run => ({
    skill: tally(run.shots, record => record.diagnosis !== 'execution'),
    top: tally(run.shots, record => record.isBreathHeld === true),
  }),
  '04': run => ({
    skill: tallyChecks(run, check => check.rowVerdicts['reading-speed'] !== undefined && check.rowVerdicts['reading-speed'] !== 'error'),
    top: tallyChecks(run, check => check.rowVerdicts['turret-windage'] === 'exact'),
  }),
  '05': run => ({
    skill: tally(run.shots, record => isRangeEstimated(record, RANGE_TOLERANCE_SECOND_CLASS)),
    top: tally(run.shots, record => isRangeEstimated(record, RANGE_TOLERANCE_FIRST_CLASS)),
  }),
  '06': checkVerdictGoals,
  '07': run => ({
    skill: tallyChecks(run, check => check.rowVerdicts.atmosphere !== undefined && check.rowVerdicts.atmosphere !== 'error'),
    top: tallyChecks(run, check => check.verdict === 'exact'),
  }),
  '08': checkVerdictGoals,
  '09': run => ({
    skill: tallyChecks(run, check => !check.errorTypes.includes('side')),
    top: tallyChecks(run, check => check.verdict === 'exact'),
  }),
  '10': run => ({
    skill: tally(targetShots(run), shots => shots.some(record => record.isHit)),
    top: tally(run.shots, record => record.isCallAccurate === true),
  }),
  '11': patrolGoals,
  '12': run => ({ skill: { isMet: run.shots.length > 0 && !run.hasOpenedReference }, top: { isMet: run.mode === 'manual-hard' } }),
  '13': run => ({
    skill: tallyChecks(run, check => isStepWithoutError(check, 'angle')),
    top: tallyChecks(run, check => check.verdict === 'exact' && check.rowVerdicts.angle !== undefined),
  }),
  '14': run => ({
    skill: tallyChecks(run, check => isStepWithoutError(check, 'spin') && isStepWithoutError(check, 'coriolis')),
    top: tallyChecks(run, check => check.verdict === 'exact' && EARTH_ROTATION_STEPS.every(step => check.rowVerdicts[step] !== undefined)),
  }),
};

export function withChosenMode<T extends PositionTask>(def: T, mode: NotebookMode | undefined): T {
  return mode && def.modeChoices?.includes(mode) ? { ...def, notebookMode: mode } : def;
}

export function isExerciseTask(task: PositionTask): task is ExerciseDef {
  return task.kind === 'exercise';
}

export function exerciseById(id: ExerciseId): ExerciseDef | undefined {
  return COURSE.find(def => def.id === id);
}

export function exerciseTitle(def: ExerciseDef, system: UnitSystem): string {
  return def.id === '10' ? TITLES['10']({ distance: roundToStep(inSystem('distance', CONFIRM_ZERO_DISTANCE_M, system), FIXED_DISTANCE_STEP) }) : def.title;
}

export function setupTask(def: PositionTask, seed: number, system: UnitSystem = 'metric'): ExerciseSetup {
  const random = mulberry32(seed);
  const targets = def.targets ? targetsFor(def.targets, random, system) : [];
  return {
    targets,
    plan:
      def.kind === 'free' && !def.drill
        ? { kind: 'free', cartridgeId: def.stages[0].cartridgeId }
        : { kind: 'exercise', hasColdBore: def.hasColdBore, stages: def.stages.map(stage => ({ ...stage, targetCount: targets.length })) },
    scenarioOptions: def.conditions,
    sightOffset: def.hasKnockedSight ? knockedSightOffset(random) : NO_OFFSET,
    ...(def.hasPatrol ? { patrol: patrolPlan(seed) } : {}),
  };
}

export function skillGoals(def: ExerciseDef, run: ExerciseRun): SkillGoals {
  return SKILL_GOALS[def.id](run);
}

export function exerciseResult(def: ExerciseDef, run: ExerciseRun): ExerciseResult {
  if (!def.targets) {
    return { targetPoints: [], hitShare: 0, total: 0, exerciseClass: 0, isAdmitted: false, score: NO_SCORE, goals: { skill: NOT_MET, top: NOT_MET } };
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
    multiplier: modeMultiplier(run.mode, run.isRepeatAfterRecalc === true),
    hasOpenedReference: run.hasOpenedReference,
  });
  const goals = skillGoals(def, run);
  const resultClass = exerciseClass({ hitShare: share, isSkillGoalMet: goals.skill.isMet, isTopSkillGoalMet: goals.top.isMet });
  const score: ScoreParts = {
    targetSum: sumOf(pointsPerTarget),
    calcSum: sumOf(calculationPoints),
    multiplier: modeMultiplier(run.mode, run.isRepeatAfterRecalc === true),
    referencePenalty: run.hasOpenedReference ? REFERENCE_PENALTY : 0,
  };
  return { targetPoints: pointsPerTarget, hitShare: share, total, exerciseClass: resultClass, isAdmitted: resultClass !== 0, score, goals };
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
  const exercises = COURSE.slice(0, COURSE.findIndex(def => def.id === ATTESTATION_ID) + 1).filter(def => def.targets);
  const isAdmitted = (id: ExerciseId): boolean => (results.bestClasses[id] ?? 0) !== 0;
  const admissions = exercises.filter(def => isAdmitted(def.id)).length;
  const isEveryExerciseTopClass = exercises.every(def => results.bestClasses[def.id] === 1);
  const unlockedIds = COURSE.filter((def, index) => {
    if (isEverythingUnlocked || index === 0) {
      return true;
    }
    const previousId = COURSE[index - 1].id;
    return previousId === INTRO_ID || isAdmitted(previousId);
  }).map(def => def.id);
  const nextExercise = COURSE.find(def => unlockedIds.includes(def.id) && (def.targets ? !isAdmitted(def.id) : !results.isIntroCompleted));
  return {
    admissions,
    unlockedIds,
    nextExerciseId: nextExercise?.id ?? null,
    rank: rankFor(admissions, isEveryExerciseTopClass),
    freePlayUnlocks: ALL_FREE_PLAY_OPEN,
  };
}

function exerciseDef(id: ExerciseId, title: string, targets: ExerciseTargets | null, fields: Partial<Omit<ExerciseDef, 'kind' | 'id' | 'title' | 'targets' | 'goals' | 'novelty' | 'terms'>>): ExerciseDef {
  return {
    kind: 'exercise',
    id,
    title,
    targets,
    goals: GOAL_TEXTS[id],
    novelty: text.content.novelties[id],
    terms: text.content.exerciseTerms[id],
    stages: [TWO_SHOTS],
    hasColdBore: true,
    hasKnockedSight: false,
    hasPatrol: false,
    trigger: Number(id) <= LAST_TAP_TRIGGER_EXERCISE ? 'tap' : 'pressure',
    notebookMode: 'auto',
    scopeId: Number(id) >= MIL_DOT_FROM_EXERCISE ? 'course-dot' : 'course-tree',
    conditions: {},
    ...fields,
  };
}

function targetsFor(targets: ExerciseTargets, random: RandomSource, system: UnitSystem): Target[] {
  const distances = targets.isLadder ? ladderDistances(targets, system) : Array.from({ length: targets.count }, () => distanceFor(targets.distance, random, system));
  const ordered = targets.isOutAndBack ? outAndBack(distances) : distances;
  return ordered.map(distanceM => ({ distanceM, diameterM: targetDiameterM(targets, distanceM, system) }));
}

function ladderDistances(targets: ExerciseTargets, system: UnitSystem): number[] {
  const distance = targets.distance;
  if (distance.kind === 'fixed') {
    return Array.from({ length: targets.count }, () => distance.distanceM);
  }
  const { from, to } = distanceBoundsIn(system, distance.fromM, distance.toM);
  const rungStep = targets.count > 1 ? (to - from) / (targets.count - 1) : 0;
  return Array.from({ length: targets.count }, (_, index) => fromInput('distance', from + index * rungStep, system));
}

export function distanceBoundsIn(system: UnitSystem, fromM: number, toM: number): { from: number; to: number } {
  return {
    from: roundToStep(inSystem('distance', fromM, system), KNOWN_DISTANCE_STEP),
    to: Math.min(MAX_DISTANCE_IN_SYSTEM, roundToStep(inSystem('distance', toM, system), KNOWN_DISTANCE_STEP)),
  };
}

export function targetDistanceIn(distance: TargetDistance, system: UnitSystem): TargetDistance {
  const toMetres = (value: number): number => fromInput('distance', value, system);
  if (distance.kind === 'fixed') {
    return { kind: 'fixed', distanceM: toMetres(roundToStep(inSystem('distance', distance.distanceM, system), FIXED_DISTANCE_STEP)) };
  }
  const { from, to } = distanceBoundsIn(system, distance.fromM, distance.toM);
  return { kind: distance.kind, fromM: toMetres(from), toM: toMetres(to) };
}

export function targetDiameterM(targets: ExerciseTargets, distanceM: number, system: UnitSystem): number {
  return diameterIn(system, targets.diameterM ?? gongDiameterM(distanceM, system));
}

function distanceFor(distance: TargetDistance, random: RandomSource, system: UnitSystem): number {
  const toMetres = (value: number): number => fromInput('distance', value, system);
  switch (distance.kind) {
    case 'fixed':
      return toMetres(roundToStep(inSystem('distance', distance.distanceM, system), FIXED_DISTANCE_STEP));
    case 'known': {
      const { from, to } = distanceBoundsIn(system, distance.fromM, distance.toM);
      return toMetres(pickStep(from, to, KNOWN_DISTANCE_STEP, random));
    }
    case 'unknown': {
      const { from, to } = distanceBoundsIn(system, distance.fromM, distance.toM);
      const candidates = steps(from, to, UNKNOWN_DISTANCE_STEP).filter(value => value % KNOWN_DISTANCE_STEP !== 0);
      return toMetres(candidates[Math.floor(random() * candidates.length)]);
    }
  }
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function pickStep(from: number, to: number, step: number, random: RandomSource): number {
  const candidates = steps(from, to, step);
  return candidates[Math.floor(random() * candidates.length)];
}

function steps(from: number, to: number, step: number): number[] {
  return Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, index) => from + index * step);
}

function outAndBack(distances: readonly number[]): number[] {
  const sorted = [...distances].sort((a, b) => a - b);
  const outward = sorted.filter((_, index) => index % 2 === 0);
  const back = sorted.filter((_, index) => index % 2 === 1).reverse();
  return [...outward, ...back];
}

function gongDiameterM(distanceM: number, system: UnitSystem): number {
  const largeFrom = roundToStep(inSystem('distance', LARGE_GONG_FROM_M, system), KNOWN_DISTANCE_STEP);
  return inSystem('distance', distanceM, system) > largeFrom + SAME_DISTANCE_EPSILON ? LARGE_GONG_DIAMETER_M : GONG_DIAMETER_M;
}

function diameterIn(system: UnitSystem, diameterM: number): number {
  return fromInput('targetSize', toDisplay('targetSize', diameterM, system), system);
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
  const isGroupComplete = groupImpacts.length === ZERO_GROUP_SHOTS.length;
  const groupSpreadMil = isGroupComplete ? extremeSpreadMil(groupImpacts) : undefined;
  const controlMissMil = controlShot ? Math.hypot(controlShot.impact.upMrad, controlShot.impact.rightMrad) : undefined;
  return {
    skill: {
      isMet: groupSpreadMil !== undefined && groupSpreadMil <= ZERO_GROUP_MAX_MIL + DISTANCE_EPSILON_MIL,
      ...(groupSpreadMil !== undefined ? { valueMil: groupSpreadMil } : {}),
      limitMil: ZERO_GROUP_MAX_MIL,
    },
    top: {
      isMet: coldShot !== undefined && coldShot.diagnosis !== 'execution' && controlMissMil !== undefined && controlMissMil <= ZERO_CONTROL_MAX_MIL + DISTANCE_EPSILON_MIL,
      ...(controlMissMil !== undefined ? { valueMil: controlMissMil } : {}),
      limitMil: ZERO_CONTROL_MAX_MIL,
    },
  };
}

function checkVerdictGoals(run: ExerciseRun): SkillGoals {
  return {
    skill: tallyChecks(run, check => check.verdict !== 'error'),
    top: tallyChecks(run, check => check.verdict === 'exact'),
  };
}

function patrolGoals(run: ExerciseRun): SkillGoals {
  const targets = targetShots(run);
  const hitTargets = targets.filter(shots => shots.some(record => record.isHit)).length;
  const hasNoBackwardLead = run.shots.every(record => !record.isLeadBackward);
  const isEveryAmbushFirstShot = targets.every(shots => !shots[0].isAmbush || shots[0].isHit);
  return {
    skill: { isMet: hitTargets >= PATROL_MIN_TARGETS_HIT && hasNoBackwardLead, passed: hitTargets, total: PATROL_TARGETS },
    top: { isMet: hitTargets === PATROL_TARGETS && isEveryAmbushFirstShot, passed: hitTargets, total: PATROL_TARGETS },
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

function tally<T>(items: readonly T[], predicate: (item: T) => boolean): GoalCheck {
  const passed = items.filter(predicate).length;
  return { isMet: items.length > 0 && passed === items.length, passed, total: items.length };
}

function isStepWithoutError(check: ShotCheckSummary, step: CheckRowKind): boolean {
  const verdict = check.rowVerdicts[step];
  return verdict !== undefined && verdict !== 'error';
}

function tallyChecks(run: ExerciseRun, predicate: (check: ShotCheckSummary) => boolean): GoalCheck {
  return tally(run.shots, record => record.check !== undefined && predicate(record.check));
}

function sumOf(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
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
