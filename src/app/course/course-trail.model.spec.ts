import { describe, expect, it } from 'vitest';
import { CourseResults, exerciseById } from '../../sim/course';
import { exerciseSheet, trailNodes } from './course-trail.model';

function results(bestClasses: CourseResults['bestClasses'], isIntroCompleted = true): CourseResults {
  return { isIntroCompleted, bestClasses };
}

describe('trail nodes', () => {
  it('first launch: fifteen nodes, only the intro is current, the rest locked', () => {
    const nodes = trailNodes(results({}, false));
    expect(nodes.map(node => node.id)).toEqual(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14']);
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
    const allIds = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'];
    const nodes = trailNodes(results(Object.fromEntries(allIds.map(id => [id, 2]))));
    expect(nodes.every(node => node.state === 'passed')).toBe(true);
  });

  it('after the attestation 13 is current and 14 locked; the attestation mark stays on 12', () => {
    const toAttestation = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const nodes = trailNodes(results(Object.fromEntries(toAttestation.map(id => [id, 3]))));
    expect(nodes.slice(-3).map(node => [node.id, node.state, node.isAttestation])).toEqual([
      ['12', 'passed', true],
      ['13', 'current', false],
      ['14', 'locked', false],
    ]);
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
      atmosphere: '+15 °C · 1013 гПа',
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
    expect(exerciseSheet(exerciseById('07')!).atmosphere).toBe('−5…0 °C · 1025–1035 гПа');
    expect(exerciseSheet(exerciseById('08')!).shots).toBe('до 2 выстрелов на цель · патроны А, Б, В');
    expect(exerciseSheet(exerciseById('10')!).mode).toBe('САМ · сложный');
  });

  it('12: unknown distances out and back, wind by zones, gongs up to 0.7 m', () => {
    const sheet = exerciseSheet(exerciseById('12')!);
    expect(sheet.targets).toBe('10 × гонг 0,5–0,7 м · неизвестная, 200–700 м, туда и обратно');
    expect(sheet.wind).toBe('разный по зонам');
    expect(sheet.atmosphere).toBe('по погоде');
  });

  it('13: the slope and the altitude in the conditions; 14: spin drift and the latitude; 0.7 m gongs at 800–1000 m', () => {
    const slope = exerciseSheet(exerciseById('13')!);
    expect(slope.targets).toBe('4 × гонг 0,5–0,7 м · 400–700 м');
    expect(slope.atmosphere).toBe('по погоде · ∠ 10–25° вверх или вниз · высота 1000–1500 м');
    const longRange = exerciseSheet(exerciseById('14')!);
    expect(longRange.targets).toBe('4 × гонг 0,7 м · 800–1000 м');
    expect(longRange.atmosphere).toBe('по погоде · деривация · широта 40–60°');
    expect(longRange.mode).toBe('САМ · лёгкий');
  });

  it('00 has no targets', () => {
    expect(exerciseSheet(exerciseById('00')!).targets).toBe('без стрельбы');
  });
});

describe('лист упражнения в имперских единицах (T1.8a)', () => {
  it('01: гонги в дюймах, 325 ярдов (T1.8c), штиль, +59 °F и 29,91 дюйма рт. ст.', () => {
    const sheet = exerciseSheet(exerciseById('01')!, 'imperial');
    expect(sheet.targets).toBe('3 × гонг 20 дюймов · 325 ярдов');
    expect(sheet.atmosphere).toBe('+59 °F · 29,91 дюйма рт. ст.');
  });

  it('07: холодное утро в °F и дюймах рт. ст.; ветер в миль/ч', () => {
    const sheet = exerciseSheet(exerciseById('07')!, 'imperial');
    expect(sheet.atmosphere).toBe('+23…32 °F · 30,27–30,56 дюйма рт. ст.');
    expect(sheet.wind).toBe('4,5–5,6 миль/ч');
    expect(sheet.targets).toBe('4 × гонг 20 дюймов · 550–650 ярдов');
  });

  it('12 и 13: неизвестные дистанции и высота в футах', () => {
    expect(exerciseSheet(exerciseById('12')!, 'imperial').targets).toBe('10 × гонг 20–28 дюймов · неизвестная, 200–750 ярдов, туда и обратно');
    expect(exerciseSheet(exerciseById('13')!, 'imperial').atmosphere).toBe('по погоде · ∠ 10–25° вверх или вниз · высота 3280–4920 футов');
  });

  it('метрика без изменений, кроме знака градуса', () => {
    expect(exerciseSheet(exerciseById('07')!).atmosphere).toBe('−5…0 °C · 1025–1035 гПа');
    expect(exerciseSheet(exerciseById('01')!, 'metric').targets).toBe('3 × гонг 0,5 м · 300 м');
  });
});

describe('лист упражнения: полигон в ярдах (T1.8c)', () => {
  it('дистанции и гонги — как стоят в имперских: 325 ярдов, 450–550, 20″ и 28″', () => {
    expect(exerciseSheet(exerciseById('01')!, 'imperial').targets).toBe('3 × гонг 20 дюймов · 325 ярдов');
    expect(exerciseSheet(exerciseById('06')!, 'imperial').targets).toBe('4 × гонг 20 дюймов · 450–550 ярдов');
    expect(exerciseSheet(exerciseById('09')!, 'imperial').targets).toBe('4 × гонг 20–28 дюймов · 550–750 ярдов');
    expect(exerciseSheet(exerciseById('14')!, 'imperial').targets).toBe('4 × гонг 28 дюймов · 850–1000 ярдов');
    expect(exerciseSheet(exerciseById('05')!, 'imperial').targets).toContain('350–650 ярдов');
    expect(exerciseSheet(exerciseById('10')!, 'imperial').title).toBe('Пристрелка на 425');
    expect(exerciseSheet(exerciseById('06')!).targets).toBe('4 × гонг 0,5 м · 400–500 м');
  });

  it('тропа курса: название 10 — в единицах игрока', () => {
    expect(trailNodes({ isIntroCompleted: true, bestClasses: {} }, false, 'imperial').find(node => node.id === '10')!.title).toBe('Пристрелка на 425');
    expect(trailNodes({ isIntroCompleted: true, bestClasses: {} }).find(node => node.id === '10')!.title).toBe('Пристрелка на 400');
  });
});
