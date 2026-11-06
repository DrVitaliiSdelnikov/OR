import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { MAX_TRIGGER_SPREAD_MIL, qualityLabel, TriggerPull, zoneRadiusPt } from './trigger';

describe('zoneRadiusPt', () => {
  it('matches the design examples: 62 → 73, 92 → 55, 118 → 38 pt', () => {
    expect(zoneRadiusPt(62)).toBeCloseTo(72.8, 1);
    expect(zoneRadiusPt(92)).toBeCloseTo(54.2, 1);
    expect(zoneRadiusPt(118)).toBeCloseTo(38.0, 1);
  });

  it('never drops below 22 pt or exceeds 74 pt', () => {
    expect(zoneRadiusPt(200)).toBe(22);
    expect(zoneRadiusPt(40)).toBe(74);
  });

  it('the accessibility option enlarges the zone', () => {
    expect(zoneRadiusPt(92, true)).toBeGreaterThan(zoneRadiusPt(92));
  });
});

describe('qualityLabel', () => {
  it('splits clean, medium and jerk at 0.7 and 0.4', () => {
    expect(qualityLabel(0.71)).toBe('clean');
    expect(qualityLabel(0.7)).toBe('medium');
    expect(qualityLabel(0.4)).toBe('medium');
    expect(qualityLabel(0.39)).toBe('jerk');
  });
});

function pullWithFingerAtCenter(bpm: number, isMarkerDriftOff: boolean): { firedAtS: number | null; trigger: TriggerPull } {
  const trigger = new TriggerPull(mulberry32(4), { isZoneLarger: false, isMarkerDriftOff });
  trigger.marker = { x: 0, y: 0 };
  const dtS = 1 / 60;
  for (let timeS = 0; timeS < 15; timeS += dtS) {
    if (trigger.step(dtS, bpm, false, { x: 0, y: 0 })) {
      return { firedAtS: timeS, trigger };
    }
  }
  return { firedAtS: null, trigger };
}

describe('TriggerPull', () => {
  it('fires on its own after about 4.5 s of clean holding', () => {
    const { firedAtS } = pullWithFingerAtCenter(62, true);
    expect(firedAtS).not.toBeNull();
    expect(firedAtS!).toBeGreaterThan(4.3);
    expect(firedAtS!).toBeLessThan(4.8);
  });

  it('a clean hold gives a clean label and almost no extra spread', () => {
    const { trigger } = pullWithFingerAtCenter(62, true);
    expect(qualityLabel(trigger.quality(62))).toBe('clean');
    const spread = trigger.extraSpread(62, 9);
    expect(Math.hypot(spread.upMrad, spread.rightMrad)).toBeLessThan(0.1);
  });

  it('pressure decays when the finger is lifted', () => {
    const trigger = new TriggerPull(mulberry32(1), { isZoneLarger: false, isMarkerDriftOff: true });
    trigger.marker = { x: 0, y: 0 };
    for (let step = 0; step < 120; step++) {
      trigger.step(1 / 60, 62, false, { x: 0, y: 0 });
    }
    const pressed = trigger.pressure;
    for (let step = 0; step < 30; step++) {
      trigger.step(1 / 60, 62, false, null);
    }
    expect(trigger.pressure).toBeLessThan(pressed);
  });

  it('holding outside the zone does not build pressure', () => {
    const trigger = new TriggerPull(mulberry32(1), { isZoneLarger: false, isMarkerDriftOff: true });
    for (let step = 0; step < 300; step++) {
      trigger.step(1 / 60, 62, false, { x: 140, y: 140 });
    }
    expect(trigger.pressure).toBe(0);
    expect(trigger.fired).toBe(false);
  });

  it('extra spread never exceeds 0.4 mil', () => {
    const trigger = new TriggerPull(mulberry32(2));
    for (let step = 0; step < 100; step++) {
      trigger.step(1 / 60, 118, step % 40 === 0, { x: 120, y: -120 });
    }
    const spread = trigger.extraSpread(118, 3);
    expect(Math.hypot(spread.upMrad, spread.rightMrad)).toBeLessThanOrEqual(MAX_TRIGGER_SPREAD_MIL + 1e-9);
  });

  it('a heartbeat kicks the marker vertically', () => {
    const calm = new TriggerPull(mulberry32(8), { isZoneLarger: false, isMarkerDriftOff: true });
    const kicked = new TriggerPull(mulberry32(8), { isZoneLarger: false, isMarkerDriftOff: true });
    calm.marker = { x: 0, y: 0 };
    kicked.marker = { x: 0, y: 0 };
    calm.step(1 / 60, 92, false, null);
    kicked.step(1 / 60, 92, true, null);
    expect(kicked.marker.y).toBeLessThan(calm.marker.y);
  });
});
