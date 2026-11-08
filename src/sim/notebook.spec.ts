import { beforeAll, describe, expect, it } from 'vitest';
import { checkManualSteps, checkPreparation } from '../core/calc-check';
import { CARTRIDGES } from '../core/content';
import { buildDopeCard, DopeCard, dopeRowAt } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { GaugeReading } from '../core/scenario';
import { CartridgeId } from '../core/types';
import {
  checkInputs,
  createNotebook,
  enterWind,
  factorContributions,
  measureRange,
  Notebook,
  NotebookContext,
  placeChip,
  readFlags,
  recordStation,
  recordStep,
  setSign,
  softHint,
  staleness,
  stepSheet,
  tabs,
  takeWindFromStation,
  toggleFactor,
  total,
  typeTape,
  changeContext,
  NotebookStepId,
  ChipKind,
  removeChip,
  setUnits,
  openReference,
  stepHasSide,
} from './notebook';
import { scopeById } from './scope-model';

const CLICK_MIL = 0.1;
const cards = new Map<CartridgeId, DopeCard>();
const scope = scopeById('tree');

beforeAll(async () => {
  const engine = new BallisticsEngine();
  for (const cartridge of CARTRIDGES) {
    cards.set(cartridge.id, await buildDopeCard(engine, cartridge, CLICK_MIL));
  }
});

function context(fields: Partial<NotebookContext> = {}): NotebookContext {
  return {
    card: cards.get('B')!,
    scope,
    target: { sizeM: 0.5, distanceM: 300 },
    hasZones: false,
    canTakeWindFromStation: false,
    seed: 7,
    ...fields,
  };
}

function station(fields: Partial<GaugeReading> = {}): GaugeReading {
  return { temperatureC: 14, pressureHpa: 1015, relativeHumidity: 0.5, windSpeedMps: 3.2, windClock: 9, ...fields };
}

function solve(notebook: Notebook, step: NotebookStepId, chips: ChipKind[], tape: number[], sign: 1 | -1 = 1): Notebook {
  let next = notebook;
  for (const chipId of chips) {
    next = placeChip(next, step, chipId);
  }
  tape.forEach((value, index) => {
    next = typeTape(next, step, index, value);
  });
  next = setSign(next, step, sign);
  return recordStep(next, step);
}

describe('a new notebook', () => {
  it('marks unknown distance, conditions and wind as empty; the total is empty until DOPE', () => {
    const notebook = createNotebook(context({ target: { sizeM: 0.5, distanceM: null } }), 'auto');
    expect(tabs(notebook)).toEqual({ total: true, distance: false, conditions: false, wind: false, dope: true });
    expect(total(notebook).isEmpty).toBe(true);
  });

  it('a known distance is filled from the start', () => {
    expect(tabs(createNotebook(context(), 'auto')).distance).toBe(true);
  });
});

describe('readings', () => {
  it('set Ж: a 0.5 m gong at 1.7 MIL is 294 m', () => {
    const notebook = measureRange(createNotebook(context({ target: { sizeM: 0.5, distanceM: null } }), 'auto'), 1.7);
    expect(Math.round(notebook.distanceM!)).toBe(294);
    expect(tabs(notebook).distance).toBe(true);
  });

  it('a hold shorter than 3 s is a short measurement; wind is not copied into the wind tab', () => {
    const short = recordStation(createNotebook(context(), 'auto'), station(), 2, 10);
    expect(short.readings.station!.isShort).toBe(true);
    expect(short.readings.wind).toBeNull();
    expect(tabs(short).conditions).toBe(true);
    expect(recordStation(createNotebook(context(), 'auto'), station(), 3, 10).readings.station!.isShort).toBe(false);
  });

  it('"take from station" only where the course allows it', () => {
    const measured = recordStation(createNotebook(context(), 'auto'), station(), 3, 10);
    expect(() => takeWindFromStation(measured)).toThrow(RangeError);
    const allowed = recordStation(createNotebook(context({ canTakeWindFromStation: true }), 'auto'), station(), 3, 10);
    expect(takeWindFromStation(allowed).readings.wind).toEqual({ speedMps: 3.2, clock: 9 });
  });
});

