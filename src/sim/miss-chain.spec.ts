import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout } from '../core/content';
import { buildDopeCard, DopeCard } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { Correction } from '../core/types';
import { createNotebook, enterWind, formulaCorrectionMil, FormulaInputs, measureRange, Notebook, NotebookContext, NotebookStepId, placeChip, readFlag, recordStation, recordStep, setSign, stepSheet, toggleFactor, total, typeTape } from './notebook';
import { CHAIN_ORDER, ChainLink, ChainLinkKind, missChain } from './miss-chain';
import { scopeById } from './scope-model';

const CLICK_MIL = 0.1;
const DISTANCE_M = 500;
const TRUE_WIND = { speedMps: 4, clock: 9 };
const STATION = { temperatureC: 5, pressureHpa: 1025, relativeHumidity: 0.5, windSpeedMps: 4, windClock: 9 };
const TRUTH: FormulaInputs = { distanceM: DISTANCE_M, temperatureC: 5, pressureHpa: 1025, wind: TRUE_WIND, flagCrosswindsMps: null };
const EPSILON_MIL = 1e-9;
const engine = new BallisticsEngine();
let card: DopeCard;

beforeAll(async () => {
  card = await buildDopeCard(engine, courseLoadout('B'), CLICK_MIL);
});

function context(fields: Partial<NotebookContext> = {}): NotebookContext {
  return { card, scope: scopeById('course-dot'), target: { sizeM: 0.5, distanceM: DISTANCE_M }, hasZones: false, canTakeWindFromStation: false, seed: 4, ...fields };
}

function autoNotebook(wind = TRUE_WIND, fields: Partial<NotebookContext> = {}): Notebook {
  return toggleFactor(enterWind(recordStation(createNotebook(context(fields), 'auto'), STATION, 3, 0), wind.speedMps, wind.clock), 'conditions');
}

function dialOf(notebook: Notebook, extraUpClicks = 0): Correction {
  const planned = total(notebook);
  return { upMrad: (planned.elevation.targetClicks + extraUpClicks) * CLICK_MIL, rightMrad: -planned.windageLeft.targetClicks * CLICK_MIL };
}

function chainOf(notebook: Notebook, dial = dialOf(notebook), truth = TRUTH): ChainLink[] {
  return missChain({ notebook, truth, dial, hasKnockedSight: false });
}

function link(chain: readonly ChainLink[], kind: ChainLinkKind): ChainLink {
  return chain.find(candidate => candidate.kind === kind)!;
}

function sizeOf(vector: Correction): number {
  return Math.hypot(vector.upMrad, vector.rightMrad);
}

function nonZeroPlayerLinks(chain: readonly ChainLink[]): ChainLinkKind[] {
  return chain.filter(candidate => candidate.kind !== 'rounding' && sizeOf(candidate.vector) > EPSILON_MIL).map(candidate => candidate.kind);
}

function sumOf(chain: readonly ChainLink[]): Correction {
  return chain.filter(candidate => candidate.kind !== 'lead').reduce((sum, candidate) => ({ upMrad: sum.upMrad + candidate.vector.upMrad, rightMrad: sum.rightMrad + candidate.vector.rightMrad }), { upMrad: 0, rightMrad: 0 });
}

function solved(notebook: Notebook, step: NotebookStepId, finalValue: number, sign: 1 | -1 = 1): Notebook {
  const sheet = stepSheet(notebook, step);
  let next = sheet.slots.reduce((current, slot) => placeChip(current, step, slot.chipKind), notebook);
  next = typeTape(next, step, sheet.tapeLength - 1, finalValue);
  return recordStep(setSign(next, step, sign), step);
}

function manualNotebook(changes: { dope?: number; atmosphere?: number; wind?: number } = {}): Notebook {
  let notebook = autoNotebook();
  notebook = { ...notebook, mode: 'manual-easy' };
  const auto = formulaCorrectionMil(notebook, TRUTH);
  const truthUp = { dope: card.rows[4].elevationMil };
  notebook = solved(notebook, 'dope', changes.dope ?? truthUp.dope);
  notebook = solved(notebook, 'atmosphere', changes.atmosphere ?? auto.upMrad - truthUp.dope, 1);
  const windMil = changes.wind ?? auto.rightMrad;
  return solved(notebook, 'wind', Math.abs(windMil), windMil < 0 ? -1 : 1);
}

