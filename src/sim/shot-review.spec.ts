import { describe, expect, it } from 'vitest';
import { Correction } from '../core/types';
import { analyseGroup, diagnoseShot, dopeNoteElevationMil, isCallAccurate, secondShotCorrection } from './shot-review';

const CLICK_MIL = 0.1;
const AIM_POINT: Correction = { upMrad: 0, rightMrad: 0 };

function point(upMrad: number, rightMrad: number): Correction {
  return { upMrad, rightMrad };
}

describe('isCallAccurate', () => {
  it('0.15 MIL off is accurate, 0.25 is not, exactly 0.2 still is', () => {
    expect(isCallAccurate(point(0, 0.15), AIM_POINT)).toBe(true);
    expect(isCallAccurate(point(0.25, 0), AIM_POINT)).toBe(false);
    expect(isCallAccurate(point(0.12, 0.16), AIM_POINT)).toBe(true);
  });
});

describe('diagnoseShot', () => {
  it('reticle on the target and a hit is clean', () => {
    expect(diagnoseShot(point(0.1, 0), true)).toBe('clean');
  });

  it('reticle on the target and a miss is a data error', () => {
    expect(diagnoseShot(point(0.1, 0), false)).toBe('data');
  });

  it('reticle off the target is an execution error, even with a lucky hit', () => {
    expect(diagnoseShot(point(0, 1), false)).toBe('execution');
    expect(diagnoseShot(point(0, 1), true)).toBe('execution');
  });

  it('exactly 0.2 MIL off still counts as on the target', () => {
    expect(diagnoseShot(point(0.12, 0.16), false)).toBe('data');
  });
});

describe('secondShotCorrection', () => {
  it('a hit 0.3 to the right needs 3 clicks to the left', () => {
    expect(secondShotCorrection(AIM_POINT, point(0, 0.3), CLICK_MIL, 'data')).toEqual({ upClicks: 0, rightClicks: -3 });
  });

  it('a hit 0.5 low needs 5 clicks up', () => {
    expect(secondShotCorrection(AIM_POINT, point(-0.5, 0), CLICK_MIL, 'data')).toEqual({ upClicks: 5, rightClicks: 0 });
  });

  it('a jerked trigger does not move the turret (debrief R2)', () => {
    expect(secondShotCorrection(point(0, 1), point(0, 1), CLICK_MIL, 'execution')).toEqual({ upClicks: 0, rightClicks: 0 });
  });

  it('an execution error leaves the turret alone even when the bullet went further than the call', () => {
    expect(secondShotCorrection(point(0, 1), point(0, 1.3), CLICK_MIL, 'execution')).toEqual({ upClicks: 0, rightClicks: 0 });
  });

  it('counts from the call, not from the aim point', () => {
    expect(secondShotCorrection(point(0, 0.15), point(0, 0.45), CLICK_MIL, 'data')).toEqual({ upClicks: 0, rightClicks: -3 });
  });
});

describe('dopeNoteElevationMil', () => {
  it('a clean call 0.1 high corrects ↑ 2.8 to ↑ 2.9 when the bullet landed 0.1 low', () => {
    expect(dopeNoteElevationMil(2.8, AIM_POINT, point(-0.1, 0.4), 'data')).toBeCloseTo(2.9, 9);
  });

  it('wind does not go into the card', () => {
    expect(dopeNoteElevationMil(2.8, AIM_POINT, point(0, 0.6), 'clean')).toBeCloseTo(2.8, 9);
  });

  it('an execution error writes nothing', () => {
    expect(dopeNoteElevationMil(2.8, point(1, 0), point(0.9, 0), 'execution')).toBeNull();
  });
});

describe('analyseGroup', () => {
  it('needs at least three shots', () => {
    expect(analyseGroup([point(0, 0), point(0.1, 0)])).toBeNull();
  });

  it('finds the centre and the spread', () => {
    const group = analyseGroup([point(-0.4, 0.05), point(0, -0.05), point(0.4, 0)])!;
    expect(group.center.upMrad).toBeCloseTo(0, 9);
    expect(group.center.rightMrad).toBeCloseTo(0, 9);
    expect(group.spreadMil.up).toBeCloseTo(0.3266, 4);
    expect(group.spreadMil.right).toBeCloseTo(0.0408, 4);
  });

  it('a vertical string points to breathing', () => {
    expect(analyseGroup([point(-0.4, 0.05), point(0, -0.05), point(0.4, 0)])!.shape).toBe('vertical-string');
  });

  it('a horizontal string points to a canted rifle', () => {
    expect(analyseGroup([point(0.05, -0.4), point(-0.05, 0), point(0, 0.4)])!.shape).toBe('horizontal-string');
  });

  it('a tight group low and right points to the hand and the trigger', () => {
    expect(analyseGroup([point(-0.32, 0.28), point(-0.28, 0.32), point(-0.3, 0.3)])!.shape).toBe('low-right');
  });

  it('a tight group off the centre is a data problem', () => {
    expect(analyseGroup([point(0.02, 0.28), point(-0.02, 0.32), point(0, 0.3)])!.shape).toBe('offset');
  });

  it('shots all over are scattered', () => {
    expect(analyseGroup([point(-0.6, 0.5), point(0, -0.5), point(0.6, 0)])!.shape).toBe('scattered');
  });

  it('a wide vertical group is scattered first, not a string', () => {
    expect(analyseGroup([point(-0.8, 0.02), point(0, -0.02), point(0.8, 0)])!.shape).toBe('scattered');
  });

  it('a round group is not a string', () => {
    expect(analyseGroup([point(-0.3, 0), point(0, 0.3), point(0.3, 0), point(0, -0.3)])!.shape).toBe('tight');
  });

  it('a tight group low and left is an offset, not the hand-and-trigger pattern', () => {
    expect(analyseGroup([point(-0.32, -0.28), point(-0.28, -0.32), point(-0.3, -0.3)])!.shape).toBe('offset');
  });

  it('a tight group on the centre is fine', () => {
    expect(analyseGroup([point(0.05, 0), point(-0.05, 0.03), point(0, -0.03)])!.shape).toBe('tight');
  });
});
