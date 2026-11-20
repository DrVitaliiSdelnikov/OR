import { describe, expect, it } from 'vitest';
import { DrillRoundRecord } from '../../sim/drill-round';
import { applyAttempts, attemptDifficulty, attemptsFromDrillRound, attemptsFromShot, initialRatings, INITIAL_RATING } from '../../sim/skill-rating';
import { JournalSeries, JournalShot } from '../journal/journal.model';
import { attemptsFromJournalShot, emptyLedger, knownLedger, replayedLedger, withRatedRound, withRatedSeries } from './skill-ledger.model';

function journalShot(fields: Partial<JournalShot> = {}): JournalShot {
  return { distanceM: 600, isHit: true, isFirstAtTarget: true, mainCause: null, errorTypes: [], windSpeedMps: 4, mode: 'manual-easy', causes: [], clickMil: 0.1, ...fields };
}

function series(id: string, startedAtIso: string, shots: JournalShot[]): JournalSeries {
  return { id, startedAtIso, kind: 'free', exerciseId: null, title: 'Свободная', mode: 'manual-easy', cartridgeIds: ['B'], exerciseClass: null, total: null, isInterrupted: false, shots };
}

const ROUND: DrillRoundRecord = {
  drillId: 'wind',
  level: 'learn',
  seed: 1,
  startedAtIso: '2026-11-20T10:00:00.000Z',
  cards: [{ verdict: 'exact', errorTypes: [], seconds: 8 }],
};

describe('учёт серий журнала', () => {
  it('серия пишется повторно — в рейтинг идут только новые выстрелы', () => {
    const first = series('s1', '2026-11-20T09:00:00.000Z', [journalShot()]);
    const grown = { ...first, shots: [journalShot(), journalShot({ isHit: false, causes: [{ kind: 'wind-clock', mil: 0.4 }] })] };
    const once = withRatedSeries(emptyLedger(), first, ['s1']);
    const twice = withRatedSeries(withRatedSeries(once, first, ['s1']), grown, ['s1']);
    const expected = applyAttempts(initialRatings(), grown.shots.flatMap(attemptsFromJournalShot));
    expect(twice.ratings).toEqual(expected);
    expect(twice.ratedShots).toEqual({ s1: 2 });
  });

  it('учёт держится только для серий, что остались в журнале', () => {
    const ledger = withRatedSeries(withRatedSeries(emptyLedger(), series('old', '2026-11-19T09:00:00.000Z', [journalShot()]), ['old']), series('new', '2026-11-20T09:00:00.000Z', [journalShot()]), ['new']);
    expect(ledger.ratedShots).toEqual({ new: 1 });
  });

  it('раунд дрила даёт свои попытки при записи', () => {
    expect(withRatedRound(emptyLedger(), ROUND).ratings).toEqual(applyAttempts(initialRatings(), attemptsFromDrillRound(ROUND)));
  });
});

describe('выстрел журнала → попытки', () => {
  it('с величинами — как в T4.1', () => {
    const shot = journalShot({ causes: [{ kind: 'distance', mil: 0.1 }] });
    expect(attemptsFromJournalShot(shot)).toEqual(attemptsFromShot(shot));
  });

  it('без величин, попадание: исполнение, ветер если дул, ДОПЕ в ручном — все 1', () => {
    const difficulty = attemptDifficulty({ level: 'learn', distanceM: 600, windSpeedMps: 4 });
    expect(attemptsFromJournalShot(journalShot({ causes: undefined, clickMil: undefined }))).toEqual([
      { skill: 'dope', outcome: 1, difficulty },
      { skill: 'wind', outcome: 1, difficulty },
      { skill: 'execution', outcome: 1, difficulty },
    ]);
    expect(attemptsFromJournalShot(journalShot({ causes: undefined, mode: 'auto', windSpeedMps: 0 })).map(attempt => attempt.skill)).toEqual(['execution']);
  });

  it('без величин, промах: 0 только навыку грубой причины; без причины — ничего', () => {
    const missBy = (mainCause: JournalShot['mainCause']) => attemptsFromJournalShot(journalShot({ causes: undefined, isHit: false, mainCause })).map(attempt => [attempt.skill, attempt.outcome]);
    expect(missBy('calc')).toEqual([['dope', 0]]);
    expect(missBy('wind-over')).toEqual([['wind', 0]]);
    expect(missBy('lead')).toEqual([['lead', 0]]);
    expect(missBy('trigger')).toEqual([['execution', 0]]);
    expect(missBy(null)).toEqual([]);
  });

  it('время вышло — попыток нет: «скорость» даёт раунд', () => {
    expect(attemptsFromJournalShot(journalShot({ isHit: false, isTimedOut: true }))).toEqual([]);
    expect(attemptsFromJournalShot(journalShot({ isHit: false, isTimedOut: true, causes: undefined, clickMil: undefined }))).toEqual([]);
  });
});

describe('пересчёт журнала', () => {
  it('серии и раунды — по времени начала; серия раньше раунда с тем же временем', () => {
    const late = series('late', '2026-11-20T11:00:00.000Z', [journalShot({ isHit: false, causes: [{ kind: 'wind-clock', mil: 0.5 }] })]);
    const sameAsRound = series('same', ROUND.startedAtIso, [journalShot()]);
    const early = series('early', '2026-11-20T09:00:00.000Z', [journalShot({ causes: [{ kind: 'wind-speed', mil: 0.1 }] })]);
    const replayed = replayedLedger([late, sameAsRound, early], [ROUND]);
    const inOrder = [...early.shots.flatMap(attemptsFromJournalShot), ...sameAsRound.shots.flatMap(attemptsFromJournalShot), ...attemptsFromDrillRound(ROUND), ...late.shots.flatMap(attemptsFromJournalShot)];
    expect(replayed.ratings).toEqual(applyAttempts(initialRatings(), inOrder));
    expect(replayed.ratedShots).toEqual({ late: 1, same: 1, early: 1 });
  });

  it('пустой журнал — начальный рейтинг', () => {
    expect(replayedLedger([], [])).toEqual(emptyLedger());
  });
});

describe('чтение учёта из хранилища', () => {
  it('целый учёт читается как есть', () => {
    const ledger = withRatedRound(emptyLedger(), ROUND);
    expect(knownLedger(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
  });

  it('нет поля, нет навыка, рейтинг вне 0–100, дробные попытки, битый учёт серий — не читается', () => {
    const ratings = initialRatings();
    const { speed: _speed, ...withoutSpeed } = ratings;
    expect(knownLedger(undefined)).toBeNull();
    expect(knownLedger({ ratings: withoutSpeed, ratedShots: {} })).toBeNull();
    expect(knownLedger({ ratings: { ...ratings, wind: { rating: 120, attempts: 1 } }, ratedShots: {} })).toBeNull();
    expect(knownLedger({ ratings: { ...ratings, wind: { rating: INITIAL_RATING, attempts: 1.5 } }, ratedShots: {} })).toBeNull();
    expect(knownLedger({ ratings, ratedShots: { s1: 'two' } })).toBeNull();
    expect(knownLedger({ ratings, ratedShots: [] })).toBeNull();
  });
});
