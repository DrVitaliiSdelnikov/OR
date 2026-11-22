import { describe, expect, it } from 'vitest';
import { ExerciseShotRecord, setupTask } from './course';
import { DailyRecord, dailyDateKey, dailyFromCards, dailyFromShots, dailyPositionTask, dailySeed, dailyShareText, dailyStreak, dailyTask, withDailyRecord } from './daily';
import { COUNT_DRILL_IDS } from './drills';
import { DEFAULT_FREE_PLAY, freePlayTask } from './free-play';

function shot(fields: Partial<ExerciseShotRecord> = {}): ExerciseShotRecord {
  return { stageIndex: 0, targetIndex: 0, distanceM: 500, isHit: true, isColdBore: false, impact: { upMrad: 0, rightMrad: 0 }, diagnosis: 'clean', ...fields };
}

function record(dateKey: string, fields: Partial<DailyRecord> = {}): DailyRecord {
  return { dateKey, kind: 'cards', drillId: 'wind', hits: 8, total: 10, windErrorMil: null, ...fields };
}

describe('задание дня: дата и сид (T5.1)', () => {
  it('ключ даты — по UTC', () => {
    expect(dailyDateKey('2026-11-21T23:30:00.000Z')).toBe('2026-11-21');
    expect(dailyDateKey('2026-11-21T23:30:00.000-03:00')).toBe('2026-11-22');
  });

  it('сид одинаковый для одной даты и разный для соседних', () => {
    expect(dailySeed('2026-11-21')).toBe(dailySeed('2026-11-21'));
    expect(dailySeed('2026-11-21')).not.toBe(dailySeed('2026-11-22'));
    expect(Number.isInteger(dailySeed('2026-11-21'))).toBe(true);
    expect(dailySeed('2026-11-21')).toBeGreaterThanOrEqual(0);
  });

  it('дни чередуются: карточки по чётным дням от 1970-01-01, позиция по нечётным', () => {
    expect(dailyTask('1970-01-01').kind).toBe('cards');
    expect(dailyTask('1970-01-02').kind).toBe('position');
    expect(dailyTask('2026-11-21').kind).not.toBe(dailyTask('2026-11-22').kind);
  });

  it('дрил карточного дня — по сиду из 6 счётных; у позиции дрила нет', () => {
    const cardsDay = '1970-01-01';
    expect(dailyTask(cardsDay)).toEqual({ dateKey: cardsDay, seed: dailySeed(cardsDay), kind: 'cards', drillId: COUNT_DRILL_IDS[dailySeed(cardsDay) % COUNT_DRILL_IDS.length] });
    expect(dailyTask('1970-01-02').drillId).toBeNull();
    const drills = new Set(Array.from({ length: 60 }, (_, day) => dailyTask(new Date(Date.UTC(2026, 0, 1 + day * 2)).toISOString().slice(0, 10)).drillId));
    expect(drills.size).toBeGreaterThan(3);
  });
});

describe('позиция дня', () => {
  it('3 гонга 300–700 м, САМ лёгкий, 1 выстрел на цель, умеренный ветер, учебная винтовка', () => {
    const task = dailyPositionTask('metric');
    expect(task.targets).toEqual({ count: 3, distance: { kind: 'known', fromM: 300, toM: 700 } });
    expect(task.notebookMode).toBe('manual-easy');
    expect(task.stages).toEqual([{ cartridgeId: 'B', maxShotsPerTarget: 1, closesOnHit: true }]);
    expect(task.conditions.windSpeedRangeMps).toEqual([4, 6]);
    expect(task.rifle).toBeUndefined();
    expect(task.scopeId).toBe('course-tree');
  });

  it('план огня — этапный: 3 цели по 1 выстрелу, а не бесконечная свободная стрельба', () => {
    expect(setupTask(dailyPositionTask('metric'), 7).plan).toEqual({
      kind: 'exercise',
      hasColdBore: false,
      stages: [{ cartridgeId: 'B', maxShotsPerTarget: 1, closesOnHit: true, targetCount: 3 }],
    });
    expect(setupTask(freePlayTask(DEFAULT_FREE_PLAY), 7).plan).toEqual({ kind: 'free', cartridgeId: DEFAULT_FREE_PLAY.cartridgeId });
  });
});

describe('запись дня', () => {
  it('из карточек: верные из всех, без ветра', () => {
    const cards = [
      { verdict: 'exact' as const, errorTypes: [], seconds: 9 },
      { verdict: 'close' as const, errorTypes: [], seconds: 9 },
      { verdict: 'exact' as const, errorTypes: [], seconds: 9 },
    ];
    expect(dailyFromCards(dailyTask('1970-01-01'), cards)).toEqual({ dateKey: '1970-01-01', kind: 'cards', drillId: dailyTask('1970-01-01').drillId, hits: 2, total: 3, windErrorMil: null });
  });

  it('из выстрелов: попадания и средняя ошибка по ветру — модуль суммы звеньев ветра выстрела', () => {
    const shots = [
      shot({ causes: [{ kind: 'wind-clock', mil: -0.2 }, { kind: 'wind-speed', mil: 0.1 }, { kind: 'dope', mil: 0.5 }] }),
      shot({ isHit: false, causes: [{ kind: 'zones', mil: 0.3 }] }),
      shot({ causes: [] }),
    ];
    const day = dailyFromShots(dailyTask('1970-01-02'), shots);
    expect([day.kind, day.hits, day.total, day.drillId]).toEqual(['position', 2, 3, null]);
    expect(day.windErrorMil).toBeCloseTo((0.1 + 0.3 + 0) / 3, 6);
  });

  it('в зачёт — первая попытка дня', () => {
    const first = record('2026-11-21', { hits: 5 });
    expect(withDailyRecord([first], record('2026-11-21', { hits: 9 }))).toEqual([first]);
    expect(withDailyRecord([first], record('2026-11-22'))).toEqual([first, record('2026-11-22')]);
  });
});

describe('серия дней', () => {
  const days = (...keys: string[]) => keys.map(key => record(key));

  it('подряд до сегодня; если сегодня не сделано — до вчера; пропуск рвёт серию', () => {
    expect(dailyStreak(days('2026-11-19', '2026-11-20', '2026-11-21'), '2026-11-21')).toBe(3);
    expect(dailyStreak(days('2026-11-19', '2026-11-20'), '2026-11-21')).toBe(2);
    expect(dailyStreak(days('2026-11-17', '2026-11-19', '2026-11-20', '2026-11-21'), '2026-11-21')).toBe(3);
    expect(dailyStreak(days('2026-11-19'), '2026-11-21')).toBe(0);
    expect(dailyStreak(days('2026-10-31', '2026-11-01'), '2026-11-01')).toBe(2);
  });
});

describe('текст «Поделиться»', () => {
  it('позиция — попадания и ветер; карточки — дрил и верные', () => {
    expect(dailyShareText(record('2026-11-14', { kind: 'position', drillId: null, hits: 2, total: 3, windErrorMil: 0.214 }))).toBe('Симулятор снайпинга · 14.11 · 2 из 3 · ветер 0,2 MIL');
    expect(dailyShareText(record('2026-11-15', { hits: 8, total: 10 }))).toBe('Симулятор снайпинга · 15.11 · Ветер · 8 из 10');
  });
});
