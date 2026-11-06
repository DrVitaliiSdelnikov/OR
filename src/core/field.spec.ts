import { describe, expect, it } from 'vitest';
import { cartridgeById } from './content';
import { BallisticsEngine } from './engine';
import { crosswindByClockRule, densityAltitudeM, formatClock, impactSoundDelayS, isTransonic, speedOfSoundMps, windClockShare } from './field';

describe('wind clock rule', () => {
  it('follows the sine table: 12 and 6 → 0, 1/5/7/11 → 0.5, 2/4/8/10 → 0.87, 3 and 9 → 1', () => {
    const expectedByHour: [number, number][] = [
      [12, 0], [1, 0.5], [2, 0.87], [3, 1], [4, 0.87], [5, 0.5],
      [6, 0], [7, 0.5], [8, 0.87], [9, 1], [10, 0.87], [11, 0.5],
    ];
    for (const [clockHours, share] of expectedByHour) {
      expect(windClockShare(clockHours)).toBe(share);
    }
  });

  it('half hours follow the sine too', () => {
    expect(windClockShare(1.5)).toBe(0.71);
    expect(windClockShare(10.5)).toBe(0.71);
    expect(windClockShare(2.5)).toBe(0.97);
  });

  it('normalises hours outside 0–12', () => {
    expect(windClockShare(15)).toBe(windClockShare(3));
    expect(windClockShare(-3)).toBe(windClockShare(9));
    expect(windClockShare(0)).toBe(windClockShare(12));
  });

  it('4 m/s from 10:30 gives 2.84 m/s crosswind', () => {
    expect(crosswindByClockRule(4, 10.5)).toBeCloseTo(2.84, 6);
  });

  it('formats half hours', () => {
    expect(formatClock(10.5)).toBe('10:30');
    expect(formatClock(0)).toBe('12:00');
  });
});

describe('atmosphere helpers', () => {
  it('density altitude is about 0 m in the standard atmosphere', () => {
    expect(Math.abs(densityAltitudeM(15, 1013.25))).toBeLessThan(30);
  });

  it('hot thin air raises density altitude', () => {
    expect(densityAltitudeM(30, 990)).toBeGreaterThan(500);
  });

  it('speed of sound is 343 m/s at 20 °C', () => {
    expect(speedOfSoundMps(20)).toBeCloseTo(343.4, 1);
  });

  it('steel rings about 3 s after the shot at 700 m', () => {
    expect(impactSoundDelayS(1.1, 700, 15)).toBeGreaterThan(3);
    expect(impactSoundDelayS(1.1, 700, 15)).toBeLessThan(3.3);
  });

  it('transonic below 1.2 Mach', () => {
    expect(isTransonic(400, 15)).toBe(true);
    expect(isTransonic(500, 15)).toBe(false);
  });
});

describe('BallisticsEngine.interpolated', () => {
  it('returns exact samples unchanged', async () => {
    const points = await new BallisticsEngine().trajectory(cartridgeById('B'), null, null);
    expect(BallisticsEngine.interpolated(points, 500)).toEqual(BallisticsEngine.required(points, 500));
  });

  it('blends between samples for 525 m', async () => {
    const points = await new BallisticsEngine().trajectory(cartridgeById('B'), null, null);
    const at500 = BallisticsEngine.required(points, 500).upMrad;
    const at600 = BallisticsEngine.required(points, 600).upMrad;
    expect(BallisticsEngine.interpolated(points, 525).upMrad).toBeCloseTo(at500 + (at600 - at500) * 0.25, 6);
  });

  it('rejects distances beyond the trajectory', async () => {
    const points = await new BallisticsEngine().trajectory(cartridgeById('B'), null, null);
    expect(() => BallisticsEngine.interpolated(points, 1100)).toThrow();
    expect(() => BallisticsEngine.interpolated(points, 1000)).not.toThrow();
  });
});
