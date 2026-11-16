import { beforeAll, describe, expect, it } from 'vitest';
import { CARTRIDGES, courseLoadout, rangeLayout, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C } from './content';
import { buildDopeCard, DopeCard, dopeRowAt } from './dope-card';
import { BallisticsEngine } from './engine';
import { atmosphereCorrectionMilImperial } from './game-formulas';
import { Atmosphere, CartridgeId } from './types';
import { fromInput, inSystem } from './units';

const CLICK_MIL = 0.1;
const YARD_M = 0.9144;
const COLDER_STEP_F = 10;
const PRESSURE_STEP_INHG = 0.3;
const engine = new BallisticsEngine();
const imperialCards = new Map<CartridgeId, DopeCard>();

function atmosphere(temperatureC: number, pressureHpa: number): Atmosphere {
  return { temperatureC, pressureHpa, relativeHumidity: STANDARD_RELATIVE_HUMIDITY };
}

beforeAll(async () => {
  for (const cartridge of CARTRIDGES) {
    imperialCards.set(cartridge.id, await buildDopeCard(engine, courseLoadout(cartridge.id), CLICK_MIL, 'imperial'));
  }
});

describe('карточка ДОПЕ в имперских (T1.8b)', () => {
  it('десять строк через 100 ярдов: 91,44…914,4 м; карточка помнит систему', () => {
    const card = imperialCards.get('B')!;
    expect(card.system).toBe('imperial');
    expect(card.rows.map(row => row.distanceM)).toEqual(Array.from({ length: 10 }, (_, index) => Number(((index + 1) * 100 * YARD_M).toFixed(2))));
  });

  it('метрическая карточка — по умолчанию и прежняя', async () => {
    const metric = await buildDopeCard(engine, courseLoadout('B'), CLICK_MIL);
    expect(metric.system).toBe('metric');
    expect(metric.rows.map(row => row.distanceM)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it('колонки: холоднее на 10 °F и давление +0,3 inHg — прогоны ядра до 0,01 MIL', async () => {
    const loadout = courseLoadout('B');
    const card = imperialCards.get('B')!;
    const step = 100 * YARD_M;
    const run = (temperatureC: number, pressureHpa: number) => engine.trajectory(loadout, atmosphere(temperatureC, pressureHpa), null, undefined, step);
    const standard = await run(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA);
    const colder = await run(STANDARD_TEMPERATURE_C - COLDER_STEP_F * (5 / 9), STANDARD_PRESSURE_HPA);
    const denser = await run(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA + fromInput('pressure', PRESSURE_STEP_INHG, 'imperial'));
    for (const [index, row] of card.rows.entries()) {
      const at = (points: typeof standard) => -points[index + 1].dropMrad;
      expect(row.colderStepMil, `${row.distanceM} м`).toBeCloseTo(at(colder) - at(standard), 2);
      expect(row.pressureStepMil, `${row.distanceM} м`).toBeCloseTo(at(denser) - at(standard), 2);
    }
  });
});

describe('формула условий в имперских (T1.8b)', () => {
  const weatherGrid: [number, number][] = [
    [-10, 990], [-10, 1035], [35, 990], [35, 1035], [-5, 1030], [35, 1000],
  ];

  async function worstErrorMil(minDistanceM: number, maxDistanceM: number): Promise<number> {
    let worstMil = 0;
    for (const cartridge of CARTRIDGES) {
      const loadout = courseLoadout(cartridge.id);
      const step = 100 * YARD_M;
      const standard = await engine.trajectory(loadout, atmosphere(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA), null, undefined, step);
      for (const [temperatureC, pressureHpa] of weatherGrid) {
        const points = await engine.trajectory(loadout, atmosphere(temperatureC, pressureHpa), null, undefined, step);
        for (const [index, row] of imperialCards.get(cartridge.id)!.rows.entries()) {
          if (row.distanceM < minDistanceM || row.distanceM > maxDistanceM) {
            continue;
          }
          const engineShiftMil = -points[index + 1].dropMrad + standard[index + 1].dropMrad;
          const formulaMil = atmosphereCorrectionMilImperial(row, inSystem('temperature', temperatureC, 'imperial'), inSystem('pressure', pressureHpa, 'imperial'));
          worstMil = Math.max(worstMil, Math.abs(formulaMil - engineShiftMil));
        }
      }
    }
    return worstMil;
  }

  it('в пределах клика до 700 ярдов, как метрическая', async () => {
    expect(await worstErrorMil(0, 700 * YARD_M)).toBeLessThanOrEqual(CLICK_MIL);
  });

  it('в пределах двух кликов на 800–1000 ярдов', async () => {
    expect(await worstErrorMil(800 * YARD_M - 1, 1000 * YARD_M + 1)).toBeLessThanOrEqual(2 * CLICK_MIL);
  });

  it('эталон 59 °F и 29,92 inHg — ноль; холоднее и плотнее — вверх', () => {
    const row = imperialCards.get('B')!.rows[5];
    expect(atmosphereCorrectionMilImperial(row, 59, 29.92)).toBe(0);
    expect(atmosphereCorrectionMilImperial(row, 39, 29.92)).toBeCloseTo(2 * row.colderStepMil, 9);
    expect(atmosphereCorrectionMilImperial(row, 59, 30.52)).toBeCloseTo(2 * row.pressureStepMil, 9);
  });
});

describe('полигон в ярдах на карточке (T1.8c)', () => {
  const ZONE_WEIGHT_PARTS = 20;

  it('веса зон — по границам 150 / 350 / 550 ярдов: прогоны ядра с ветром в одной зоне', async () => {
    const loadout = courseLoadout('B', 'imperial');
    const card = await buildDopeCard(engine, loadout, CLICK_MIL, 'imperial');
    const step = 100 * YARD_M;
    const limits = rangeLayout('imperial').windZoneLimitsM;
    const driftAt = async (windyZone: number | null) =>
      engine.trajectory(loadout, atmosphere(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA), limits.map((untilM, zoneIndex) => ({ untilM, speedMps: windyZone === null || zoneIndex === windyZone ? 1 : 0, fromDeg: 90 })), undefined, step, undefined, step * 10);
    const full = await driftAt(null);
    for (const [zoneIndex] of limits.entries()) {
      const single = await driftAt(zoneIndex);
      for (const rowIndex of [3, 5, 9]) {
        const share = single[rowIndex + 1].windageMrad / full[rowIndex + 1].windageMrad;
        expect(Math.abs(card.rows[rowIndex].zoneWeights[zoneIndex] - share), `зона ${zoneIndex}, строка ${rowIndex}`).toBeLessThan(1 / ZONE_WEIGHT_PARTS);
      }
    }
  });

  it('ноль 100 ярдов: карточка помнит его, угол нуля — по ядру и не как у нуля 100 м', async () => {
    const loadout = courseLoadout('B', 'imperial');
    const card = await buildDopeCard(engine, loadout, CLICK_MIL, 'imperial');
    expect(card.zeroM).toBeCloseTo(100 * YARD_M, 9);
    expect(card.zeroAngleMil).toBeCloseTo(await engine.zeroAngleMil(loadout), 2);
    expect(card.zeroAngleMil).not.toBe(imperialCards.get('B')!.zeroAngleMil);
  });

  it('цель на 100…1000 ярдов попадает ровно в свою строку', () => {
    const card = imperialCards.get('B')!;
    for (const [index, row] of card.rows.entries()) {
      expect(dopeRowAt(card, fromInput('distance', (index + 1) * 100, 'imperial')), `${(index + 1) * 100} ярдов`).toBe(row);
    }
  });
});
