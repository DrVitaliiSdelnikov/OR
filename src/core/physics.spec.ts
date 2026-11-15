import { describe, expect, it, vi } from 'vitest';
import { courseLoadout, FLAT_GEOMETRY, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C } from './content';
import { BallisticsEngine } from './engine';
import { Atmosphere, Loadout, ShotGeometry, TrajectoryPoint } from './types';

const SEA_LEVEL: Atmosphere = { temperatureC: STANDARD_TEMPERATURE_C, pressureHpa: STANDARD_PRESSURE_HPA, relativeHumidity: STANDARD_RELATIVE_HUMIDITY };
const SPIN: ShotGeometry = { ...FLAT_GEOMETRY, isSpinDriftOn: true };
const LOADOUT = courseLoadout('B');
const LEFT_TWIST: Loadout = { ...LOADOUT, rifle: { ...LOADOUT.rifle, twistDirection: 'left' } };

function at(points: readonly TrajectoryPoint[], distanceM: number) {
  return BallisticsEngine.required(points, distanceM);
}

async function shoot(geometry: ShotGeometry, atmosphere: Atmosphere = SEA_LEVEL, loadout: Loadout = LOADOUT, engine = new BallisticsEngine()) {
  return engine.trajectory(loadout, atmosphere, null, undefined, undefined, geometry);
}

describe('геометрия по умолчанию (T1.3)', () => {
  it('без геометрии — ровная линия: то же, что FLAT_GEOMETRY, без сноса', async () => {
    const engine = new BallisticsEngine();
    const implicit = await engine.trajectory(LOADOUT, SEA_LEVEL, null);
    const flat = await shoot(FLAT_GEOMETRY, SEA_LEVEL, LOADOUT, engine);
    expect(flat).toEqual(implicit);
    expect(Math.abs(at(flat, 1000).rightMrad)).toBeLessThan(1e-9);
  });
});

describe('деривация', () => {
  it('правые нарезы — вправо, левые — влево, по модулю равны; растёт с дальностью', async () => {
    const right = await shoot(SPIN);
    const left = await shoot(SPIN, SEA_LEVEL, LEFT_TWIST);
    const impactRightAt = (points: readonly TrajectoryPoint[], distanceM: number) => -at(points, distanceM).rightMrad;
    expect(impactRightAt(right, 1000)).toBeGreaterThan(0.3);
    expect(impactRightAt(left, 1000)).toBeCloseTo(-impactRightAt(right, 1000), 6);
    expect(impactRightAt(right, 1000)).toBeGreaterThan(impactRightAt(right, 500));
    expect(impactRightAt(right, 500)).toBeGreaterThan(impactRightAt(right, 200));
  });

  it('деривация не меняет возвышение', async () => {
    expect(at(await shoot(SPIN), 800).upMrad).toBeCloseTo(at(await shoot(FLAT_GEOMETRY), 800).upMrad, 3);
  });
});

describe('угол места', () => {
  it('±15° на 800 м — возвышение меньше ровного на 0,2–0,6 MIL; вверх и вниз почти поровну', async () => {
    const flat = at(await shoot(FLAT_GEOMETRY), 800).upMrad;
    const uphill = at(await shoot({ ...FLAT_GEOMETRY, lookAngleDeg: 15 }), 800).upMrad;
    const downhill = at(await shoot({ ...FLAT_GEOMETRY, lookAngleDeg: -15 }), 800).upMrad;
    for (const tilted of [uphill, downhill]) {
      expect(flat - tilted).toBeGreaterThan(0.2);
      expect(flat - tilted).toBeLessThan(0.6);
    }
    expect(Math.abs(uphill - downhill)).toBeLessThan(0.1);
  });

  it('на дистанции нуля под углом поправка отрицательная: ноль ровный, а сила тяжести поперёк линии прицела меньше', async () => {
    expect(at(await shoot({ ...FLAT_GEOMETRY, lookAngleDeg: 30 }), 100).upMrad).toBeLessThan(-0.05);
    expect(at(await shoot({ ...FLAT_GEOMETRY, lookAngleDeg: -30 }), 100).upMrad).toBeLessThan(-0.05);
  });

  it('дистанция точек — по линии прицела: сетка 100 м до 1000 м и при +30°, и при −30°', async () => {
    for (const lookAngleDeg of [30, -30]) {
      const points = await shoot({ ...FLAT_GEOMETRY, lookAngleDeg });
      expect(points.map(point => point.distanceM), `${lookAngleDeg}°`).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    }
  });

  it('по правилу стрелка: при 30° возвышение на 600 м близко к ровному на 600 × cos 30° (±10 %)', async () => {
    const uphill = at(await shoot({ ...FLAT_GEOMETRY, lookAngleDeg: 30 }), 600).upMrad;
    const horizontalM = 600 * Math.cos(Math.PI / 6);
    const flatAtHorizontal = BallisticsEngine.interpolated(await new BallisticsEngine().trajectory(LOADOUT, SEA_LEVEL, null, undefined, 1), horizontalM).upMrad;
    expect(uphill / flatAtHorizontal).toBeGreaterThan(0.9);
    expect(uphill / flatAtHorizontal).toBeLessThan(1.1);
  });
});

