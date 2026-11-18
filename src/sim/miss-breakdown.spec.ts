import { describe, expect, it } from 'vitest';
import { roundToClicks } from '../core/game-formulas';
import { Correction } from '../core/types';
import { CauseKind, groupPoint, hasDataError, isExecutionCause, journalCauses, mainCauseOf, mainOfAmounts, missBreakdown, MissBreakdownInput } from './miss-breakdown';
import { CHAIN_ORDER, ChainLink, ChainLinkKind } from './miss-chain';

const ZERO: Correction = { upMrad: 0, rightMrad: 0 };
const CLICK_MIL = 0.1;

function point(upMrad: number, rightMrad: number): Correction {
  return { upMrad, rightMrad };
}

function plus(first: Correction, second: Correction): Correction {
  return point(first.upMrad + second.upMrad, first.rightMrad + second.rightMrad);
}

function minus(first: Correction, second: Correction): Correction {
  return point(first.upMrad - second.upMrad, first.rightMrad - second.rightMrad);
}

function chainLink(kind: ChainLinkKind, vector: Correction): ChainLink {
  return { kind, vector, clicks: Math.abs(roundToClicks(Math.hypot(vector.upMrad, vector.rightMrad), CLICK_MIL)), quantity: 'mil-vector', player: null, truth: null };
}

type LinkVectors = Partial<Record<Exclude<ChainLinkKind, 'turret'>, Correction>>;

// Звенья без упреждения дают «барабан + план удержания − формула на правде», как в `missChain`: без явного барабана он накручен по звеньям, с явным — остаток уходит в «накрутку».
function input(change: Partial<Omit<MissBreakdownInput, 'chain'>> = {}, links: LinkVectors = {}): MissBreakdownInput {
  const linkSum = Object.entries(links).filter(([kind]) => kind !== 'lead').reduce((sum, [, vector]) => plus(sum, vector!), ZERO);
  const defaults: Omit<MissBreakdownInput, 'chain'> = {
    ideal: point(1.4, 0.3),
    formulaTruth: point(1.4, 0.3),
    dial: point(1.4, 0.3),
    plannedHold: ZERO,
    reticle: ZERO,
    triggerSpread: ZERO,
    velocitySpread: ZERO,
    rifleGroup: ZERO,
    coldBore: ZERO,
    sightOffset: ZERO,
    hasKnockedSight: false,
    clickMil: CLICK_MIL,
    ...change,
  };
  const base = change.dial ? defaults : { ...defaults, dial: minus(plus(defaults.formulaTruth, linkSum), defaults.plannedHold) };
  const calcBase = base.hasKnockedSight ? ZERO : base.dial;
  const turret = minus(minus(plus(calcBase, base.plannedHold), base.formulaTruth), linkSum);
  return { ...base, chain: CHAIN_ORDER.map(kind => chainLink(kind, kind === 'turret' ? turret : (links[kind] ?? ZERO))) };
}

function impactOf(value: MissBreakdownInput): Correction {
  const parts = [value.dial, value.reticle, value.triggerSpread, value.velocitySpread, value.rifleGroup, value.coldBore, value.sightOffset];
  const impact = minus(parts.reduce(plus, ZERO), value.ideal);
  return value.targetMotion ? point(impact.upMrad, impact.rightMrad - value.targetMotion.rightMrad) : impact;
}

function sumOfCauses(value: MissBreakdownInput): Correction {
  return missBreakdown(value).causes.reduce((sum, next) => plus(sum, next.vector), ZERO);
}

function cause(value: MissBreakdownInput, kind: CauseKind) {
  return missBreakdown(value).causes.find(candidate => candidate.kind === kind)!;
}

describe('missBreakdown — the sum (T2.2: links instead of calc and wind)', () => {
  it('links, execution and grey causes add up to the impact', () => {
    const value = input(
      {
        formulaTruth: point(1.47, 0.21),
        dial: point(1.9, 0.0),
        plannedHold: point(0.2, 0),
        reticle: point(0.13, -0.08),
        triggerSpread: point(-0.05, 0.11),
        velocitySpread: point(0.04, 0),
        rifleGroup: point(-0.03, 0.06),
        coldBore: point(0.15, 0.05),
      },
      { distance: point(0.3, 0), 'wind-speed': point(0, -0.16), rounding: point(0.03, 0.02) },
    );
    expect(sumOfCauses(value).upMrad).toBeCloseTo(impactOf(value).upMrad, 9);
    expect(sumOfCauses(value).rightMrad).toBeCloseTo(impactOf(value).rightMrad, 9);
  });

  it('with a knocked sight the sum still holds', () => {
    const value = input({ hasKnockedSight: true, sightOffset: point(-0.8, 0.6), dial: point(0.9, -0.5), formulaTruth: ZERO, ideal: ZERO });
    expect(sumOfCauses(value).upMrad).toBeCloseTo(impactOf(value).upMrad, 9);
    expect(sumOfCauses(value).rightMrad).toBeCloseTo(impactOf(value).rightMrad, 9);
  });

  it('a moving target: the lead link is carved out of the lead petal, the sum still holds', () => {
    const value = input({ plannedHold: point(0.1, 0.2), reticle: point(0.13, 1.5), triggerSpread: point(-0.05, 0.11), targetMotion: point(0, 1.65) }, { lead: point(0, -0.3) });
    expect(sumOfCauses(value).upMrad).toBeCloseTo(impactOf(value).upMrad, 9);
    expect(sumOfCauses(value).rightMrad).toBeCloseTo(impactOf(value).rightMrad, 9);
    expect(cause(value, 'lead-calc').vector.rightMrad).toBeCloseTo(-0.3, 9);
    expect(cause(value, 'lead').vector.rightMrad).toBeCloseTo(1.3 - 1.65 + 0.3, 9);
  });

  it('there are no calc and wind petals any more', () => {
    const kinds = missBreakdown(input()).causes.map(candidate => candidate.kind);
    expect(kinds).not.toContain('calc');
    expect(kinds).not.toContain('wind');
    expect(kinds).toContain('wind-speed');
  });
});

