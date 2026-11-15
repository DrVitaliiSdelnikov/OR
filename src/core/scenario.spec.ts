import { describe, expect, it } from 'vitest';
import { FLAT_GEOMETRY } from './content';
import { clockFromDeg, createScenario, degFromClock, gaugeWindAt, lateralWindMps, standardPressureHpaAt, windAt } from './scenario';

describe('createScenario', () => {
  it('is deterministic for a seed', () => {
    expect(createScenario(123)).toEqual(createScenario(123));
  });

  it('differs between seeds', () => {
    expect(createScenario(1).atmosphere).not.toEqual(createScenario(2).atmosphere);
  });

  it('keeps the atmosphere inside the playable range', () => {
    for (let seed = 1; seed < 200; seed++) {
      const { atmosphere } = createScenario(seed);
      expect(atmosphere.temperatureC).toBeGreaterThanOrEqual(4);
      expect(atmosphere.temperatureC).toBeLessThanOrEqual(32);
      expect(atmosphere.pressureHpa).toBeGreaterThanOrEqual(985);
      expect(atmosphere.pressureHpa).toBeLessThanOrEqual(1025);
    }
  });

  it('has four wind zones ending at 150, 350, 550 m and beyond', () => {
    expect(createScenario(5).zones.map(zone => zone.untilM)).toEqual([150, 350, 550, Infinity]);
  });

  it('calm (windScale 0) has zero wind at any time', () => {
    const scenario = createScenario(77, { windScale: 0 });
    for (const timeS of [0, 13, 40, 300]) {
      expect(windAt(scenario, timeS).every(zone => zone.speedMps === 0)).toBe(true);
    }
  });

  it('uniform wind gives the same wind in every zone', () => {
    const scenario = createScenario(77, { isWindUniform: true });
    for (const timeS of [0, 25, 90]) {
      const zones = windAt(scenario, timeS);
      expect(new Set(zones.map(zone => zone.speedMps)).size).toBe(1);
      expect(new Set(zones.map(zone => zone.fromDeg)).size).toBe(1);
    }
  });

  it('zone wind differs between zones without the uniform option', () => {
    const scenario = createScenario(77);
    expect(new Set(scenario.zones.map(zone => zone.speedMps)).size).toBeGreaterThan(1);
  });

  it('flags read the lateral wind of zones 2–4', () => {
    const scenario = createScenario(9);
    expect(scenario.flags.map(flag => flag.distanceM)).toEqual([200, 400, 600]);
    expect(scenario.flags[0].lateralWindMps).toBeCloseTo(lateralWindMps(scenario.zones[1]));
  });
});

describe('windAt', () => {
  it('is a pure function of time', () => {
    const scenario = createScenario(31);
    expect(windAt(scenario, 42.5)).toEqual(windAt(scenario, 42.5));
  });

  it('changes over time', () => {
    const scenario = createScenario(31);
    expect(windAt(scenario, 0)[0].speedMps).not.toBe(windAt(scenario, 17)[0].speedMps);
  });
});

describe('gaugeWindAt', () => {
  it('applies the gauge bias to the shooter zone', () => {
    const scenario = createScenario(31);
    const shooterSpeed = windAt(scenario, 10)[0].speedMps;
    expect(gaugeWindAt(scenario, 10).speedMps).toBeCloseTo(shooterSpeed * scenario.gaugeSpeedBias);
  });

  it('never reports negative wind', () => {
    expect(gaugeWindAt(createScenario(31), 10, -100).speedMps).toBe(0);
  });
});

describe('wind clock', () => {
  it('9 o’clock is from the left (90°), 3 o’clock from the right (270°)', () => {
    expect(degFromClock(9)).toBe(90);
    expect(degFromClock(3)).toBe(270);
    expect(clockFromDeg(90)).toBe(9);
    expect(clockFromDeg(270)).toBe(3);
    expect(clockFromDeg(0)).toBe(12);
  });

  it('lateral component is positive (pushes right) for wind from the left', () => {
    expect(lateralWindMps({ speedMps: 4, fromDeg: 90 })).toBeCloseTo(4);
    expect(lateralWindMps({ speedMps: 4, fromDeg: 270 })).toBeCloseTo(-4);
    expect(lateralWindMps({ speedMps: 4, fromDeg: 0 })).toBeCloseTo(0);
  });
});

