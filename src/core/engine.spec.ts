import { describe, expect, it } from 'vitest';
import { cartridgeById, RIFLE } from './content';
import { BallisticsEngine } from './engine';

const engine = new BallisticsEngine();
const cartridgeB = cartridgeById('B');

describe('BallisticsEngine.trajectory', () => {
  it('returns samples every 100 m out to 1000 m', async () => {
    const points = await engine.trajectory(cartridgeB, null, null);
    expect(points.map(point => point.distanceM)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it('is zeroed at 100 m', async () => {
    const points = await engine.trajectory(cartridgeB, null, null);
    expect(Math.abs(BallisticsEngine.required(points, RIFLE.zeroM).upMrad)).toBeLessThan(0.02);
  });

  it('needs more elevation the farther the target', async () => {
    const points = await engine.trajectory(cartridgeB, null, null);
    const elevations = [300, 400, 500, 600, 700, 800, 900, 1000].map(distanceM => BallisticsEngine.required(points, distanceM).upMrad);
    expect(elevations[0]).toBeGreaterThan(0);
    for (let index = 1; index < elevations.length; index++) {
      expect(elevations[index]).toBeGreaterThan(elevations[index - 1]);
    }
  });

  it('matches the reference drop table within 0.05 mrad', async () => {
    const points = await engine.trajectory(cartridgeB, null, null);
    expect(BallisticsEngine.required(points, 300).upMrad).toBeCloseTo(1.63, 1);
    expect(BallisticsEngine.required(points, 500).upMrad).toBeCloseTo(4.13, 1);
    expect(BallisticsEngine.required(points, 700).upMrad).toBeCloseTo(7.56, 1);
  });

  it('wind from the left (90°) pushes right, so the correction is to the left', async () => {
    const points = await engine.trajectory(cartridgeB, null, [{ untilM: Infinity, speedMps: 4, fromDeg: 90 }]);
    expect(BallisticsEngine.required(points, 500).rightMrad).toBeLessThan(0);
  });

  it('wind from the right (270°) needs a correction to the right', async () => {
    const points = await engine.trajectory(cartridgeB, null, [{ untilM: Infinity, speedMps: 4, fromDeg: 270 }]);
    expect(BallisticsEngine.required(points, 500).rightMrad).toBeGreaterThan(0);
  });

  it('a faster bullet drops less', async () => {
    const slow = await engine.trajectory(cartridgeB, null, null, 780);
    const fast = await engine.trajectory(cartridgeB, null, null, 820);
    expect(BallisticsEngine.required(fast, 700).upMrad).toBeLessThan(BallisticsEngine.required(slow, 700).upMrad);
  });

  it('colder denser air needs more elevation', async () => {
    const cold = await engine.trajectory(cartridgeB, { temperatureC: -10, pressureHpa: 1030, relativeHumidity: 0.5 }, null);
    const hot = await engine.trajectory(cartridgeB, { temperatureC: 35, pressureHpa: 990, relativeHumidity: 0.5 }, null);
    expect(BallisticsEngine.required(cold, 700).upMrad).toBeGreaterThan(BallisticsEngine.required(hot, 700).upMrad);
  });
});

describe('BallisticsEngine.required', () => {
  it('throws for a distance without a sample', () => {
    expect(() => BallisticsEngine.required([], 350)).toThrow('no trajectory sample at 350 m');
  });
});
