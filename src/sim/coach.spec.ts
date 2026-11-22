import { describe, expect, it } from 'vitest';
import { coachAdvice, coachRanking, CoachInput, SkillPractice, skillPriority } from './coach';
import { DrillRoundRecord } from './drill-round';
import { initialRatings, SkillRatings } from './skill-rating';

const NOW = '2026-11-21T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * DAY_MS).toISOString();
}

function practice(skill: SkillPractice['skill'], days: number, fields: Partial<SkillPractice> = {}): SkillPractice {
  return { skill, atIso: daysAgo(days), isFailure: false, errorTypes: [], ...fields };
}

function ratingsOf(values: Partial<Record<keyof SkillRatings, number>>): SkillRatings {
  const ratings = initialRatings();
  for (const [skill, rating] of Object.entries(values)) {
    ratings[skill as keyof SkillRatings] = { rating: rating!, attempts: 1 };
  }
  return ratings;
}

function practisedEverythingToday(): SkillPractice[] {
  return (['distance', 'dope', 'wind', 'conditions', 'angle', 'lead', 'execution', 'speed'] as const).map(skill => practice(skill, 0));
}

function input(fields: Partial<CoachInput> = {}): CoachInput {
  return { ratings: initialRatings(), practices: practisedEverythingToday(), rounds: [], nowIso: NOW, isEverythingUnlocked: false, ...fields };
}

describe('приоритет навыка', () => {
  it('(1 − рейтинг / 100) + min(дней / 7; 1); без занятий — давность 1', () => {
    expect(skillPriority(40, 0)).toBeCloseTo(0.6, 9);
    expect(skillPriority(40, 3.5)).toBeCloseTo(1.1, 9);
    expect(skillPriority(40, 30)).toBeCloseTo(1.6, 9);
    expect(skillPriority(80, null)).toBeCloseTo(1.2, 9);
  });
});

describe('порядок советов', () => {
  it('слабый навык выше; давность поднимает сильный; равенство — по порядку навыков', () => {
    const ranking = coachRanking(input({ ratings: ratingsOf({ wind: 20, dope: 70 }), practices: [...practisedEverythingToday().filter(item => item.skill !== 'dope'), practice('dope', 10)] }));
    expect(ranking.map(advice => advice.skill)).toEqual(['dope', 'wind', 'distance', 'conditions', 'angle', 'lead', 'execution', 'speed']);
    expect(ranking[0].priority).toBeCloseTo(1.3, 9);
  });

  it('учитывается последнее занятие навыка, а не первое', () => {
    const practices = [...practisedEverythingToday().filter(item => item.skill !== 'angle'), practice('angle', 20), practice('angle', 1)];
    expect(coachRanking(input({ practices })).find(advice => advice.skill === 'angle')!.priority).toBeCloseTo(0.6 + 1 / 7, 9);
  });

  it('дрил по навыку: счётные для расчёта, холодный выстрел для исполнения, этап для скорости', () => {
    const drillOf = Object.fromEntries(coachRanking(input()).map(advice => [advice.skill, advice.drillId]));
    expect(drillOf).toEqual({ distance: 'milling', dope: 'dope', wind: 'wind', conditions: 'conditions', angle: 'angle', lead: 'lead', execution: 'cold-bore', speed: 'timed-stage' });
  });

  it('уровень «на время» — только заработанный: 2 раунда обучения ≥ 80 %; «Открыть всё» его не советует (QA 22.11)', () => {
    const accurate: DrillRoundRecord = { drillId: 'milling', level: 'learn', seed: 1, startedAtIso: daysAgo(0), cards: [{ verdict: 'exact', errorTypes: [], seconds: 5 }] };
    const levelOf = (fields: Partial<CoachInput>) => coachRanking(input(fields)).find(advice => advice.skill === 'distance')!.level;
    expect(levelOf({})).toBe('learn');
    expect(levelOf({ rounds: [accurate, accurate] })).toBe('timed');
    expect(levelOf({ isEverythingUnlocked: true })).toBe('learn');
    expect(levelOf({ isEverythingUnlocked: true, rounds: [accurate, accurate] })).toBe('timed');
  });

  it('совет — верхний', () => {
    expect(coachAdvice(input({ ratings: ratingsOf({ lead: 10 }) })).skill).toBe('lead');
  });
});

describe('причина совета', () => {
  const reasonOf = (practices: SkillPractice[], ratings = ratingsOf({ wind: 10 })) => coachAdvice(input({ ratings, practices: [...practisedEverythingToday(), ...practices] })).reason;

  it('≥ 2 неудач за неделю — ошибки и самый частый тип; при равенстве — по порядку типов проверки', () => {
    expect(reasonOf([practice('wind', 1, { isFailure: true, errorTypes: ['rounding'] }), practice('wind', 2, { isFailure: true, errorTypes: ['side'] }), practice('wind', 3, { isFailure: true, errorTypes: ['side', 'rounding'] })])).toEqual({ kind: 'errors', count: 3, topError: 'side' });
    expect(reasonOf([practice('wind', 1, { isFailure: true, errorTypes: ['rounding'] }), practice('wind', 2, { isFailure: true, errorTypes: ['side'] })])).toEqual({ kind: 'errors', count: 2, topError: 'side' });
    expect(reasonOf([practice('wind', 1, { isFailure: true, errorTypes: ['rounding'] }), practice('wind', 2, { isFailure: true, errorTypes: ['rounding'] }), practice('wind', 3, { isFailure: true, errorTypes: ['side'] })])).toEqual({ kind: 'errors', count: 3, topError: 'rounding' });
    expect(reasonOf([practice('wind', 1, { isFailure: true }), practice('wind', 2, { isFailure: true })])).toEqual({ kind: 'errors', count: 2, topError: null });
  });

  it('неудачи старше недели и одна неудача — не «ошибки»; чужой навык не считается', () => {
    expect(reasonOf([practice('wind', 8, { isFailure: true }), practice('wind', 9, { isFailure: true }), practice('wind', 1, { isFailure: true }), practice('dope', 1, { isFailure: true })]).kind).toBe('weak');
  });

  it('без занятий — «ещё не тренировали»; ≥ 7 дней — «давно» с целыми днями; иначе — рейтинг', () => {
    const without = (skill: SkillPractice['skill']) => practisedEverythingToday().filter(item => item.skill !== skill);
    expect(coachAdvice(input({ practices: without('angle') })).reason).toEqual({ kind: 'never' });
    expect(coachAdvice(input({ practices: [...without('angle'), practice('angle', 9.6)] })).reason).toEqual({ kind: 'stale', days: 9 });
    expect(coachAdvice(input({ practices: [...without('angle'), practice('angle', 6.9)], ratings: ratingsOf({ angle: 33.4 }) })).reason).toEqual({ kind: 'weak', rating: 33 });
  });
});
