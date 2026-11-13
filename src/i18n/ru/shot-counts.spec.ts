import { describe, expect, it } from 'vitest';
import { text } from '..';

describe('число выстрелов согласовано с числом', () => {
  it('карточка упражнения: «до N выстрелов на цель» и «N выстрелов»', () => {
    const sheet = text.screens.exerciseSheet;
    expect([1, 2, 5].map(maxShots => sheet.shotsUntilHit({ maxShots }))).toEqual(['до 1 выстрела на цель', 'до 2 выстрелов на цель', 'до 5 выстрелов на цель']);
    expect([1, 2, 5, 21].map(maxShots => sheet.shotsFixed({ maxShots }))).toEqual(['1 выстрел', '2 выстрела', '5 выстрелов', '21 выстрел']);
  });

  it('журнал и разбор: «после N выстрелов», «от N выстрелов»', () => {
    expect(text.screens.journal.statsFew({ minShots: 10 })).toBe('Статистика наберётся после 10 выстрелов');
    expect(text.screens.journal.statsFew({ minShots: 21 })).toBe('Статистика наберётся после 21 выстрела');
    expect(text.review.groupTooSmall({ minShots: 3 })).toBe('Диагноз группы — от 3 выстрелов');
    expect(text.review.groupTooSmall({ minShots: 1 })).toBe('Диагноз группы — от 1 выстрела');
  });
});
