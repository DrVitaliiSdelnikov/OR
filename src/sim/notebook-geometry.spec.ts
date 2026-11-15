import { beforeAll, describe, expect, it } from 'vitest';
import { checkManualSteps } from '../core/calc-check';
import { courseLoadout, FLAT_GEOMETRY } from '../core/content';
import { buildDopeCard, DopeCard, dopeRowAt } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { inclineElevationMil } from '../core/game-formulas';
import { ShotGeometry } from '../core/types';
import {
  ChipKind,
  checkInputs,
  createNotebook,
  factorContributions,
  formulaCorrectionMil,
  measureRange,
  Notebook,
  NotebookContext,
  NotebookStepId,
  placeChip,
  recordStep,
  setSign,
  staleness,
  stepHasSide,
  stepSheet,
  total,
  typeTape,
  changeContext,
} from './notebook';
import { scopeById } from './scope-model';

const CLICK_MIL = 0.1;
const EARTH_ROTATION_MIL_PER_S = 0.0729;
const MOUNTAIN: ShotGeometry = { ...FLAT_GEOMETRY, lookAngleDeg: 20 };
const LONG_RANGE: ShotGeometry = { lookAngleDeg: 0, coriolis: { latitudeDeg: 55, azimuthDeg: 90 }, isSpinDriftOn: true };
const TRUTH = { distanceM: 600, temperatureC: 15, pressureHpa: 1013, wind: { speedMps: 0, clock: 3 }, flagCrosswindsMps: null };
const NO_CHECK_TRUTH = { trueWindClock: 3, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 };
let card: DopeCard;

beforeAll(async () => {
  card = await buildDopeCard(new BallisticsEngine(), courseLoadout('B'), CLICK_MIL);
});

function context(geometry?: ShotGeometry): NotebookContext {
  return {
    card,
    scope: scopeById('tree'),
    target: { sizeM: 0.5, distanceM: 600 },
    hasZones: false,
    canTakeWindFromStation: false,
    seed: 7,
    ...(geometry ? { geometry } : {}),
  };
}

