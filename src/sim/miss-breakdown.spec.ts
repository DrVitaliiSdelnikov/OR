import { describe, expect, it } from 'vitest';
import { Correction } from '../core/types';
import { CauseKind, groupPoint, missBreakdown, MissBreakdownInput } from './miss-breakdown';

const ZERO: Correction = { upMrad: 0, rightMrad: 0 };

function point(upMrad: number, rightMrad: number): Correction {
  return { upMrad, rightMrad };
}

function input(change: Partial<MissBreakdownInput> = {}): MissBreakdownInput {
  return {
    ideal: point(1.4, 0.3),
    formulaTruth: point(1.4, 0.3),
    formulaPlayerWind: point(1.4, 0.3),
    dial: point(1.4, 0.3),
    plannedHold: ZERO,
    reticle: ZERO,
    triggerSpread: ZERO,
    velocitySpread: ZERO,
    rifleGroup: ZERO,
    coldBore: ZERO,
    sightOffset: ZERO,
    hasKnockedSight: false,
    clickMil: 0.1,
    ...change,
  };
}

function impactOf(value: MissBreakdownInput): Correction {
  return {
    upMrad: value.dial.upMrad - value.ideal.upMrad + value.reticle.upMrad + value.triggerSpread.upMrad + value.velocitySpread.upMrad + value.rifleGroup.upMrad + value.coldBore.upMrad + value.sightOffset.upMrad,
    rightMrad:
      value.dial.rightMrad - value.ideal.rightMrad + value.reticle.rightMrad + value.triggerSpread.rightMrad + value.velocitySpread.rightMrad + value.rifleGroup.rightMrad + value.coldBore.rightMrad + value.sightOffset.rightMrad,
  };
}

function cause(value: MissBreakdownInput, kind: CauseKind) {
  return missBreakdown(value).causes.find(candidate => candidate.kind === kind)!;
}

describe('missBreakdown — the sum', () => {
  it('all causes add up to the impact', () => {
    const value = input({
      formulaTruth: point(1.47, 0.21),
      formulaPlayerWind: point(1.47, 0.05),
      dial: point(1.9, 0.0),
      plannedHold: point(0.2, 0),
      reticle: point(0.13, -0.08),
      triggerSpread: point(-0.05, 0.11),
      velocitySpread: point(0.04, 0),
      rifleGroup: point(-0.03, 0.06),
      coldBore: point(0.15, 0.05),
    });
    const sum = missBreakdown(value).causes.reduce((total, next) => point(total.upMrad + next.vector.upMrad, total.rightMrad + next.vector.rightMrad), ZERO);
    const impact = impactOf(value);
    expect(sum.upMrad).toBeCloseTo(impact.upMrad, 9);
    expect(sum.rightMrad).toBeCloseTo(impact.rightMrad, 9);
  });

  it('with a knocked sight the sum still holds', () => {
    const value = input({ hasKnockedSight: true, sightOffset: point(-0.8, 0.6), dial: point(0.9, -0.5), formulaTruth: ZERO, formulaPlayerWind: ZERO, ideal: ZERO });
    const sum = missBreakdown(value).causes.reduce((total, next) => point(total.upMrad + next.vector.upMrad, total.rightMrad + next.vector.rightMrad), ZERO);
    expect(sum.upMrad).toBeCloseTo(impactOf(value).upMrad, 9);
    expect(sum.rightMrad).toBeCloseTo(impactOf(value).rightMrad, 9);
  });
});

