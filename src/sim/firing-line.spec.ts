import { describe, expect, it } from 'vitest';
import { targetPoints } from '../core/exercise-scoring';
import { FiringLine, FiringPlan, FiringStage } from './firing-line';

function gongs(targetCount: number, cartridgeId: FiringStage['cartridgeId'] = 'B'): FiringStage {
  return { cartridgeId, targetCount, maxShotsPerTarget: 2, closesOnHit: true };
}

function exercise(stages: FiringStage[], hasColdBore = true): FiringPlan {
  return { kind: 'exercise', stages, hasColdBore };
}

const MISS = false;
const HIT = true;

describe('FiringLine — exercise', () => {
  it('3 gongs × 2: loads 5 of 6 rounds, first target, first shot cold', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    expect(line.magazineLoaded).toBe(5);
    expect(line.magazineLeft).toBe(5);
    expect(line.targetIndex).toBe(0);
    expect(line.cartridgeId).toBe('B');
    expect(line.isNextShotCold).toBe(true);
  });

  it('a first-shot hit closes the target and moves on', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    expect(line.recordShot(HIT)).toEqual(['target-closed', 'next-target']);
    expect(line.targetIndex).toBe(1);
    expect(line.magazineLeft).toBe(4);
    expect(line.isNextShotCold).toBe(false);
  });

  it('a miss keeps the target, the second miss closes it', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    expect(line.recordShot(MISS)).toEqual([]);
    expect(line.targetIndex).toBe(0);
    expect(line.recordShot(MISS)).toEqual(['target-closed', 'next-target']);
    expect(line.targetIndex).toBe(1);
  });

  it('all first-shot hits finish the exercise with rounds to spare', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    line.recordShot(HIT);
    line.recordShot(HIT);
    expect(line.recordShot(HIT)).toEqual(['target-closed', 'exercise-done']);
    expect(line.isFinished).toBe(true);
    expect(line.magazineLeft).toBe(2);
  });

  it('an empty magazine asks for a new one with the rounds left in the exercise', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    for (let shot = 0; shot < 4; shot++) {
      line.recordShot(MISS);
    }
    expect(line.recordShot(MISS)).toEqual(['magazine-empty']);
    expect(line.magazineLeft).toBe(0);
    line.changeMagazine();
    expect(line.magazineLoaded).toBe(1);
    expect(line.magazineLeft).toBe(1);
    expect(line.targetIndex).toBe(2);
  });

  it('a shot with an empty magazine is refused', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    for (let shot = 0; shot < 5; shot++) {
      line.recordShot(MISS);
    }
    expect(() => line.recordShot(MISS)).toThrow(RangeError);
  });

  it('a magazine with rounds in it cannot be changed in the course', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    line.recordShot(MISS);
    expect(() => line.changeMagazine()).toThrow(RangeError);
  });

  it('a shot after the exercise is over is refused', () => {
    const line = new FiringLine(exercise([gongs(1)]));
    line.recordShot(HIT);
    expect(() => line.recordShot(HIT)).toThrow(RangeError);
  });

  it('exercise 08: each cartridge is a stage with its own magazine, the barrel stays warm', () => {
    const line = new FiringLine(exercise([gongs(1, 'A'), gongs(1, 'B'), gongs(1, 'C')]));
    expect(line.magazineLoaded).toBe(2);
    expect(line.recordShot(HIT)).toEqual(['target-closed', 'stage-done']);
    expect(line.stageIndex).toBe(1);
    expect(line.magazineLeft).toBe(0);
    line.changeMagazine();
    expect(line.cartridgeId).toBe('B');
    expect(line.magazineLoaded).toBe(2);
    expect(line.targetIndex).toBe(0);
    expect(line.isNextShotCold).toBe(false);
    line.recordShot(MISS);
    line.recordShot(MISS);
    line.changeMagazine();
    expect(line.cartridgeId).toBe('C');
    expect(line.recordShot(HIT)).toEqual(['target-closed', 'exercise-done']);
    expect(line.series.map(series => series.cartridgeId)).toEqual(['A', 'B', 'C']);
  });

  it('exercise 02: five shots at one target, hits do not close it, only the first is cold', () => {
    const line = new FiringLine(exercise([{ cartridgeId: 'B', targetCount: 1, maxShotsPerTarget: 5, closesOnHit: false }]));
    expect(line.recordShot(HIT)).toEqual([]);
    for (let shot = 0; shot < 3; shot++) {
      expect(line.recordShot(HIT)).toEqual([]);
    }
    expect(line.recordShot(HIT)).toEqual(['target-closed', 'exercise-done']);
    const shots = line.series[0].targets[0];
    expect(shots).toHaveLength(5);
    expect(shots.map(shot => shot.isColdBore)).toEqual([true, false, false, false, false]);
  });

  it('exercise 01 has no cold bore', () => {
    const line = new FiringLine(exercise([gongs(3)], false));
    expect(line.isNextShotCold).toBe(false);
    line.recordShot(HIT);
    expect(line.series[0].targets[0][0].isColdBore).toBe(false);
  });

  it('the series feeds the 10 / 5 scoring per target', () => {
    const line = new FiringLine(exercise([gongs(3)]));
    line.recordShot(HIT);
    line.recordShot(MISS);
    line.recordShot(HIT);
    line.recordShot(MISS);
    line.recordShot(MISS);
    const points = line.series[0].targets.map(shots => targetPoints(shots.map(shot => shot.isHit)));
    expect(points).toEqual([10, 5, 0]);
  });
});

describe('FiringLine — free play', () => {
  it('five rounds, then the magazine is empty; no end of exercise', () => {
    const line = new FiringLine({ kind: 'free', cartridgeId: 'B' });
    expect(line.isNextShotCold).toBe(true);
    for (let shot = 0; shot < 4; shot++) {
      expect(line.recordShot(HIT)).toEqual([]);
    }
    expect(line.recordShot(HIT)).toEqual(['magazine-empty']);
    expect(line.isFinished).toBe(false);
    line.changeMagazine();
    expect(line.magazineLeft).toBe(5);
    expect(line.series).toHaveLength(2);
  });

  it('a cartridge change mid-magazine starts a new series and keeps the old one', () => {
    const line = new FiringLine({ kind: 'free', cartridgeId: 'B' });
    line.recordShot(HIT);
    line.recordShot(MISS);
    line.changeMagazine('C');
    expect(line.cartridgeId).toBe('C');
    expect(line.magazineLeft).toBe(5);
    expect(line.isNextShotCold).toBe(false);
    expect(line.series).toHaveLength(2);
    expect(line.series[0]).toEqual({
      cartridgeId: 'B',
      targets: [[{ isHit: true, isColdBore: true }, { isHit: false, isColdBore: false }]],
    });
    expect(line.series[1]).toEqual({ cartridgeId: 'C', targets: [[]] });
  });

  it('changing an untouched magazine does not leave an empty series behind', () => {
    const line = new FiringLine({ kind: 'free', cartridgeId: 'B' });
    line.changeMagazine('A');
    expect(line.series).toEqual([{ cartridgeId: 'A', targets: [[]] }]);
    expect(line.isNextShotCold).toBe(true);
  });
});