function solve(notebook: Notebook, step: NotebookStepId, chips: ChipKind[], tape: number[], sign: 1 | -1 = 1): Notebook {
  let next = chips.reduce((current, chip) => placeChip(current, step, chip), notebook);
  tape.forEach((value, index) => {
    next = typeTape(next, step, index, value);
  });
  return recordStep(setSign(next, step, sign), step);
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

describe('ровная геометрия (T1.4b)', () => {
  it('без геометрии и с FLAT_GEOMETRY — те же итоги, новые факторы выключены и пусты', () => {
    const before = createNotebook(context(), 'auto');
    const flat = createNotebook(context(FLAT_GEOMETRY), 'auto');
    expect(total(flat)).toEqual(total(before));
    const contributions = factorContributions(flat);
    for (const factor of ['angle', 'spin', 'coriolis', 'eotvos'] as const) {
      expect(contributions[factor], factor).toEqual({ isOn: false, mil: null, clicks: null });
    }
  });
});

describe('угол места', () => {
  it('АВТО 20°: вертикаль = ДОПЕ + угол, угол < 0 и равен формуле с cos до 0,01; горизонталь не меняется', () => {
    const notebook = createNotebook(context(MOUNTAIN), 'auto');
    const row = dopeRowAt(card, 600);
    const angleMil = (row.elevationMil + card.zeroAngleMil) * round2(Math.cos((20 * Math.PI) / 180)) - card.zeroAngleMil - row.elevationMil;
    const contributions = factorContributions(notebook);
    expect(contributions.angle.isOn).toBe(true);
    expect(contributions.angle.mil).toBeCloseTo(angleMil, 9);
    expect(contributions.angle.mil!).toBeLessThan(0);
    expect(total(notebook).upMil).toBeCloseTo(row.elevationMil + angleMil, 9);
    expect(total(notebook).rightMil).toBe(total(createNotebook(context(), 'auto')).rightMil);
  });

  it('ручной шаг: фишки строка ДОПЕ, Z и cos угла; три строки ленты; без стороны; итог — возвышение под углом', () => {
    const sheet = stepSheet(createNotebook(context(MOUNTAIN), 'manual-easy'), 'angle');
    expect(sheet.slots.map(slot => slot.chipKind)).toEqual(['dope-elevation', 'zero-angle', 'cos-angle']);
    expect(sheet.tapeLength).toBe(3);
    expect(stepHasSide('angle')).toBe(false);
    const row = dopeRowAt(card, 600);
    const cos = round2(Math.cos((20 * Math.PI) / 180));
    const inclined = inclineElevationMil(row.elevationMil, card.zeroAngleMil, 20);
    let notebook = createNotebook(context(MOUNTAIN), 'manual-easy');
    notebook = solve(notebook, 'dope', ['distance'], [row.elevationMil]);
    notebook = solve(notebook, 'angle', ['dope-elevation', 'zero-angle', 'cos-angle'], [row.elevationMil + card.zeroAngleMil, (row.elevationMil + card.zeroAngleMil) * cos, round2(inclined)]);
    expect(total(notebook).upMil).toBeCloseTo(round2(inclined), 9);
    const check = checkManualSteps(checkInputs(notebook, NO_CHECK_TRUTH).steps, CLICK_MIL);
    expect(check.rows.map(checked => checked.status)).toEqual(['exact', 'exact']);
  });

  it('шаг угла не записан — вертикаль по ДОПЕ, как раньше', () => {
    const row = dopeRowAt(card, 600);
    const notebook = solve(createNotebook(context(MOUNTAIN), 'manual-easy'), 'dope', ['distance'], [row.elevationMil]);
    expect(total(notebook).upMil).toBeCloseTo(row.elevationMil, 9);
  });
});

describe('деривация, Кориолис, Этвёш', () => {
  it('АВТО: деривация против ухода (влево), Кориолис в с. ш. влево, на восток Этвёш вниз; значения — по фишкам до 0,01', () => {
    const notebook = createNotebook(context(LONG_RANGE), 'auto');
    const row = dopeRowAt(card, 600);
    const contributions = factorContributions(notebook);
    const sinLatitude = round2(Math.sin((55 * Math.PI) / 180));
    const cosLatitude = round2(Math.cos((55 * Math.PI) / 180));
    expect(contributions.spin.mil).toBeCloseTo(-row.spinDriftMil, 9);
    expect(contributions.coriolis.mil).toBeCloseTo(-EARTH_ROTATION_MIL_PER_S * row.timeOfFlightS * sinLatitude, 9);
    expect(contributions.eotvos.mil).toBeCloseTo(-EARTH_ROTATION_MIL_PER_S * row.timeOfFlightS * cosLatitude * 1, 9);
    expect(contributions.spin.mil!).toBeLessThan(0);
    expect(contributions.coriolis.mil!).toBeLessThan(0);
    expect(contributions.eotvos.mil!).toBeLessThan(0);
    const flat = total(createNotebook(context(), 'auto'));
    expect(total(notebook).rightMil).toBeCloseTo(flat.rightMil + contributions.spin.mil! + contributions.coriolis.mil!, 9);
    expect(total(notebook).upMil).toBeCloseTo(flat.upMil + contributions.eotvos.mil!, 9);
  });

  it('южное полушарие — Кориолис вправо; на запад — Этвёш вверх', () => {
    const south = factorContributions(createNotebook(context({ ...LONG_RANGE, coriolis: { latitudeDeg: -40, azimuthDeg: 270 } }), 'auto'));
    expect(south.coriolis.mil!).toBeGreaterThan(0);
    expect(south.eotvos.mil!).toBeGreaterThan(0);
  });

  it('ручная деривация со стороной «вправо» — ошибка стороны; «влево» — точно', () => {
    const spinDriftMil = round2(dopeRowAt(card, 600).spinDriftMil);
    const wrong = solve(createNotebook(context(LONG_RANGE), 'manual-easy'), 'spin', ['spin-drift'], [spinDriftMil], 1);
    const right = solve(createNotebook(context(LONG_RANGE), 'manual-easy'), 'spin', ['spin-drift'], [spinDriftMil], -1);
    const wrongCheck = checkManualSteps(checkInputs(wrong, NO_CHECK_TRUTH).steps, CLICK_MIL);
    expect(wrongCheck.verdict).toBe('error');
    expect(wrongCheck.rows[0].errorTypes).toEqual(['side']);
    expect(checkManualSteps(checkInputs(right, NO_CHECK_TRUTH).steps, CLICK_MIL).verdict).toBe('exact');
  });

  it('фишки Кориолиса и Этвёша: t, |sin φ|, cos φ, |sin A| с 1000·Ω отдельной константой', () => {
    const notebook = createNotebook(context({ ...LONG_RANGE, coriolis: { latitudeDeg: -40, azimuthDeg: 250 } }), 'manual-easy');
    const coriolis = stepSheet(notebook, 'coriolis');
    const eotvos = stepSheet(notebook, 'eotvos');
    expect(coriolis.slots.map(slot => slot.chipKind)).toEqual(['time-of-flight', 'sin-latitude']);
    expect(eotvos.slots.map(slot => slot.chipKind)).toEqual(['time-of-flight', 'cos-latitude', 'sin-azimuth']);
    expect(coriolis.printedConstants.map(chip => [chip.kind, chip.value])).toEqual([['earth-rotation', EARTH_ROTATION_MIL_PER_S]]);
    const chipValue = (kind: ChipKind) => eotvos.chips.concat(coriolis.chips).find(chip => chip.kind === kind)!.value;
    expect(chipValue('sin-latitude')).toBe(0.64);
    expect(chipValue('cos-latitude')).toBe(0.77);
    expect(chipValue('sin-azimuth')).toBe(0.94);
  });
});

describe('устаревание и правда для разбора', () => {
  it('сменили дальность — шаги угла, деривации, Кориолиса и Этвёша устарели', () => {
    const geometry: ShotGeometry = { ...LONG_RANGE, lookAngleDeg: 15 };
    const row = dopeRowAt(card, 600);
    let notebook = createNotebook(context(geometry), 'manual-easy');
    notebook = solve(notebook, 'angle', ['dope-elevation', 'zero-angle', 'cos-angle'], [1, 1, 5]);
    notebook = solve(notebook, 'spin', ['spin-drift'], [round2(row.spinDriftMil)], -1);
    notebook = solve(notebook, 'coriolis', ['time-of-flight', 'sin-latitude'], [0.1], -1);
    notebook = solve(notebook, 'eotvos', ['time-of-flight', 'cos-latitude', 'sin-azimuth'], [0.1], -1);
    const moved = changeContext(notebook, { target: { sizeM: 0.5, distanceM: 700 } });
    const stale = staleness(moved);
    for (const step of ['angle', 'spin', 'coriolis', 'eotvos'] as const) {
      expect(stale[step], step).toBe('distance');
    }
  });

  it('правда для разбора (formulaCorrectionMil) учитывает геометрию блокнота', () => {
    const flat = formulaCorrectionMil(createNotebook(context(), 'manual-hard'), TRUTH);
    const tilted = formulaCorrectionMil(createNotebook(context({ ...LONG_RANGE, lookAngleDeg: 20 }), 'manual-hard'), TRUTH);
    const contributions = factorContributions(createNotebook(context({ ...LONG_RANGE, lookAngleDeg: 20 }), 'auto'));
    expect(tilted.upMrad).toBeCloseTo(flat.upMrad + contributions.angle.mil! + contributions.eotvos.mil!, 9);
    expect(tilted.rightMrad).toBeCloseTo(flat.rightMrad + contributions.spin.mil! + contributions.coriolis.mil!, 9);
  });

  it('новые факторы не мешают миллингу: дальность по сетке, угол — от неё', () => {
    let notebook = createNotebook({ ...context(MOUNTAIN), target: { sizeM: 0.5, distanceM: null } }, 'auto');
    notebook = measureRange(notebook, 1);
    expect(factorContributions(notebook).angle.mil).not.toBeNull();
  });
});
