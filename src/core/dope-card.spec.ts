import { beforeAll, describe, expect, it } from 'vitest';
import { CARTRIDGES, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C, WIND_ZONE_LIMITS_M } from './content';
import { buildDopeCard, DopeCard, dopeRowAt } from './dope-card';
import { BallisticsEngine } from './engine';
import { atmosphereCorrectionMil, averageCrosswindMps, windCorrectionMil } from './game-formulas';
import { createScenario, lateralWindMps } from './scenario';
import { Atmosphere, CartridgeId } from './types';

const CLICK_MIL = 0.1;
const FULL_CROSSWIND_FROM_LEFT_DEG = 90;
const engine = new BallisticsEngine();
const cards = new Map<CartridgeId, DopeCard>();

function atmosphere(temperatureC: number, pressureHpa: number): Atmosphere {
  return { temperatureC, pressureHpa, relativeHumidity: STANDARD_RELATIVE_HUMIDITY };
}

function card(cartridgeId: CartridgeId): DopeCard {
  return cards.get(cartridgeId)!;
}

beforeAll(async () => {
  for (const cartridge of CARTRIDGES) {
    cards.set(cartridge.id, await buildDopeCard(engine, cartridge, CLICK_MIL));
  }
});

describe('buildDopeCard', () => {
  it('has ten rows from 100 to 1000 m', () => {
    expect(card('B').rows.map(row => row.distanceM)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
  });

  it('elevation and time of flight grow, the wind constant falls with distance', () => {
    const rows = card('B').rows.slice(1);
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index].elevationMil).toBeGreaterThan(rows[index - 1].elevationMil);
      expect(rows[index].timeOfFlightS).toBeGreaterThan(rows[index - 1].timeOfFlightS);
      expect(rows[index].windConstant).toBeLessThan(rows[index - 1].windConstant);
    }
  });

  it('matches the engine in standard air on every row of every cartridge', async () => {
    for (const cartridge of CARTRIDGES) {
      const points = await engine.trajectory(cartridge, atmosphere(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA), null);
      for (const row of card(cartridge.id).rows) {
        expect(Math.abs(row.elevationMil - BallisticsEngine.required(points, row.distanceM).upMrad)).toBeLessThanOrEqual(0.05);
        expect(row.clicks).toBe(Math.round(row.elevationMil / CLICK_MIL));
      }
    }
  });

  it('the zero distance shows a plain zero, not −0', () => {
    const zeroRow = dopeRowAt(card('B'), 100);
    expect(Object.is(zeroRow.elevationMil, 0)).toBe(true);
    expect(Object.is(zeroRow.clicks, 0)).toBe(true);
  });

  it('cartridge B needs 16 clicks at 300 m', () => {
    expect(dopeRowAt(card('B'), 300).clicks).toBe(16);
  });

  it('rounds the wind constant to tens', () => {
    for (const row of card('B').rows) {
      expect(row.windConstant % 10).toBe(0);
    }
  });

  it('builds a card per cartridge with different numbers', () => {
    expect(dopeRowAt(card('A'), 600).elevationMil).not.toBe(dopeRowAt(card('C'), 600).elevationMil);
  });
});

describe('dopeRowAt', () => {
  it('blends between rows (350 m is halfway between 300 and 400)', () => {
    const at300 = dopeRowAt(card('B'), 300);
    const at400 = dopeRowAt(card('B'), 400);
    const at350 = dopeRowAt(card('B'), 350);
    expect(at350.distanceM).toBe(350);
    expect(at350.elevationMil).toBeCloseTo((at300.elevationMil + at400.elevationMil) / 2, 6);
    expect(at350.timeOfFlightS).toBeCloseTo((at300.timeOfFlightS + at400.timeOfFlightS) / 2, 6);
    expect(at350.windConstant).toBeCloseTo((at300.windConstant + at400.windConstant) / 2, 6);
    expect(at350.colderBy10CMil).toBeCloseTo((at300.colderBy10CMil + at400.colderBy10CMil) / 2, 6);
    expect(at350.pressureUp10HpaMil).toBeCloseTo((at300.pressureUp10HpaMil + at400.pressureUp10HpaMil) / 2, 6);
  });

  it('returns exact rows at 100 and 1000 m', () => {
    expect(dopeRowAt(card('B'), 100)).toEqual(card('B').rows[0]);
    expect(dopeRowAt(card('B'), 1000)).toEqual(card('B').rows[9]);
  });

  it('rejects distances outside the card', () => {
    expect(() => dopeRowAt(card('B'), 50)).toThrow(RangeError);
    expect(() => dopeRowAt(card('B'), 1050)).toThrow(RangeError);
  });
});

