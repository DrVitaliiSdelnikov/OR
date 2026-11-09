import { describe, expect, it } from 'vitest';
import { CourseResults, exerciseById, ExerciseId } from '../../sim/course';
import { briefingCard } from './briefing.model';

const FRESH: CourseResults = { isIntroCompleted: true, bestClasses: {} };

function card(id: ExerciseId, course: CourseResults = FRESH) {
  return briefingCard(exerciseById(id)!, course);
}

describe('briefingCard', () => {
  it('04: header, the class standards from COURSE, the mode with its multiplier, what is new', () => {
    const briefing = card('04');
    expect(briefing.header).toBe('ЗАДАНИЕ 04 · УЧЕБНОЕ');
    expect(briefing.title).toBe('Флажок на бруствере');
    expect(briefing.classRows).toEqual([
      '3 класс — от 70 % очков',
      '2 класс — 85 % и скорость перенесена без ошибки',
      '1 класс — все первым и вклад ветра учтён на всех',
    ]);
    expect(briefing.mode).toBe('АВТО × 1.0');
    expect(briefing.novelty).toBe('Новое: ветер, метеостанция, флажок у бруствера');
    expect(briefing.termsLine).toBe('узнаешь: ветер · правило часов · флажок · метеостанция · боковая составляющая');
    expect(briefing.best).toBeNull();
  });

  it('after an admission: no «Новое», the best result instead', () => {
    const briefing = card('04', { isIntroCompleted: true, bestClasses: { '04': 2 }, bestTotals: { '04': 25 } });
    expect(briefing.novelty).toBeNull();
    expect(briefing.best).toBe('лучший: 2 класс · 25 очк.');
  });

  it('a run without admission keeps «Новое» and shows no best class', () => {
    const briefing = card('04', { isIntroCompleted: true, bestClasses: { '04': 0 }, bestTotals: { '04': 10 } });
    expect(briefing.novelty).not.toBeNull();
    expect(briefing.best).toBe('лучший: не зачтено · 10 очк.');
  });

  it('the scheme: distance text, a flag with wind, paper in 02', () => {
    expect(card('04').scheme).toEqual({ distanceText: '300 м', isPaper: false, hasFlag: true, targetCount: 3 });
    expect(card('01').scheme.hasFlag).toBe(false);
    expect(card('02').scheme).toEqual({ distanceText: '100 м', isPaper: true, hasFlag: false, targetCount: 1 });
    expect(card('05').scheme.distanceText).toBe('300–600 м · неизвестно');
    expect(card('06').scheme.distanceText).toBe('400–500 м');
  });

  it('SAM modes carry their multipliers; 01 has no 1st-class skill goal', () => {
    expect(card('06').mode).toBe('САМ · лёгкий × 1.5');
    expect(card('10').mode).toBe('САМ · сложный × 2.0');
    expect(card('01').classRows[2]).toBe('1 класс — все первым');
    expect(card('02').classRows[2]).toBe('1 класс — все в мишень и холодный — без срыва спуска, контрольный ≤ 0,3 MIL от точки прицеливания');
  });

  it('12 is the attestation without the terms line', () => {
    const briefing = card('12');
    expect(briefing.header).toBe('ЗАДАНИЕ 12 · АТТЕСТАЦИЯ');
    expect(briefing.termsLine).toBeNull();
    expect(briefing.novelty).toBeNull();
  });

  it('«с инструктором»: on before the admission, off after it; only where there is a script', () => {
    expect(card('01').instructor).toEqual({ isDefaultOn: true });
    expect(card('03', { isIntroCompleted: true, bestClasses: { '03': 2 } }).instructor).toEqual({ isDefaultOn: false });
    expect(card('02', { isIntroCompleted: true, bestClasses: { '02': 0 } }).instructor).toEqual({ isDefaultOn: true });
    expect(card('04').instructor).toBeNull();
  });

  it('the facts stay from the sheet', () => {
    expect(card('04').facts.wind).toContain('м/с');
  });
});
