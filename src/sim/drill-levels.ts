import { CheckVerdict } from '../core/calc-check';
import { ExerciseShotRecord } from './course';
import type { DrillCardResult, DrillErrorKind, DrillRoundRecord, DrillRoundSummary } from './drill-round';
import { DrillId, DrillLevel, PositionDrillId } from './drills';

export const TIMED_OPEN_ACCURACY = 0.8;
export const TIMED_OPEN_ROUNDS = 2;

export interface PositionDrillRoundInput {
  drillId: PositionDrillId;
  level: DrillLevel;
  seed: number;
  startedAtIso: string;
  records: readonly ExerciseShotRecord[];
}

export function isTimedOpen(drillId: DrillId, rounds: readonly DrillRoundRecord[], isEverythingUnlocked: boolean): boolean {
  if (isEverythingUnlocked) {
    return true;
  }
  const lastLearnRounds = rounds.filter(round => round.drillId === drillId && round.level === 'learn').slice(-TIMED_OPEN_ROUNDS);
  return lastLearnRounds.length === TIMED_OPEN_ROUNDS && lastLearnRounds.every(round => drillRoundSummary(round.cards).accuracy >= TIMED_OPEN_ACCURACY);
}

export function drillRoundSummary(cards: readonly DrillCardResult[]): DrillRoundSummary {
  const countOf = (verdict: CheckVerdict) => cards.filter(card => card.verdict === verdict).length;
  const errorCounts = new Map<DrillErrorKind, number>();
  for (const kind of cards.flatMap(errorKindsOf)) {
    errorCounts.set(kind, (errorCounts.get(kind) ?? 0) + 1);
  }
  return {
    exact: countOf('exact'),
    close: countOf('close'),
    error: countOf('error'),
    accuracy: cards.length === 0 ? 0 : countOf('exact') / cards.length,
    averageSeconds: cards.length === 0 ? 0 : cards.reduce((total, card) => total + card.seconds, 0) / cards.length,
    errorCounts: [...errorCounts.entries()].map(([type, count]) => ({ type, count })).sort((first, second) => second.count - first.count),
  };
}

export function positionDrillRecord(input: PositionDrillRoundInput): DrillRoundRecord {
  return {
    drillId: input.drillId,
    level: input.level,
    seed: input.seed,
    startedAtIso: input.startedAtIso,
    cards: input.records.map(record => positionCard(record)),
  };
}

function positionCard(record: ExerciseShotRecord): DrillCardResult {
  const card: DrillCardResult = { verdict: record.isHit ? 'exact' : 'error', errorTypes: [], seconds: record.shotSeconds ?? 0 };
  if (record.isTimedOut) {
    return { ...card, isTimedOut: true };
  }
  return !record.isHit && record.mainCause ? { ...card, missCause: record.mainCause } : card;
}

function errorKindsOf(card: DrillCardResult): DrillErrorKind[] {
  if (card.isTimedOut) {
    return ['time'];
  }
  return card.missCause ? [`miss-${card.missCause}`] : card.errorTypes;
}
