import { describe, expect, it } from 'vitest';
import {
  atmosphereCorrectionMil,
  averageCrosswindMps,
  clicksDifference,
  crosswindMps,
  isRangeWithinTolerance,
  leadMil,
  rangeByMilling,
  roundToClicks,
  windCorrectionMil,
} from './game-formulas';

const CLICK_MIL = 0.1;
const WIND_CONSTANT = 2400;

describe('crosswindMps', () => {
  it('takes half the speed from 11 o’clock (set В: 3.2 → 1.6)', () => {
    expect(crosswindMps(3.2, 11)).toBeCloseTo(1.6, 6);
  });

  it('takes the full speed from 9 o’clock and none from 12', () => {
    expect(crosswindMps(3.2, 9)).toBeCloseTo(3.2, 6);
    expect(crosswindMps(3.2, 12)).toBe(0);
  });
});

describe('windCorrectionMil', () => {
  it('3.2 m/s from 9 o’clock at 300 m needs 0.4 to the left (set А)', () => {
    expect(windCorrectionMil(3.2, 9, 300, WIND_CONSTANT)).toBeCloseTo(-0.4, 6);
  });

  it('3.2 m/s from 11 o’clock at 600 m needs 0.4 to the left (set В)', () => {
    expect(windCorrectionMil(3.2, 11, 600, WIND_CONSTANT)).toBeCloseTo(-0.4, 6);
  });

  it('wind from the right (3 o’clock) needs a correction to the right', () => {
    expect(windCorrectionMil(3.2, 3, 300, WIND_CONSTANT)).toBeCloseTo(0.4, 6);
  });

  it('head and tail wind need no correction', () => {
    expect(windCorrectionMil(5, 12, 600, WIND_CONSTANT)).toBe(0);
    expect(windCorrectionMil(5, 6, 600, WIND_CONSTANT)).toBe(0);
  });

  it('calm or zero distance needs no correction', () => {
    expect(windCorrectionMil(0, 9, 600, WIND_CONSTANT)).toBe(0);
    expect(windCorrectionMil(3.2, 9, 0, WIND_CONSTANT)).toBe(0);
  });
});

describe('roundToClicks', () => {
  it('rounds half away from zero (set Б: 0.35 → 4)', () => {
    expect(roundToClicks(0.35, CLICK_MIL)).toBe(4);
    expect(roundToClicks(-0.35, CLICK_MIL)).toBe(-4);
  });

  it('rounds to the nearest click', () => {
    expect(roundToClicks(0.34, CLICK_MIL)).toBe(3);
    expect(roundToClicks(0.36, CLICK_MIL)).toBe(4);
  });

  it('is not fooled by floating point (0.3 / 0.1 and 0.4 / 0.1)', () => {
    expect(roundToClicks(0.3, CLICK_MIL)).toBe(3);
    expect(roundToClicks(0.4, CLICK_MIL)).toBe(4);
    expect(roundToClicks(0.1 + 0.2, CLICK_MIL)).toBe(3);
  });
});

describe('clicksDifference', () => {
  it('0.3 against 0.4 is one click', () => {
    expect(clicksDifference(0.3, 0.4, CLICK_MIL)).toBe(1);
  });

  it('0.8 against 0.4 is four clicks (set В)', () => {
    expect(clicksDifference(0.8, 0.4, CLICK_MIL)).toBe(4);
  });

  it('the wrong side counts the whole distance across zero', () => {
    expect(clicksDifference(-0.4, 0.4, CLICK_MIL)).toBe(8);
  });
});

describe('atmosphereCorrectionMil', () => {
  const row = { colderBy10CMil: 0.2, pressureUp10HpaMil: 0.06 };

  it('standard air (+15 C, 1013 hPa) needs no correction', () => {
    expect(atmosphereCorrectionMil(row, 15, 1013)).toBe(0);
  });

  it('20 degrees colder and 20 hPa higher add both columns twice', () => {
    expect(atmosphereCorrectionMil(row, -5, 1033)).toBeCloseTo(0.52, 6);
  });

  it('heat and low pressure take elevation away', () => {
    expect(atmosphereCorrectionMil(row, 35, 1000)).toBeCloseTo(-0.478, 6);
  });

  it('cold with low pressure partly cancels out', () => {
    expect(atmosphereCorrectionMil(row, 5, 1003)).toBeCloseTo(0.14, 6);
  });
});

describe('rangeByMilling', () => {
  it('a 0.5 m gong at 1.7 MIL is 294 m away (set Ж)', () => {
    expect(rangeByMilling(0.5, 1.7)).toBeCloseTo(294.1, 1);
  });

  it('rejects a zero reading', () => {
    expect(() => rangeByMilling(0.5, 0)).toThrow(RangeError);
  });

  it('294 m is within ±5 % of 300 m, 280 m is not', () => {
    expect(isRangeWithinTolerance(294, 300, 0.05)).toBe(true);
    expect(isRangeWithinTolerance(280, 300, 0.05)).toBe(false);
    expect(isRangeWithinTolerance(280, 300, 0.1)).toBe(true);
  });

  it('exactly 5 % off still counts', () => {
    expect(isRangeWithinTolerance(285, 300, 0.05)).toBe(true);
    expect(isRangeWithinTolerance(315, 300, 0.05)).toBe(true);
  });
});

describe('leadMil', () => {
  it('1.2 m/s across, 0.6 s of flight at 400 m is 1.8 MIL (set Д)', () => {
    expect(leadMil(1.2, 3, 0.6, 400)).toBeCloseTo(1.8, 6);
  });

  it('a target walking straight at the shooter needs no lead', () => {
    expect(leadMil(1.2, 12, 0.6, 400)).toBe(0);
  });

  it('zero distance needs no lead', () => {
    expect(leadMil(1.2, 3, 0.6, 0)).toBe(0);
  });

  it('a target walking at 1 o’clock needs half the lead', () => {
    expect(leadMil(1.2, 1, 0.6, 400)).toBeCloseTo(0.9, 6);
  });
});

describe('averageCrosswindMps', () => {
  it('the same wind in every zone is that wind', () => {
    expect(averageCrosswindMps([3, 3, 3, 3], [0.3, 0.35, 0.25, 0.1])).toBeCloseTo(3, 9);
  });

  it('weights each zone: station 2, flags 4 / 1 / 0 → 2.25', () => {
    expect(averageCrosswindMps([2, 4, 1, 0], [0.3, 0.35, 0.25, 0.1])).toBeCloseTo(2.25, 9);
  });

  it('a wind from the other side counts against', () => {
    expect(averageCrosswindMps([2, -2, 0, 0], [0.5, 0.5, 0, 0])).toBeCloseTo(0, 9);
  });

  it('refuses a different number of winds and weights', () => {
    expect(() => averageCrosswindMps([2, 4, 1], [0.3, 0.35, 0.25, 0.1])).toThrow(RangeError);
  });
});
