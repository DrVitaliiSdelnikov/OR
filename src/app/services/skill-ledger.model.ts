import { DrillRoundRecord } from '../../sim/drill-round';
import { applyAttempts, attemptsFromDrillRound, attemptsFromRoughShot, attemptsFromShot, initialRatings, SKILL_IDS, SkillAttempt, SkillRatings } from '../../sim/skill-rating';
import { JournalSeries, JournalShot } from '../journal/journal.model';

export interface SkillLedger {
  ratings: SkillRatings;
  ratedShots: Record<string, number>;
}

type ReplayEntry = { startedAtIso: string; order: number; rate: (ledger: SkillLedger) => SkillLedger };

const SERIES_BEFORE_ROUND = 0;
const ROUND_AFTER_SERIES = 1;

export function emptyLedger(): SkillLedger {
  return { ratings: initialRatings(), ratedShots: {} };
}

export function attemptsFromJournalShot(shot: JournalShot): SkillAttempt[] {
  return shot.causes && shot.clickMil !== undefined ? attemptsFromShot(shot) : attemptsFromRoughShot(shot);
}

export function withRatedSeries(ledger: SkillLedger, series: JournalSeries, journalIds: readonly string[]): SkillLedger {
  const alreadyRated = ledger.ratedShots[series.id] ?? 0;
  const newAttempts = series.shots.slice(alreadyRated).flatMap(attemptsFromJournalShot);
  const ratedShots: Record<string, number> = { ...ledger.ratedShots, [series.id]: Math.max(alreadyRated, series.shots.length) };
  const keptIds = new Set(journalIds);
  return {
    ratings: applyAttempts(ledger.ratings, newAttempts),
    ratedShots: Object.fromEntries(Object.entries(ratedShots).filter(([id]) => keptIds.has(id))),
  };
}

export function withRatedRound(ledger: SkillLedger, round: DrillRoundRecord): SkillLedger {
  return { ...ledger, ratings: applyAttempts(ledger.ratings, attemptsFromDrillRound(round)) };
}

export function replayedLedger(journal: readonly JournalSeries[], rounds: readonly DrillRoundRecord[]): SkillLedger {
  const journalIds = journal.map(series => series.id);
  const entries: ReplayEntry[] = [
    ...journal.map(series => ({ startedAtIso: series.startedAtIso, order: SERIES_BEFORE_ROUND, rate: (ledger: SkillLedger) => withRatedSeries(ledger, series, journalIds) })),
    ...rounds.map(round => ({ startedAtIso: round.startedAtIso, order: ROUND_AFTER_SERIES, rate: (ledger: SkillLedger) => withRatedRound(ledger, round) })),
  ];
  entries.sort((first, second) => first.startedAtIso.localeCompare(second.startedAtIso) || first.order - second.order);
  return entries.reduce((ledger, entry) => entry.rate(ledger), emptyLedger());
}

export function knownLedger(stored: unknown): SkillLedger | null {
  if (!isRecord(stored) || !isRecord(stored['ratings']) || !isRecord(stored['ratedShots'])) {
    return null;
  }
  const ratings = stored['ratings'];
  const ratedShots = stored['ratedShots'];
  const isEveryRatingKnown = SKILL_IDS.every(skill => isKnownRating(ratings[skill]));
  const isEveryCountKnown = Object.values(ratedShots).every(count => Number.isInteger(count) && (count as number) >= 0);
  return isEveryRatingKnown && isEveryCountKnown ? { ratings: ratings as SkillRatings, ratedShots: ratedShots as Record<string, number> } : null;
}

function isKnownRating(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const { rating, attempts } = value;
  return typeof rating === 'number' && rating >= 0 && rating <= 100 && Number.isInteger(attempts) && (attempts as number) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