describe('game formulas against the engine', () => {
  it('wind formula is within one click for 100–1000 m and up to 12 m/s', async () => {
    for (const cartridge of CARTRIDGES) {
      for (const speedMps of [4, 8, 12]) {
        const points = await engine.trajectory(cartridge, atmosphere(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA), [
          { untilM: Infinity, speedMps, fromDeg: FULL_CROSSWIND_FROM_LEFT_DEG },
        ]);
        for (const row of card(cartridge.id).rows) {
          const engineMil = BallisticsEngine.required(points, row.distanceM).rightMrad;
          const formulaMil = windCorrectionMil(speedMps, 9, row.distanceM, row.windConstant);
          expect(Math.abs(formulaMil - engineMil)).toBeLessThan(CLICK_MIL);
        }
      }
    }
  });

  const weatherGrid: [number, number][] = [
    [-10, 990], [-10, 1035], [35, 990], [35, 1035], [-5, 1030], [35, 1000],
  ];

  async function worstAtmosphereErrorMil(maxDistanceM: number, minDistanceM: number): Promise<number> {
    let worstMil = 0;
    for (const cartridge of CARTRIDGES) {
      const standardPoints = await engine.trajectory(cartridge, atmosphere(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA), null);
      for (const [temperatureC, pressureHpa] of weatherGrid) {
        const points = await engine.trajectory(cartridge, atmosphere(temperatureC, pressureHpa), null);
        for (const row of card(cartridge.id).rows.filter(candidate => candidate.distanceM >= minDistanceM && candidate.distanceM <= maxDistanceM)) {
          const engineShiftMil = BallisticsEngine.required(points, row.distanceM).upMrad - BallisticsEngine.required(standardPoints, row.distanceM).upMrad;
          worstMil = Math.max(worstMil, Math.abs(atmosphereCorrectionMil(row, temperatureC, pressureHpa) - engineShiftMil));
        }
      }
    }
    return worstMil;
  }

  it('atmosphere formula is within one click up to 700 m', async () => {
    expect(await worstAtmosphereErrorMil(700, 100)).toBeLessThanOrEqual(CLICK_MIL);
  });

  it('atmosphere formula is within two clicks at 800–1000 m', async () => {
    expect(await worstAtmosphereErrorMil(1000, 800)).toBeLessThanOrEqual(2 * CLICK_MIL);
  });

  it('colder air and higher pressure mean more elevation, standard air means none', () => {
    const row = dopeRowAt(card('B'), 600);
    expect(row.colderBy10CMil).toBeGreaterThan(0);
    expect(row.pressureUp10HpaMil).toBeGreaterThan(0);
    expect(atmosphereCorrectionMil(row, STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA)).toBe(0);
  });
});

describe('zone weights', () => {
  const WEIGHT_STEP = 0.05;

  it('every row has four weights in steps of 0.05 summing to exactly 1', () => {
    for (const cartridge of CARTRIDGES) {
      for (const row of card(cartridge.id).rows) {
        expect(row.zoneWeights).toHaveLength(WIND_ZONE_LIMITS_M.length);
        for (const weight of row.zoneWeights) {
          expect(Math.abs(weight / WEIGHT_STEP - Math.round(weight / WEIGHT_STEP))).toBeLessThan(1e-9);
        }
        expect(row.zoneWeights.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 9);
      }
    }
  });

  it('near zones matter at short range, the far zone at long range', () => {
    const rowAt = (distanceM: number) => card('B').rows.find(row => row.distanceM === distanceM)!;
    expect(rowAt(300).zoneWeights.slice(2)).toEqual([0, 0]);
    expect(rowAt(500).zoneWeights[0]).toBeCloseTo(0.45, 9);
    const far = rowAt(1000).zoneWeights;
    expect(far[3]).toBe(Math.max(...far));
  });

  it('matches the engine within half a rounding step', async () => {
    const standard = atmosphere(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA);
    for (const cartridge of CARTRIDGES) {
      const zonesWith = (windyZone: number | null) =>
        WIND_ZONE_LIMITS_M.map((untilM, index) => ({ untilM, speedMps: windyZone === null || windyZone === index ? 1 : 0, fromDeg: FULL_CROSSWIND_FROM_LEFT_DEG }));
      const full = await engine.trajectory(cartridge, standard, zonesWith(null));
      const perZone = await Promise.all(WIND_ZONE_LIMITS_M.map((_, index) => engine.trajectory(cartridge, standard, zonesWith(index))));
      for (const row of card(cartridge.id).rows.filter(candidate => candidate.distanceM >= 200)) {
        const totalMil = BallisticsEngine.required(full, row.distanceM).rightMrad;
        perZone.forEach((points, index) => {
          const engineWeight = BallisticsEngine.required(points, row.distanceM).rightMrad / totalMil;
          expect(Math.abs(row.zoneWeights[index] - engineWeight)).toBeLessThanOrEqual(WEIGHT_STEP / 2 + 0.01);
        });
      }
    }
  });

  it('interpolates weights between rows and keeps the sum at 1', () => {
    for (const distanceM of [450, 650]) {
      const lower = dopeRowAt(card('B'), distanceM - 50).zoneWeights;
      const upper = dopeRowAt(card('B'), distanceM + 50).zoneWeights;
      const between = dopeRowAt(card('B'), distanceM).zoneWeights;
      between.forEach((weight, index) => expect(weight).toBeCloseTo((lower[index] + upper[index]) / 2, 9));
      expect(between.reduce((total, weight) => total + weight, 0)).toBeCloseTo(1, 9);
    }
  });

  it('the average-wind formula is within one click of the engine in zone exercises', async () => {
    const standard = atmosphere(STANDARD_TEMPERATURE_C, STANDARD_PRESSURE_HPA);
    const cartridge = CARTRIDGES.find(candidate => candidate.id === 'B')!;
    for (let seed = 1; seed <= 20; seed++) {
      const { zones } = createScenario(seed * 101, { isWindUniform: false });
      for (const distanceM of [200, 350, 500, 550, 600, 650, 700]) {
        const points = await engine.trajectory(cartridge, standard, zones, cartridge.muzzleVelocityMps, distanceM);
        const engineMil = BallisticsEngine.required(points, distanceM).rightMrad;
        const row = dopeRowAt(card('B'), distanceM);
        const averageMps = averageCrosswindMps(zones.map(zone => lateralWindMps(zone)), row.zoneWeights);
        const formulaMil = windCorrectionMil(averageMps, 9, distanceM, row.windConstant);
        expect(Math.abs(formulaMil - engineMil)).toBeLessThan(CLICK_MIL);
      }
    }
  });
});
