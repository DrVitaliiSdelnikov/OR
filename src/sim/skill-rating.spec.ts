import { describe, expect, it } from 'vitest';
import { DrillRoundRecord } from './drill-round';
import {
  applyAttempt,
  applyAttempts,
  attemptDifficulty,
  attemptsFromDrillRound,
  attemptsFromShot,
  expectedOutcome,
  INITIAL_RATING,
  initialRatings,
  MAX_STEP,
  overallLevel,
  SkillAttempt,
  SkillRatings,
} from './skill-rating';

const STARTED = '2026-11-20T10:00:00.000Z';

function attempts(skill: SkillAttempt['skill'], outcome: SkillAttempt['outcome'], count: number, difficulty = 40): SkillAttempt[] {
  return Array.from({ length: count }, () => ({ skill, outcome, difficulty }));
}

function withRatings(values: Partial<Record<keyof SkillRatings, number>>): SkillRatings {
  const ratings = initialRatings();
  for (const [skill, rating] of Object.entries(values)) {
    ratings[skill as keyof SkillRatings] = { rating: rating!, attempts: 1 };
  }
  return ratings;
}

describe('обновление рейтинга', () => {
  it(`начало — ${INITIAL_RATING}, без попыток`, () => {
    expect(initialRatings().wind).toEqual({ rating: INITIAL_RATING, attempts: 0 });
  });

  it('серия точных растит, серия ошибок снижает; попытки считаются', () => {
    const up = applyAttempts(initialRatings(), attempts('wind', 1, 10));
    const down = applyAttempts(initialRatings(), attempts('wind', 0, 10));
    expect(up.wind.rating).toBeGreaterThan(INITIAL_RATING + 10);
    expect(down.wind.rating).toBeLessThan(INITIAL_RATING - 10);
    expect(up.wind.attempts).toBe(10);
    expect(up.dope).toEqual(initialRatings().dope);
  });

  it(`шаг за попытку не больше ${MAX_STEP}; рейтинг в 0–100`, () => {
    const once = applyAttempt(initialRatings(), { skill: 'wind', outcome: 1, difficulty: 100 });
    expect(once.wind.rating - INITIAL_RATING).toBeLessThanOrEqual(MAX_STEP);
    expect(once.wind.rating - INITIAL_RATING).toBeGreaterThan(MAX_STEP * 0.9);
    expect(applyAttempts(initialRatings(), attempts('wind', 1, 200, 100)).wind.rating).toBeLessThanOrEqual(100);
    expect(applyAttempts(initialRatings(), attempts('wind', 0, 200, 0)).wind.rating).toBeGreaterThanOrEqual(0);
  });

  it('трудная точная попытка даёт больше лёгкой; ожидание — по Эло со шкалой 25', () => {
    const hard = applyAttempt(initialRatings(), { skill: 'wind', outcome: 1, difficulty: 80 }).wind.rating;
    const easy = applyAttempt(initialRatings(), { skill: 'wind', outcome: 1, difficulty: 10 }).wind.rating;
    expect(hard).toBeGreaterThan(easy);
    expect(expectedOutcome(40, 40)).toBeCloseTo(0.5, 9);
    expect(expectedOutcome(40, 65)).toBeCloseTo(1 / 11, 9);
  });

  it('«близко» на равной сложности не двигает рейтинг', () => {
    expect(applyAttempt(initialRatings(), { skill: 'wind', outcome: 0.5, difficulty: INITIAL_RATING }).wind.rating).toBeCloseTo(INITIAL_RATING, 9);
  });
});

describe('сложность попытки', () => {
  it('база, дистанция, ветер, на время; дистанция и ветер упираются в предел — сложность не выше 100', () => {
    expect(attemptDifficulty({ level: 'learn' })).toBe(15);
    expect(attemptDifficulty({ level: 'learn', distanceM: 1000 })).toBe(55);
    expect(attemptDifficulty({ level: 'learn', distanceM: 100, windSpeedMps: 10 })).toBe(40);
    expect(attemptDifficulty({ level: 'timed', distanceM: 550, windSpeedMps: 4 })).toBe(15 + 20 + 10 + 20);
    expect(attemptDifficulty({ level: 'timed', distanceM: 5000, windSpeedMps: 50 })).toBe(100);
  });
});

