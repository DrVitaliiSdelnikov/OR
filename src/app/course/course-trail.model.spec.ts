import { describe, expect, it } from 'vitest';
import { CourseResults, exerciseById } from '../../sim/course';
import { exerciseSheet, trailNodes } from './course-trail.model';

function results(bestClasses: CourseResults['bestClasses'], isIntroCompleted = true): CourseResults {
  return { isIntroCompleted, bestClasses };
}

describe('trail nodes', () => {
  it('first launch: thirteen nodes, only the intro is current, the rest locked', () => {
    const nodes = trailNodes(results({}, false));
    expect(nodes.map(node => node.id)).toEqual(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
    expect(nodes[0].state).toBe('current');
    expect(nodes.slice(1).every(node => node.state === 'locked')).toBe(true);
  });

  it('in progress: passed with class stamps, the next current, then locked', () => {
    const nodes = trailNodes(results({ '01': 1, '02': 2, '03': 3, '04': 0 }));
    expect(nodes.slice(0, 6).map(node => [node.state, node.stamp])).toEqual([
      ['passed', null],
      ['passed', 'gold'],
      ['passed', 'silver'],
      ['passed', 'bronze'],
      ['current', null],
      ['locked', null],
    ]);
  });

  it('the intro and the attestation are marked', () => {
    const nodes = trailNodes(results({}, false));
    expect(nodes.filter(node => node.isIntro).map(node => node.id)).toEqual(['00']);
    expect(nodes.filter(node => node.isAttestation).map(node => node.id)).toEqual(['12']);
    expect(nodes[12].title).toBe('Полевой рубеж');
  });

  it('"unlock everything": nothing locked, the first not admitted is current', () => {
    const nodes = trailNodes(results({ '01': 3 }), true);
    expect(nodes.some(node => node.state === 'locked')).toBe(false);
    expect(nodes.filter(node => node.state === 'current').map(node => node.id)).toEqual(['02']);
    expect(nodes[5].state).toBe('open');
  });

  it('a finished course has no current node', () => {
    const allIds = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const nodes = trailNodes(results(Object.fromEntries(allIds.map(id => [id, 2]))));
    expect(nodes.every(node => node.state === 'passed')).toBe(true);
  });
});

describe('exercise sheet', () => {
  it('01: three gongs at 300 m, calm standard day, AUTO', () => {
    expect(exerciseSheet(exerciseById('01')!)).toEqual({
      id: '01',
      title: 'Первые щелчки',
      targets: '3 × гонг 0,5 м · 300 м',
      shots: 'до 2 выстрелов на цель · патрон Б',
      wind: 'штиль',
      atmosphere: '+15 C · 1013 гПа',
      mode: 'АВТО',
      terms: ['клик', 'MIL', 'MOA', 'барабан', 'ДОПЕ', 'ZERO STOP'],
    });
  });

  it('02: paper target, five shots', () => {
    const sheet = exerciseSheet(exerciseById('02')!);
    expect(sheet.targets).toBe('1 × бумажная мишень 0,5 м · 100 м');
    expect(sheet.shots).toBe('5 выстрелов · патрон Б');
  });

  it('04 and 06: light wind from 3 or 9, moderate oblique wind', () => {
    expect(exerciseSheet(exerciseById('04')!).wind).toBe('2–2,5 м/с · с 3 или 9 ч');
    expect(exerciseSheet(exerciseById('06')!).wind).toBe('4–6 м/с · косой');
    expect(exerciseSheet(exerciseById('06')!).targets).toBe('4 × гонг 0,5 м · 400–500 м');
    expect(exerciseSheet(exerciseById('06')!).mode).toBe('САМ · лёгкий');
  });

  it('07: a cold morning; 08: three cartridges; 10: SAM hard', () => {
    expect(exerciseSheet(exerciseById('07')!).atmosphere).toBe('−5…0 C · 1025–1035 гПа');
    expect(exerciseSheet(exerciseById('08')!).shots).toBe('до 2 выстрелов на цель · патроны А, Б, В');
    expect(exerciseSheet(exerciseById('10')!).mode).toBe('САМ · сложный');
  });

  it('12: unknown distances out and back, wind by zones, gongs up to 0.7 m', () => {
    const sheet = exerciseSheet(exerciseById('12')!);
    expect(sheet.targets).toBe('10 × гонг 0,5–0,7 м · неизвестная, 200–700 м, туда и обратно');
    expect(sheet.wind).toBe('разный по зонам');
    expect(sheet.atmosphere).toBe('по погоде');
  });

  it('00 has no targets', () => {
    expect(exerciseSheet(exerciseById('00')!).targets).toBe('без стрельбы');
  });
});