describe('цепочка подстановок (T2.1)', () => {
  it('звенья — в постоянном порядке; у каждого — вклад, клики, значения игрока и правды', () => {
    const chain = chainOf(autoNotebook());
    expect(chain.map(candidate => candidate.kind)).toEqual(CHAIN_ORDER);
    expect(CHAIN_ORDER).toEqual(['distance', 'dope', 'conditions', 'angle', 'earth', 'wind-speed', 'wind-clock', 'zones', 'wind-calc', 'lead', 'rounding', 'turret']);
  });

  it('правда = игрок: все звенья, кроме округления, — ноль; округление меньше полуклика', () => {
    const chain = chainOf(autoNotebook());
    expect(nonZeroPlayerLinks(chain)).toEqual([]);
    expect(sizeOf(link(chain, 'rounding').vector)).toBeLessThanOrEqual(Math.SQRT2 * CLICK_MIL / 2 + EPSILON_MIL);
  });

  it('сумма звеньев (без упреждения) = накрутка + удержание − формула на правде', () => {
    const notebook = autoNotebook({ speedMps: 2.5, clock: 10 });
    const dial = dialOf(notebook, 3);
    const sum = sumOf(chainOf(notebook, dial));
    const truth = formulaCorrectionMil(notebook, TRUTH);
    const planned = total(notebook);
    expect(sum.upMrad).toBeCloseTo(dial.upMrad + planned.holdUpMil - truth.upMrad, 9);
    expect(sum.rightMrad).toBeCloseTo(dial.rightMrad + planned.holdRightMil - truth.rightMrad, 9);
  });
});

describe('одна подмена — одно звено (T2.1)', () => {
  it('АВТО, скорость 3 вместо 4 м/с → только «скорость ветра»; значения в м/с', () => {
    const chain = chainOf(autoNotebook({ speedMps: 3, clock: 9 }));
    expect(nonZeroPlayerLinks(chain)).toEqual(['wind-speed']);
    expect(link(chain, 'wind-speed')).toMatchObject({ quantity: 'windSpeed', player: 3, truth: 4 });
    expect(link(chain, 'wind-speed').vector.rightMrad).not.toBe(0);
  });

  it('АВТО, час 8 вместо 9 → только «часы ветра»', () => {
    const chain = chainOf(autoNotebook({ speedMps: 4, clock: 8 }));
    expect(nonZeroPlayerLinks(chain)).toEqual(['wind-clock']);
    expect(link(chain, 'wind-clock')).toMatchObject({ quantity: 'clock', player: 8, truth: 9 });
  });

  it('АВТО, дальность миллингом 450 вместо 500 → только «дальность»', () => {
    const notebook = measureRange(autoNotebook(TRUE_WIND, { target: { sizeM: 0.5, distanceM: null } }), (0.5 * 1000) / 450);
    const chain = chainOf(notebook);
    expect(nonZeroPlayerLinks(chain)).toEqual(['distance']);
    expect(link(chain, 'distance').quantity).toBe('distance');
    expect(link(chain, 'distance').player).toBeCloseTo(450, 6);
    expect(link(chain, 'distance').truth).toBe(500);
    expect(link(chain, 'distance').vector.upMrad).toBeLessThan(0);
  });

  it('АВТО, условия выключены → только «условия», вклад = −поправка условий', () => {
    const notebook = toggleFactor(autoNotebook(), 'conditions');
    const chain = chainOf(notebook);
    expect(nonZeroPlayerLinks(chain)).toEqual(['conditions']);
    const conditionsMil = formulaCorrectionMil(autoNotebook(), TRUTH).upMrad - card.rows[4].elevationMil;
    expect(link(chain, 'conditions').vector.upMrad).toBeCloseTo(-conditionsMil, 6);
  });

  it('накрутка на 2 клика выше плана → только «накрутка», 0,2 MIL и 2 клика', () => {
    const notebook = autoNotebook();
    const chain = chainOf(notebook, dialOf(notebook, 2));
    expect(nonZeroPlayerLinks(chain)).toEqual(['turret']);
    expect(link(chain, 'turret').vector.upMrad).toBeCloseTo(0.2, 9);
    expect(link(chain, 'turret').clicks).toBe(2);
  });

  it('САМ, ДОПЕ на 0,3 больше строки → только «строка ДОПЕ»; значения в MIL', () => {
    const correct = chainOf(manualNotebook());
    expect(nonZeroPlayerLinks(correct)).toEqual([]);
    const chain = chainOf(manualNotebook({ dope: card.rows[4].elevationMil + 0.3 }));
    expect(nonZeroPlayerLinks(chain)).toEqual(['dope']);
    expect(link(chain, 'dope').vector.upMrad).toBeCloseTo(0.3, 9);
    expect(link(chain, 'dope')).toMatchObject({ quantity: 'mil', truth: card.rows[4].elevationMil });
    expect(link(chain, 'dope').player).toBeCloseTo(card.rows[4].elevationMil + 0.3, 9);
  });

  it('САМ, условия на 0,2 меньше → только «условия»; арифметика ветра → только «ветер: расчёт»', () => {
    const auto = formulaCorrectionMil(autoNotebook(), TRUTH);
    expect(nonZeroPlayerLinks(chainOf(manualNotebook({ atmosphere: auto.upMrad - card.rows[4].elevationMil - 0.2 })))).toEqual(['conditions']);
    const windChain = chainOf(manualNotebook({ wind: auto.rightMrad + 0.4 }));
    expect(nonZeroPlayerLinks(windChain)).toEqual(['wind-calc']);
    expect(link(windChain, 'wind-calc').vector.rightMrad).toBeCloseTo(0.4, 9);
  });

  it('округление: 3,46 MIL → 35 кликов → звено 0,04 MIL', () => {
    const notebook = autoNotebook();
    const planned = total(notebook);
    const chain = chainOf(notebook);
    expect(link(chain, 'rounding').vector.upMrad).toBeCloseTo(planned.elevation.targetClicks * CLICK_MIL + planned.holdUpMil - planned.upMil, 9);
    expect(link(chain, 'rounding').quantity).toBe('mil-vector');
  });
});

