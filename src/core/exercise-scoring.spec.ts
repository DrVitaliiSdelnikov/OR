import { describe, expect, it } from 'vitest';
import { calcPoints, exerciseClass, hitShare, modeMultiplier, rankFor, seriesTotal, targetPoints } from './exercise-scoring';

describe('targetPoints', () => {
  it('gives 10 for a first-round hit, 5 for a second-round hit, 0 for a miss', () => {
    expect(targetPoints([true])).toBe(10);
    expect(targetPoints([false, true])).toBe(5);
    expect(targetPoints([false, false])).toBe(0);
  });

  it('gives 0 for a target nobody shot at', () => {
    expect(targetPoints([])).toBe(0);
  });

  it('rejects more shots than the exercise allows', () => {
    expect(() => targetPoints([false, false, true])).toThrow(RangeError);
    expect(() => targetPoints([false, false, true], 5)).not.toThrow();
  });
});

describe('calcPoints', () => {
  it('gives 10 / 5 / 0 for exact / close / error', () => {
    expect(calcPoints('exact')).toBe(10);
    expect(calcPoints('close')).toBe(5);
    expect(calcPoints('error')).toBe(0);
  });
});

describe('modeMultiplier', () => {
  it('is 1.0 for АВТО, 1.5 for САМ лёгкий, 2.0 for САМ сложный', () => {
    expect(modeMultiplier('auto', false)).toBe(1);
    expect(modeMultiplier('manual-easy', false)).toBe(1.5);
    expect(modeMultiplier('manual-hard', false)).toBe(2);
  });

  it('drops to 1.0 for a repeat after recalculation', () => {
    expect(modeMultiplier('manual-hard', true)).toBe(1);
  });
});

describe('seriesTotal', () => {
  it('set З: (35 + 35) × 1.5 = 105', () => {
    expect(seriesTotal({ targetPoints: [10, 10, 10, 5], calcPoints: [10, 10, 10, 5], multiplier: 1.5, hasOpenedReference: false })).toBe(105);
  });

  it('rounds half up: 35 × 1.5 = 52.5 → 53', () => {
    expect(seriesTotal({ targetPoints: [10, 10, 10, 5], calcPoints: [], multiplier: 1.5, hasOpenedReference: false })).toBe(53);
  });

  it('takes 30 away once for the opened reference', () => {
    expect(seriesTotal({ targetPoints: [10, 10, 10, 5], calcPoints: [10, 10, 10, 5], multiplier: 1.5, hasOpenedReference: true })).toBe(75);
  });

  it('never goes below zero', () => {
    expect(seriesTotal({ targetPoints: [0], calcPoints: [0], multiplier: 2, hasOpenedReference: true })).toBe(0);
  });
});

describe('hitShare', () => {
  it('counts only target points: 35 of 40 is 0.875', () => {
    expect(hitShare([10, 10, 10, 5])).toBeCloseTo(0.875, 6);
  });

  it('is 0 with no targets', () => {
    expect(hitShare([])).toBe(0);
  });
});

describe('exerciseClass', () => {
  const seventyPercent = hitShare([10, 10, 10, 10, 10, 10, 10, 0, 0, 0]);

  it('below 70 % is not passed', () => {
    expect(exerciseClass({ hitShare: 0.69, isSkillGoalMet: true, isTopSkillGoalMet: true })).toBe(0);
  });

  it('exactly 70 % is 3rd class', () => {
    expect(exerciseClass({ hitShare: seventyPercent, isSkillGoalMet: false, isTopSkillGoalMet: false })).toBe(3);
  });

  it('85 % needs the skill goal for 2nd class', () => {
    expect(exerciseClass({ hitShare: 0.85, isSkillGoalMet: false, isTopSkillGoalMet: false })).toBe(3);
    expect(exerciseClass({ hitShare: 0.85, isSkillGoalMet: true, isTopSkillGoalMet: false })).toBe(2);
  });

  it('1st class needs 100 % and both skill goals', () => {
    expect(exerciseClass({ hitShare: 1, isSkillGoalMet: true, isTopSkillGoalMet: false })).toBe(2);
    expect(exerciseClass({ hitShare: 1, isSkillGoalMet: true, isTopSkillGoalMet: true })).toBe(1);
  });

  it('classes are cumulative: the top goal alone does not lift past 3rd', () => {
    expect(exerciseClass({ hitShare: 1, isSkillGoalMet: false, isTopSkillGoalMet: true })).toBe(3);
  });
});

describe('rankFor', () => {
  it.each([
    [0, 'cadet'],
    [2, 'cadet'],
    [3, 'rifleman'],
    [6, 'rifleman'],
    [7, 'senior-rifleman'],
    [11, 'senior-rifleman'],
    [12, 'sniper'],
  ] as const)('%i admissions give %s', (admissions, rank) => {
    expect(rankFor(admissions, false)).toBe(rank);
  });

  it('all twelve on 1st class make a sniper-instructor', () => {
    expect(rankFor(12, true)).toBe('sniper-instructor');
    expect(rankFor(11, true)).toBe('senior-rifleman');
  });
});
