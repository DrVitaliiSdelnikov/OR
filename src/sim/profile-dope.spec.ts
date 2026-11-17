import { beforeAll, describe, expect, it } from 'vitest';
import { builtInProfile, loadoutOf, profileFromPreset, RifleProfile } from './rifle-profile';
import { BallisticsEngine } from '../core/engine';
import { buildProfileDopeCard, ProfileDopeCard } from './profile-dope';
import reference308 from '../core/reference/308-175.json';

const MRAD_PER_MOA = 0.29089;
const METERS_PER_SECOND_PER_MPH = 0.44704;
const engine = new BallisticsEngine();
let metric308: ProfileDopeCard;

function moaScope(profile: RifleProfile): RifleProfile {
  return { ...profile, scope: { ...profile.scope, units: 'MOA', clickValue: 0.25 } };
}

function leftTwist(profile: RifleProfile): RifleProfile {
  return { ...profile, rifle: { ...profile.rifle, twistDirection: 'left' } };
}

beforeAll(async () => {
  metric308 = await buildProfileDopeCard(engine, profileFromPreset('308-175', 'p', 'Моя .308'), 'metric');
});

describe('строки карточки профиля', () => {
  it('метрика: 20 строк 50…1000 м шагом 50', () => {
    expect(metric308.rows.map(row => row.distance)).toEqual(Array.from({ length: 20 }, (_, index) => 50 * (index + 1)));
    expect(metric308.distanceUnit).toBe('metric');
  });

  it('имперская: 22 строки 50…1100 ярдов, дистанции в ярдах целые', async () => {
    const card = await buildProfileDopeCard(engine, profileFromPreset('308-175', 'p', 'p'), 'imperial');
    expect(card.rows.map(row => row.distance)).toEqual(Array.from({ length: 22 }, (_, index) => 50 * (index + 1)));
    expect(card.distanceUnit).toBe('imperial');
    const at1000yd = card.rows.find(row => row.distance === 1000)!;
    const at900m = metric308.rows.find(row => row.distance === 900)!;
    const at950m = metric308.rows.find(row => row.distance === 950)!;
    expect(at1000yd.elevation).toBeGreaterThan(at900m.elevation);
    expect(at1000yd.elevation).toBeLessThan(at950m.elevation);
  });
});

