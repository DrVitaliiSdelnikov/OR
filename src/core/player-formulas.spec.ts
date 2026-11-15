import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout, FLAT_GEOMETRY, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C } from './content';
import { buildDopeCard, DopeCard, dopeRowAt } from './dope-card';
import { BallisticsEngine } from './engine';
import {
  atmosphereCorrectionMil,
  coriolisHorizontalMil,
  coriolisVerticalMil,
  imperialWindConstant,
  inclineElevationMil,
  leadMil,
  leadMilImperial,
  rangeByMilling,
  rangeByMillingYards,
  rangeByMoaYards,
  windCorrectionMil,
} from './game-formulas';
import { REFERENCE_LOADOUTS } from './reference/reference-loadouts';
import { Atmosphere, Loadout, ShotGeometry, TrajectoryPoint } from './types';

const CLICK_MIL = 0.1;
const METERS_PER_YARD = 0.9144;
const MPS_PER_MPH = 0.44704;
const MRAD_PER_MOA = 0.29088821;
const STANDARD: Atmosphere = { temperatureC: STANDARD_TEMPERATURE_C, pressureHpa: STANDARD_PRESSURE_HPA, relativeHumidity: STANDARD_RELATIVE_HUMIDITY };
const FULL_CROSSWIND_FROM_LEFT_DEG = 90;
const WIND_CLOCK_FROM_LEFT = 9;

const LOADOUTS: readonly { id: string; loadout: Loadout }[] = [{ id: 'Б', loadout: courseLoadout('B') }, ...REFERENCE_LOADOUTS];
const engine = new BallisticsEngine();
const cards = new Map<string, DopeCard>();

function cardOf(id: string): DopeCard {
  return cards.get(id)!;
}

function required(points: readonly TrajectoryPoint[], distanceM: number) {
  return BallisticsEngine.required(points, distanceM);
}

async function shoot(loadout: Loadout, geometry: ShotGeometry = FLAT_GEOMETRY, atmosphere: Atmosphere = STANDARD) {
  return engine.trajectory(loadout, atmosphere, null, undefined, undefined, geometry);
}

beforeAll(async () => {
  for (const { id, loadout } of LOADOUTS) {
    cards.set(id, await buildDopeCard(engine, loadout, CLICK_MIL));
  }
});

describe('угол места (T1.4a)', () => {
  it('C4: (ДОПЕ + Z) × cos − Z — ≤ 1 клика до 800 м и ≤ 2 кликов на 1000 м при ±10…30°', async () => {
    for (const { id, loadout } of LOADOUTS) {
      const card = cardOf(id);
      for (const lookAngleDeg of [10, 20, 30, -15, -30]) {
        const points = await shoot(loadout, { ...FLAT_GEOMETRY, lookAngleDeg });
        for (const row of card.rows) {
          const errorMil = Math.abs(inclineElevationMil(row.elevationMil, card.zeroAngleMil, lookAngleDeg) - required(points, row.distanceM).upMrad);
          const toleranceMil = row.distanceM <= 800 ? CLICK_MIL : 2 * CLICK_MIL;
          expect(errorMil, `${id} ${lookAngleDeg}° ${row.distanceM} м`).toBeLessThanOrEqual(toleranceMil);
        }
      }
    }
  });

  it('при 0° формула возвращает строку ДОПЕ', () => {
    expect(inclineElevationMil(5.49, 1.31, 0)).toBeCloseTo(5.49, 12);
  });

  it('при 60° — (5,49 + 1,31) × 0,5 − 1,31 = 2,09', () => {
    expect(inclineElevationMil(5.49, 1.31, 60)).toBeCloseTo(2.09, 9);
  });

  it('угол нуля Z из карточки — 1,0–1,6 MIL у всех; совпадает с ядром', async () => {
    for (const { id, loadout } of LOADOUTS) {
      expect(cardOf(id).zeroAngleMil, id).toBeGreaterThan(1);
      expect(cardOf(id).zeroAngleMil, id).toBeLessThan(1.6);
      expect(cardOf(id).zeroAngleMil, id).toBeCloseTo(await engine.zeroAngleMil(loadout), 2);
    }
  });
});

