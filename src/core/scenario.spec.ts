import { describe, expect, it } from 'vitest';
import { clockFromDeg, createScenario, degFromClock, gaugeWindAt, lateralWindMps, windAt } from './scenario';

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
