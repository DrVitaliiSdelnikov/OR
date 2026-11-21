import { text } from '../../i18n';
import { DailyRecord, dailyShareText, dailyStreak, dailyTask, shortDate } from '../../sim/daily';
import { drillTitle, ROUND_CARDS } from '../../sim/drills';
import { DrillLink } from '../drill/drill-cards.model';

export interface DailyView {
  date: string;
  taskLine: string;
  rule: string;
  startLabel: string;
  link: DrillLink;
  result: { line: string; wind: string | null } | null;
  streak: string | null;
  shareText: string | null;
}

export const DAILY_POSITION_ID = 'daily';
export const DAILY_ON = 'on';
const T = text.daily;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: readonly string[] = ['cards', 'position'];

export function dailyView(records: readonly DailyRecord[], todayKey: string): DailyView {
  const task = dailyTask(todayKey);
  const todayRecord = records.find(record => record.dateKey === todayKey) ?? null;
  const streak = dailyStreak(records, todayKey);
  return {
    date: T.date({ date: shortDate(todayKey) }),
    taskLine: task.drillId ? T.cardsTask({ drill: drillTitle(task.drillId), count: ROUND_CARDS }) : T.positionTask,
    rule: T.firstAttemptRule,
    startLabel: todayRecord ? T.again : T.start,
    link: task.drillId ? { path: ['/drill', task.drillId], query: { daily: DAILY_ON } } : { path: ['/position', DAILY_POSITION_ID], query: {} },
    result: todayRecord
      ? { line: T.result({ hits: todayRecord.hits, total: todayRecord.total }), wind: todayRecord.windErrorMil === null ? null : T.windError({ windErrorMil: todayRecord.windErrorMil }) }
      : null,
    streak: streak > 0 ? T.streak({ days: streak }) : null,
    shareText: todayRecord ? dailyShareText(todayRecord) : null,
  };
}

export function dailyTileLine(records: readonly DailyRecord[], todayKey: string): string {
  return records.some(record => record.dateKey === todayKey) ? T.tileDone({ days: dailyStreak(records, todayKey) }) : T.tileNew;
}

export function knownDailyRecords(stored: unknown): DailyRecord[] {
  return Array.isArray(stored) ? stored.filter(isDailyRecord) : [];
}

function isDailyRecord(value: unknown): value is DailyRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record['dateKey'] === 'string' &&
    DATE_KEY.test(record['dateKey']) &&
    KINDS.includes(record['kind'] as string) &&
    Number.isInteger(record['hits']) &&
    Number.isInteger(record['total']) &&
    (record['windErrorMil'] === null || typeof record['windErrorMil'] === 'number') &&
    (record['drillId'] === null || typeof record['drillId'] === 'string')
  );
}
