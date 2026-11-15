import { beforeAll, describe, expect, it } from 'vitest';
import { checkManualSteps } from '../core/calc-check';
import { courseLoadout } from '../core/content';
import { buildDopeCard, DopeCard, dopeRowAt } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { atmosphereCorrectionMilImperial, imperialWindConstant, leadMilImperial, rangeByMillingYards } from '../core/game-formulas';
import { fromInput, inSystem } from '../core/units';
import {
  checkInputs,
  createNotebook,
  enterWind,
  measureRange,
  Notebook,
  NotebookContext,
  NotebookStepId,
  placeChip,
  recordStation,
  recordStep,
  setSign,
  stepSheet,
  total,
  typeTape,
  ChipKind,
} from './notebook';
import { scopeById } from './scope-model';

const CLICK_MIL = 0.1;
const NO_CHECK_TRUTH = { trueWindClock: 9, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 };
const STATION = { temperatureC: -5, pressureHpa: 1030, relativeHumidity: 0.5, windSpeedMps: 3.2, windClock: 9 };
const engine = new BallisticsEngine();
let metricCard: DopeCard;
let imperialCard: DopeCard;

beforeAll(async () => {
  metricCard = await buildDopeCard(engine, courseLoadout('B'), CLICK_MIL);
  imperialCard = await buildDopeCard(engine, courseLoadout('B'), CLICK_MIL, 'imperial');
});

function context(card: DopeCard, distanceM: number | null, fields: Partial<NotebookContext> = {}): NotebookContext {
  return { card, scope: scopeById('course-dot'), target: { sizeM: 0.5, distanceM }, hasZones: false, canTakeWindFromStation: false, seed: 4, ...fields };
}

function chipValueOf(notebook: Notebook, step: NotebookStepId, kind: ChipKind): number {
  const chip = stepSheet(notebook, step).chips.concat(stepSheet(notebook, step).printedConstants).find(candidate => candidate.kind === kind);
  return chip!.value;
}