describe('деривация — колонка карточки', () => {
  const weathers: Atmosphere[] = [
    { temperatureC: -10, pressureHpa: 1035, relativeHumidity: 0.5 },
    { temperatureC: 30, pressureHpa: 990, relativeHumidity: 0.5 },
    { temperatureC: 5, pressureHpa: 846, relativeHumidity: 0.5, altitudeM: 1500 },
  ];

  it('C4: колонка против ядра в любую погоду и на высоте — ≤ 0,05 MIL до 1000 м', async () => {
    const spinning: ShotGeometry = { ...FLAT_GEOMETRY, isSpinDriftOn: true };
    for (const { id, loadout } of LOADOUTS) {
      for (const atmosphere of weathers) {
        const withSpin = await shoot(loadout, spinning, atmosphere);
        const withoutSpin = await shoot(loadout, FLAT_GEOMETRY, atmosphere);
        for (const row of cardOf(id).rows) {
          const coreSpinDriftMil = required(withoutSpin, row.distanceM).rightMrad - required(withSpin, row.distanceM).rightMrad;
          expect(Math.abs(row.spinDriftMil - coreSpinDriftMil), `${id} ${atmosphere.pressureHpa} гПа ${row.distanceM} м`).toBeLessThanOrEqual(0.05);
        }
      }
    }
  });

  it('между строками деривация смешивается: 450 м — середина между 400 и 500', () => {
    const card = cardOf('Б');
    const middle = (dopeRowAt(card, 400).spinDriftMil + dopeRowAt(card, 500).spinDriftMil) / 2;
    expect(dopeRowAt(card, 450).spinDriftMil).toBeCloseTo(middle, 9);
    expect(dopeRowAt(card, 450).spinDriftMil).toBeGreaterThan(dopeRowAt(card, 400).spinDriftMil);
  });

  it('правые нарезы — колонка плюс и растёт; левые — та же колонка с минусом', async () => {
    const right = courseLoadout('B');
    const left: Loadout = { ...right, rifle: { ...right.rifle, twistDirection: 'left' } };
    const rightCard = cardOf('Б');
    const leftCard = await buildDopeCard(new BallisticsEngine(), left, CLICK_MIL);
    expect(rightCard.rows.at(-1)!.spinDriftMil).toBeGreaterThan(0.3);
    expect(rightCard.rows.at(-1)!.spinDriftMil).toBeGreaterThan(rightCard.rows[4].spinDriftMil);
    leftCard.rows.forEach((row, index) => expect(row.spinDriftMil).toBeCloseTo(-rightCard.rows[index].spinDriftMil, 9));
  });
});

describe('Кориолис', () => {
  const placesAndDirections: [latitudeDeg: number, azimuthDeg: number][] = [
    [20, 90], [55, 90], [55, 270], [55, 0], [-55, 90], [-55, 180],
  ];

  it('C4: формулы вбок и по вертикали против ядра — ≤ 0,05 MIL на 600 и 1000 м', async () => {
    for (const { id, loadout } of LOADOUTS) {
      const flat = await shoot(loadout);
      for (const [latitudeDeg, azimuthDeg] of placesAndDirections) {
        const points = await shoot(loadout, { ...FLAT_GEOMETRY, coriolis: { latitudeDeg, azimuthDeg } });
        for (const distanceM of [600, 1000]) {
          const timeS = dopeRowAt(cardOf(id), distanceM).timeOfFlightS;
          const coreImpactRightMil = required(flat, distanceM).rightMrad - required(points, distanceM).rightMrad;
          const coreImpactUpMil = required(flat, distanceM).upMrad - required(points, distanceM).upMrad;
          const label = `${id} ${latitudeDeg}°/${azimuthDeg}° ${distanceM} м`;
          expect(Math.abs(coriolisHorizontalMil(timeS, latitudeDeg) - coreImpactRightMil), label).toBeLessThanOrEqual(0.05);
          expect(Math.abs(coriolisVerticalMil(timeS, latitudeDeg, azimuthDeg) - coreImpactUpMil), label).toBeLessThanOrEqual(0.05);
        }
      }
    }
  });

  it('знаки: северное полушарие вправо, южное влево; на восток вверх, на запад вниз, на север ноль', () => {
    expect(coriolisHorizontalMil(2, 55)).toBeGreaterThan(0);
    expect(coriolisHorizontalMil(2, -55)).toBeLessThan(0);
    expect(coriolisVerticalMil(2, 55, 90)).toBeGreaterThan(0);
    expect(coriolisVerticalMil(2, 55, 270)).toBeLessThan(0);
    expect(coriolisVerticalMil(2, 55, 0)).toBeCloseTo(0, 12);
    expect(coriolisHorizontalMil(2, 90)).toBeCloseTo(1000 * 7.292115e-5 * 2, 9);
  });
});

