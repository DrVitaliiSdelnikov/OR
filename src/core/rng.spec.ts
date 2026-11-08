import { describe, expect, it } from 'vitest';
import { gaussian, mulberry32 } from './rng';

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = mulberry32(42);
    const second = mulberry32(42);
    const firstValues = Array.from({ length: 5 }, () => first());
    const secondValues = Array.from({ length: 5 }, () => second());
    expect(firstValues).toEqual(secondValues);
  });

  it('gives a different sequence for a different seed', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('stays inside [0, 1)', () => {
    const random = mulberry32(7);
    for (let index = 0; index < 10000; index++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('gaussian', () => {
  it('has mean about 0 and deviation about 1', () => {
    const random = mulberry32(99);
    const samples = Array.from({ length: 20000 }, () => gaussian(random));
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const deviation = Math.sqrt(samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(deviation - 1)).toBeLessThan(0.03);
  });
});
