import { describe, expect, it } from 'vitest';
import { CheckErrorType } from '../../core/calc-check';
import { DopeCard } from '../../core/dope-card';
import { CourseResults, exerciseById, exerciseResult, ExerciseShotRecord } from '../../sim/course';
import { DEFAULT_FREE_PLAY, freePlayTask } from '../../sim/free-play';
import { MainCause } from '../../sim/miss-breakdown';
import {
  achievementsView,
  cardsView,
  errorsView,
  feedView,
  JournalSeries,
  journalSeries,
  JOURNAL_LIMIT,
  JournalShot,
  STATS_MIN_SHOTS,
  statsView,
  withSeries,
} from './journal.model';

const START = new Date(2026, 10, 9, 14, 5).toISOString();

function record(fields: Partial<ExerciseShotRecord> = {}): ExerciseShotRecord {
  return { stageIndex: 0, targetIndex: 0, distanceM: 300, isHit: true, isColdBore: false, impact: { upMrad: 0, rightMrad: 0 }, diagnosis: 'clean', mainCause: null, windSpeedMps: 2.2, ...fields };
}

function shot(fields: Partial<JournalShot> = {}): JournalShot {
  return { distanceM: 300, isHit: true, isFirstAtTarget: true, mainCause: null, errorTypes: [], windSpeedMps: 0, mode: 'auto', ...fields };
}

function series(fields: Partial<JournalSeries> = {}): JournalSeries {
  return {
    id: 's1',
    startedAtIso: START,
    kind: 'exercise',
    exerciseId: '04',
    title: 'Флажок на бруствере',
    mode: 'auto',
    cartridgeIds: ['B'],
    exerciseClass: 2,
    total: 25,
    isInterrupted: false,
    shots: [shot()],
    ...fields,
  };
}

const errors = (types: CheckErrorType[]) => ({ verdict: 'error' as const, rowVerdicts: {}, errorTypes: types });

describe('journal — a series from the position', () => {
  it('04 finished: title, cartridge, mode, class and points; shots with their first-at-target flag, cause and errors', () => {
    const def = exerciseById('04')!;
    const records = [
      record({ targetIndex: 0, isHit: false, mainCause: 'wind-under', check: errors(['side']) }),
      record({ targetIndex: 0 }),
      record({ targetIndex: 1 }),
      record({ targetIndex: 2 }),
    ];
    const result = exerciseResult(def, { mode: 'auto', hasOpenedReference: false, shots: records });
    const made = journalSeries({ id: 'x', task: def, startedAtIso: START, records, result })!;
    expect([made.kind, made.exerciseId, made.title, made.cartridgeIds, made.mode, made.exerciseClass, made.total, made.isInterrupted]).toEqual([
      'exercise', '04', 'Флажок на бруствере', ['B'], 'auto', result.exerciseClass, result.total, false,
    ]);
    expect(made.shots.map(item => [item.isFirstAtTarget, item.isHit, item.mainCause, item.errorTypes, item.windSpeedMps])).toEqual([
      [true, false, 'wind-under', ['side'], 2.2],
      [false, true, null, [], 2.2],
      [true, true, null, [], 2.2],
      [true, true, null, [], 2.2],
    ]);
  });

  it('left after two shots: interrupted, no class; free play: «Свободная», no class; no shots — nothing', () => {
    const def = exerciseById('04')!;
    const left = journalSeries({ id: 'y', task: def, startedAtIso: START, records: [record(), record({ targetIndex: 1 })], result: null })!;
    expect([left.isInterrupted, left.exerciseClass, left.total]).toEqual([true, null, null]);
    const free = journalSeries({ id: 'z', task: freePlayTask({ ...DEFAULT_FREE_PLAY, distanceM: 800 }), startedAtIso: START, records: [record({ distanceM: 800 })], result: null })!;
    expect([free.kind, free.exerciseId, free.title, free.isInterrupted, free.exerciseClass]).toEqual(['free', null, 'Свободная игра', false, null]);
    expect(journalSeries({ id: 'w', task: def, startedAtIso: START, records: [], result: null })).toBeNull();
  });

  it('keeps the newest first and the last 200', () => {
    const many = Array.from({ length: JOURNAL_LIMIT }, (_, index) => series({ id: `old-${index}` }));
    const added = withSeries(many, series({ id: 'new' }));
    expect(added.length).toBe(JOURNAL_LIMIT);
    expect(added[0].id).toBe('new');
    expect(added.some(item => item.id === `old-${JOURNAL_LIMIT - 1}`)).toBe(false);
  });
});