describe('упреждение в цепочке (T2.1)', () => {
  const MOVEMENT = { speedMps: 1.1, clock: 3 };

  it('АВТО — ноль; САМ, упреждение на 0,5 больше → «упреждение» по ходу цели', () => {
    const moving = { target: { sizeM: 0.5, distanceM: DISTANCE_M, movement: MOVEMENT } };
    const auto = autoNotebook(TRUE_WIND, moving);
    expect(sizeOf(link(chainOf(auto), 'lead').vector)).toBe(0);
    const autoLead = total(auto).leadMil;
    let manual: Notebook = { ...auto, mode: 'manual-easy' };
    manual = solved(manual, 'lead', autoLead + 0.5);
    const chain = chainOf(manual);
    expect(link(chain, 'lead').vector.rightMrad).toBeCloseTo(0.5, 9);
    expect(link(chain, 'lead')).toMatchObject({ quantity: 'mil' });
  });
});

describe('звенья с геометрией и зонами (T2.1)', () => {
  const COS_20 = Math.round(Math.cos((20 * Math.PI) / 180) * 100) / 100;

  it('САМ под углом: ДОПЕ неверна, угол посчитан от своей ДОПЕ → только «строка ДОПЕ»', () => {
    const geometry = { lookAngleDeg: 20, coriolis: null, isSpinDriftOn: false };
    const base = { ...autoNotebook(TRUE_WIND, { geometry }), mode: 'manual-easy' as const };
    const truthFormula = formulaCorrectionMil(base, TRUTH);
    const wrongDope = card.rows[4].elevationMil + 0.3;
    const inclined = (wrongDope + card.zeroAngleMil) * COS_20 - card.zeroAngleMil;
    let notebook = solved(base, 'dope', wrongDope);
    notebook = solved(notebook, 'angle', inclined);
    const conditionsMil = truthFormula.upMrad - ((card.rows[4].elevationMil + card.zeroAngleMil) * COS_20 - card.zeroAngleMil);
    notebook = solved(notebook, 'atmosphere', conditionsMil);
    notebook = solved(notebook, 'wind', Math.abs(truthFormula.rightMrad), truthFormula.rightMrad < 0 ? -1 : 1);
    expect(nonZeroPlayerLinks(chainOf(notebook))).toEqual(['dope']);
  });

  it('САМ с деривацией: шаг деривации на 0,1 больше → только «вращение»', () => {
    const geometry = { lookAngleDeg: 0, coriolis: null, isSpinDriftOn: true };
    const base = { ...autoNotebook(TRUE_WIND, { geometry }), mode: 'manual-easy' as const };
    const truthFormula = formulaCorrectionMil(base, TRUTH);
    const spinMil = -card.rows[4].spinDriftMil;
    let notebook = solved(base, 'dope', card.rows[4].elevationMil);
    notebook = solved(notebook, 'atmosphere', truthFormula.upMrad - card.rows[4].elevationMil);
    const windMil = truthFormula.rightMrad - spinMil;
    notebook = solved(notebook, 'wind', Math.abs(windMil), windMil < 0 ? -1 : 1);
    const wrongSpin = spinMil - 0.1;
    notebook = solved(notebook, 'spin', Math.abs(wrongSpin), wrongSpin < 0 ? -1 : 1);
    const chain = chainOf(notebook);
    expect(nonZeroPlayerLinks(chain)).toEqual(['earth']);
    expect(link(chain, 'earth').vector.rightMrad).toBeCloseTo(-0.1, 9);
  });

  it('АВТО с зонами: флажок 400 прочитан 3 вместо 1 м/с → только «зоны»', () => {
    const truth: FormulaInputs = { ...TRUTH, flagCrosswindsMps: [1, 1, 1] };
    let notebook = autoNotebook(TRUE_WIND, { hasZones: true });
    notebook = readFlag(readFlag(readFlag(notebook, 0, 1), 1, 3), 2, 1);
    const chain = chainOf(notebook, dialOf(notebook), truth);
    expect(nonZeroPlayerLinks(chain)).toEqual(['zones']);
    expect(link(chain, 'zones')).toMatchObject({ quantity: 'crosswinds', player: [1, 3, 1], truth: [1, 1, 1] });
  });

  it('упреждение против хода цели: цель на 9 ч — вклад влево', () => {
    const moving = { target: { sizeM: 0.5, distanceM: DISTANCE_M, movement: { speedMps: 1.1, clock: 9 } } };
    const auto = autoNotebook(TRUE_WIND, moving);
    const manual = solved({ ...auto, mode: 'manual-easy' }, 'lead', total(auto).leadMil + 0.5);
    expect(link(chainOf(manual), 'lead').vector.rightMrad).toBeCloseTo(-0.5, 9);
  });
});
