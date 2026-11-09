import { describe, expect, it } from 'vitest';
import { FreePlayUnlocks, setupTask } from './course';
import { allowedFreePlay, DEFAULT_FREE_PLAY, FREE_PLAY_DISTANCES_M, freePlayTask, FreePlaySettings, knownFreePlay, WIND_PRESETS } from './free-play';

const ALL_OPEN: FreePlayUnlocks = {
  unknownDistance: true,
  manualEasy: true,
  manualHard: true,
  cartridgesAC: true,
  gustyWind: true,
  milDotScope: true,
  moaScope: true,
  longRangeScope: true,
  secondFocalPlaneScope: true,
};
const NOTHING_OPEN: FreePlayUnlocks = Object.fromEntries(Object.keys(ALL_OPEN).map(key => [key, false])) as unknown as FreePlayUnlocks;

function settings(fields: Partial<FreePlaySettings> = {}): FreePlaySettings {
  return { ...DEFAULT_FREE_PLAY, ...fields };
}

describe('free play — the task', () => {
  it('600 m, moderate wind, cartridge B, AUTO: one gong on 600, wind 4–6, a free plan with B, pressure trigger', () => {
    const task = freePlayTask(settings({ distanceM: 600, wind: 'moderate', cartridgeId: 'B', notebookMode: 'auto' }));
    expect(task.kind).toBe('free');
    expect(task.targets).toEqual({ count: 1, distance: { kind: 'fixed', distanceM: 600 } });
    expect(task.conditions.windSpeedRangeMps).toEqual([4, 6]);
    expect([task.trigger, task.notebookMode, task.hasColdBore, task.hasKnockedSight]).toEqual(['pressure', 'auto', false, false]);
    const setup = setupTask(task, 7);
    expect(setup.plan).toEqual({ kind: 'free', cartridgeId: 'B' });
    expect(setup.targets).toEqual([{ distanceM: 600, diameterM: 0.5 }]);
  });

  it('beyond 600 m the gong is 0.7 m, as in the course', () => {
    expect(setupTask(freePlayTask(settings({ distanceM: 800 })), 1).targets[0].diameterM).toBe(0.7);
  });

  it('unknown distance: 100–1000 by the seed and never round, as in the course; the notebook does not know it', () => {
    const distanceOf = (seed: number) => setupTask(freePlayTask(settings({ isDistanceUnknown: true })), seed).targets[0].distanceM;
    const distances = Array.from({ length: 40 }, (_, seed) => distanceOf(seed));
    expect(distances.every(distance => distance >= 100 && distance <= 1000 && distance % 50 !== 0)).toBe(true);
    expect(new Set(distances).size).toBeGreaterThan(5);
    expect(distanceOf(11)).toBe(distanceOf(11));
    expect(freePlayTask(settings({ isDistanceUnknown: true })).targets!.distance.kind).toBe('unknown');
  });

  it('the slider goes 100–1000 m in steps of 50', () => {
    expect([FREE_PLAY_DISTANCES_M[0], FREE_PLAY_DISTANCES_M[1], FREE_PLAY_DISTANCES_M[FREE_PLAY_DISTANCES_M.length - 1], FREE_PLAY_DISTANCES_M.length]).toEqual([100, 150, 1000, 19]);
  });

  it('five wind presets', () => {
    expect(WIND_PRESETS.calm.windScale).toBe(0);
    expect(WIND_PRESETS.light.windSpeedRangeMps).toEqual([2, 2.5]);
    expect(WIND_PRESETS.moderate.windSpeedRangeMps).toEqual([4, 6]);
    expect(WIND_PRESETS.strong.windSpeedRangeMps).toEqual([7, 9]);
    expect(WIND_PRESETS.gusty.isWindUniform).toBe(false);
  });

  it('the chosen scope goes to the task', () => {
    expect(freePlayTask(settings({ scopeId: 'moa' })).scopeId).toBe('moa');
  });
});

describe('free play — what is open', () => {
  it('before the course opens them, locked choices fall back to the open ones', () => {
    const chosen = settings({ isDistanceUnknown: true, cartridgeId: 'A', notebookMode: 'manual-hard', wind: 'gusty', scopeId: 'moa' });
    expect(allowedFreePlay(chosen, NOTHING_OPEN)).toEqual({ ...chosen, isDistanceUnknown: false, cartridgeId: 'B', notebookMode: 'auto', wind: 'light', scopeId: 'course-tree' });
  });

  it('hard SAM without 10 but with 06 becomes easy SAM', () => {
    expect(allowedFreePlay(settings({ notebookMode: 'manual-hard' }), { ...ALL_OPEN, manualHard: false }).notebookMode).toBe('manual-easy');
  });

  it('everything open — the choice stays', () => {
    const chosen = settings({ isDistanceUnknown: true, cartridgeId: 'C', notebookMode: 'manual-hard', wind: 'gusty', scopeId: 'dot' });
    expect(allowedFreePlay(chosen, ALL_OPEN)).toEqual(chosen);
  });

  it('a saved choice is read back; an old save without it, or with junk, gives the defaults', () => {
    const saved = settings({ distanceM: 750, wind: 'strong', cartridgeId: 'C' });
    expect(knownFreePlay(saved)).toEqual(saved);
    expect(knownFreePlay(undefined)).toEqual(DEFAULT_FREE_PLAY);
    expect(knownFreePlay({ distanceM: 1234, wind: 'storm' } as unknown as Partial<FreePlaySettings>)).toEqual(DEFAULT_FREE_PLAY);
  });

  it('the defaults: 300 m, light wind, course scope, B, AUTO, instructor off', () => {
    expect(DEFAULT_FREE_PLAY).toEqual({ distanceM: 300, isDistanceUnknown: false, wind: 'light', scopeId: 'course-tree', cartridgeId: 'B', notebookMode: 'auto', isInstructorNear: false });
  });
});
