import { text } from '../../i18n';
import { CoachAdvice, coachAdvice, CoachReason, SkillPractice } from '../../sim/coach';
import { DrillRoundRecord } from '../../sim/drill-round';
import { drillById, drillTitle } from '../../sim/drills';
import { attemptsFromDrillRound, SkillAttempt, SkillRatings } from '../../sim/skill-rating';
import { JournalSeries } from '../journal/journal.model';
import { attemptsFromJournalShot } from '../services/skill-ledger.model';
import { DrillLink, drillLink } from './drill-cards.model';

export interface CoachView {
  title: string;
  drill: string;
  reason: string;
  link: DrillLink;
}

export interface CoachProgress {
  journal: readonly JournalSeries[];
  rounds: readonly DrillRoundRecord[];
  ratings: SkillRatings;
  isEverythingUnlocked: boolean;
  nowIso: string;
}

const T = text.instructor.coach;

export function progressCoachView(progress: CoachProgress): CoachView {
  const { journal, rounds, ratings, isEverythingUnlocked, nowIso } = progress;
  return coachView(coachAdvice({ ratings, practices: skillPractices(journal, rounds), rounds, nowIso, isEverythingUnlocked }));
}

export function skillPractices(journal: readonly JournalSeries[], rounds: readonly DrillRoundRecord[]): SkillPractice[] {
  const fromSeries = journal.flatMap(series => series.shots.flatMap(attemptsFromJournalShot).map(attempt => practiceOf(attempt, series.startedAtIso)));
  return [...fromSeries, ...rounds.flatMap(roundPractices)];
}

export function coachView(advice: CoachAdvice): CoachView {
  return {
    title: T.title({ skill: text.drills.skills[advice.skill] }),
    drill: T.drill({ title: drillTitle(advice.drillId), level: T.levels[advice.level] }),
    reason: reasonText(advice.reason),
    link: drillLink(advice.drillId, advice.level),
  };
}

function roundPractices(round: DrillRoundRecord): SkillPractice[] {
  const drill = drillById(round.drillId)!;
  const atIso = round.startedAtIso;
  if (drill.kind === 'position') {
    return [{ skill: drill.skill, atIso, isFailure: false, errorTypes: [] }, ...attemptsFromDrillRound(round).map(attempt => practiceOf(attempt, atIso))];
  }
  return round.cards.flatMap(card => {
    const isFailure = card.isTimedOut === true || card.verdict === 'error';
    const cardPractice: SkillPractice = { skill: drill.skill, atIso, isFailure, errorTypes: card.errorTypes };
    return round.level === 'timed' ? [cardPractice, { skill: 'speed' as const, atIso, isFailure, errorTypes: [] }] : [cardPractice];
  });
}

function practiceOf(attempt: SkillAttempt, atIso: string): SkillPractice {
  return { skill: attempt.skill, atIso, isFailure: attempt.outcome === 0, errorTypes: [] };
}

function reasonText(reason: CoachReason): string {
  switch (reason.kind) {
    case 'errors':
      return reason.topError ? T.errorsWithType({ count: reason.count, type: text.review.errorLabels[reason.topError] }) : T.errors({ count: reason.count });
    case 'never':
      return T.never;
    case 'stale':
      return T.stale({ days: reason.days });
    case 'weak':
      return T.weak({ rating: reason.rating });
  }
}