describe('AUTO', () => {
  function setA(): Notebook {
    return enterWind(recordStation(createNotebook(context(), 'auto'), station(), 3, 10), 3.2, 9);
  }

  it('DOPE and wind are on by default; set А gives ↑ 1.6 ← 0.60, 16 clicks up and 6 left', () => {
    const result = total(setA());
    expect(result.upMil).toBeCloseTo(1.6, 9);
    expect(result.rightMil).toBeCloseTo(-0.6, 2);
    expect(result.elevation.targetClicks).toBe(16);
    expect(result.windageLeft.targetClicks).toBe(6);
  });

  it('set Г: conditions off still show their contribution and stay out of the total', () => {
    const notebook = enterWind(recordStation(createNotebook(context({ target: { sizeM: 0.5, distanceM: 600 } }), 'auto'), station({ temperatureC: -5, pressureHpa: 1030 }), 3, 10), 3.2, 9);
    const contributions = factorContributions(notebook);
    expect(contributions.conditions.isOn).toBe(false);
    expect(contributions.conditions.mil).toBeCloseTo(0.25, 2);
    expect(contributions.conditions.clicks).toBe(3);
    expect(total(notebook).upMil).toBeCloseTo(dopeRowAt(cards.get('B')!, 600).elevationMil, 9);
    expect(total(toggleFactor(notebook, 'conditions')).upMil).toBeCloseTo(dopeRowAt(cards.get('B')!, 600).elevationMil + contributions.conditions.mil!, 9);
  });

  it('set Д: the lead is held with the reticle, not dialled', () => {
    const notebook = createNotebook(context({ target: { sizeM: 0.5, distanceM: 400, movement: { speedMps: 1.2, clock: 3 } } }), 'auto');
    const result = total(notebook);
    expect(result.leadMil).toBeCloseTo(1.8, 2);
    expect(result.windageLeft.targetClicks).toBe(0);
    expect(factorContributions(notebook).lead.isOn).toBe(true);
  });

  it('set К: the zone average 2.85 m/s gives ← 1.24, 12 clicks', () => {
    let notebook = createNotebook(context({ target: { sizeM: 0.5, distanceM: 600 }, hasZones: true }), 'auto');
    notebook = enterWind(notebook, 3, 9);
    notebook = readFlags(notebook, [2, 4, 1]);
    const result = total(notebook);
    expect(result.rightMil).toBeCloseTo(-1.24, 2);
    expect(result.windageLeft.targetClicks).toBe(12);
  });

  it('set И: a total below zero stops at ZERO STOP and holds the rest', () => {
    const notebook = solve(createNotebook(context(), 'manual-easy'), 'dope', ['distance'], [0.1], -1);
    const result = total(notebook);
    expect(result.elevation.targetClicks).toBe(0);
    expect(result.holdUpMil).toBeCloseTo(-0.1, 9);
  });
});

