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

describe('подпись величины с заданными знаками (T1.8a)', () => {
  it('метрика — как раньше на экранах: 2,0 м/с, −2,5 C-шкала, 600 м', () => {
    expect(units.valueText('windSpeed', 2, 'metric', 1)).toBe('2,0 м/с');
    expect(units.valueText('distance', 600, 'metric', 0)).toBe('600 м');
    expect(units.valueText('temperature', -2.5, 'metric', 1)).toBe('−2,5 °C');
  });

  it('имперские: ярды по числу, миль/ч, °F, дюймы рт. ст., футы, дюймы', () => {
    expect(units.valueText('distance', 600, 'imperial', 0)).toBe('656 ярдов');
    expect(units.valueText('windSpeed', 2, 'imperial', 1)).toBe('4,5 миль/ч');
    expect(units.valueText('temperature', -2.5, 'imperial', 0)).toBe('+28 °F');
    expect(units.valueText('pressure', 1030, 'imperial', 2)).toBe('30,42 дюйма рт. ст.');
    expect(units.valueText('altitude', 1500, 'imperial', -1)).toBe('4920 футов');
    expect(units.valueText('impactOffset', 30, 'imperial', 1)).toBe('11,8 дюйма');
  });
});

describe('подпись диапазона (T1.8a)', () => {
  it('метрика и имперские; одно значение — без тире; температура со знаком', () => {
    expect(units.rangeText('windSpeed', [2, 2.5], 'metric')).toBe('2–2,5 м/с');
    expect(units.rangeText('windSpeed', [2, 2.5], 'imperial')).toBe('4,5–5,6 миль/ч');
    expect(units.rangeText('distance', [400, 700], 'imperial')).toBe('437–766 ярдов');
    expect(units.rangeText('distance', [300, 300], 'metric')).toBe('300 м');
    expect(units.rangeText('temperature', [-5, 0], 'metric')).toBe('−5…0 °C');
    expect(units.rangeText('temperature', [15, 15], 'metric')).toBe('+15 °C');
    expect(units.rangeText('temperature', [-5, 0], 'imperial')).toBe('+23…32 °F');
    expect(units.rangeText('pressure', [1025, 1035], 'imperial')).toBe('30,27–30,56 дюйма рт. ст.');
    expect(units.rangeText('altitude', [1000, 1500], 'imperial')).toBe('3280–4920 футов');
    expect(units.rangeText('targetSize', [0.5, 0.7], 'imperial')).toBe('20–28 дюймов');
    expect(units.rangeText('targetSize', [0.35, 0.35], 'metric')).toBe('0,35 м');
  });
});
