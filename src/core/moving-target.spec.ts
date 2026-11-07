import { beforeAll, describe, expect, it } from 'vitest';
import { cartridgeById, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C } from './content';
import { buildDopeCard, DopeCard, dopeRowAt } from './dope-card';
import { BallisticsEngine } from './engine';
import { leadMil } from './game-formulas';
import { lateralVelocityMps, PatrolPath, patrolPositionM, patrolVelocityMps, targetMotionMil } from './moving-target';
import { Atmosphere } from './types';

const HALF_CLICK_MIL = 0.05;

function patrol(fields: Partial<PatrolPath> = {}): PatrolPath {
  return { speedMps: 1, movementClock: 3, startOffsetM: 0, halfWidthM: 5, ...fields };
}

describe('lateralVelocityMps', () => {
  it('3 o’clock is to the right, 9 to the left, 12 straight away', () => {
    expect(lateralVelocityMps(1.2, 3)).toBeCloseTo(1.2, 9);
    expect(lateralVelocityMps(1.2, 9)).toBeCloseTo(-1.2, 9);
    expect(lateralVelocityMps(1.2, 12)).toBeCloseTo(0, 9);
    expect(lateralVelocityMps(1.2, 6)).toBeCloseTo(0, 9);
  });

  it('oblique uses the exact sine, not the rounded share', () => {
    expect(lateralVelocityMps(1.2, 1.5)).toBeCloseTo(1.2 * Math.SQRT1_2, 9);
    expect(lateralVelocityMps(1.2, 10.5)).toBeCloseTo(-1.2 * Math.SQRT1_2, 9);
  });
});

describe('targetMotionMil', () => {
  it('set Д: 1.2 m/s, 0.60 s, 400 m → 1.80 MIL', () => {
    expect(targetMotionMil(1.2, 0.6, 400)).toBeCloseTo(1.8, 9);
  });

  it('keeps the sign of the movement', () => {
    expect(targetMotionMil(-1.2, 0.6, 400)).toBeCloseTo(-1.8, 9);
  });

  it('zero distance gives no motion', () => {
    expect(targetMotionMil(1.2, 0.6, 0)).toBe(0);
  });
});

describe('patrol', () => {
  it('walks right, turns at the edge and walks back', () => {
    expect(patrolPositionM(patrol(), 3)).toBeCloseTo(3, 9);
    expect(patrolPositionM(patrol(), 7)).toBeCloseTo(3, 9);
    expect(patrolPositionM(patrol(), 12)).toBeCloseTo(-2, 9);
    expect(patrolPositionM(patrol(), 23)).toBeCloseTo(3, 9);
  });

  it('a patrol to the left starts towards the left edge', () => {
    expect(patrolPositionM(patrol({ movementClock: 9 }), 3)).toBeCloseTo(-3, 9);
    expect(patrolPositionM(patrol({ movementClock: 9 }), 7)).toBeCloseTo(-3, 9);
  });

  it('oblique patrol walks at its lateral speed', () => {
    expect(patrolPositionM(patrol({ movementClock: 1.5, speedMps: 2 }), 2)).toBeCloseTo(2 * 2 * Math.SQRT1_2, 9);
  });

  it('velocity follows the direction and flips at the edge', () => {
    expect(patrolVelocityMps(patrol(), 3)).toBeCloseTo(1, 9);
    expect(patrolVelocityMps(patrol(), 7)).toBeCloseTo(-1, 9);
    expect(patrolVelocityMps(patrol(), 5)).toBeCloseTo(-1, 9);
    expect(patrolVelocityMps(patrol(), 15)).toBeCloseTo(1, 9);
  });

  it('a standing target stays put', () => {
    expect(patrolPositionM(patrol({ halfWidthM: 0, startOffsetM: 0 }), 4)).toBe(0);
    expect(patrolVelocityMps(patrol({ halfWidthM: 0 }), 4)).toBe(0);
  });

  it('a target walking straight away does not move sideways', () => {
    expect(patrolPositionM(patrol({ movementClock: 12, startOffsetM: 2 }), 4)).toBeCloseTo(2, 9);
    expect(patrolVelocityMps(patrol({ movementClock: 12 }), 4)).toBe(0);
  });

  it('a start beyond the edge is pulled back to the edge', () => {
    expect(patrolPositionM(patrol({ startOffsetM: 8 }), 0)).toBeCloseTo(5, 9);
    expect(patrolPositionM(patrol({ startOffsetM: -8 }), 0)).toBeCloseTo(-5, 9);
  });

  it('starting in the middle of the left half keeps the period', () => {
    expect(patrolPositionM(patrol({ startOffsetM: -2 }), 4)).toBeCloseTo(2, 9);
    expect(patrolPositionM(patrol({ startOffsetM: -2 }), 9)).toBeCloseTo(3, 9);
    expect(patrolPositionM(patrol({ startOffsetM: -2 }), 24)).toBeCloseTo(2, 9);
  });
});

describe('the lead formula against the core', () => {
  const engine = new BallisticsEngine();
  const cartridge = cartridgeById('B');
  const standard: Atmosphere = { temperatureC: STANDARD_TEMPERATURE_C, pressureHpa: STANDARD_PRESSURE_HPA, relativeHumidity: STANDARD_RELATIVE_HUMIDITY };
  let card: DopeCard;

  beforeAll(async () => {
    card = await buildDopeCard(engine, cartridge, 0.1);
  });

  it('differs by less than half a click on 300–500 m', async () => {
    for (const distanceM of [300, 350, 400, 450, 500]) {
      const points = await engine.trajectory(cartridge, standard, null, cartridge.muzzleVelocityMps, distanceM);
      const coreTimeOfFlightS = BallisticsEngine.required(points, distanceM).timeS;
      const cardTimeOfFlightS = dopeRowAt(card, distanceM).timeOfFlightS;
      for (const speedMps of [0.4, 0.6, 1.1, 1.7]) {
        for (const movementClock of [3, 1.5]) {
          const formulaMil = leadMil(speedMps, movementClock, cardTimeOfFlightS, distanceM);
          const coreMil = targetMotionMil(lateralVelocityMps(speedMps, movementClock), coreTimeOfFlightS, distanceM);
          expect(Math.abs(formulaMil - coreMil)).toBeLessThan(HALF_CLICK_MIL);
        }
      }
    }
  });
});
