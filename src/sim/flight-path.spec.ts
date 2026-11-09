import { describe, expect, it } from 'vitest';
import { cartridgeById } from '../core/content';
import { BallisticsEngine } from '../core/engine';
import { flightPaths, flightSamples } from './flight-path';

const engine = new BallisticsEngine();
const CALM = [{ untilM: 1000, speedMps: 0, fromDeg: 90 }];
const WIND_FROM_RIGHT = [{ untilM: 1000, speedMps: 5, fromDeg: 90 }];

async function samples(distanceM: number, zones = CALM) {
  const points = await engine.trajectory(cartridgeById('B'), null, zones, undefined, distanceM / 10);
  return flightSamples(points, distanceM);
}

describe('flightSamples', () => {
  it('ten points up to the target, the last exactly at its distance', async () => {
    const result = await samples(300);
    expect(result).toHaveLength(10);
    expect(result[0].distanceM).toBe(30);
    expect(result.at(-1)!.distanceM).toBe(300);
  });

  it('a distance between whole metres still ends exactly at the target', async () => {
    const points = await engine.trajectory(cartridgeById('B'), null, CALM, undefined, 37);
    expect(flightSamples(points, 375).at(-1)!.distanceM).toBe(375);
  });
});

describe('flightPaths — side view', () => {
  it('the bullet line ends at the impact, the centre line at the target centre', async () => {
    const paths = flightPaths(await samples(300), { upMrad: -0.5, rightMrad: 0.2 });
    expect(paths.bullet.at(-1)!.heightCm).toBeCloseTo(-15, 6);
    expect(paths.bullet.at(-1)!.sideCm).toBeCloseTo(6, 6);
    expect(paths.centre.at(-1)!.heightCm).toBeCloseTo(0, 6);
    expect(paths.centre.at(-1)!.sideCm).toBeCloseTo(0, 6);
  });

  it('both lines start at the muzzle a sight height below the line of sight; at 300 m the bullet rises above it on the way', async () => {
    const paths = flightPaths(await samples(300), { upMrad: 0.3, rightMrad: 0 });
    expect(paths.centre[0]).toEqual({ distanceM: 0, heightCm: -5, sideCm: 0 });
    expect(paths.bullet[0]).toEqual({ distanceM: 0, heightCm: -5, sideCm: 0 });
    expect(Math.max(...paths.centre.map(point => point.heightCm))).toBeGreaterThan(5);
  });

  it('both lines differ only by a straight tilt growing to the miss', async () => {
    const paths = flightPaths(await samples(300), { upMrad: -0.5, rightMrad: 0 });
    const middle = paths.bullet.findIndex(point => point.distanceM === 150);
    expect(paths.bullet[middle].heightCm - paths.centre[middle].heightCm).toBeCloseTo(-7.5, 6);
  });
});

describe('flightPaths — top view', () => {
  it('a cross wind bows the centre line sideways and brings it back to the centre at the target; calm keeps it straight', async () => {
    const windy = flightPaths(await samples(600, WIND_FROM_RIGHT), { upMrad: 0, rightMrad: 0 });
    const sides = windy.centre.map(point => point.sideCm);
    expect(Math.max(...sides.map(Math.abs))).toBeGreaterThan(5);
    expect(sides.at(-1)).toBeCloseTo(0, 6);
    const calm = flightPaths(await samples(600), { upMrad: 0, rightMrad: 0 });
    expect(Math.max(...calm.centre.map(point => Math.abs(point.sideCm)))).toBeLessThan(0.5);
  });
});