describe('числа карточки', () => {
  it('пресет .308 175 (BC по ICAO): ВЕРТ на 100…1000 м совпадает с эталоном lob до клика', () => {
    const set = reference308.sets.find(candidate => candidate.id === 'sea-level-calm')!;
    for (const lobRow of set.rows) {
      const row = metric308.rows.find(candidate => candidate.distance === lobRow.distanceM)!;
      expect(Math.abs(row.clicks - Math.round(lobRow.upMil / 0.1)), `${lobRow.distanceM} м`).toBeLessThanOrEqual(1);
    }
  });

  it('MIL: ВЕРТ, ветер и деривация округлены до 0,1; клики по 0,1 MIL', () => {
    for (const row of metric308.rows) {
      for (const value of [row.elevation, row.windPerUnit, row.spinDriftRight]) {
        expect(Math.round(value * 10) / 10).toBeCloseTo(value, 9);
      }
    }
    const at600 = metric308.rows.find(row => row.distance === 600)!;
    expect(Math.abs(at600.clicks - at600.elevation / 0.1)).toBeLessThanOrEqual(0.5);
  });

  it('прицел MOA: ВЕРТ = MIL / 0,29089 с точностью 0,25; клики по ¼ MOA', async () => {
    const card = await buildProfileDopeCard(engine, moaScope(profileFromPreset('308-175', 'p', 'p')), 'metric');
    for (const [index, row] of card.rows.entries()) {
      const milRow = metric308.rows[index];
      expect(Math.round(row.elevation * 4) / 4).toBeCloseTo(row.elevation, 9);
      expect(Math.abs(row.elevation - milRow.elevation / MRAD_PER_MOA), `${row.distance} м`).toBeLessThanOrEqual(0.25 + 0.05 / MRAD_PER_MOA);
      expect(Math.abs(row.clicks - row.elevation / 0.25), `${row.distance} м`).toBeLessThanOrEqual(1);
    }
    expect(card.header.scopeUnits).toBe('MOA');
    expect(card.header.clickValue).toBe(0.25);
  });

  it('ветер на 1 mph = ветер на 1 м/с × 0,447', async () => {
    const card = await buildProfileDopeCard(engine, profileFromPreset('308-175', 'p', 'p'), 'imperial');
    const exactMetric = await buildProfileDopeCard(engine, profileFromPreset('308-175', 'p', 'p'), 'metric');
    const at600m = exactMetric.rows.find(row => row.distance === 600)!;
    const near600m = card.rows.find(row => row.distance === 650)!;
    expect(near600m.windPerUnit).toBeCloseTo(at600m.windPerUnit * METERS_PER_SECOND_PER_MPH, 0);
    expect(near600m.windPerUnit).toBeLessThan(at600m.windPerUnit);
    expect(card.header.windUnit).toBe('mph');
    expect(exactMetric.header.windUnit).toBe('mps');
  });

  it('ветер растёт с дистанцией; деривация правых нарезов — вправо, левых — влево той же величины', async () => {
    const winds = metric308.rows.map(row => row.windPerUnit);
    expect(winds.at(-1)!).toBeGreaterThan(winds[5]);
    const at1000 = metric308.rows.at(-1)!;
    expect(at1000.spinDriftRight).toBeGreaterThan(0);
    const left = await buildProfileDopeCard(engine, leftTwist(profileFromPreset('308-175', 'p', 'p')), 'metric');
    expect(left.rows.at(-1)!.spinDriftRight).toBeCloseTo(-at1000.spinDriftRight, 9);
  });

  it('на дистанции нуля ВЕРТ 0 и 0 кликов; ноль 300 м — на 100…250 м пуля выше линии, ВЕРТ вниз', async () => {
    const at100 = metric308.rows.find(row => row.distance === 100)!;
    expect([at100.elevation, at100.clicks]).toEqual([0, 0]);
    const profile = profileFromPreset('308-175', 'p', 'p');
    const zero300 = await buildProfileDopeCard(engine, { ...profile, rifle: { ...profile.rifle, zeroM: 300 } }, 'metric');
    expect(zero300.rows.find(row => row.distance === 300)!.clicks).toBe(0);
    for (const distance of [100, 150, 200, 250]) {
      const row = zero300.rows.find(candidate => candidate.distance === distance)!;
      expect(row.elevation, `${distance} м`).toBeLessThan(0);
      expect(row.clicks, `${distance} м`).toBeLessThan(0);
    }
  });

  it('время полёта растёт и округлено до 0,01', () => {
    const times = metric308.rows.map(row => row.timeOfFlightS);
    expect(times.every((time, index) => index === 0 || time > times[index - 1])).toBe(true);
    times.forEach(time => expect(Math.round(time * 100) / 100).toBeCloseTo(time, 9));
  });
});

describe('шапка карточки', () => {
  it('метрика: имя, ноль 100 м, 15 °C и 1013 гПа, MIL 0,1, угол нуля Z', async () => {
    expect(metric308.header).toMatchObject({ profileName: 'Моя .308', zero: 100, temperature: 15, pressure: 1013, scopeUnits: 'MIL', clickValue: 0.1 });
    expect(metric308.header.zeroAngle).toBeCloseTo(await engine.zeroAngleMil(loadoutOf(profileFromPreset('308-175', 'p', 'p'))), 2);
  });

  it('имперская: ноль в ярдах, 59 °F и 29,91 inHg (1013 гПа); угол нуля в MOA у MOA-прицела', async () => {
    const card = await buildProfileDopeCard(engine, moaScope(profileFromPreset('308-175', 'p', 'p')), 'imperial');
    expect(card.header).toMatchObject({ zero: 109, temperature: 59, pressure: 29.91 });
    expect(card.header.zeroAngle).toBeCloseTo(metric308.header.zeroAngle / MRAD_PER_MOA, 1);
  });
});

describe('карточка ДОПЕ встроенной «своя-custom» (17.11)', () => {
  it('строится: ноль 50 м — на 50 м ноль, дальше вверх; поправки в кликах ½ MOA', async () => {
    const card = await buildProfileDopeCard(new BallisticsEngine(), builtInProfile(), 'metric');
    expect(card.rows).toHaveLength(20);
    expect(card.rows[0]).toMatchObject({ distance: 50, elevation: 0, clicks: 0 });
    expect(card.rows[3].elevation).toBeGreaterThan(0);
    expect(card.rows[3].clicks).toBe(Math.round(card.rows[3].elevation / 0.5));
  });
});
