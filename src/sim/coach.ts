import { CheckErrorType } from '../core/calc-check';
import { isTimedOpen } from './drill-levels';
import type { DrillRoundRecord } from './drill-round';
import { DrillId, DrillLevel } from './drills';
import { SKILL_IDS, SkillId, SkillRatings } from './skill-rating';

export interface SkillPractice {
  skill: SkillId;
  atIso: string;
  isFailure: boolean;
  errorTypes: readonly CheckErrorType[];
}

export interface CoachInput {
  ratings: SkillRatings;
  practices: readonly SkillPractice[];
  rounds: readonly DrillRoundRecord[];
  nowIso: string;
  isEverythingUnlocked: boolean;
}

export type CoachReason =
  | { kind: 'errors'; count: number; topError: CheckErrorType | null }
  | { kind: 'never' }
  | { kind: 'stale'; days: number }
  | { kind: 'weak'; rating: number };

export interface CoachAdvice {
  skill: SkillId;
  drillId: DrillId;
  level: DrillLevel;
  priority: number;
  reason: CoachReason;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 7;
const RECENT_ERRORS_DAYS = 7;
const RECENT_ERRORS_MIN = 2;
const DRILL_OF_SKILL: Record<SkillId, DrillId> = {
  distance: 'milling',
  dope: 'dope',
  wind: 'wind',
  conditions: 'conditions',
  angle: 'angle',
  lead: 'lead',
  execution: 'cold-bore',
  speed: 'timed-stage',
};
export const ERROR_TYPE_ORDER: readonly CheckErrorType[] = ['side', 'substitution', 'arithmetic', 'factor', 'reading', 'lead', 'rounding', 'units', 'turret'];

export function skillPriority(rating: number, daysSincePractice: number | null): number {
  const staleness = daysSincePractice === null ? 1 : Math.min(daysSincePractice / STALE_DAYS, 1);
  return 1 - rating / 100 + staleness;
}

export function coachRanking(input: CoachInput): CoachAdvice[] {
  const nowMs = Date.parse(input.nowIso);
  const advices = SKILL_IDS.map(skill => {
    const practices = input.practices.filter(practice => practice.skill === skill);
    const lastMs = practices.length === 0 ? null : Math.max(...practices.map(practice => Date.parse(practice.atIso)));
    const daysSince = lastMs === null ? null : (nowMs - lastMs) / DAY_MS;
    const rating = input.ratings[skill].rating;
    const drillId = DRILL_OF_SKILL[skill];
    return {
      skill,
      drillId,
      level: isTimedOpen(drillId, input.rounds, false) ? ('timed' as const) : ('learn' as const),
      priority: skillPriority(rating, daysSince),
      reason: coachReason(practices, daysSince, rating, nowMs),
    };
  });
  return advices.sort((first, second) => second.priority - first.priority);
}

export function coachAdvice(input: CoachInput): CoachAdvice {
  return coachRanking(input)[0];
}

function coachReason(practices: readonly SkillPractice[], daysSince: number | null, rating: number, nowMs: number): CoachReason {
  const recentFailures = practices.filter(practice => practice.isFailure && nowMs - Date.parse(practice.atIso) <= RECENT_ERRORS_DAYS * DAY_MS);
  if (recentFailures.length >= RECENT_ERRORS_MIN) {
    return { kind: 'errors', count: recentFailures.length, topError: mostFrequentError(recentFailures.flatMap(practice => practice.errorTypes)) };
  }
  if (daysSince === null) {
    return { kind: 'never' };
  }
  if (daysSince >= STALE_DAYS) {
    return { kind: 'stale', days: Math.floor(daysSince) };
  }
  return { kind: 'weak', rating: Math.round(rating) };
}

function mostFrequentError(errorTypes: readonly CheckErrorType[]): CheckErrorType | null {
  const countOf = (type: CheckErrorType) => errorTypes.filter(errorType => errorType === type).length;
  return ERROR_TYPE_ORDER.reduce<CheckErrorType | null>((top, type) => (countOf(type) > (top === null ? 0 : countOf(top)) ? type : top), null);
}
