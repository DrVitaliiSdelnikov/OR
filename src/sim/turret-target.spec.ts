import { describe, expect, it } from 'vitest';
import { scopeById, Turret } from './scope-model';
import { turretProgress, turretTarget } from './turret-target';

const treeScope = scopeById('tree');
const CLICK_MIL = treeScope.clickMrad;

describe('turretTarget', () => {
  it('turns the notebook total into clicks: ↑ 1.6 → 16 clicks, nothing to hold', () => {
    const target = turretTarget(Turret.elevation(treeScope), 1.6, CLICK_MIL);
    expect(target.targetClicks).toBe(16);
    expect(target.holdMil).toBeCloseTo(0, 9);
  });

  it('rounds half a click away from zero: ↑ 0.35 → 4 clicks, hold −0.05', () => {
    const target = turretTarget(Turret.elevation(treeScope), 0.35, CLICK_MIL);
    expect(target.targetClicks).toBe(4);
    expect(target.holdMil).toBeCloseTo(-0.05, 9);
  });

  it('below zero stops at ZERO STOP and holds the rest (set И: ↓ 0.1)', () => {
    const target = turretTarget(Turret.elevation(treeScope), -0.1, CLICK_MIL);
    expect(target.targetClicks).toBe(0);
    expect(target.holdMil).toBeCloseTo(-0.1, 9);
  });

  it('beyond the top stop dials the maximum and holds the rest', () => {
    const turret = Turret.elevation(treeScope);
    const target = turretTarget(turret, (turret.maxClicks + 5) * CLICK_MIL, CLICK_MIL);
    expect(target.targetClicks).toBe(turret.maxClicks);
    expect(target.holdMil).toBeCloseTo(0.5, 9);
  });

  it('windage beyond the side stop clamps to the far side', () => {
    const turret = Turret.windage(treeScope);
    const target = turretTarget(turret, (turret.minClicks - 3) * CLICK_MIL, CLICK_MIL);
    expect(target.targetClicks).toBe(turret.minClicks);
    expect(target.holdMil).toBeCloseTo(-0.3, 9);
  });
});

describe('turretProgress', () => {
  it('from 0 to 16, now at 12: four more clicks up', () => {
    expect(turretProgress(0, 12, 16)).toEqual({ remainingClicks: 4, direction: 'up', isOnTarget: false, overshootClicks: 0 });
  });

  it('on target: nothing left', () => {
    expect(turretProgress(0, 16, 16)).toEqual({ remainingClicks: 0, direction: 'none', isOnTarget: true, overshootClicks: 0 });
  });

  it('turned past the target: two extra clicks, turn back down', () => {
    expect(turretProgress(0, 18, 16)).toEqual({ remainingClicks: 2, direction: 'down', isOnTarget: false, overshootClicks: 2 });
  });

  it('mirrors for turning down past the target', () => {
    expect(turretProgress(20, 14, 16)).toEqual({ remainingClicks: 2, direction: 'up', isOnTarget: false, overshootClicks: 2 });
  });

  it('starting short of the target on the far side is not an overshoot', () => {
    expect(turretProgress(20, 18, 16)).toEqual({ remainingClicks: 2, direction: 'down', isOnTarget: false, overshootClicks: 0 });
  });

  it('starting already on target: no direction, no overshoot', () => {
    expect(turretProgress(16, 16, 16)).toEqual({ remainingClicks: 0, direction: 'none', isOnTarget: true, overshootClicks: 0 });
  });
});