describe('SAM sheets', () => {
  function windNotebook(mode: 'manual-easy' | 'manual-hard', distanceM = 300, clock = 9): Notebook {
    return enterWind(createNotebook(context({ target: { sizeM: 0.5, distanceM, neighborDistanceM: 500 } }), mode), 3.2, clock);
  }

  it('easy: slots V⊥ and D, K printed; only the needed chips; the slot says which chip it waits for', () => {
    const sheet = stepSheet(windNotebook('manual-easy'), 'wind');
    expect(sheet.slots.map(slot => slot.chipKind)).toEqual(['crosswind', 'distance']);
    expect(sheet.printedConstants.map(constant => constant.kind)).toEqual(['wind-constant']);
    expect(sheet.chips.map(chip => chip.kind).sort()).toEqual(['crosswind', 'distance']);
    expect(sheet.slots[0].waitsFor).toBe('crosswind');
  });

  it('hard: K is a slot, two honest traps (V and the neighbour distance), nothing highlighted', () => {
    const sheet = stepSheet(windNotebook('manual-hard'), 'wind');
    expect(sheet.slots.map(slot => slot.chipKind)).toEqual(['crosswind', 'distance', 'wind-constant']);
    expect(sheet.chips.map(chip => chip.kind).sort()).toEqual(['crosswind', 'distance', 'neighbor-distance', 'speed', 'wind-constant']);
    expect(sheet.slots.every(slot => slot.waitsFor === null)).toBe(true);
  });

  it('chip order follows the seed, not the answer', () => {
    const orders = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const notebook = enterWind(createNotebook(context({ seed, target: { sizeM: 0.5, distanceM: 300, neighborDistanceM: 500 } }), 'manual-hard'), 3.2, 9);
      orders.add(stepSheet(notebook, 'wind').chips.map(chip => chip.kind).join());
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('more than five chips are grouped by source', () => {
    const sheet = stepSheet(windNotebook('manual-hard'), 'wind');
    expect(sheet.isGrouped).toBe(false);
    const atmosphere = stepSheet(recordStation(windNotebook('manual-hard'), station(), 3, 10), 'atmosphere');
    expect(atmosphere.isGrouped).toBe(true);
    expect(new Set(atmosphere.chips.map(chip => chip.group))).toEqual(new Set(['instruments', 'cartridge']));
  });

  it('recording a step gives no verdict; an empty slot cannot be recorded', () => {
    const notebook = windNotebook('manual-easy');
    expect(() => recordStep(notebook, 'wind')).toThrow(RangeError);
    const recorded = solve(notebook, 'wind', ['crosswind', 'distance'], [960, 0.6, 0.6], -1);
    expect(recorded.steps.wind.isRecorded).toBe(true);
    expect(Object.keys(recorded.steps.wind)).not.toContain('verdict');
  });

  it('easy hints the kind of mistake without the answer; hard says nothing', () => {
    const wrongDivision = solve(windNotebook('manual-easy'), 'wind', ['crosswind', 'distance'], [960, 0.4, 0.4], -1);
    expect(softHint(wrongDivision, 'wind')).toBe('arithmetic');
    const right = solve(windNotebook('manual-easy'), 'wind', ['crosswind', 'distance'], [960, 0.6, 0.6], -1);
    expect(softHint(right, 'wind')).toBeNull();
    const hard = solve(windNotebook('manual-hard'), 'wind', ['crosswind', 'distance', 'wind-constant'], [960, 0.4, 0.4], -1);
    expect(softHint(hard, 'wind')).toBeNull();
  });

  it('the SAM total comes from the recorded steps', () => {
    let notebook = windNotebook('manual-easy');
    notebook = solve(notebook, 'dope', ['distance'], [1.6]);
    notebook = solve(notebook, 'wind', ['crosswind', 'distance'], [960, 0.6, 0.6], -1);
    const result = total(notebook);
    expect(result.upMil).toBeCloseTo(1.6, 9);
    expect(result.rightMil).toBeCloseTo(-0.6, 9);
  });
});

describe('the chain of references (Б23)', () => {
  it('a wrong milled distance is one mistake: DOPE is right for the player’s 320 m', () => {
    let notebook = createNotebook(context({ target: { sizeM: 0.5, distanceM: null } }), 'manual-easy');
    notebook = measureRange(notebook, 0.5 * 1000 / 300);
    notebook = solve(notebook, 'distance', ['target-size', 'reticle-mil'], [320]);
    const elevation320 = dopeRowAt(cards.get('B')!, 320).elevationMil;
    notebook = solve(notebook, 'dope', ['distance'], [elevation320]);
    const result = checkManualSteps(checkInputs(notebook, { trueWindClock: 9, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }).steps, CLICK_MIL);
    expect(result.rows[0].status).not.toBe('exact');
    expect(result.rows[1].status).toBe('exact');
  });
});

describe('check inputs', () => {
  it('set В in hard: V instead of V⊥ in the slot is a SUBSTITUTION', () => {
    let notebook = enterWind(createNotebook(context({ target: { sizeM: 0.5, distanceM: 600, neighborDistanceM: 500 } }), 'manual-hard'), 3.2, 11);
    const k = dopeRowAt(cards.get('B')!, 600).windConstant;
    notebook = solve(notebook, 'wind', ['speed', 'distance', 'wind-constant'], [3.2 * 600, (3.2 * 600) / k, 1.4], 1);
    const result = checkManualSteps(checkInputs(notebook, { trueWindClock: 11, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }).steps, CLICK_MIL);
    expect(result.rows[0].errorTypes).toContain('substitution');
  });

  it('set Г in AUTO: 2.4 typed for 3.2 is 4 clicks of READING; conditions left out are 3 clicks of FACTOR', () => {
    let notebook = createNotebook(context({ target: { sizeM: 0.5, distanceM: 600 } }), 'auto');
    notebook = recordStation(notebook, station({ temperatureC: -5, pressureHpa: 1030 }), 3, 10);
    notebook = enterWind(notebook, 2.4, 9);
    const planned = total(notebook);
    const rows = checkInputs(notebook, { trueWindClock: 9, dialedElevationClicks: planned.elevation.targetClicks, dialedWindageLeftClicks: planned.windageLeft.targetClicks }).preparation;
    const byRow = Object.fromEntries(rows.map(row => [row.row, row]));
    expect(byRow['reading-speed'].clicksOff).toBe(4);
    expect(byRow['factors'].clicksOff).toBe(3);
    expect(byRow['turret-elevation'].clicksOff).toBe(0);
    expect(byRow['turret-windage'].clicksOff).toBe(0);
    expect(checkPreparation(rows).verdict).toBe('error');
  });

  it('a turret turned the other way is a SIDE error', () => {
    const notebook = enterWind(createNotebook(context(), 'auto'), 3.2, 9);
    const rows = checkInputs(notebook, { trueWindClock: 9, dialedElevationClicks: 16, dialedWindageLeftClicks: -6 }).preparation;
    expect(rows.find(row => row.row === 'turret-windage')!.isWrongSide).toBe(true);
  });
});

describe('stale steps', () => {
  function solved(): Notebook {
    let notebook = recordStation(enterWind(createNotebook(context(), 'manual-easy'), 3.2, 9), station(), 3, 10);
    notebook = solve(notebook, 'dope', ['distance'], [1.6]);
    notebook = solve(notebook, 'atmosphere', ['temperature', 'pressure'], [0]);
    return solve(notebook, 'wind', ['crosswind', 'distance'], [960, 0.6, 0.6], -1);
  }

  it('a cartridge change clears DOPE, conditions and wind with the reason; AUTO recalculates', () => {
    const changed = changeContext(solved(), { card: cards.get('C')! });
    const stale = staleness(changed);
    expect(stale.dope).toBe('cartridge');
    expect(stale.atmosphere).toBe('cartridge');
    expect(stale.wind).toBe('cartridge');
    expect(changed.steps.wind.isRecorded).toBe(false);
    expect(changed.steps.wind.slots.every(slot => slot === null)).toBe(true);
    const auto = enterWind(createNotebook(context(), 'auto'), 3.2, 9);
    const before = factorContributions(auto).wind.mil;
    expect(factorContributions(changeContext(auto, { card: cards.get('C')! })).wind.mil).not.toBeCloseTo(before!, 3);
  });

  it('a new station reading makes only conditions stale; a new wind only the wind', () => {
    const remeasured = recordStation(solved(), station({ temperatureC: 0 }), 3, 20);
    expect(staleness(remeasured)).toEqual({ distance: null, dope: null, atmosphere: 'conditions', zones: null, wind: null, lead: null });
    const rewound = enterWind(solved(), 4, 9);
    expect(staleness(rewound).wind).toBe('wind');
    expect(staleness(rewound).atmosphere).toBeNull();
  });

  it('a new distance makes everything after the distance stale', () => {
    const moved = changeContext(solved(), { target: { sizeM: 0.5, distanceM: 400 } });
    expect(staleness(moved).dope).toBe('distance');
    expect(staleness(moved).wind).toBe('distance');
  });

  it('a new target at an unknown distance forgets the milling of the previous one', () => {
    const unknown = { sizeM: 0.5, distanceM: null };
    const milled = measureRange(createNotebook(context({ target: unknown }), 'auto'), 1.7);
    const next = changeContext(milled, { target: { ...unknown } });
    expect(next.readings.reticleMil).toBeNull();
    expect(next.distanceM).toBeNull();
    expect(tabs(next).distance).toBe(false);
    expect(changeContext(milled, { card: milled.context.card }).readings.reticleMil).toBe(1.7);
  });
});

describe('tape and side (A5.2)', () => {
  function windReady(): Notebook {
    let notebook = enterWind(createNotebook(context(), 'manual-easy'), 3.2, 9);
    notebook = placeChip(notebook, 'wind', 'crosswind');
    notebook = placeChip(notebook, 'wind', 'distance');
    return typeTape(typeTape(typeTape(notebook, 'wind', 0, 960), 'wind', 1, 0.6), 'wind', 2, 0.6);
  }

  it('a cleared tape cell is empty and unrecords the step', () => {
    const recorded = recordStep(setSign(windReady(), 'wind', -1), 'wind');
    const cleared = typeTape(recorded, 'wind', 2, null);
    expect(cleared.steps.wind.tape[2]).toBeNull();
    expect(cleared.steps.wind.isRecorded).toBe(false);
    expect(() => recordStep(cleared, 'wind')).toThrow(RangeError);
  });

  it('a new step has no side; a step with a side cannot be recorded without one', () => {
    expect(windReady().steps.wind.sign).toBeNull();
    expect(() => recordStep(windReady(), 'wind')).toThrow(RangeError);
    expect(total(recordStep(setSign(windReady(), 'wind', -1), 'wind')).rightMil).toBeCloseTo(-0.6, 9);
  });

  it('a zero answer needs no side; the distance step has none', () => {
    const calm = typeTape(windReady(), 'wind', 2, 0);
    expect(recordStep(calm, 'wind').steps.wind.isRecorded).toBe(true);
    expect(stepHasSide('distance')).toBe(false);
    expect(stepHasSide('wind')).toBe(true);
    expect(stepHasSide('dope')).toBe(true);
    const unknown = measureRange(createNotebook(context({ target: { sizeM: 0.5, distanceM: null } }), 'manual-easy'), 1.7);
    let milled = placeChip(placeChip(unknown, 'distance', 'target-size'), 'distance', 'reticle-mil');
    milled = recordStep(typeTape(milled, 'distance', 0, 294), 'distance');
    expect(milled.distanceM).toBe(294);
  });
});

describe('immutability', () => {
  it('an operation leaves the previous notebook as it was', () => {
    const notebook = createNotebook(context(), 'manual-easy');
    const snapshot = JSON.stringify(notebook);
    enterWind(notebook, 3.2, 9);
    placeChip(notebook, 'dope', 'distance');
    toggleFactor(notebook, 'conditions');
    expect(JSON.stringify(notebook)).toBe(snapshot);
  });
});

describe('more cases', () => {
  const noTruth = { trueWindClock: 9, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 };

  it('hard prints no constants', () => {
    const notebook = enterWind(createNotebook(context(), 'manual-hard'), 3.2, 9);
    expect(stepSheet(notebook, 'wind').printedConstants).toEqual([]);
  });

  it('a filled tape with an empty slot, or full slots with no result, cannot be recorded', () => {
    const notebook = enterWind(createNotebook(context(), 'manual-easy'), 3.2, 9);
    const tapeOnly = typeTape(notebook, 'wind', 2, 0.6);
    expect(() => recordStep(tapeOnly, 'wind')).toThrow(RangeError);
    const slotsOnly = placeChip(placeChip(notebook, 'wind', 'crosswind'), 'wind', 'distance');
    expect(() => recordStep(slotsOnly, 'wind')).toThrow(RangeError);
  });

  it('a chip can be taken out of its slot', () => {
    const placed = placeChip(createNotebook(context(), 'manual-easy'), 'dope', 'distance');
    expect(removeChip(placed, 'dope', 0).steps.dope.slots[0]).toBeNull();
  });

  it('wind past the side stop: the rest is held to the same side', () => {
    const notebook = solve(enterWind(createNotebook(context(), 'manual-easy'), 3.2, 9), 'wind', ['crosswind', 'distance'], [960, 12, 12], -1);
    const result = total(notebook);
    expect(result.holdRightMil).toBeLessThan(0);
    expect(result.holdRightMil).toBeCloseTo(-12 + result.windageLeft.targetClicks * CLICK_MIL, 9);
  });

  it('zones with every wind from the right push the other way', () => {
    let notebook = createNotebook(context({ target: { sizeM: 0.5, distanceM: 600 }, hasZones: true }), 'auto');
    notebook = readFlags(enterWind(notebook, 3, 3), [-2, -4, -1]);
    expect(total(notebook).rightMil).toBeCloseTo(1.24, 2);
  });

  it('a wrong direction is READING: 8 o’clock for 9 at 600 m is 2 clicks', () => {
    const notebook = enterWind(createNotebook(context({ target: { sizeM: 0.5, distanceM: 600 } }), 'auto'), 3.2, 8);
    const row = checkInputs(notebook, noTruth).preparation.find(candidate => candidate.row === 'reading-direction')!;
    expect(row.clicksOff).toBe(2);
  });

  it('a turret one click short is one click off', () => {
    const notebook = enterWind(createNotebook(context(), 'auto'), 3.2, 9);
    const rows = checkInputs(notebook, { trueWindClock: 9, dialedElevationClicks: 15, dialedWindageLeftClicks: 6 }).preparation;
    expect(rows.find(row => row.row === 'turret-elevation')!.clicksOff).toBe(1);
  });

  it('when the cartridge and the distance change together, the cartridge is named', () => {
    let notebook = enterWind(createNotebook(context(), 'manual-easy'), 3.2, 9);
    notebook = solve(notebook, 'dope', ['distance'], [1.6]);
    const changed = changeContext(notebook, { card: cards.get('A')!, target: { sizeM: 0.5, distanceM: 400 } });
    expect(staleness(changed).dope).toBe('cartridge');
  });

  it('a factor toggles off and on again', () => {
    const notebook = enterWind(createNotebook(context(), 'auto'), 3.2, 9);
    const windOff = toggleFactor(notebook, 'wind');
    expect(total(windOff).rightMil).toBe(0);
    expect(total(toggleFactor(windOff, 'wind')).rightMil).toBeCloseTo(total(notebook).rightMil, 9);
  });

  it('an answer in MOA is checked as wrong units', () => {
    let notebook = enterWind(createNotebook(context(), 'manual-easy'), 3.2, 9);
    notebook = setUnits(placeChip(placeChip(notebook, 'wind', 'crosswind'), 'wind', 'distance'), 'wind', 'moa');
    notebook = recordStep(setSign(typeTape(typeTape(typeTape(notebook, 'wind', 0, 960), 'wind', 1, 2.05), 'wind', 2, 2.05), 'wind', -1), 'wind');
    expect(checkInputs(notebook, noTruth).steps[0].playerUnits).toBe('moa');
    expect(softHint(notebook, 'wind')).toBe('units');
  });

  it('opening the reference is remembered for the −30', () => {
    const notebook = createNotebook(context(), 'manual-hard');
    expect(notebook.hasOpenedReference).toBe(false);
    expect(openReference(notebook).hasOpenedReference).toBe(true);
  });
});
