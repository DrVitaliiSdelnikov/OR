import { describe, expect, it } from 'vitest';
import { reticleMarks } from './reticle';
import { MRAD_PER_MOA } from './scope-model';

describe('reticleMarks', () => {
  it('MIL-dot: dots every 1 MIL up to 4 on both axes, thick posts from 4.2 MIL', () => {
    const reticle = reticleMarks('mil-dot');
    const dots = reticle.marks.filter(mark => mark.kind === 'mil-dot');
    const onRight = dots.filter(dot => dot.downMil === 0 && dot.rightMil > 0).map(dot => dot.rightMil);
    const below = dots.filter(dot => dot.rightMil === 0 && dot.downMil > 0).map(dot => dot.downMil);
    expect(onRight.sort()).toEqual([1, 2, 3, 4]);
    expect(below.sort()).toEqual([1, 2, 3, 4]);
    expect(dots).toHaveLength(16);
    expect(reticle.thickPostFromMil).toBe(4.2);
  });

  it('tree: whole-MIL ticks with 0.5 MIL half marks across, a longer scale down than up', () => {
    const marks = reticleMarks('tree').marks;
    const halfMarks = marks.filter(mark => mark.kind === 'half-mil-tick');
    expect(halfMarks.every(mark => mark.downMil === 0 && Math.abs(mark.rightMil) % 1 === 0.5)).toBe(true);
    expect(halfMarks.map(mark => mark.rightMil)).toContain(0.5);
    const verticalScale = marks.filter(mark => mark.kind === 'mil-tick' && mark.rightMil === 0).map(mark => mark.downMil);
    expect(Math.max(...verticalScale)).toBe(14);
    expect(Math.min(...verticalScale)).toBe(-6);
    expect(reticleMarks('tree').thickPostFromMil).toBeNull();
  });

  it('tree: holdover dots in rows 1 MIL apart below the centre, 0.5 MIL apart across', () => {
    const dots = reticleMarks('tree').marks.filter(mark => mark.kind === 'holdover-dot');
    expect([...new Set(dots.map(dot => dot.downMil))]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const firstRow = dots.filter(dot => dot.downMil === 1).map(dot => dot.rightMil);
    expect(firstRow[1] - firstRow[0]).toBeCloseTo(0.5, 9);
  });

  it('MOA: a tick every 1 MOA = 0.2909 MIL, a long one every 5 MOA, numbers every 10', () => {
    const marks = reticleMarks('moa-grid').marks;
    const firstTick = marks.find(mark => mark.kind === 'moa-tick' && mark.downMil === 0 && mark.rightMil > 0)!;
    expect(firstTick.rightMil).toBeCloseTo(0.2909, 4);
    expect(firstTick.rightMil).toBe(MRAD_PER_MOA);
    const fiveMoa = marks.filter(mark => mark.kind === 'five-moa-tick' && mark.downMil === 0 && mark.rightMil > 0).map(mark => mark.rightMil);
    expect(fiveMoa[0]).toBeCloseTo(5 * MRAD_PER_MOA, 9);
    expect(marks.filter(mark => mark.kind === 'label').map(mark => mark.text)).toEqual(['10', '20', '30', '40']);
  });
});
