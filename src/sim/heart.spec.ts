import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { Heart, PULSE_WANDER_BPM, TaskPulse } from './heart';

function beatTimes(restingBpm: number, durationS: number, seed = 5): number[] {
  const heart = new Heart(mulberry32(seed), new TaskPulse(restingBpm));
  const times: number[] = [];
  const dtS = 0.005;
  for (let timeS = 0; timeS < durationS; timeS += dtS) {
    if (heart.step(dtS)) {
      times.push(timeS);
    }
  }
  return times;
}

describe('Heart', () => {
  it('beats about as often as the task pulse', () => {
    const times = beatTimes(62, 120);
    const measuredBpm = ((times.length - 1) / (times[times.length - 1] - times[0])) * 60;
    expect(measuredBpm).toBeGreaterThan(62 - PULSE_WANDER_BPM - 2);
    expect(measuredBpm).toBeLessThan(62 + PULSE_WANDER_BPM + 2);
  });

  it('a stressed heart beats faster', () => {
    expect(beatTimes(118, 60).length).toBeGreaterThan(beatTimes(62, 60).length * 1.6);
  });

  it('is not a metronome: interval variation is between 1% and 10%', () => {
    const times = beatTimes(65, 180);
    const intervals = times.slice(1).map((time, index) => time - times[index]);
    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const deviation = Math.sqrt(intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length);
    const variation = deviation / mean;
    expect(variation).toBeGreaterThan(0.01);
    expect(variation).toBeLessThan(0.1);
  });

  it('neighbouring beats differ by more than the slow wander explains', () => {
    const times = beatTimes(65, 180);
    const intervals = times.slice(1).map((time, index) => time - times[index]);
    const meanInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const neighbourChanges = intervals.slice(1).map((interval, index) => Math.abs(interval - intervals[index]));
    const meanChange = neighbourChanges.reduce((sum, value) => sum + value, 0) / neighbourChanges.length;
    expect(meanChange / meanInterval).toBeGreaterThan(0.025);
  });

  it('stays within the wander band around the task pulse', () => {
    const heart = new Heart(mulberry32(3), new TaskPulse(92));
    for (let step = 0; step < 20000; step++) {
      heart.step(0.01);
      expect(Math.abs(heart.bpm - 92)).toBeLessThanOrEqual(PULSE_WANDER_BPM + 0.01);
    }
  });

  it('scales the beat amplitude with the pulse', () => {
    expect(new Heart(mulberry32(1), new TaskPulse(130)).amplitudeScale).toBeCloseTo(2);
    expect(new Heart(mulberry32(1), new TaskPulse(65)).amplitudeScale).toBeCloseTo(1);
  });
});
