import { beforeAll, describe, expect, it } from 'vitest';
import { cartridgeById, RIFLE, TARGETS } from './content';
import { BallisticsEngine } from './engine';
import { createScenario, windAt } from './scenario';
import { explainMiss, MissInputs, resolveShot } from './shot';
import { Correction } from './types';

const engine = new BallisticsEngine();
const cartridge = cartridgeById('B');
const target500 = TARGETS[1];
const scenario = createScenario(20261032, { windScale: 0 });
let perfectDial: Correction;

beforeAll(async () => {
  const points = await engine.trajectory(cartridge, scenario.atmosphere, windAt(scenario, scenario.startTimeS));
  const required = BallisticsEngine.required(points, target500.distanceM);
  perfectDial = { upMrad: required.upMrad, rightMrad: required.rightMrad };
});

describe('resolveShot', () => {
  it('a perfect dial leaves no decision error', async () => {
    const result = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 0);
    expect(result.decision.upMrad).toBeCloseTo(0, 2);
    expect(result.decision.rightMrad).toBeCloseTo(0, 2);
  });

  it('is reproducible for the same seed, shot and dial', async () => {
    const first = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 1);
    const second = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 1);
    expect(first).toEqual(second);
  });

  it('a large hold moves the impact by the hold', async () => {
    const centered = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 2);
    const held = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 2, { hold: { upMrad: 0, rightMrad: 2 } });
    expect(held.impact.rightMrad - centered.impact.rightMrad).toBeCloseTo(2, 1);
    expect(held.isHit).toBe(false);
  });

  it('a wrong elevation of 1 mrad misses a 0.5 mrad plate', async () => {
    const result = await resolveShot(engine, scenario, cartridge, target500, { ...perfectDial, upMrad: perfectDial.upMrad + 1 }, 0);
    expect(result.isHit).toBe(false);
    expect(result.cause).toBe('vertical');
  });

  it('orders the probabilities: optimum ≥ with decision ≥ with decision and hold', async () => {
    const result = await resolveShot(engine, scenario, cartridge, target500, { ...perfectDial, upMrad: perfectDial.upMrad + 0.2 }, 0, {
      hold: { upMrad: 0.2, rightMrad: 0 },
    });
    expect(result.optimumProbability).toBeGreaterThanOrEqual(result.decisionProbability);
    expect(result.decisionProbability).toBeGreaterThanOrEqual(result.hitProbability);
  });

  it('luck is the hit outcome minus the hit chance', async () => {
    const result = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 0);
    expect(result.luck).toBeCloseTo((result.isHit ? 1 : 0) - result.hitProbability, 6);
    expect(result.luck).toBeGreaterThanOrEqual(-1);
    expect(result.luck).toBeLessThanOrEqual(1);
  });

  it('a cold bore shot lands shifted by the rifle cold bore shift', async () => {
    const warm = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 3);
    const cold = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 3, { isColdBore: true });
    expect(warm.coldBore).toEqual({ upMrad: 0, rightMrad: 0 });
    expect(cold.coldBore).toEqual(RIFLE.coldBoreShiftMil);
    expect(cold.impact.upMrad - warm.impact.upMrad).toBeCloseTo(0.15, 9);
    expect(cold.impact.rightMrad - warm.impact.rightMrad).toBeCloseTo(0.05, 9);
  });

  it('the hit chance of a cold bore shot accounts for the shift', async () => {
    const dialUnderShift = { upMrad: perfectDial.upMrad - 0.3, rightMrad: perfectDial.rightMrad - 0.1 };
    const warm = await resolveShot(engine, scenario, cartridge, target500, dialUnderShift, 4);
    const cold = await resolveShot(engine, scenario, cartridge, target500, dialUnderShift, 4, { isColdBore: true });
    expect(cold.hitProbability).toBeGreaterThan(warm.hitProbability);
  });

  it('plate radius is 0.5 mrad at 500 m', async () => {
    const result = await resolveShot(engine, scenario, cartridge, target500, perfectDial, 0);
    expect(result.radiusMrad).toBe(0.5);
  });
});

const baseInputs: MissInputs = {
  decision: { upMrad: 0, rightMrad: 0 },
  velocitySpread: { upMrad: 0, rightMrad: 0 },
  group: { upMrad: 0, rightMrad: 0 },
  hold: { upMrad: 0, rightMrad: 0 },
  windShift: { upMrad: 0, rightMrad: 0 },
  atmosphereUpMrad: 0,
  dial: { upMrad: 4, rightMrad: -0.5 },
  ideal: { upMrad: 4, rightMrad: -0.5 },
  radiusMrad: 0.5,
  isHit: false,
};

describe('explainMiss', () => {
  it('blames the hold when the decision was right and the cross was off', () => {
    const result = explainMiss({ ...baseInputs, hold: { upMrad: 0.4, rightMrad: 0 } });
    expect(result.cause).toBe('hold');
    expect(result.verdict).toContain('Крест в момент выстрела стоял на 0.40 mrad');
  });

  it('blames luck when the decision was right and random spread was large', () => {
    expect(explainMiss({ ...baseInputs, velocitySpread: { upMrad: 0.3, rightMrad: 0 } }).cause).toBe('luck');
  });

  it('a hit with a right decision is luck-category praise', () => {
    expect(explainMiss({ ...baseInputs, isHit: true }).cause).toBe('luck');
  });

  it('blames a gust when the wind shift explains the horizontal error', () => {
    const result = explainMiss({ ...baseInputs, decision: { upMrad: 0, rightMrad: 0.6 }, windShift: { upMrad: 0, rightMrad: 0.4 } });
    expect(result.cause).toBe('gust');
  });

  it('points at the flags when the wind was underestimated', () => {
    const result = explainMiss({ ...baseInputs, decision: { upMrad: 0, rightMrad: 0.6 }, dial: { upMrad: 4, rightMrad: -0.2 }, ideal: { upMrad: 4, rightMrad: -0.8 } });
    expect(result.cause).toBe('flags');
  });

  it('calls out overcorrection for wind', () => {
    const result = explainMiss({ ...baseInputs, decision: { upMrad: 0, rightMrad: -0.6 }, dial: { upMrad: 4, rightMrad: -1.4 }, ideal: { upMrad: 4, rightMrad: -0.8 } });
    expect(result.cause).toBe('wind');
    expect(result.verdict).toContain('влево');
  });

  it('blames the atmosphere for a vertical miss it explains', () => {
    const result = explainMiss({ ...baseInputs, decision: { upMrad: -0.6, rightMrad: 0 }, atmosphereUpMrad: 0.5 });
    expect(result.cause).toBe('vertical');
    expect(result.verdict).toContain('температуру и давление');
  });
});
