import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CARTRIDGES, COURSE_RIFLE, courseLoadout, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C } from './content';
import regression from './course-dope.regression.json';
import { buildDopeCard, DopeRow } from './dope-card';
import { BallisticsEngine } from './engine';
import { Atmosphere, CartridgeId, Loadout } from './types';

interface RegressionPoint {
  distanceM: number;
  dropMrad: number;
  windagePerMpsMrad: number;
  timeS: number;
}

const REGRESSION = regression as Record<CartridgeId, { trajectory: RegressionPoint[]; dopeRows: DopeRow[] }>;
const STANDARD: Atmosphere = { temperatureC: STANDARD_TEMPERATURE_C, pressureHpa: STANDARD_PRESSURE_HPA, relativeHumidity: STANDARD_RELATIVE_HUMIDITY };
const CROSSWIND_1_MPS = [{ untilM: Infinity, speedMps: 1, fromDeg: 90 }];
const RAW_DECIMALS = 3;
const DEPRECATED_RIFLE_IMPORT = /import\s*\{[^}]*\bRIFLE\b[^}]*\}\s*from/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith('.ts') ? [relative('.', path).replaceAll('\\', '/')] : [];
  });
}

async function elevationAt(engine: BallisticsEngine, loadout: Loadout, distanceM: number): Promise<number> {
  return BallisticsEngine.required(await engine.trajectory(loadout, STANDARD, null), distanceM).upMrad;
}

describe('снаряжение курса: регрессия (T1.2)', () => {
  it('траектории А, Б, В на 100–1000 м совпадают со снимком до правки', async () => {
    const engine = new BallisticsEngine();
    for (const cartridge of CARTRIDGES) {
      const loadout = courseLoadout(cartridge.id);
      const standard = (await engine.trajectory(loadout, STANDARD, null)).filter(point => point.distanceM >= 100);
      const crosswind = (await engine.trajectory(loadout, STANDARD, CROSSWIND_1_MPS)).filter(point => point.distanceM >= 100);
      REGRESSION[cartridge.id].trajectory.forEach((expected, index) => {
        const label = `${cartridge.id} ${expected.distanceM} м`;
        expect(standard[index].distanceM, label).toBe(expected.distanceM);
        expect(standard[index].dropMrad, label).toBeCloseTo(expected.dropMrad, RAW_DECIMALS);
        expect(crosswind[index].windageMrad, label).toBeCloseTo(expected.windagePerMpsMrad, RAW_DECIMALS);
        expect(standard[index].timeS, label).toBeCloseTo(expected.timeS, RAW_DECIMALS);
      });
    }
  });

  it('строки ДОПЕ А, Б, В — те же, что до правки', async () => {
    const engine = new BallisticsEngine();
    for (const cartridge of CARTRIDGES) {
      const card = await buildDopeCard(engine, courseLoadout(cartridge.id), 0.1);
      expect(card.rows, cartridge.id).toEqual(REGRESSION[cartridge.id].dopeRows);
    }
  });

  it('учебное снаряжение: общая винтовка курса, калибр 0,308″, G7', () => {
    for (const cartridge of CARTRIDGES) {
      const loadout = courseLoadout(cartridge.id);
      expect(loadout.rifle, cartridge.id).toBe(COURSE_RIFLE);
      expect(loadout.cartridge, cartridge.id).toBe(cartridge);
      expect(loadout.cartridge.bulletDiameterIn).toBe(0.308);
      expect(loadout.cartridge.dragModel).toBe('G7');
    }
    expect(COURSE_RIFLE.twistInchesPerTurn).toBe(10);
    expect(COURSE_RIFLE.twistDirection).toBe('right');
  });
});

describe('ноль винтовки по числам снаряжения', () => {
  it('ноль 200 м — другая траектория, чем 100 м, тем же движком в любом порядке', async () => {
    const engine = new BallisticsEngine();
    const zero100 = courseLoadout('B');
    const zero200: Loadout = { ...zero100, rifle: { ...zero100.rifle, zeroM: 200 } };
    const before = await elevationAt(engine, zero100, 500);
    const shifted = await elevationAt(engine, zero200, 500);
    const after = await elevationAt(engine, zero100, 500);
    expect(Math.abs(before - shifted)).toBeGreaterThan(0.3);
    expect(after).toBe(before);
    expect(await elevationAt(engine, zero200, 200)).toBeCloseTo(0, 2);
  });

  it('одинаковые по числам снаряжения пристреливаются один раз, даже если спросили одновременно', async () => {
    const engine = new BallisticsEngine();
    const calculator = (engine as unknown as { calculator: { setWeaponZero: () => unknown } }).calculator;
    const zeroing = vi.spyOn(calculator, 'setWeaponZero');
    await Promise.all([
      engine.trajectory(courseLoadout('B'), STANDARD, null),
      engine.trajectory({ rifle: { ...COURSE_RIFLE }, cartridge: { ...courseLoadout('B').cartridge } }, STANDARD, null),
    ]);
    await engine.trajectory(courseLoadout('B'), null, CROSSWIND_1_MPS);
    expect(zeroing).toHaveBeenCalledTimes(1);
  });

  it('модель сопротивления: тот же BC в G1 даёт другое возвышение на 800 м', async () => {
    const engine = new BallisticsEngine();
    const g7 = courseLoadout('B');
    const g1: Loadout = { ...g7, cartridge: { ...g7.cartridge, dragModel: 'G1' } };
    expect(Math.abs((await elevationAt(engine, g1, 800)) - (await elevationAt(engine, g7, 800)))).toBeGreaterThan(1);
  });
});

describe('глобальной винтовки больше нет', () => {
  it('RIFLE не импортирует ни один файл', () => {
    const importers = sourceFiles('src').filter(path => DEPRECATED_RIFLE_IMPORT.test(readFileSync(path, 'utf-8')));
    expect(importers).toEqual([]);
  });
});
