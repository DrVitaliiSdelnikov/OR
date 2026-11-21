import { CheckVerdict } from '../core/calc-check';
import { NotebookMode } from '../core/exercise-scoring';
import { roundToClicks } from '../core/game-formulas';
import { text } from '../i18n';
import type { DrillCardResult, DrillRoundRecord } from './drill-round';
import { drillById, DrillLevel, DrillSkill } from './drills';
import { CauseAmount, CauseKind, MainCause } from './miss-breakdown';

export type SkillId = DrillSkill;
export type AttemptOutcome = 0 | 0.5 | 1;

export interface SkillAttempt {
  skill: SkillId;
  outcome: AttemptOutcome;
  difficulty: number;
}

export interface SkillRating {
  rating: number;
  attempts: number;
}

export type SkillRatings = Record<SkillId, SkillRating>;

export interface ShotForRating {
  distanceM: number;
  windSpeedMps: number;
  mode: NotebookMode;
  isHit: boolean;
  causes?: readonly CauseAmount[];
  clickMil?: number;
  isTimedOut?: boolean;
}

export interface RoughShotForRating extends Omit<ShotForRating, 'causes' | 'clickMil' | 'isTimedOut'> {
  mainCause: MainCause | null;
}

export interface DifficultyInput {
  level: DrillLevel;
  distanceM?: number;
  windSpeedMps?: number;
}

export const SKILL_IDS: readonly SkillId[] = ['distance', 'dope', 'wind', 'conditions', 'angle', 'lead', 'execution', 'speed'];
export const INITIAL_RATING = 40;
export const MAX_STEP = 4;
const ELO_SCALE = 25;
const RATING_MIN = 0;
const RATING_MAX = 100;
const BASE_DIFFICULTY = 15;
const DISTANCE_DIFFICULTY = { fromM: 100, toM: 1000, points: 40 };
const WIND_DIFFICULTY = { toMps: 10, points: 25 };
const TIMED_DIFFICULTY = 20;
const LEVEL_THRESHOLDS: readonly { from: number; name: string }[] = [
  { from: 85, name: text.skills.levels.expert },
  { from: 70, name: text.skills.levels.strong },
  { from: 55, name: text.skills.levels.shooter },
  { from: 40, name: text.skills.levels.amateur },
  { from: -Infinity, name: text.skills.levels.beginner },
];
export const SKILL_OF_CAUSE: Partial<Record<CauseKind, SkillId>> = {
  distance: 'distance',
  dope: 'dope',
  turret: 'dope',
  conditions: 'conditions',
  'wind-speed': 'wind',
  'wind-clock': 'wind',
  zones: 'wind',
  'wind-calc': 'wind',
  angle: 'angle',
  earth: 'angle',
  'lead-calc': 'lead',
  lead: 'lead',
  hold: 'execution',
  trigger: 'execution',
  zero: 'execution',
};
const SKILL_OF_MAIN_CAUSE: Record<MainCause, SkillId> = {
  calc: 'dope',
  'wind-under': 'wind',
  'wind-over': 'wind',
  lead: 'lead',
  hold: 'execution',
  trigger: 'execution',
  zero: 'execution',
};
const OUTCOME_OF_VERDICT: Record<CheckVerdict, AttemptOutcome> = { exact: 1, close: 0.5, error: 0 };

export function initialRatings(): SkillRatings {
  return Object.fromEntries(SKILL_IDS.map(skill => [skill, { rating: INITIAL_RATING, attempts: 0 }])) as SkillRatings;
}

export function expectedOutcome(rating: number, difficulty: number): number {
  return 1 / (1 + 10 ** ((difficulty - rating) / ELO_SCALE));
}

export function applyAttempt(ratings: SkillRatings, attempt: SkillAttempt): SkillRatings {
  const current = ratings[attempt.skill];
  const step = MAX_STEP * (attempt.outcome - expectedOutcome(current.rating, attempt.difficulty));
  const rating = Math.min(RATING_MAX, Math.max(RATING_MIN, current.rating + step));
  return { ...ratings, [attempt.skill]: { rating, attempts: current.attempts + 1 } };
}

export function applyAttempts(ratings: SkillRatings, attempts: readonly SkillAttempt[]): SkillRatings {
  return attempts.reduce(applyAttempt, ratings);
}