function solve(notebook: Notebook, step: NotebookStepId, chips: ChipKind[], tape: number[], sign: 1 | -1 = 1): Notebook {
  let next = chips.reduce((current, chip) => placeChip(current, step, chip), notebook);
  tape.forEach((value, index) => {
    next = typeTape(next, step, index, value);
  });
  return recordStep(setSign(next, step, sign), step);
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

describe('фишки в имперских (T1.8b)', () => {
  it('размер — дюймы, дистанция — ярды, сосед +100 ярдов, условия — °F и inHg, ветер — mph, K — K_imp', () => {
    let notebook = createNotebook(context(imperialCard, 548.64), 'manual-hard');
    notebook = enterWind(recordStation(notebook, STATION, 3, 0), 3.2, 9);
    const row = dopeRowAt(imperialCard, 548.64);
    expect(chipValueOf(notebook, 'distance', 'target-size')).toBe(19.7);
    expect(chipValueOf(notebook, 'dope', 'distance')).toBeCloseTo(600, 9);
    expect(chipValueOf(notebook, 'dope', 'neighbor-distance')).toBeCloseTo(700, 9);
    expect(chipValueOf(notebook, 'atmosphere', 'temperature')).toBeCloseTo(23, 9);
    expect(chipValueOf(notebook, 'atmosphere', 'pressure')).toBe(30.42);
    expect(chipValueOf(notebook, 'atmosphere', 'colder-column')).toBe(row.colderStepMil);
    expect(chipValueOf(notebook, 'wind', 'crosswind')).toBe(7.2);
    expect(chipValueOf(notebook, 'wind', 'wind-constant')).toBe(imperialWindConstant(row.windConstant));
  });

  it('метрика — прежние фишки: метры, °C, гПа, м/с, K', () => {
    let notebook = createNotebook(context(metricCard, 600), 'manual-hard');
    notebook = enterWind(recordStation(notebook, STATION, 3, 0), 3.2, 9);
    expect(chipValueOf(notebook, 'dope', 'distance')).toBe(600);
    expect(chipValueOf(notebook, 'atmosphere', 'temperature')).toBe(-5);
    expect(chipValueOf(notebook, 'wind', 'wind-constant')).toBe(dopeRowAt(metricCard, 600).windConstant);
  });
});

describe('фишки в имперских округлены до точности прибора (T1.8b)', () => {
  it('°F и mph — до десятых, дюймы рт. ст. — до сотых, размер — до десятых дюйма', () => {
    let notebook = createNotebook(context(imperialCard, 548.64), 'manual-hard');
    notebook = enterWind(recordStation(notebook, { ...STATION, temperatureC: 16.6, pressureHpa: 1010.2 }, 3, 0), 2.47, 10);
    expect(chipValueOf(notebook, 'atmosphere', 'temperature')).toBe(61.9);
    expect(chipValueOf(notebook, 'atmosphere', 'pressure')).toBe(29.83);
    expect(chipValueOf(notebook, 'wind', 'crosswind')).toBe(Math.round(inSystem('windSpeed', 2.47 * 0.866, 'imperial') * 10) / 10);
    expect(chipValueOf(notebook, 'distance', 'target-size')).toBe(19.7);
  });
});

describe('ручные шаги в имперских — верные числа дают «точно» (T1.8b)', () => {
  it('дистанция: размер″ × 27,78 / MIL = ярды; строка ДОПЕ — по ярдам', () => {
    let notebook = measureRange(createNotebook(context(imperialCard, null), 'manual-easy'), 1);
    const yards = rangeByMillingYards(0.5 / 0.0254, 1);
    notebook = solve(notebook, 'distance', ['target-size', 'reticle-mil'], [round2(yards)]);
    const check = checkManualSteps(checkInputs(notebook, NO_CHECK_TRUTH).steps, CLICK_MIL);
    expect(check.verdict).toBe('exact');
    expect(notebook.distanceM).toBeCloseTo(fromInput('distance', round2(yards), 'imperial'), 9);
  });

  it('условия: (59 − T) / 10 × Х + (P − 29,92) / 0,3 × Р', () => {
    const distanceM = 600 * 0.9144;
    let notebook = recordStation(createNotebook(context(imperialCard, distanceM), 'manual-easy'), STATION, 3, 0);
    const row = dopeRowAt(imperialCard, distanceM);
    const answer = round2(atmosphereCorrectionMilImperial(row, inSystem('temperature', -5, 'imperial'), inSystem('pressure', 1030, 'imperial')));
    notebook = solve(notebook, 'atmosphere', ['temperature', 'pressure'], [answer]);
    expect(checkManualSteps(checkInputs(notebook, NO_CHECK_TRUTH).steps, CLICK_MIL).verdict).toBe('exact');
  });

  it('ветер: V⊥(mph) × D(ярды) / K_imp; подстановка м/с — ошибка подстановки', () => {
    const distanceM = 600 * 0.9144;
    let notebook = enterWind(createNotebook(context(imperialCard, distanceM), 'manual-hard'), 3.2, 10);
    const crosswind = chipValueOf(notebook, 'wind', 'crosswind');
    const constant = chipValueOf(notebook, 'wind', 'wind-constant');
    const product = round2(crosswind * 600);
    const slots = stepSheet(notebook, 'wind').slots.map(slot => slot.chipKind);
    const exact = solve(notebook, 'wind', slots, [product, round2(product / constant), round2(product / constant)], -1);
    expect(checkManualSteps(checkInputs(exact, NO_CHECK_TRUTH).steps, CLICK_MIL).verdict).toBe('exact');
    const wrongProduct = round2(chipValueOf(notebook, 'wind', 'speed') * 600);
    const wrong = solve(notebook, 'wind', slots.map(kind => (kind === 'crosswind' ? 'speed' : kind)), [wrongProduct, round2(wrongProduct / constant), round2(wrongProduct / constant)], -1);
    expect(checkManualSteps(checkInputs(wrong, NO_CHECK_TRUTH).steps, CLICK_MIL).rows[0].errorTypes).toContain('substitution');
  });

  it('упреждение: 488,9 × V⊥(mph) × t / D(ярды)', () => {
    const distanceM = 400 * 0.9144;
    const movement = { speedMps: 1.1, clock: 3 };
    const notebook = createNotebook(context(imperialCard, distanceM, { target: { sizeM: 0.5, distanceM, movement } }), 'manual-easy');
    const row = dopeRowAt(imperialCard, distanceM);
    const answer = round2(leadMilImperial(inSystem('windSpeed', 1.1, 'imperial'), 3, row.timeOfFlightS, 400));
    const solved = solve(notebook, 'lead', ['target-crosswind', 'time-of-flight', 'distance'], [answer, answer, answer]);
    expect(checkManualSteps(checkInputs(solved, NO_CHECK_TRUTH).steps, CLICK_MIL).verdict).toBe('exact');
  });
});

describe('АВТО в имперских совпадает с метрикой до клика (T1.8b)', () => {
  it('на 300, 600 и 900 м: итог на барабаны', () => {
    for (const distanceM of [300, 600, 900]) {
      const prepare = (card: DopeCard) => enterWind(recordStation(createNotebook(context(card, distanceM), 'auto'), STATION, 3, 0), 3.2, 9);
      const metric = total(prepare(metricCard));
      const imperial = total(prepare(imperialCard));
      expect(Math.abs(imperial.upMil - metric.upMil), `${distanceM} м вверх`).toBeLessThanOrEqual(CLICK_MIL);
      expect(Math.abs(imperial.rightMil - metric.rightMil), `${distanceM} м вбок`).toBeLessThanOrEqual(CLICK_MIL);
    }
  });
});
