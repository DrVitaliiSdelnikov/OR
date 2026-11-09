import { beforeAll, describe, expect, it } from 'vitest';
import { cartridgeById } from '../core/content';
import { buildDopeCard, DopeCard } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { patrolPositionM } from '../core/moving-target';
import { exerciseById, setupTask } from './course';
import { createNotebook, factorContributions } from './notebook';
import { movementClockAt, movingShotOptions, PATROL_SPEEDS_MPS, patrolPlan, targetOffsetMil } from './patrol';
import { scopeById } from './scope-model';

const CROSSWISE_CLOCKS = [3, 9];
const OBLIQUE_CLOCKS = [1.5, 4.5, 7.5, 10.5];
const SEEDS = Array.from({ length: 20 }, (_, index) => 500 + index * 13);

function isRightward(clock: number): boolean {
  return clock > 0 && clock < 6;
}

describe('patrolPlan', () => {
  it('ten targets: speeds and tracking or ambush follow the ladder', () => {
    const plan = patrolPlan(1);
    expect(plan.map(target => target.path.speedMps)).toEqual([0.4, 0.6, 1.1, 1.1, 1.7, 0.6, 1.1, 1.1, 1.7, 1.7]);
    expect(plan.map(target => target.isAmbush)).toEqual([false, false, false, false, false, true, true, true, true, true]);
    expect(PATROL_SPEEDS_MPS).toEqual([0.4, 0.6, 1.1, 1.7]);
  });

  it('crosswise targets walk at 3 or 9 o’clock, oblique ones at the half hours', () => {
    const obliqueIndexes = [3, 4, 7, 9];
    for (const seed of SEEDS) {
      patrolPlan(seed).forEach((target, index) => {
        expect(obliqueIndexes.includes(index) ? OBLIQUE_CLOCKS : CROSSWISE_CLOCKS).toContain(target.path.movementClock);
      });
    }
  });

  it('the same seed gives the same plan; seeds vary the side', () => {
    expect(patrolPlan(42)).toEqual(patrolPlan(42));
    const firstClocks = new Set(SEEDS.map(seed => patrolPlan(seed)[0].path.movementClock));
    expect(firstClocks).toEqual(new Set([3, 9]));
    const obliqueClocks = new Set(SEEDS.map(seed => patrolPlan(seed)[3].path.movementClock));
    expect(obliqueClocks.size).toBeGreaterThan(2);
  });

  it('the walk is speed × 8 s each way', () => {
    const plan = patrolPlan(3);
    expect(plan[0].path.halfWidthM).toBeCloseTo(3.2, 9);
    expect(plan[4].path.halfWidthM).toBeCloseTo(13.6, 9);
  });

  it('a target starts at the edge it walks away from', () => {
    for (const seed of SEEDS) {
      for (const { path } of patrolPlan(seed)) {
        expect(path.startOffsetM).toBeCloseTo(isRightward(path.movementClock) ? -path.halfWidthM : path.halfWidthM, 9);
      }
    }
  });
});

describe('where the target is and where it goes', () => {
  const walkingRight = { speedMps: 1.2, movementClock: 3, startOffsetM: 0, halfWidthM: 5 };

  it('1.2 m to the right at 400 m is +3.0 MIL', () => {
    expect(targetOffsetMil(walkingRight, 400, 1)).toBeCloseTo(3, 9);
    expect(patrolPositionM(walkingRight, 1)).toBeCloseTo(1.2, 9);
  });

  it('after the turn the clock is mirrored', () => {
    const turnTimeS = 5 / 1.2;
    expect(movementClockAt(walkingRight, 1)).toBe(3);
    expect(movementClockAt(walkingRight, turnTimeS + 1)).toBe(9);
    const obliqueRight = { speedMps: 1.2, movementClock: 1.5, startOffsetM: 0, halfWidthM: 5 };
    const obliqueTurnS = 5 / (1.2 * Math.SQRT1_2);
    expect(movementClockAt(obliqueRight, obliqueTurnS + 1)).toBe(10.5);
    expect(movementClockAt({ ...obliqueRight, movementClock: 4.5 }, obliqueTurnS + 1)).toBe(7.5);
    expect(movementClockAt({ ...obliqueRight, movementClock: 9, startOffsetM: 0 }, 1)).toBe(9);
  });

  it('the shot gets the lateral speed of the moment, with its sign', () => {
    expect(movingShotOptions(walkingRight, 1).targetLateralVelocityMps).toBeCloseTo(1.2, 9);
    expect(movingShotOptions(walkingRight, 5 / 1.2 + 1).targetLateralVelocityMps).toBeCloseTo(-1.2, 9);
  });
});

describe('course and notebook', () => {
  let card: DopeCard;

  beforeAll(async () => {
    card = await buildDopeCard(new BallisticsEngine(), cartridgeById('B'), 0.1);
  });

  it('exercise 11 gets the patrol plan; exercise 10 does not', () => {
    const setup = setupTask(exerciseById('11')!, 9);
    expect(setup.patrol).toEqual(patrolPlan(9));
    expect(setup.targets).toHaveLength(10);
    expect(setupTask(exerciseById('10')!, 9).patrol).toBeUndefined();
  });

  it('the lead points the way the target walks now', () => {
    const path = { speedMps: 1.1, movementClock: 3, startOffsetM: 0, halfWidthM: 8.8 };
    const leadAt = (timeS: number) =>
      factorContributions(
        createNotebook(
          {
            card,
            scope: scopeById('tree'),
            target: { sizeM: 0.5, distanceM: 400, movement: { speedMps: path.speedMps, clock: movementClockAt(path, timeS) } },
            hasZones: false,
            canTakeWindFromStation: false,
            seed: 1,
          },
          'auto',
        ),
      ).lead.mil!;
    expect(leadAt(2)).toBeGreaterThan(0);
    expect(leadAt(8.8 / 1.1 + 2)).toBeLessThan(0);
  });
});
