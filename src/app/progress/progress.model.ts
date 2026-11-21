import { CheckErrorType } from '../../core/calc-check';
import { text } from '../../i18n';
import { ERROR_TYPE_ORDER } from '../../sim/coach';
import { DrillRoundRecord } from '../../sim/drill-round';
import { overallLevel, SKILL_IDS, SkillId, SkillRatings } from '../../sim/skill-rating';
import { JournalSeries } from '../journal/journal.model';
import { replayedLedger } from '../services/skill-ledger.model';

export interface LevelView {
  text: string;
  isKnown: boolean;
}

export interface SkillRowView {
  skill: SkillId;
  title: string;
  rating: number;
  share: number;
  attempts: string;
  isRated: boolean;
}

export interface WeekPoint {
  label: string;
  level: number | null;
}

export interface ErrorTypeRow {
  type: CheckErrorType;
  label: string;
  count: number;
}

const T = text.skills.progress;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const SHOWN_WEEKS = 8;
const ERROR_WINDOW_MS = 4 * WEEK_MS;
const RATING_MAX = 100;

export function levelView(ratings: SkillRatings): LevelView {
  const level = overallLevel(ratings);
  return level ? { text: T.level({ name: level.name, value: Math.round(level.value) }), isKnown: true } : { text: T.levelUnknown, isKnown: false };
}

export function skillRows(ratings: SkillRatings): SkillRowView[] {
  return SKILL_IDS.map(skill => {
    const { rating, attempts } = ratings[skill];
    return {
      skill,
      title: text.drills.skills[skill],
      rating: Math.round(rating),
      share: rating / RATING_MAX,
      attempts: attempts > 0 ? T.attempts({ count: attempts }) : T.noAttempts,
      isRated: attempts > 0,
    };
  });
}

export function weeklyLevels(journal: readonly JournalSeries[], rounds: readonly DrillRoundRecord[], nowIso: string, currentRatings: SkillRatings): WeekPoint[] {
  const currentWeekStartMs = weekStartMs(Date.parse(nowIso));
  return Array.from({ length: SHOWN_WEEKS }, (_, index) => {
    const startMs = currentWeekStartMs - (SHOWN_WEEKS - 1 - index) * WEEK_MS;
    const endMs = startMs + WEEK_MS;
    const isBeforeEnd = (iso: string) => Date.parse(iso) < endMs;
    const isCurrentWeek = index === SHOWN_WEEKS - 1;
    const ratings = isCurrentWeek
      ? currentRatings
      : replayedLedger(
          journal.filter(series => isBeforeEnd(series.startedAtIso)),
          rounds.filter(round => isBeforeEnd(round.startedAtIso)),
        ).ratings;
    const level = overallLevel(ratings);
    return { label: weekLabel(startMs), level: level ? Math.round(level.value) : null };
  });
}

export function errorTypeRows(journal: readonly JournalSeries[], rounds: readonly DrillRoundRecord[], nowIso: string): ErrorTypeRow[] {
  const fromMs = Date.parse(nowIso) - ERROR_WINDOW_MS;
  const isRecent = (iso: string) => Date.parse(iso) >= fromMs;
  const errorTypes = [
    ...journal.filter(series => isRecent(series.startedAtIso)).flatMap(series => series.shots.flatMap(shot => shot.errorTypes)),
    ...rounds.filter(round => isRecent(round.startedAtIso)).flatMap(round => round.cards.flatMap(card => card.errorTypes)),
  ];
  return ERROR_TYPE_ORDER.map(type => ({ type, label: text.review.errorLabels[type], count: errorTypes.filter(errorType => errorType === type).length }))
    .filter(row => row.count > 0)
    .sort((first, second) => second.count - first.count);
}

function weekStartMs(ms: number): number {
  const dayStartMs = Math.floor(ms / DAY_MS) * DAY_MS;
  const daysSinceMonday = (new Date(dayStartMs).getUTCDay() + 6) % 7;
  return dayStartMs - daysSinceMonday * DAY_MS;
}

function weekLabel(startMs: number): string {
  const date = new Date(startMs);
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  return T.weekLabel({ day: twoDigits(date.getUTCDate()), month: twoDigits(date.getUTCMonth() + 1) });
}