describe('missBreakdown — each cause', () => {
  it('a chain link is a player cause with its own link', () => {
    const value = input({}, { 'wind-speed': point(0, -0.26) });
    expect(cause(value, 'wind-speed')).toMatchObject({ clicks: 3, isPlayerError: true, isShown: true });
    expect(cause(value, 'wind-speed').link?.kind).toBe('wind-speed');
  });

  it('the formula simplification is formula with the truth minus the core, grey', () => {
    const formula = cause(input({ formulaTruth: point(1.52, 0.3), dial: point(1.52, 0.3) }), 'formula');
    expect(formula.vector.upMrad).toBeCloseTo(0.12, 9);
    expect(formula.clicks).toBe(1);
    expect(formula.isPlayerError).toBe(false);
  });

  it('the turret beyond the plan is the turret link', () => {
    const turret = cause(input({ dial: point(1.9, 0.3) }), 'turret');
    expect(turret.vector.upMrad).toBeCloseTo(0.5, 9);
    expect(turret.clicks).toBe(5);
  });

  it('the planned hold is part of the plan: holding it is neither a turret nor a hold error', () => {
    const value = input({ dial: point(1.2, 0.3), plannedHold: point(0.2, 0), reticle: point(0.2, 0) });
    expect(cause(value, 'turret').clicks).toBe(0);
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

  it('02: the knocked sight and the turret beyond the plan are the zero, not the turret', () => {
    const value = input({ ideal: ZERO, formulaTruth: ZERO, dial: point(0.9, -0.5), sightOffset: point(-0.8, 0.6), hasKnockedSight: true });
    const zero = cause(value, 'zero');
    expect(zero.vector.upMrad).toBeCloseTo(0.1, 9);
    expect(zero.vector.rightMrad).toBeCloseTo(0.1, 9);
    expect(zero.isPlayerError).toBe(true);
    expect(cause(value, 'turret').clicks).toBe(0);
  });

  it('without a knocked sight there is no zero cause; a still target has no lead petal', () => {
    expect(missBreakdown(input()).causes.some(candidate => candidate.kind === 'zero')).toBe(false);
    expect(missBreakdown(input()).causes.map(candidate => candidate.kind)).not.toContain('lead');
  });

  it('U8: held 1.2 ahead while the target moved 1.8 — the lead petal is 6 clicks back, the hold petal is only vertical', () => {
    const value = input({ reticle: point(0.05, 1.2), targetMotion: point(0, 1.8) });
    expect(cause(value, 'lead').vector.rightMrad).toBeCloseTo(-0.6, 9);
    expect(cause(value, 'lead').clicks).toBe(6);
    expect(cause(value, 'hold').vector).toEqual(point(0.05, 0));
    expect(missBreakdown(value).main).toBe('lead');
  });
});

describe('missBreakdown — shown, main and clean trigger', () => {
  it('links and grey causes from 1 click; the hold and the trigger always; the rounding never', () => {
    const value = input({ formulaTruth: point(1.43, 0.3), coldBore: point(0.15, 0.05) }, { dope: point(0.3, 0), angle: point(0.04, 0), rounding: point(0.05, 0.05) });
    const shown = missBreakdown(value).causes.filter(candidate => candidate.isShown).map(candidate => candidate.kind);
    expect(shown).toEqual(['dope', 'hold', 'trigger', 'cold-bore']);
    expect(cause(value, 'rounding').isPlayerError).toBe(false);
  });

  it('the lead petal and the zero only from 1 click', () => {
    expect(cause(input({ reticle: point(0, 1.8), targetMotion: point(0, 1.82) }), 'lead').isShown).toBe(false);
    expect(cause(input({ ideal: ZERO, formulaTruth: ZERO, dial: point(0.8, -0.6), sightOffset: point(-0.8, 0.6), hasKnockedSight: true }), 'zero').isShown).toBe(false);
  });

  it('the main cause is the largest player cause of at least 1 click, links and execution together', () => {
    expect(missBreakdown(input({ reticle: point(0, 0.2) }, { 'wind-speed': point(0, -0.4) })).main).toBe('wind-speed');
    expect(missBreakdown(input({ reticle: point(0, 0.5) }, { 'wind-speed': point(0, -0.4) })).main).toBe('hold');
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
    const value = input(
      { dial: point(1.9, 0.6), formulaTruth: point(1.5, 0.3), reticle: point(0.1, 0), triggerSpread: point(0, -0.2), velocitySpread: point(0.03, 0), coldBore: point(0.15, 0.05) },
      { 'wind-speed': point(0, 0.2) },
    );
    const group = groupPoint(missBreakdown(value));
    expect(group.upMrad).toBeCloseTo(0.13, 9);
    expect(group.rightMrad).toBeCloseTo(-0.2, 9);
  });
});

describe('mainCauseOf: the rough category for the result and the journal (T2.2)', () => {
  it('the wind readings sum into the wind, split into under and over by the true wind side', () => {
    expect(mainCauseOf(missBreakdown(input({}, { 'wind-speed': point(0, -0.12), 'wind-clock': point(0, -0.1) })))).toBe('wind-under');
    expect(mainCauseOf(missBreakdown(input({}, { zones: point(0, 0.3) })))).toBe('wind-over');
  });

  it('the calculation links sum into the calculation, even when each is below the wind', () => {
    expect(mainCauseOf(missBreakdown(input({}, { distance: point(0.2, 0), dope: point(0.2, 0), 'wind-speed': point(0, -0.3) })))).toBe('calc');
    expect(mainCauseOf(missBreakdown(input({}, { 'wind-calc': point(0, 0.4) })))).toBe('calc');
    expect(mainCauseOf(missBreakdown(input({ dial: point(1.9, 0.3) })))).toBe('calc');
  });

  it('the lead link and the lead petal sum into the lead; execution keeps its own', () => {
    expect(mainCauseOf(missBreakdown(input({ reticle: point(0, 1.3), targetMotion: point(0, 1.8) }, { lead: point(0, -0.5) })))).toBe('lead');
    expect(mainCauseOf(missBreakdown(input({ reticle: point(0, 0.4) })))).toBe('hold');
    expect(mainCauseOf(missBreakdown(input({ triggerSpread: point(0.4, 0) })))).toBe('trigger');
    expect(mainCauseOf(missBreakdown(input()))).toBeNull();
  });
});

describe('journalCauses: what the journal keeps of a shot (T2.3)', () => {
  it('player causes to 0.01 MIL in ladder order; zeros, grey causes and rounding are left out', () => {
    const value = input({ triggerSpread: point(0.03, 0.04), velocitySpread: point(0.3, 0), coldBore: point(0.2, 0) }, { distance: point(0.623, 0), rounding: point(0, 0.04), 'wind-speed': point(0, -0.004) });
    expect(journalCauses(missBreakdown(value))).toEqual([
      { kind: 'distance', mil: 0.62 },
      { kind: 'trigger', mil: 0.05 },
    ]);
  });

  it('a clean shot keeps an empty list', () => {
    expect(journalCauses(missBreakdown(input()))).toEqual([]);
  });
});

describe('hasDataError: a player link of at least one click', () => {
  it('a link of a click is a data error; hold, trigger and grey causes are not', () => {
    expect(hasDataError(missBreakdown(input({}, { dope: point(0.1, 0) })))).toBe(true);
    expect(hasDataError(missBreakdown(input({ reticle: point(-1.7, 0), triggerSpread: point(0.5, 0), velocitySpread: point(0.4, 0), coldBore: point(0.3, 0) })))).toBe(false);
  });

  it('a link under half a click and the rounding link are not data errors', () => {
    expect(hasDataError(missBreakdown(input({}, { dope: point(0.04, 0) })))).toBe(false);
    expect(hasDataError(missBreakdown(input({}, { rounding: point(0.3, 0) })))).toBe(false);
  });
});

describe('isExecutionCause', () => {
  it('hold, lead, trigger and zero are execution; links are not', () => {
    expect((['hold', 'lead', 'trigger', 'zero'] as const).every(isExecutionCause)).toBe(true);
    expect((['dope', 'wind-speed', 'lead-calc', 'turret'] as const).some(isExecutionCause)).toBe(false);
  });
});

describe('mainOfAmounts: the main cause from the kept amounts (T2.3)', () => {
  it('the largest of at least one click, the earliest on a tie', () => {
    expect(mainOfAmounts([{ kind: 'distance', mil: 0.3 }, { kind: 'wind-speed', mil: 0.6 }, { kind: 'hold', mil: 0.6 }], 0.1)).toBe('wind-speed');
    expect(mainOfAmounts([{ kind: 'trigger', mil: 0.05 }], 0.2)).toBeNull();
    expect(mainOfAmounts([], 0.1)).toBeNull();
  });

  it('agrees with the breakdown main cause', () => {
    const breakdown = missBreakdown(input({ reticle: point(0, 0.35) }, { dope: point(0.52, 0), 'wind-clock': point(0, 0.2) }));
    expect(mainOfAmounts(journalCauses(breakdown), CLICK_MIL)).toBe(breakdown.main);
    expect(breakdown.main).toBe('dope');
  });
});