describe('ветер и атмосфера для любого снаряжения', () => {
  it('C4 ветер на 4 эталонах: ≤ 1 клика до 1000 м при 4–12 м/с', async () => {
    for (const { id, loadout } of REFERENCE_LOADOUTS) {
      for (const speedMps of [4, 8, 12]) {
        const points = await engine.trajectory(loadout, STANDARD, [{ untilM: Infinity, speedMps, fromDeg: FULL_CROSSWIND_FROM_LEFT_DEG }]);
        for (const row of cardOf(id).rows) {
          const formulaMil = windCorrectionMil(speedMps, WIND_CLOCK_FROM_LEFT, row.distanceM, row.windConstant);
          expect(Math.abs(formulaMil - required(points, row.distanceM).rightMrad), `${id} ${speedMps} м/с ${row.distanceM} м`).toBeLessThan(CLICK_MIL);
        }
      }
    }
  });

  it('C4 атмосфера на 4 эталонах: ≤ 1 клика до 700 м в погоде курса', async () => {
    const weathers: [number, number][] = [[-10, 990], [-10, 1035], [35, 990], [35, 1035]];
    for (const { id, loadout } of REFERENCE_LOADOUTS) {
      const standardPoints = await shoot(loadout);
      for (const [temperatureC, pressureHpa] of weathers) {
        const points = await shoot(loadout, FLAT_GEOMETRY, { temperatureC, pressureHpa, relativeHumidity: STANDARD_RELATIVE_HUMIDITY });
        for (const row of cardOf(id).rows.filter(candidate => candidate.distanceM <= 700)) {
          const coreShiftMil = required(points, row.distanceM).upMrad - required(standardPoints, row.distanceM).upMrad;
          expect(Math.abs(atmosphereCorrectionMil(row, temperatureC, pressureHpa) - coreShiftMil), `${id} ${temperatureC}/${pressureHpa} ${row.distanceM} м`).toBeLessThanOrEqual(CLICK_MIL);
        }
      }
    }
  });

  it('атмосфера на высоте 1500 м (846 гПа, 5 °C): прежняя формула держит клик до 600 м', async () => {
    const mountain: Atmosphere = { temperatureC: 5, pressureHpa: 846, relativeHumidity: STANDARD_RELATIVE_HUMIDITY, altitudeM: 1500 };
    for (const { id, loadout } of LOADOUTS) {
      const standardPoints = await shoot(loadout);
      const points = await shoot(loadout, FLAT_GEOMETRY, mountain);
      for (const row of cardOf(id).rows.filter(candidate => candidate.distanceM <= 600)) {
        const coreShiftMil = required(points, row.distanceM).upMrad - required(standardPoints, row.distanceM).upMrad;
        expect(Math.abs(atmosphereCorrectionMil(row, mountain.temperatureC, mountain.pressureHpa) - coreShiftMil), `${id} ${row.distanceM} м`).toBeLessThanOrEqual(CLICK_MIL);
      }
    }
  });
});

describe('имперские единицы', () => {
  it('миллинг в ярдах: 20″ на 2 MIL и на 6,875 MOA → 277,8 ярда; совпадает с метрическим до 0,1 %', () => {
    expect(rangeByMillingYards(20, 2)).toBeCloseTo(277.8, 1);
    expect(rangeByMoaYards(20, 6.875)).toBeCloseTo(277.8, 1);
    const metricYards = rangeByMilling(20 * 0.0254, 2) / METERS_PER_YARD;
    expect(Math.abs(rangeByMillingYards(20, 2) / metricYards - 1)).toBeLessThan(0.001);
    expect(Math.abs(rangeByMoaYards(20, 2 / MRAD_PER_MOA) / metricYards - 1)).toBeLessThan(0.001);
  });

  it('C4 ветер в mph и ярдах с округлённой константой — ≤ 1 клика до 1000 м, 5 снаряжений', async () => {
    for (const { id, loadout } of LOADOUTS) {
      for (const speedMph of [5, 10, 20]) {
        const points = await engine.trajectory(loadout, STANDARD, [{ untilM: Infinity, speedMps: speedMph * MPS_PER_MPH, fromDeg: FULL_CROSSWIND_FROM_LEFT_DEG }]);
        for (const row of cardOf(id).rows) {
          const formulaMil = windCorrectionMil(speedMph, WIND_CLOCK_FROM_LEFT, row.distanceM / METERS_PER_YARD, imperialWindConstant(row.windConstant));
          expect(Math.abs(formulaMil - required(points, row.distanceM).rightMrad), `${id} ${speedMph} mph ${row.distanceM} м`).toBeLessThan(CLICK_MIL);
        }
      }
    }
  });

  it('константа ветра в ярдах и mph — K / (0,44704 × 0,9144), округлена до 10', () => {
    expect(imperialWindConstant(1610)).toBe(3940);
    expect(imperialWindConstant(1610) % 10).toBe(0);
  });

  it('упреждение в ярдах и mph = метрическому до 0,001 MIL', () => {
    const metricMil = leadMil(1.1, 3, 0.6, 400);
    expect(leadMilImperial(1.1 / MPS_PER_MPH, 3, 0.6, 400 / METERS_PER_YARD)).toBeCloseTo(metricMil, 3);
  });
});