describe('journal — the feed', () => {
  it('a series line: number and title, cartridge and mode, date; the stamp; free play by distance; interrupted', () => {
    const [exercise, free, interrupted] = feedView([
      series(),
      series({ id: 'f', kind: 'free', exerciseId: null, title: 'Свободная игра', exerciseClass: null, total: null, shots: [shot({ distanceM: 800 })] }),
      series({ id: 'i', isInterrupted: true, exerciseClass: null, total: null }),
    ]);
    expect([exercise.title, exercise.meta, exercise.stamp, exercise.stampTone]).toEqual(['04 · Флажок на бруствере', 'патрон Б · АВТО · 9 нояб., 14:05', '2 КЛАСС', 'silver']);
    expect([free.title, free.stamp]).toEqual(['Свободная · 800 м', null]);
    expect([interrupted.stamp, interrupted.stampTone]).toEqual(['прервано', 'graphite']);
    expect(feedView([series({ exerciseClass: 0 })])[0].stampTone).toBe('red');
  });

  it('shot rows: number, distance, hit or miss and the cause', () => {
    const [view] = feedView([series({ shots: [shot({ isHit: false, mainCause: 'wind-under' }), shot({ distanceM: 450, mainCause: 'hold' })] })]);
    expect(view.shots).toEqual(['1 · 300 м · ✕ · недооценка ветра', '2 · 450 м · ✓']);
  });
});

describe('journal — errors', () => {
  it('counted by type over all series, the most frequent first, with where it happened last', () => {
    const view = errorsView([
      series({ id: 'a', exerciseId: '06', shots: [shot({ errorTypes: ['side'] }), shot({ mainCause: 'trigger' as MainCause })] }),
      series({ id: 'b', exerciseId: '04', startedAtIso: new Date(2026, 10, 8, 9, 0).toISOString(), shots: [shot({ errorTypes: ['side', 'arithmetic'] })] }),
    ]);
    expect(view.map(row => [row.label, row.count, row.last])).toEqual([
      ['СТОРОНА', 2, '06 · 9 нояб.'],
      ['АРИФМЕТИКА', 1, '04 · 8 нояб.'],
      ['срыв спуска', 1, '06 · 9 нояб.'],
    ]);
    expect(view[0].isTop).toBe(true);
    expect(view[1].isTop).toBe(false);
  });

  it('a clean journal has no errors', () => {
    expect(errorsView([series()])).toEqual([]);
  });
});

describe('journal — statistics', () => {
  it(`fewer than ${STATS_MIN_SHOTS} first shots — not enough`, () => {
    expect(statsView([series({ shots: Array.from({ length: STATS_MIN_SHOTS - 1 }, () => shot()) })]).isEnough).toBe(false);
  });

  it('first-shot hits by distance, wind and mode; second shots do not count', () => {
    const shots = [
      ...Array.from({ length: 6 }, () => shot({ distanceM: 310, windSpeedMps: 2.1 })),
      ...Array.from({ length: 4 }, () => shot({ distanceM: 590, isHit: false, windSpeedMps: 5, mode: 'manual-easy' })),
      shot({ isFirstAtTarget: false, isHit: false }),
    ];
    const view = statsView([series({ shots })]);
    expect(view.isEnough).toBe(true);
    expect(view.byDistance.filter(bar => bar.count > 0).map(bar => [bar.label, bar.count, bar.share])).toEqual([
      ['300', 6, 1],
      ['600', 4, 0],
    ]);
    expect(view.byWind.filter(bar => bar.count > 0).map(bar => [bar.label, bar.share])).toEqual([
      ['слабый', 1],
      ['умеренный', 0],
    ]);
    expect(view.byMode.filter(bar => bar.count > 0).map(bar => [bar.label, bar.share])).toEqual([
      ['АВТО', 1],
      ['САМ · лёгкий', 0],
    ]);
  });
});

describe('journal — cards and achievements', () => {
  it('the factory row in ink and the player note beside it', () => {
    const card: DopeCard = { cartridgeId: 'B', clickMil: 0.1, rows: [300, 400].map(distanceM => ({ distanceM, elevationMil: distanceM / 200, clicks: 0, timeOfFlightS: 0, windConstant: 0, colderBy10CMil: 0 })) as unknown as DopeCard['rows'] };
    const [view] = cardsView([card], { B: [{ distanceM: 400, elevationMil: 2.2 }] });
    expect(view.title).toBe('Патрон Б');
    expect(view.rows).toEqual([
      { distance: '300', factory: '↑ 1.5', player: null },
      { distance: '400', factory: '↑ 2.0', player: '↑ 2.2' },
    ]);
  });

  it('rank, admissions, class stamps and records', () => {
    const course: CourseResults = { isIntroCompleted: true, bestClasses: { '01': 1, '02': 3, '03': 0 }, bestTotals: { '01': 30, '02': 40 } };
    const view = achievementsView(course);
    expect(view.rank).toBe('Курсант');
    expect(view.admissions).toBe('допуски 2 / 12');
    expect(view.classes.slice(0, 4).map(row => [row.id, row.stamp])).toEqual([
      ['01', '1 КЛАСС'],
      ['02', '3 КЛАСС'],
      ['03', 'НЕ ЗАЧТЕНО'],
      ['04', null],
    ]);
    expect(view.records).toEqual(['01 · 30 очк.', '02 · 40 очк.']);
  });
});
