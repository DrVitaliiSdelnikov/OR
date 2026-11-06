import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { Heart, TaskPulse } from './heart';
import { BREATH_COOLDOWN_S, BREATH_HOLD_CALM_FACTOR, BreathHold, ScopeSway } from './sway';

function advance(breath: BreathHold, seconds: number, dtS = 0.01): void {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dtS) {
    breath.step(dtS);
  }
}

describe('BreathHold', () => {
  it('settles to the calm factor 0.22 during the first 5 s', () => {
    const breath = new BreathHold();
    breath.press();
    advance(breath, 2);
    expect(breath.factor).toBeCloseTo(BREATH_HOLD_CALM_FACTOR, 2);
    expect(breath.state).toBe('holding');
  });

  it('strains above 1 near the end of the hold', () => {
    const breath = new BreathHold();
    breath.press();
    advance(breath, 7.8);
    expect(breath.targetFactor()).toBeGreaterThan(1.5);
  });

  it('forces an exhale at 8 s', () => {
    const breath = new BreathHold();
    breath.press();
    advance(breath, 8.05);
    expect(breath.state).toBe('cooldown');
    expect(breath.wasExhaleForced).toBe(true);
  });

  it('blocks a new hold for 2.5 s after release', () => {
    const breath = new BreathHold();
    breath.press();
    advance(breath, 1);
    breath.release();
    advance(breath, BREATH_COOLDOWN_S - 0.2);
    expect(breath.press()).toBe(false);
    advance(breath, 0.3);
    expect(breath.press()).toBe(true);
  });

  it('returns smoothly to 1, without a jump', () => {
    const breath = new BreathHold();
    breath.press();
    advance(breath, 3);
    breath.release();
    breath.step(0.01);
    expect(breath.factor).toBeLessThan(0.4);
    advance(breath, 2);
    expect(breath.factor).toBeCloseTo(1, 2);
  });
});

function rmsSway(restingBpm: number, isHolding: boolean, seed = 11): number {
  const random = mulberry32(seed);
  const heart = new Heart(random, new TaskPulse(restingBpm));
  const sway = new ScopeSway(random, heart);
  if (isHolding) {
    sway.breath.press();
  }
  let sumSquares = 0;
  let samples = 0;
  const dtS = 1 / 60;
  for (let timeS = 0; timeS < 4.5; timeS += dtS) {
    sway.step(dtS, heart.step(dtS));
    if (timeS > 1) {
      const offset = sway.offsetMil;
      sumSquares += offset.x ** 2 + offset.y ** 2;
      samples++;
    }
  }
  return Math.sqrt(sumSquares / samples);
}

describe('ScopeSway', () => {
  it('holding the breath reduces the sway', () => {
    expect(rmsSway(65, true)).toBeLessThan(rmsSway(65, false) * 0.5);
  });

  it('a higher pulse sways more', () => {
    const averageOf = (bpm: number) => [1, 2, 3, 4, 5].reduce((sum, seed) => sum + rmsSway(bpm, false, seed), 0) / 5;
    expect(averageOf(118)).toBeGreaterThan(averageOf(62));
  });

  it('one heartbeat kicks harder at a higher pulse', () => {
    const kickAfterOneBeat = (restingBpm: number): number => {
      const random = mulberry32(21);
      const sway = new ScopeSway(random, new Heart(mulberry32(1), new TaskPulse(restingBpm)));
      sway.step(0.01, true);
      let peak = 0;
      for (let step = 0; step < 10; step++) {
        sway.step(0.01, false);
        peak = Math.max(peak, Math.abs(sway.offsetMil.y));
      }
      return peak;
    };
    expect(kickAfterOneBeat(130)).toBeGreaterThan(kickAfterOneBeat(65) * 1.5);
  });

  it('recoil throws the reticle up and fades within 0.5 s', () => {
    const random = mulberry32(1);
    const heart = new Heart(random, new TaskPulse(65));
    const sway = new ScopeSway(random, heart);
    const before = sway.offsetMil.y;
    sway.fireRecoil();
    expect(sway.offsetMil.y - before).toBeGreaterThan(0.5);
    for (let step = 0; step < 30; step++) {
      sway.step(1 / 50, false);
    }
    const settled = sway.offsetMil;
    expect(Math.abs(settled.y)).toBeLessThan(0.5);
  });
});