describe('createScenario — exercise conditions', () => {
  it('without conditions nothing changes', () => {
    const plain = createScenario(4242, { windScale: 1, isWindUniform: true });
    expect(createScenario(4242, { windScale: 1, isWindUniform: true, windClocks: undefined })).toEqual(plain);
  });

  it('a cold morning keeps temperature and pressure in range and the gauge follows', () => {
    for (let seed = 1; seed < 60; seed++) {
      const scenario = createScenario(seed, { temperatureRangeC: [-5, 0], pressureRangeHpa: [1025, 1035] });
      expect(scenario.atmosphere.temperatureC).toBeGreaterThanOrEqual(-5);
      expect(scenario.atmosphere.temperatureC).toBeLessThanOrEqual(0);
      expect(scenario.atmosphere.pressureHpa).toBeGreaterThanOrEqual(1025);
      expect(scenario.atmosphere.pressureHpa).toBeLessThanOrEqual(1035);
      expect(Math.abs(scenario.gauge.temperatureC - scenario.atmosphere.temperatureC)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(scenario.gauge.pressureHpa - scenario.atmosphere.pressureHpa)).toBeLessThanOrEqual(1.5);
    }
  });

  it('a fixed standard day is exactly +15 C and 1013 hPa', () => {
    const { atmosphere } = createScenario(9, { temperatureRangeC: [15, 15], pressureRangeHpa: [1013, 1013] });
    expect(atmosphere.temperatureC).toBe(15);
    expect(atmosphere.pressureHpa).toBe(1013);
  });

  it('a light wind from 3 or 9 o’clock: speed in range, one wind along the range, gauge and flags agree', () => {
    const clocks = new Set<number>();
    for (let seed = 1; seed < 60; seed++) {
      const scenario = createScenario(seed, { isWindUniform: true, windSpeedRangeMps: [2, 2.5], windClocks: [3, 9] });
      const [shooterZone] = scenario.zones;
      expect(shooterZone.speedMps).toBeGreaterThanOrEqual(2);
      expect(shooterZone.speedMps).toBeLessThanOrEqual(2.5);
      expect(scenario.zones.every(zone => zone.speedMps === shooterZone.speedMps && zone.fromDeg === shooterZone.fromDeg)).toBe(true);
      expect([3, 9]).toContain(scenario.gauge.windClock);
      expect(clockFromDeg(shooterZone.fromDeg)).toBe(scenario.gauge.windClock);
      expect(scenario.gauge.windSpeedMps).toBe(shooterZone.speedMps);
      expect(scenario.flags[0].lateralWindMps).toBeCloseTo(lateralWindMps(shooterZone), 9);
      clocks.add(scenario.gauge.windClock);
    }
    expect(clocks).toEqual(new Set([3, 9]));
  });
});

describe('createScenario — местность и геометрия (T1.3)', () => {
  it('без новых полей сценарий тот же, что до T1.3 (снимок сида 20261115), геометрия ровная', () => {
    const scenario = createScenario(20261115, { windScale: 1 });
    expect(scenario.atmosphere).toEqual({ temperatureC: 11.6, pressureHpa: 1017, relativeHumidity: 0.34 });
    expect(scenario.zones.map(zone => [zone.speedMps, zone.fromDeg])).toEqual([[2.8, 87], [2.4, 51], [2.8, 79], [2, 85]]);
    expect(scenario.startTimeS).toBe(127);
    expect(scenario.gauge).toEqual({ temperatureC: 11.1, pressureHpa: 1017, relativeHumidity: 0.35, windSpeedMps: 2.8, windClock: 9 });
    expect(scenario.geometry).toEqual(FLAT_GEOMETRY);
  });

  it('стандартное давление: 1013 гПа на уровне моря, около 846 на 1500 м', () => {
    expect(standardPressureHpaAt(0)).toBeCloseTo(1013.25, 2);
    expect(standardPressureHpaAt(1500)).toBeCloseTo(845.6, 0);
  });

  it('высота 1500 м: давление на станции 800–890 гПа, станция показывает его же; ветер и время — как без высоты', () => {
    const plain = createScenario(20261115, { windScale: 1 });
    for (let seed = 1; seed <= 30; seed++) {
      const scenario = createScenario(seed, { windScale: 1, altitudeRangeM: [1500, 1500] });
      expect(scenario.atmosphere.altitudeM).toBe(1500);
      expect(scenario.atmosphere.pressureHpa).toBeGreaterThanOrEqual(800);
      expect(scenario.atmosphere.pressureHpa).toBeLessThanOrEqual(890);
      expect(Math.abs(scenario.gauge.pressureHpa - scenario.atmosphere.pressureHpa)).toBeLessThanOrEqual(2);
    }
    const mountain = createScenario(20261115, { windScale: 1, altitudeRangeM: [1500, 1500] });
    expect(mountain.zones).toEqual(plain.zones);
    expect(mountain.startTimeS).toBe(plain.startTimeS);
  });

  it('угол в любую сторону: по модулю в диапазоне, встречаются и подъём, и спуск', () => {
    const angles = Array.from({ length: 40 }, (_, seed) => createScenario(seed, { lookAngleRangeDeg: [10, 25], isLookAngleEitherWay: true }).geometry.lookAngleDeg);
    expect(angles.every(angle => Math.abs(angle) >= 10 && Math.abs(angle) <= 25)).toBe(true);
    expect(angles.some(angle => angle > 0)).toBe(true);
    expect(angles.some(angle => angle < 0)).toBe(true);
  });

  it('широта из диапазона, азимут — кратный 5° по всему кругу', () => {
    const places = Array.from({ length: 40 }, (_, seed) => createScenario(seed, { coriolisLatitudeRangeDeg: [40, 60] }).geometry.coriolis!);
    expect(places.every(place => place.latitudeDeg >= 40 && place.latitudeDeg <= 60 && Number.isInteger(place.latitudeDeg))).toBe(true);
    expect(places.every(place => place.azimuthDeg >= 0 && place.azimuthDeg < 360 && place.azimuthDeg % 5 === 0)).toBe(true);
    expect(new Set(places.map(place => Math.floor(place.azimuthDeg / 90))).size).toBe(4);
  });

  it('угол, Кориолис и деривация берутся из условий; угол — в диапазоне', () => {
    const scenario = createScenario(7, { lookAngleRangeDeg: [-20, -10], coriolis: { latitudeDeg: 55, azimuthDeg: 90 }, isSpinDriftOn: true });
    expect(scenario.geometry.lookAngleDeg).toBeGreaterThanOrEqual(-20);
    expect(scenario.geometry.lookAngleDeg).toBeLessThanOrEqual(-10);
    expect(scenario.geometry.coriolis).toEqual({ latitudeDeg: 55, azimuthDeg: 90 });
    expect(scenario.geometry.isSpinDriftOn).toBe(true);
  });
});