describe('выстрел → попытки навыков', () => {
  const base = { distanceM: 600, windSpeedMps: 4, mode: 'manual-easy' as const, clickMil: 0.1 };

  it('звено 0 кликов — 1, 1 клик — 0,5, больше — 0; навык — по самому большому звену', () => {
    const made = attemptsFromShot({ ...base, causes: [{ kind: 'wind-clock', mil: 0.3 }, { kind: 'wind-speed', mil: 0.02 }, { kind: 'distance', mil: 0.1 }, { kind: 'hold', mil: 0.04 }] });
    const outcomeOf = (skill: SkillAttempt['skill']) => made.find(attempt => attempt.skill === skill)?.outcome;
    expect(outcomeOf('wind')).toBe(0);
    expect(outcomeOf('distance')).toBe(0.5);
    expect(outcomeOf('execution')).toBe(1);
    expect(outcomeOf('dope')).toBe(1);
    expect(outcomeOf('angle')).toBeUndefined();
    expect(made.every(attempt => attempt.difficulty === attemptDifficulty({ level: 'learn', distanceM: 600, windSpeedMps: 4 }))).toBe(true);
  });

  it('исполнение — всегда; ветер — если дул; ДОПЕ — только в ручных режимах; накрутка — это ДОПЕ', () => {
    const calmAuto = attemptsFromShot({ ...base, mode: 'auto', windSpeedMps: 0, causes: [] }).map(attempt => attempt.skill);
    expect(calmAuto).toEqual(['execution']);
    const turret = attemptsFromShot({ ...base, mode: 'auto', windSpeedMps: 0, causes: [{ kind: 'turret', mil: 0.5 }] });
    expect(turret.find(attempt => attempt.skill === 'dope')?.outcome).toBe(0);
  });

  it('время вышло — только «скорость» 0; без величин — попыток нет', () => {
    expect(attemptsFromShot({ ...base, isTimedOut: true, causes: [] })).toEqual([{ skill: 'speed', outcome: 0, difficulty: attemptDifficulty({ level: 'timed', distanceM: 600, windSpeedMps: 4 }) }]);
    expect(attemptsFromShot({ ...base, causes: undefined })).toEqual([]);
  });
});

describe('раунд дрила → попытки', () => {
  function countRound(level: DrillRoundRecord['level']): DrillRoundRecord {
    return {
      drillId: 'wind',
      level,
      seed: 1,
      startedAtIso: STARTED,
      cards: [
        { verdict: 'exact', errorTypes: [], seconds: 8, distanceM: 600, windSpeedMps: 4 },
        { verdict: 'close', errorTypes: ['rounding'], seconds: 9 },
        { verdict: 'error', errorTypes: [], seconds: 30, isTimedOut: true },
      ],
    };
  }

  it('карточки: навык дрила, точно / близко / ошибка → 1 / 0,5 / 0; сложность — дистанция и ветер карточки', () => {
    expect(attemptsFromDrillRound(countRound('learn'))).toEqual([
      { skill: 'wind', outcome: 1, difficulty: attemptDifficulty({ level: 'learn', distanceM: 600, windSpeedMps: 4 }) },
      { skill: 'wind', outcome: 0.5, difficulty: attemptDifficulty({ level: 'learn' }) },
      { skill: 'wind', outcome: 0, difficulty: attemptDifficulty({ level: 'learn' }) },
    ]);
  });

  it('на время — ещё и «скорость» с тем же исходом', () => {
    const made = attemptsFromDrillRound(countRound('timed'));
    expect(made.filter(attempt => attempt.skill === 'speed').map(attempt => attempt.outcome)).toEqual([1, 0.5, 0]);
    expect(made.filter(attempt => attempt.skill === 'wind')).toHaveLength(3);
  });

  it('серия на позиции: навыки уже в журнале — только «скорость» на время: попадание 1, промах 0,5, время 0', () => {
    const position: DrillRoundRecord = {
      drillId: 'patrol',
      level: 'timed',
      seed: 1,
      startedAtIso: STARTED,
      cards: [
        { verdict: 'exact', errorTypes: [], seconds: 20 },
        { verdict: 'error', errorTypes: [], seconds: 40, missCause: 'hold' },
        { verdict: 'error', errorTypes: [], seconds: 90, isTimedOut: true },
      ],
    };
    expect(attemptsFromDrillRound(position).map(attempt => [attempt.skill, attempt.outcome])).toEqual([
      ['speed', 1],
      ['speed', 0.5],
      ['speed', 0],
    ]);
    expect(attemptsFromDrillRound({ ...position, level: 'learn' })).toEqual([]);
  });
});

describe('общий уровень', () => {
  it('среднее навыков с попытками; без попыток — нет уровня', () => {
    expect(overallLevel(initialRatings())).toBeNull();
    expect(overallLevel(withRatings({ wind: 60, dope: 50 }))).toEqual({ value: 55, name: 'Стрелок' });
  });

  it('пороги: < 40, 40–54, 55–69, 70–84, ≥ 85', () => {
    const nameAt = (value: number) => overallLevel(withRatings({ wind: value }))!.name;
    expect([39.9, 40, 54.9, 55, 69.9, 70, 84.9, 85].map(nameAt)).toEqual([
      'Начинающий',
      'Любитель',
      'Любитель',
      'Стрелок',
      'Стрелок',
      'Сильный стрелок',
      'Сильный стрелок',
      'Эксперт',
    ]);
  });
});
