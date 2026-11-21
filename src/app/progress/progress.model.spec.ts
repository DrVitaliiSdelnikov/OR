import { describe, expect, it } from 'vitest';
import { DrillRoundRecord } from '../../sim/drill-round';
import { initialRatings } from '../../sim/skill-rating';
import { JournalSeries, JournalShot } from '../journal/journal.model';
import { replayedLedger } from '../services/skill-ledger.model';
import { errorTypeRows, levelView, skillRows, weeklyLevels } from './progress.model';

const NOW = '2026-11-21T12:00:00.000Z';
const WEEK_LABELS = ['28.09', '05.10', '12.10', '19.10', '26.10', '02.11', '09.11', '16.11'];

function round(startedAtIso: string, fields: Partial<DrillRoundRecord> = {}): DrillRoundRecord {
  const cards = Array.from({ length: 10 }, () => ({ verdict: 'exact' as const, errorTypes: [], seconds: 9 }));
  return { drillId: 'wind', level: 'learn', seed: 1, startedAtIso, cards, ...fields };
}

function shot(errorTypes: JournalShot['errorTypes']): JournalShot {
  return { distanceM: 600, isHit: true, isFirstAtTarget: true, mainCause: null, errorTypes, windSpeedMps: 0, mode: 'manual-easy', causes: [], clickMil: 0.1 };
}

function series(startedAtIso: string, shots: JournalShot[]): JournalSeries {
  return { id: startedAtIso, startedAtIso, kind: 'free', exerciseId: null, title: 'Свободная', mode: 'manual-easy', cartridgeIds: ['B'], exerciseClass: null, total: null, isInterrupted: false, shots };
}

describe('уровень', () => {
  it('без попыток — «не определён»; иначе название и округлённое среднее навыков с попытками', () => {
    expect(levelView(initialRatings())).toEqual({ text: 'Уровень не определён', isKnown: false });
    expect(levelView({ ...initialRatings(), wind: { rating: 58.4, attempts: 3 } })).toEqual({ text: 'Стрелок · 58', isKnown: true });
  });
});

describe('навыки', () => {
  it('8 строк в порядке навыков: рейтинг округлён, доля полоски, попытки словами', () => {
    const rows = skillRows({ ...initialRatings(), wind: { rating: 41.6, attempts: 12 }, lead: { rating: 50, attempts: 1 } });
    expect(rows.map(row => row.skill)).toEqual(['distance', 'dope', 'wind', 'conditions', 'angle', 'lead', 'execution', 'speed']);
    expect(rows[2]).toEqual({ skill: 'wind', title: 'ветер', rating: 42, share: expect.closeTo(0.416, 6), attempts: '12 попыток', isRated: true });
    expect(rows[5].attempts).toBe('1 попытка');
    expect(rows[0]).toMatchObject({ rating: 40, attempts: 'нет попыток', isRated: false });
  });
});

describe('уровень по неделям', () => {
  it('8 недель с понедельника по UTC; до первой попытки точек нет; пустая неделя держит уровень; рост после новой попытки', () => {
    const rounds = [round('2026-11-04T10:00:00.000Z'), round('2026-11-18T10:00:00.000Z')];
    const weeks = weeklyLevels([], rounds, NOW, replayedLedger([], rounds).ratings);
    expect(weeks.map(week => week.label)).toEqual(WEEK_LABELS);
    expect(weeks.slice(0, 5).map(week => week.level)).toEqual([null, null, null, null, null]);
    const [first, idle, current] = weeks.slice(5).map(week => week.level!);
    expect(first).toBeGreaterThan(40);
    expect(idle).toBe(first);
    expect(current).toBeGreaterThan(first);
    expect(Number.isInteger(first)).toBe(true);
  });

  it('текущая неделя — по сохранённому рейтингу, а не по пересчёту', () => {
    const stored = { ...initialRatings(), wind: { rating: 61.4, attempts: 30 } };
    const weeks = weeklyLevels([], [round('2026-11-04T10:00:00.000Z')], NOW, stored);
    expect(weeks[7].level).toBe(61);
    expect(weeks[6].level).not.toBe(61);
    expect(weeklyLevels([], [], NOW, initialRatings())[7].level).toBeNull();
  });

  it('попытка ровно в понедельник 00:00 — в новой неделе; журнал тоже считается', () => {
    const atMonday = weeklyLevels([], [round('2026-11-09T00:00:00.000Z')], NOW, initialRatings());
    expect(atMonday[5].level).toBeNull();
    expect(atMonday[6].level).not.toBeNull();
    const journal = [series('2026-11-10T10:00:00.000Z', [shot([])])];
    const fromJournal = weeklyLevels(journal, [], NOW, replayedLedger(journal, []).ratings);
    expect(fromJournal[5].level).toBeNull();
    expect(fromJournal[6].level).not.toBeNull();
  });
});

describe('ошибки по типам', () => {
  it('за 4 недели из журнала и карточек; по убыванию, при равенстве — порядок типов', () => {
    const journal = [series('2026-11-10T10:00:00.000Z', [shot(['rounding', 'side'])]), series('2026-10-01T10:00:00.000Z', [shot(['units', 'units'])])];
    const rounds = [round('2026-11-15T10:00:00.000Z', { cards: [{ verdict: 'error', errorTypes: ['side'], seconds: 9 }] })];
    expect(errorTypeRows(journal, rounds, NOW)).toEqual([
      { type: 'side', label: 'СТОРОНА', count: 2 },
      { type: 'rounding', label: 'ОКРУГЛЕНИЕ', count: 1 },
    ]);
    expect(errorTypeRows([series('2026-11-10T10:00:00.000Z', [shot(['rounding', 'side'])])], [], NOW).map(row => row.type)).toEqual(['side', 'rounding']);
    expect(errorTypeRows([series('2026-11-10T10:00:00.000Z', [shot(['side', 'rounding', 'rounding'])])], [], NOW).map(row => row.type)).toEqual(['rounding', 'side']);
    expect(errorTypeRows([], [], NOW)).toEqual([]);
  });
});
