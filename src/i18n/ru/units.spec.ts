import { describe, expect, it } from 'vitest';
import { QUANTITIES, UNIT_SYSTEMS } from '../../core/units';
import { units } from './units';

describe('подписи единиц (T1.1)', () => {
  it('дальность в ярдах склоняется по числу', () => {
    expect(units.quantityText('distance', 0.9144, 'imperial')).toBe('1 ярд');
    expect(units.quantityText('distance', 2 * 0.9144, 'imperial')).toBe('2 ярда');
    expect(units.quantityText('distance', 275 * 0.9144, 'imperial')).toBe('275 ярдов');
  });

  it('дробь — с запятой и знаками по шагу, минус типографский', () => {
    expect(units.quantityText('windSpeed', 2.5, 'metric')).toBe('2,5 м/с');
    expect(units.quantityText('windSpeed', 2.54, 'imperial')).toBe('5,7 миль/ч');
    expect(units.quantityText('temperature', -20, 'imperial')).toBe('−4 °F');
    expect(units.quantityText('targetSize', 0.5, 'metric')).toBe('0,5 м');
    expect(units.quantityText('bulletLength', 31.2, 'imperial')).toBe('1,228 дюйма');
    expect(units.quantityText('pressure', 1013.2, 'imperial')).toBe('29,92 дюйма рт. ст.');
  });

  it('у каждой величины в обеих системах есть подпись', () => {
    for (const system of UNIT_SYSTEMS) {
      for (const quantity of QUANTITIES) {
        expect(units.unitLabel(quantity, system), `${quantity} ${system}`).not.toBe('');
      }
    }
    expect(units.unitLabel('temperature', 'imperial')).toBe('°F');
    expect(units.unitLabel('windSpeed', 'imperial')).toBe('миль/ч');
  });
});
