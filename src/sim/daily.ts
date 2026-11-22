import { fromInput, UnitSystem } from '../core/units';
import { text } from '../i18n';
import { ExerciseShotRecord, FreePlayTask } from './course';
import { DrillCardResult } from './drill-round';
import { COUNT_DRILL_IDS, CountDrillId, drillTitle } from './drills';
import { DEFAULT_FREE_PLAY, freePlayTask } from './free-play';
import { SKILL_OF_CAUSE } from './skill-rating';

export type DailyKind = 'cards' | 'position';

export interface DailyTask {
  dateKey: string;
  seed: number;
  kind: DailyKind;
  drillId: CountDrillId | null;
}

export interface DailyRecord {
  dateKey: string;
  kind: DailyKind;
  drillId: CountDrillId | null;
  hits: number;
  total: number;
  windErrorMil: number | null;
}

const T = text.daily;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_LENGTH = 10;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const POSITION_TARGETS = 3;
const POSITION_SPAN_IN_SYSTEM = { from: 300, to: 700 };
const WIND_DIGITS = 1;

export function dailyDateKey(nowIso: string): string {
  return new Date(nowIso).toISOString().slice(0, DATE_KEY_LENGTH);
}

export function dailySeed(dateKey: string): number {
  let hash = FNV_OFFSET;
  for (const char of dateKey) {
    hash = Math.imul(hash ^ char.charCodeAt(0), FNV_PRIME);
  }
  return hash >>> 0;
}

export function dailyTask(dateKey: string): DailyTask {
  const seed = dailySeed(dateKey);
  const isCardsDay = dayNumber(dateKey) % 2 === 0;
  return { dateKey, seed, kind: isCardsDay ? 'cards' : 'position', drillId: isCardsDay ? COUNT_DRILL_IDS[seed % COUNT_DRILL_IDS.length] : null };
}

export function dailyPositionTask(system: UnitSystem): FreePlayTask {
  const base = freePlayTask({ ...DEFAULT_FREE_PLAY, wind: 'moderate', notebookMode: 'manual-easy', rifle: 'course', scopeId: 'course-tree', cartridgeId: 'B' }, null, system);
  return {
    ...base,
    title: T.title,
    targets: {
      count: POSITION_TARGETS,
      distance: { kind: 'known', fromM: fromInput('distance', POSITION_SPAN_IN_SYSTEM.from, system), toM: fromInput('distance', POSITION_SPAN_IN_SYSTEM.to, system) },
    },
    stages: [{ cartridgeId: 'B', maxShotsPerTarget: 1, closesOnHit: true }],
  };
}

export function dailyFromCards(task: DailyTask, cards: readonly DrillCardResult[]): DailyRecord {
  return { dateKey: task.dateKey, kind: task.kind, drillId: task.drillId, hits: cards.filter(card => card.verdict === 'exact').length, total: cards.length, windErrorMil: null };
}

export function dailyFromShots(task: DailyTask, shots: readonly ExerciseShotRecord[]): DailyRecord {
  const windErrors = shots.map(shot => (shot.causes ?? []).filter(cause => SKILL_OF_CAUSE[cause.kind] === 'wind').reduce((sum, cause) => sum + cause.mil, 0)).map(Math.abs);
  const windErrorMil = windErrors.length === 0 ? null : windErrors.reduce((sum, error) => sum + error, 0) / windErrors.length;
  return { dateKey: task.dateKey, kind: task.kind, drillId: task.drillId, hits: shots.filter(shot => shot.isHit).length, total: shots.length, windErrorMil };
}

export function withDailyRecord(records: readonly DailyRecord[], record: DailyRecord): DailyRecord[] {
  return records.some(saved => saved.dateKey === record.dateKey) ? [...records] : [...records, record];
}

export function dailyStreak(records: readonly DailyRecord[], todayKey: string): number {
  const doneDays = new Set(records.map(record => dayNumber(record.dateKey)));
  let day = dayNumber(todayKey);
  if (!doneDays.has(day)) {
    day--;
  }
  let streak = 0;
  while (doneDays.has(day)) {
    streak++;
    day--;
  }
  return streak;
}

export function dailyShareText(record: DailyRecord): string {
  const date = shortDate(record.dateKey);
  return record.kind === 'position'
    ? T.sharePosition({ date, hits: record.hits, total: record.total, windErrorMil: record.windErrorMil ?? 0, digits: WIND_DIGITS })
    : T.shareCards({ date, drill: drillTitle(record.drillId!), hits: record.hits, total: record.total });
}

export function shortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return T.shortDate({ day, month });
}

function dayNumber(dateKey: string): number {
  return Math.round(Date.parse(`${dateKey}T00:00:00.000Z`) / DAY_MS);
}
