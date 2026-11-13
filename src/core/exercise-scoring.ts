import type { CheckVerdict } from './calc-check';

export type NotebookMode = 'auto' | 'manual-easy' | 'manual-hard';
export type ExerciseClass = 0 | 1 | 2 | 3;
export type Rank = 'cadet' | 'rifleman' | 'senior-rifleman' | 'sniper' | 'sniper-instructor';

export interface SeriesTotalInput {
  targetPoints: readonly number[];
  calcPoints: readonly number[];
  multiplier: number;
  hasOpenedReference: boolean;
}

export interface ExerciseClassInput {
  hitShare: number;
  isSkillGoalMet: boolean;
  isTopSkillGoalMet: boolean;
}

export const FIRST_SHOT_POINTS = 10;
export const SECOND_SHOT_POINTS = 5;
const DEFAULT_MAX_SHOTS_PER_TARGET = 2;
const MAX_POINTS_PER_TARGET = FIRST_SHOT_POINTS;
export const REFERENCE_PENALTY = 30;
export const THIRD_CLASS_SHARE = 0.7;
export const SECOND_CLASS_SHARE = 0.85;
export const FIRST_CLASS_SHARE = 1;
const SHARE_EPSILON = 1e-9;
const ROUNDING_EPSILON = 1e-9;
const COURSE_EXERCISES = 12;

const CALC_POINTS: Record<CheckVerdict, number> = { exact: 10, close: 5, error: 0 };
const MODE_MULTIPLIERS: Record<NotebookMode, number> = { auto: 1, 'manual-easy': 1.5, 'manual-hard': 2 };
const RANK_FROM_ADMISSIONS: readonly { minAdmissions: number; rank: Rank }[] = [
  { minAdmissions: 12, rank: 'sniper' },
  { minAdmissions: 7, rank: 'senior-rifleman' },
  { minAdmissions: 3, rank: 'rifleman' },
  { minAdmissions: 0, rank: 'cadet' },
];

export function targetPoints(shotHits: readonly boolean[], maxShotsPerTarget = DEFAULT_MAX_SHOTS_PER_TARGET): number {
  if (shotHits.length > maxShotsPerTarget) {
    throw new RangeError(`${shotHits.length} shots at one target, the exercise allows ${maxShotsPerTarget}`);
  }
  if (shotHits[0]) {
    return FIRST_SHOT_POINTS;
  }
  return shotHits[1] ? SECOND_SHOT_POINTS : 0;
}

export function calcPoints(verdict: CheckVerdict): number {
  return CALC_POINTS[verdict];
}

export function modeMultiplier(mode: NotebookMode, isRepeatAfterRecalc: boolean): number {
  return isRepeatAfterRecalc ? MODE_MULTIPLIERS.auto : MODE_MULTIPLIERS[mode];
}

export function seriesTotal(input: SeriesTotalInput): number {
  const rawTotal = (sum(input.targetPoints) + sum(input.calcPoints)) * input.multiplier;
  const roundedTotal = Math.floor(rawTotal + 0.5 + ROUNDING_EPSILON);
  const penalty = input.hasOpenedReference ? REFERENCE_PENALTY : 0;
  return Math.max(0, roundedTotal - penalty);
}

export function hitShare(pointsPerTarget: readonly number[]): number {
  return pointsPerTarget.length === 0 ? 0 : sum(pointsPerTarget) / (MAX_POINTS_PER_TARGET * pointsPerTarget.length);
}

export function exerciseClass(input: ExerciseClassInput): ExerciseClass {
  if (input.hitShare < THIRD_CLASS_SHARE - SHARE_EPSILON) {
    return 0;
  }
  if (input.hitShare < SECOND_CLASS_SHARE - SHARE_EPSILON || !input.isSkillGoalMet) {
    return 3;
  }
  if (input.hitShare < FIRST_CLASS_SHARE - SHARE_EPSILON || !input.isTopSkillGoalMet) {
    return 2;
  }
  return 1;
}

export function rankFor(admissions: number, isEveryExerciseTopClass: boolean): Rank {
  if (admissions >= COURSE_EXERCISES && isEveryExerciseTopClass) {
    return 'sniper-instructor';
  }
  return RANK_FROM_ADMISSIONS.find(step => admissions >= step.minAdmissions)!.rank;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
