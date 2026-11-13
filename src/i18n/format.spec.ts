import { describe, expect, it } from 'vitest';
import { andList, decimal, percent, plural, signed } from './format';

const SHOT_FORMS = ['выстрел', 'выстрела', 'выстрелов'] as const;

describe('decimal', () => {
  it('ставит запятую и держит число знаков', () => {
    expect(decimal(0.1, 1)).toBe('0,1');
    expect(decimal(3.44, 2)).toBe('3,44');
    expect(decimal(3, 1)).toBe('3,0');
    expect(decimal(12, 0)).toBe('12');
  });

  it('минус — типографский, у нуля минуса нет', () => {
    expect(decimal(-0.3, 1)).toBe('−0,3');
    expect(decimal(-0, 1)).toBe('0,0');
    expect(decimal(-0.04, 1)).toBe('0,0');
  });

  it('округляет как toFixed', () => {
    for (const value of [2.25, 1.005, 0.35, 0.45, 7.85]) {
      expect(decimal(value, 1), String(value)).toBe(value.toFixed(1).replace('.', ','));
    }
  });

  it('без знаков после запятой — как есть, без лишних нулей', () => {
    expect(decimal(0.5)).toBe('0,5');
    expect(decimal(1.25)).toBe('1,25');
    expect(decimal(300)).toBe('300');
  });
});

describe('signed', () => {
  it('плюс у положительного, минус у отрицательного, ноль без знака', () => {
    expect(signed(0.3, 1)).toBe('+0,3');
    expect(signed(-0.3, 1)).toBe('−0,3');
    expect(signed(0, 1)).toBe('0,0');
    expect(signed(0.02, 1)).toBe('0,0');
  });
});

describe('percent', () => {
  it('доля → проценты с пробелом', () => {
    expect(percent(0.7)).toBe('70 %');
    expect(percent(0.85)).toBe('85 %');
    expect(percent(1)).toBe('100 %');
  });
});

describe('plural', () => {
  it('русские формы для 1, 2–4 и 5+, исключение 11–14', () => {
    const cases: [number, string][] = [
      [0, 'выстрелов'], [1, 'выстрел'], [2, 'выстрела'], [4, 'выстрела'], [5, 'выстрелов'],
      [11, 'выстрелов'], [12, 'выстрелов'], [14, 'выстрелов'], [21, 'выстрел'], [22, 'выстрела'],
      [25, 'выстрелов'], [111, 'выстрелов'],
    ];
    for (const [count, form] of cases) {
      expect(plural(count, SHOT_FORMS), String(count)).toBe(form);
    }
  });
});

describe('andList', () => {
  it('последний — через «и», остальные — через запятую', () => {
    expect(andList([200, 400, 600])).toBe('200, 400 и 600');
    expect(andList([200, 400])).toBe('200 и 400');
    expect(andList([200])).toBe('200');
    expect(andList([])).toBe('');
  });
});