describe('missBreakdown — each cause', () => {
  it('the formula simplification is formula with the truth minus the core, grey', () => {
    const formula = cause(input({ formulaTruth: point(1.52, 0.3), formulaPlayerWind: point(1.52, 0.3), dial: point(1.52, 0.3) }), 'formula');
    expect(formula.vector.upMrad).toBeCloseTo(0.12, 9);
    expect(formula.clicks).toBe(1);
    expect(formula.isPlayerError).toBe(false);
  });

  it('the wind estimate is the formula with the player wind minus the formula with the true wind', () => {
    const value = input({ formulaPlayerWind: point(1.4, 0.15), dial: point(1.4, 0.15) });
    const wind = cause(value, 'wind');
    expect(wind.vector.rightMrad).toBeCloseTo(-0.15, 9);
    expect(wind.clicks).toBe(2);
    expect(wind.isPlayerError).toBe(true);
    expect(cause(value, 'calc').clicks).toBe(0);
    expect(missBreakdown(value).windVerdict).toBe('under');
    expect(missBreakdown(input({ formulaPlayerWind: point(1.4, 0.5), dial: point(1.4, 0.5) })).windVerdict).toBe('over');
  });

  it('the calculation takes the turret against the formula with the player wind', () => {
    const calc = cause(input({ dial: point(1.9, 0.3) }), 'calc');
    expect(calc.vector.upMrad).toBeCloseTo(0.5, 9);
    expect(calc.clicks).toBe(5);
  });

  it('the planned hold is part of the plan: holding it is neither a calculation nor a hold error', () => {
    const value = input({ dial: point(1.2, 0.3), plannedHold: point(0.2, 0), reticle: point(0.2, 0) });
    expect(cause(value, 'calc').clicks).toBe(0);
    expect(cause(value, 'hold').clicks).toBe(0);
  });

  it('the hold and the trigger stay apart', () => {
    const value = input({ reticle: point(0, 0.3), triggerSpread: point(-0.2, 0) });
    expect(cause(value, 'hold').vector).toEqual(point(0, 0.3));
    expect(cause(value, 'hold').clicks).toBe(3);
    expect(cause(value, 'trigger').vector).toEqual(point(-0.2, 0));
    expect(cause(value, 'trigger').clicks).toBe(2);
  });

  it('the rifle is the velocity spread plus the rifle group; the cold bore is its own grey cause', () => {
    const value = input({ velocitySpread: point(0.06, 0), rifleGroup: point(0.04, -0.1), coldBore: point(0.15, 0.05) });
    expect(cause(value, 'rifle').vector.upMrad).toBeCloseTo(0.1, 9);
    expect(cause(value, 'rifle').vector.rightMrad).toBeCloseTo(-0.1, 9);
    expect(cause(value, 'rifle').isPlayerError).toBe(false);
    expect(cause(value, 'cold-bore').clicks).toBe(2);
    expect(cause(value, 'cold-bore').isPlayerError).toBe(false);
  });

  it('02: the knocked sight and the turret beyond the plan are the zero, not the calculation', () => {
    const value = input({ ideal: ZERO, formulaTruth: ZERO, formulaPlayerWind: ZERO, dial: point(0.9, -0.5), sightOffset: point(-0.8, 0.6), hasKnockedSight: true });
    const zero = cause(value, 'zero');
    expect(zero.vector.upMrad).toBeCloseTo(0.1, 9);
    expect(zero.vector.rightMrad).toBeCloseTo(0.1, 9);
    expect(zero.isPlayerError).toBe(true);
    expect(cause(value, 'calc').clicks).toBe(0);
  });

  it('without a knocked sight there is no zero cause', () => {
    expect(missBreakdown(input()).causes.some(candidate => candidate.kind === 'zero')).toBe(false);
  });
});

describe('missBreakdown — shown, main and clean trigger', () => {
  it('player causes are always shown; grey ones from 1 click', () => {
    const value = input({ formulaTruth: point(1.43, 0.3), formulaPlayerWind: point(1.43, 0.3), dial: point(1.43, 0.3), coldBore: point(0.15, 0.05) });
    const shown = missBreakdown(value).causes.filter(candidate => candidate.isShown).map(candidate => candidate.kind);
    expect(shown).toEqual(['calc', 'wind', 'hold', 'trigger', 'cold-bore']);
  });

  it('the main cause is the largest player cause of at least 1 click', () => {
    const value = input({ dial: point(1.6, 0.3), reticle: point(0, 0.4), triggerSpread: point(0.1, 0), velocitySpread: point(0.9, 0) });
    expect(missBreakdown(value).main).toBe('hold');
    expect(missBreakdown(input({ velocitySpread: point(0.9, 0) })).main).toBeNull();
  });

  it('the trigger is clean below 1 click', () => {
    expect(missBreakdown(input({ triggerSpread: point(0.04, 0) })).isTriggerClean).toBe(true);
    expect(missBreakdown(input({ triggerSpread: point(0.06, 0.03) })).isTriggerClean).toBe(false);
  });

  it('a click count is the length of the vector, rounded', () => {
    expect(cause(input({ reticle: point(0.3, 0.4) }), 'hold').clicks).toBe(5);
  });
});

describe('groupPoint', () => {
  it('the warm impact without the data causes: hold, trigger, rifle and zero stay; cold bore and data go', () => {
    const value = input({
      dial: point(1.9, 0.6),
      formulaTruth: point(1.5, 0.3),
      formulaPlayerWind: point(1.5, 0.5),
      reticle: point(0.1, 0),
      triggerSpread: point(0, -0.2),
      velocitySpread: point(0.03, 0),
      coldBore: point(0.15, 0.05),
    });
    const group = groupPoint(missBreakdown(value));
    expect(group.upMrad).toBeCloseTo(0.13, 9);
    expect(group.rightMrad).toBeCloseTo(-0.2, 9);
  });
});
