import { describe, expect, it } from 'vitest';
import { isPassed, shotPoints, starsFor } from './score';

describe('shotPoints', () => {
  it('gives 10 inside the central half of the radius', () => {
    expect(shotPoints(0.25, 0.5)).toBe(10);
  });

  it('gives 5 on the rest of the plate', () => {
    expect(shotPoints(0.4, 0.5)).toBe(5);
    expect(shotPoints(0.5, 0.5)).toBe(5);
  });

  it('gives 0 for a miss', () => {
    expect(shotPoints(0.51, 0.5)).toBe(0);
  });
});

describe('starsFor', () => {
  it.each([
    [69, 100, 0],
    [70, 100, 1],
    [84, 100, 1],
    [85, 100, 2],
    [99, 100, 2],
    [100, 100, 3],
  ])('%i of %i gives %i stars', (score, max, stars) => {
    expect(starsFor(score, max)).toBe(stars);
  });

  it('gives 0 stars when there is nothing to score', () => {
    expect(starsFor(0, 0)).toBe(0);
  });

  it('passes from one star', () => {
    expect(isPassed(21, 30)).toBe(true);
    expect(isPassed(20, 30)).toBe(false);
  });
});
