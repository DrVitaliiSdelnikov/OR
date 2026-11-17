import { describe, expect, it } from 'vitest';
import { text } from '..';
import { COURSE } from '../../sim/course';

const T = text.about;

describe('«О приложении»: тексты визитки', () => {
  it('девять пунктов, у каждого заголовок и текст; планы не пустые', () => {
    expect(T.points).toHaveLength(9);
    for (const point of T.points) {
      expect(point.title.trim(), point.title).not.toBe('');
      expect(point.text.trim(), point.title).not.toBe('');
    }
    expect(T.plans.length).toBeGreaterThan(0);
    expect(T.plans.every(plan => plan.trim() !== '')).toBe(true);
  });

  it('число упражнений в тексте совпадает с курсом', () => {
    const courseText = T.points.find(point => point.title === 'Учебник и курс')!.text;
    expect(courseText).toContain(`${COURSE.filter(def => def.targets !== null).length} упражнений`);
  });

  it('в лицензиях есть движок bclibc под LGPL-3.0', () => {
    expect(T.licenses).toContainEqual({ name: expect.stringContaining('bclibc'), license: 'LGPL-3.0' });
  });
});