export function attemptDifficulty(input: DifficultyInput): number {
  const distanceShare = input.distanceM === undefined ? 0 : clampShare((input.distanceM - DISTANCE_DIFFICULTY.fromM) / (DISTANCE_DIFFICULTY.toM - DISTANCE_DIFFICULTY.fromM));
  const windShare = input.windSpeedMps === undefined ? 0 : clampShare(input.windSpeedMps / WIND_DIFFICULTY.toMps);
  const timed = input.level === 'timed' ? TIMED_DIFFICULTY : 0;
  return BASE_DIFFICULTY + distanceShare * DISTANCE_DIFFICULTY.points + windShare * WIND_DIFFICULTY.points + timed;
}

export function attemptsFromShot(shot: ShotForRating): SkillAttempt[] {
  if (!shot.causes || shot.clickMil === undefined || shot.isTimedOut) {
    return [];
  }
  const difficulty = shotDifficulty(shot);
  const worstClicks = new Map<SkillId, number>();
  const involve = (skill: SkillId, clicks = 0) => worstClicks.set(skill, Math.max(worstClicks.get(skill) ?? 0, clicks));
  alwaysInvolvedSkills(shot).forEach(skill => involve(skill));
  for (const cause of shot.causes) {
    const skill = SKILL_OF_CAUSE[cause.kind];
    if (skill) {
      involve(skill, Math.abs(roundToClicks(cause.mil, shot.clickMil)));
    }
  }
  return SKILL_IDS.filter(skill => worstClicks.has(skill)).map(skill => ({
    skill,
    outcome: skill === 'execution' && shot.isHit ? 1 : outcomeOfClicks(worstClicks.get(skill)!),
    difficulty,
  }));
}

export function attemptsFromRoughShot(shot: RoughShotForRating): SkillAttempt[] {
  const difficulty = shotDifficulty(shot);
  if (shot.isHit) {
    const involved = alwaysInvolvedSkills(shot);
    return SKILL_IDS.filter(skill => involved.includes(skill)).map(skill => ({ skill, outcome: 1, difficulty }));
  }
  return shot.mainCause ? [{ skill: SKILL_OF_MAIN_CAUSE[shot.mainCause], outcome: 0, difficulty }] : [];
}

export function attemptsFromDrillRound(round: DrillRoundRecord): SkillAttempt[] {
  const drill = drillById(round.drillId)!;
  const isTimed = round.level === 'timed';
  return round.cards.flatMap(card => {
    const difficulty = attemptDifficulty({ level: round.level, distanceM: card.distanceM, windSpeedMps: card.windSpeedMps });
    if (drill.kind === 'position') {
      return isTimed ? [{ skill: 'speed' as const, outcome: positionSpeedOutcome(card), difficulty }] : [];
    }
    const outcome = card.isTimedOut ? 0 : OUTCOME_OF_VERDICT[card.verdict];
    const skillAttempt: SkillAttempt = { skill: drill.skill, outcome, difficulty };
    return isTimed ? [skillAttempt, { skill: 'speed', outcome, difficulty }] : [skillAttempt];
  });
}

export function overallLevel(ratings: SkillRatings): { value: number; name: string } | null {
  const rated = SKILL_IDS.map(skill => ratings[skill]).filter(skill => skill.attempts > 0);
  if (rated.length === 0) {
    return null;
  }
  const value = rated.reduce((total, skill) => total + skill.rating, 0) / rated.length;
  return { value, name: LEVEL_THRESHOLDS.find(threshold => value >= threshold.from)!.name };
}

function shotDifficulty(shot: Pick<ShotForRating, 'distanceM' | 'windSpeedMps'>): number {
  return attemptDifficulty({ level: 'learn', distanceM: shot.distanceM, windSpeedMps: shot.windSpeedMps });
}

function alwaysInvolvedSkills(shot: Pick<ShotForRating, 'windSpeedMps' | 'mode'>): SkillId[] {
  return ['execution', ...(shot.windSpeedMps > 0 ? ['wind' as const] : []), ...(shot.mode !== 'auto' ? ['dope' as const] : [])];
}

function outcomeOfClicks(clicks: number): AttemptOutcome {
  if (clicks === 0) {
    return 1;
  }
  return clicks === 1 ? 0.5 : 0;
}

function positionSpeedOutcome(card: DrillCardResult): AttemptOutcome {
  if (card.isTimedOut) {
    return 0;
  }
  return card.verdict === 'exact' ? 1 : 0.5;
}

function clampShare(share: number): number {
  return Math.min(1, Math.max(0, share));
}
