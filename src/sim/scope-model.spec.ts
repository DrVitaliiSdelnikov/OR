import { describe, expect, it } from 'vitest';
import {
  clickLimits,
  clicksFor,
  defaultMagnification,
  fieldOfViewMil,
  formatScopeValue,
  isHoldoverSettled,
  MRAD_PER_MOA,
  reticleSubtensionScale,
  scopeById,
  splitDialAndHold,
  stepMagnification,
  Turret,
} from './scope-model';

describe('scope models from the design system', () => {
  it('Ёлка: 120 clicks up, ±40 sideways', () => {
    expect(clickLimits(scopeById('tree'))).toEqual({ elevation: 120, windage: 40 });
  });

  it('MOA: 30 MOA up is about 8.7 mrad, 120 quarter-MOA clicks', () => {
    const moa = scopeById('moa');
    expect(moa.elevationTravelMrad).toBeCloseTo(8.73, 2);
    expect(clickLimits(moa)).toEqual({ elevation: 120, windage: 48 });
  });

  it('Dot and Fine travel', () => {
    expect(clickLimits(scopeById('dot'))).toEqual({ elevation: 60, windage: 20 });
    expect(clickLimits(scopeById('fine'))).toEqual({ elevation: 140, windage: 50 });
  });

  it('field of view is 81.2 / magnification mil', () => {
    expect(fieldOfViewMil(12)).toBeCloseTo(6.76, 2);
    expect(fieldOfViewMil(5)).toBeCloseTo(16.24, 2);
  });

  it('SFP Dot is true only at 12×, FFP is always true', () => {
    const dot = scopeById('dot');
    expect(reticleSubtensionScale(dot, 12)).toBe(1);
    expect(reticleSubtensionScale(dot, 6)).toBe(2);
    expect(reticleSubtensionScale(scopeById('tree'), 6)).toBe(1);
  });

  it('magnification steps by 2 above 20× and stays inside the range', () => {
    const tree = scopeById('tree');
    expect(stepMagnification(tree, 15, 1)).toBe(17);
    expect(stepMagnification(tree, 25, 1)).toBe(25);
    expect(stepMagnification(scopeById('dot'), 3, -1)).toBe(3);
    expect(stepMagnification(scopeById('dot'), 7, 1)).toBe(8);
  });

  it('starts in the middle of the zoom range', () => {
    expect(defaultMagnification(scopeById('tree'))).toBe(15);
  });

  it('shows MOA values in MOA', () => {
    expect(formatScopeValue(scopeById('moa'), 2 * MRAD_PER_MOA)).toBe('2.00');
    expect(formatScopeValue(scopeById('tree'), 4.63)).toBe('4.6');
  });

  it('converts mrad to whole clicks', () => {
    expect(clicksFor(scopeById('tree'), 4.63)).toBe(46);
    expect(clicksFor(scopeById('moa'), 1)).toBe(14);
  });
});

describe('Turret', () => {
  it('elevation cannot go below zero (ZERO STOP)', () => {
    const turret = Turret.elevation(scopeById('tree'));
    expect(turret.isAtZeroStop).toBe(true);
    expect(turret.turn(-3)).toEqual({ appliedClicks: 0, stop: 'zero' });
    expect(turret.clicks).toBe(0);
  });

  it('elevation stops at the top of travel', () => {
    const turret = Turret.elevation(scopeById('dot'));
    expect(turret.turn(70)).toEqual({ appliedClicks: 60, stop: 'top' });
    expect(turret.clicks).toBe(60);
  });

  it('windage goes both ways and stops at the side', () => {
    const turret = Turret.windage(scopeById('dot'));
    expect(turret.turn(-15).stop).toBeNull();
    expect(turret.turn(-10)).toEqual({ appliedClicks: -5, stop: 'side' });
    expect(turret.clicks).toBe(-20);
  });

  it('reset returns to zero', () => {
    const turret = Turret.windage(scopeById('tree'));
    turret.turn(12);
    turret.reset();
    expect(turret.clicks).toBe(0);
  });
});

describe('holdover', () => {
  it('reports the remainder past the dial travel', () => {
    const dot = scopeById('dot');
    const turret = Turret.elevation(dot);
    turret.turn(100);
    const split = splitDialAndHold(dot, turret, 7.5);
    expect(split.dialedMrad).toBeCloseTo(6);
    expect(split.remainderMrad).toBeCloseTo(1.5);
  });

  it('is settled within half a click', () => {
    expect(isHoldoverSettled(scopeById('tree'), 0.04)).toBe(true);
    expect(isHoldoverSettled(scopeById('tree'), 0.06)).toBe(false);
  });
});