describe('зоны ветра под углом', () => {
  it('граница зоны — по линии прицела: ветер с 500 м при 30° сносит уже на 560 м', async () => {
    const farWindOnly = [
      { untilM: 500, speedMps: 0, fromDeg: 90 },
      { untilM: Infinity, speedMps: 8, fromDeg: 90 },
    ];
    const points = await new BallisticsEngine().trajectory(LOADOUT, SEA_LEVEL, farWindOnly, undefined, 20, { ...FLAT_GEOMETRY, lookAngleDeg: 30 });
    expect(Math.abs(at(points, 500).rightMrad)).toBeLessThan(0.002);
    expect(Math.abs(at(points, 560).rightMrad)).toBeGreaterThan(0.005);
  });
});

describe('высота над морем', () => {
  it('1500 м с давлением на станции — возвышение на 1000 м меньше, чем на уровне моря', async () => {
    const mountain: Atmosphere = { temperatureC: 5, pressureHpa: 845.6, relativeHumidity: 0.5, altitudeM: 1500 };
    const flat = at(await shoot(FLAT_GEOMETRY), 1000).upMrad;
    expect(flat - at(await shoot(FLAT_GEOMETRY, mountain), 1000).upMrad).toBeGreaterThan(1.5);
  });
});

describe('Кориолис', () => {
  const coriolis = (latitudeDeg: number, azimuthDeg: number): ShotGeometry => ({ ...FLAT_GEOMETRY, coriolis: { latitudeDeg, azimuthDeg } });

  it('северное полушарие — вправо, южное — влево', async () => {
    expect(-at(await shoot(coriolis(55, 0)), 1000).rightMrad).toBeGreaterThan(0.05);
    expect(-at(await shoot(coriolis(-55, 0)), 1000).rightMrad).toBeLessThan(-0.05);
  });

  it('на восток возвышение меньше, чем на запад; на север — как без Кориолиса', async () => {
    const flat = at(await shoot(FLAT_GEOMETRY), 1000).upMrad;
    const east = at(await shoot(coriolis(55, 90)), 1000).upMrad;
    const west = at(await shoot(coriolis(55, 270)), 1000).upMrad;
    expect(east).toBeLessThan(flat - 0.03);
    expect(west).toBeGreaterThan(flat + 0.03);
    expect(at(await shoot(coriolis(55, 0)), 1000).upMrad).toBeCloseTo(flat, 2);
  });
});

describe('ноль на стрельбище', () => {
  it('любая геометрия выстрела — одна пристрелка, на ровной линии', async () => {
    const engine = new BallisticsEngine();
    const calculator = (engine as unknown as { calculator: { setWeaponZero: () => unknown } }).calculator;
    const zeroing = vi.spyOn(calculator, 'setWeaponZero');
    await shoot(FLAT_GEOMETRY, SEA_LEVEL, LOADOUT, engine);
    await shoot({ lookAngleDeg: 20, coriolis: { latitudeDeg: 55, azimuthDeg: 90 }, isSpinDriftOn: true }, SEA_LEVEL, LOADOUT, engine);
    expect(zeroing).toHaveBeenCalledTimes(1);
  });
});
