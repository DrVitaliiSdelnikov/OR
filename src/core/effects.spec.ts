import { describe, expect, it, vi } from 'vitest';
import { courseLoadout, FLAT_GEOMETRY, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C } from './content';
import { effectContributions } from './effects';
import { BallisticsEngine } from './engine';
import { Atmosphere, ShotGeometry } from './types';

const SEA_LEVEL: Atmosphere = { temperatureC: STANDARD_TEMPERATURE_C, pressureHpa: STANDARD_PRESSURE_HPA, relativeHumidity: STANDARD_RELATIVE_HUMIDITY };
const LOADOUT = courseLoadout('B');
const EVERYTHING: ShotGeometry = { lookAngleDeg: 10, coriolis: { latitudeDeg: 55, azimuthDeg: 90 }, isSpinDriftOn: true };
const MAX_CROSS_TERM_MIL = 0.03;

describe('вклад эффектов (T1.3)', () => {
  it('выключенный эффект даёт ноль, включённые — ненулевой вклад своего знака', async () => {
    const engine = new BallisticsEngine();
    const none = await effectContributions(engine, LOADOUT, SEA_LEVEL, null, FLAT_GEOMETRY, 800);
    for (const contribution of Object.values(none)) {
      expect(contribution).toEqual({ impactUpMil: 0, impactRightMil: 0 });
    }
    const all = await effectContributions(engine, LOADOUT, SEA_LEVEL, null, EVERYTHING, 800);
    expect(all.angle.impactUpMil).toBeGreaterThan(0.05);
    expect(all.spinDrift.impactRightMil).toBeGreaterThan(0.1);
    expect(all.coriolis.impactRightMil).toBeGreaterThan(0.03);
    expect(all.coriolis.impactUpMil).toBeGreaterThan(0.02);
  });

  it('вклад эффекта — сдвиг попадания: «всё, кроме него» минус «всё включено» в поправках', async () => {
    const engine = new BallisticsEngine();
    const all = await effectContributions(engine, LOADOUT, SEA_LEVEL, null, EVERYTHING, 800);
    const required = async (geometry: ShotGeometry) =>
      BallisticsEngine.interpolated(await engine.trajectory(LOADOUT, SEA_LEVEL, null, undefined, 800, geometry), 800);
    const withAll = await required(EVERYTHING);
    const withoutSpin = await required({ ...EVERYTHING, isSpinDriftOn: false });
    expect(all.spinDrift.impactRightMil).toBeCloseTo(withoutSpin.rightMrad - withAll.rightMrad, 9);
    expect(all.spinDrift.impactUpMil).toBeCloseTo(withoutSpin.upMrad - withAll.upMrad, 9);
  });

  it('сумма вкладов ≈ «всё − ничего» до перекрёстного члена', async () => {
    const engine = new BallisticsEngine();
    const all = await effectContributions(engine, LOADOUT, SEA_LEVEL, null, EVERYTHING, 800);
    const required = async (geometry: ShotGeometry) =>
      BallisticsEngine.interpolated(await engine.trajectory(LOADOUT, SEA_LEVEL, null, undefined, 800, geometry), 800);
    const withAll = await required(EVERYTHING);
    const withNothing = await required(FLAT_GEOMETRY);
    const parts = Object.values(all);
    expect(Math.abs(parts.reduce((sum, part) => sum + part.impactUpMil, 0) - (withNothing.upMrad - withAll.upMrad))).toBeLessThan(MAX_CROSS_TERM_MIL);
    expect(Math.abs(parts.reduce((sum, part) => sum + part.impactRightMil, 0) - (withNothing.rightMrad - withAll.rightMrad))).toBeLessThan(MAX_CROSS_TERM_MIL);
  });

  it('повторный вызов с теми же входами не гоняет движок', async () => {
    const engine = new BallisticsEngine();
    await effectContributions(engine, LOADOUT, SEA_LEVEL, null, EVERYTHING, 700);
    const runs = vi.spyOn(engine, 'trajectory');
    const again = await effectContributions(engine, courseLoadout('B'), { ...SEA_LEVEL }, null, { ...EVERYTHING }, 700);
    expect(runs).not.toHaveBeenCalled();
    expect(again.spinDrift.impactRightMil).toBeGreaterThan(0);
    await effectContributions(engine, LOADOUT, SEA_LEVEL, null, EVERYTHING, 600);
    expect(runs).toHaveBeenCalled();
  });
});
