import { describe, expect, it } from 'vitest';
import { CARTRIDGES, cartridgeById } from '../core/content';
import { buildDopeCard, dopeRowAt } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { atmosphereCorrectionMil, windCorrectionMil } from '../core/game-formulas';
import { turretTarget } from './turret-target';
import {
  clickLimits,
  defaultMagnification,
  fieldOfViewMil,
  formatScopeValue,
  freePlayScopes,
  isHoldoverSettled,
  MRAD_PER_MOA,
  reticleSubtensionScale,
  SCOPES,
  scopeById,
  splitDialAndHold,
  stepMagnification,
  Turret,
} from './scope-model';

describe('scope models from the design system', () => {
  it('the catalog: five scopes, reticle separate from the body', () => {
    expect(SCOPES.map(scope => [scope.id, scope.reticle])).toEqual([
      ['course-tree', 'tree'],
      ['course-dot', 'mil-dot'],
      ['moa', 'moa-grid'],
      ['tree', 'tree'],
      ['dot', 'mil-dot'],
    ]);
    for (const scope of SCOPES.filter(candidate => candidate.units === 'MIL')) {
      expect(scope.clickMrad).toBe(0.1);
    }
    expect(scopeById('moa').clickMrad).toBeCloseTo(0.25 * MRAD_PER_MOA, 9);
  });

  it('both course scopes are the same 3–12× first-focal-plane body', () => {
    for (const id of ['course-tree', 'course-dot'] as const) {
      const scope = scopeById(id);
      expect([scope.magnificationMin, scope.magnificationMax, scope.isFirstFocalPlane]).toEqual([3, 12, true]);
      expect(clickLimits(scope)).toEqual({ elevation: 200, windage: 60 });
    }
  });

  it('travel: long-range 28 / ±10, old SFP 17 / ±6, MOA 70 / ±25 MOA', () => {
    expect(clickLimits(scopeById('tree'))).toEqual({ elevation: 280, windage: 100 });
    expect(clickLimits(scopeById('dot'))).toEqual({ elevation: 170, windage: 60 });
    expect(clickLimits(scopeById('moa'))).toEqual({ elevation: 280, windage: 100 });
    expect(scopeById('moa').elevationTravelMrad).toBeCloseTo(70 * MRAD_PER_MOA, 9);
  });

  it('only the old 3–12× sits in the second focal plane', () => {
    expect(SCOPES.filter(scope => !scope.isFirstFocalPlane).map(scope => scope.id)).toEqual(['dot']);
  });

  it('an old saved "fine" reads as the course MIL-dot, an unknown id as the course tree', () => {
    expect(scopeById('fine').id).toBe('course-dot');
    expect(scopeById('nonsense').id).toBe('course-tree');
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
    expect(turret.turn(180)).toEqual({ appliedClicks: 170, stop: 'top' });
    expect(turret.clicks).toBe(170);
  });

  it('windage goes both ways and stops at the side', () => {
    const turret = Turret.windage(scopeById('dot'));
    expect(turret.turn(-50).stop).toBeNull();
    expect(turret.turn(-15)).toEqual({ appliedClicks: -10, stop: 'side' });
    expect(turret.clicks).toBe(-60);
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
    turret.turn(200);
    const split = splitDialAndHold(dot, turret, 18.5);
    expect(split.dialedMrad).toBeCloseTo(17);
    expect(split.remainderMrad).toBeCloseTo(1.5);
  });

  it('is settled within half a click', () => {
    expect(isHoldoverSettled(scopeById('tree'), 0.04)).toBe(true);
    expect(isHoldoverSettled(scopeById('tree'), 0.06)).toBe(false);
  });
});

describe('travel against the core', () => {
  it('the course and long-range scopes fit 1000 m with cartridges A, B, C at −10 C', async () => {
    const engine = new BallisticsEngine();
    for (const cartridge of CARTRIDGES) {
      const card = await buildDopeCard(engine, cartridge, 0.1);
      const row = dopeRowAt(card, 1000);
      const coldElevationMil = row.elevationMil + atmosphereCorrectionMil(row, -10, 1013);
      for (const id of ['course-tree', 'course-dot', 'tree'] as const) {
        expect(coldElevationMil).toBeLessThanOrEqual(scopeById(id).elevationTravelMrad);
      }
    }
  });

  it('course windage: the strongest course wind (9 m/s) fits at 700 m; 12 m/s at 1000 m stops and the rest is held', async () => {
    const card = await buildDopeCard(new BallisticsEngine(), cartridgeById('B'), 0.1);
    const scope = scopeById('course-dot');
    const at700 = Math.abs(windCorrectionMil(9, 9, 700, dopeRowAt(card, 700).windConstant));
    expect(at700).toBeLessThanOrEqual(scope.windageTravelMrad);
    const at1000 = Math.abs(windCorrectionMil(12, 9, 1000, dopeRowAt(card, 1000).windConstant));
    const target = turretTarget(Turret.windage(scope), at1000, scope.clickMrad);
    expect(target.targetClicks).toBe(clickLimits(scope).windage);
    expect(target.holdMil).toBeGreaterThan(2);
  });
});

describe('free play scopes', () => {
  const none = {
    unknownDistance: false,
    manualEasy: false,
    moaScope: false,
    milDotScope: false,
    cartridgesAC: false,
    gustyWind: false,
    longRangeScope: false,
    manualHard: false,
    secondFocalPlaneScope: false,
  };

  it('open with the course: tree at once, MIL-dot and MOA after 06, long-range after 09, old SFP after 12', () => {
    expect(freePlayScopes(none).map(scope => scope.id)).toEqual(['course-tree']);
    expect(freePlayScopes({ ...none, milDotScope: true, moaScope: true }).map(scope => scope.id)).toEqual(['course-tree', 'course-dot', 'moa']);
    expect(freePlayScopes({ ...none, longRangeScope: true }).map(scope => scope.id)).toEqual(['course-tree', 'tree']);
    expect(freePlayScopes({ ...none, moaScope: true }).map(scope => scope.id)).toEqual(['course-tree', 'moa']);
    expect(freePlayScopes({ ...none, secondFocalPlaneScope: true }).map(scope => scope.id)).toEqual(['course-tree', 'dot']);
  });
});
