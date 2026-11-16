import { beforeAll, describe, expect, it } from 'vitest';
import { CARTRIDGES, COURSE_RIFLE, courseLoadout, FLAG_DISTANCES_M } from '../../../core/content';
import { buildDopeCard, DopeCard, dopeRowAt } from '../../../core/dope-card';
import { BallisticsEngine } from '../../../core/engine';
import { windClockShare } from '../../../core/field';
import { analyseGroup } from '../../../sim/shot-review';
import { CardsByCartridge, TERM_CARDS } from '../terms';
import {
  cartridgesLabels,
  cartridgesView,
  focalPlaneView,
  GROUP_EXAMPLE_IMPACTS,
  groupView,
  nearestReticleMark,
  RETICLE_SCHEME_HALF_MIL,
  reticleSchemeMarks,
  SCHEME_TERMS,
  trajectoryView,
  windClockView,
  zonesView,
} from './scheme.model';

const CLICK_MIL = 0.1;
const cards = new Map<string, DopeCard>() as Map<'A' | 'B' | 'C', DopeCard>;
const imperialCards = new Map<string, DopeCard>() as Map<'A' | 'B' | 'C', DopeCard>;

beforeAll(async () => {
  const engine = new BallisticsEngine();
  for (const cartridge of CARTRIDGES) {
    cards.set(cartridge.id, await buildDopeCard(engine, courseLoadout(cartridge.id), CLICK_MIL));
    imperialCards.set(cartridge.id, await buildDopeCard(engine, courseLoadout(cartridge.id, 'imperial'), CLICK_MIL, 'imperial'));
  }
}, 60000);

describe('схемы: к каким карточкам', () => {
  it('у каждой схемы — существующие термины, и термин не попадает в две схемы', () => {
    const terms = Object.values(SCHEME_TERMS).flat();
    const known = new Set(TERM_CARDS.map(card => card.term));
    expect(terms.filter(term => !known.has(term))).toEqual([]);
    expect(new Set(terms).size).toBe(terms.length);
    expect(SCHEME_TERMS['wind-clock']).toContain('правило часов');
    expect(SCHEME_TERMS.reticle).toContain('сетка');
  });
});

describe('сетка', () => {
  it('тап рядом с точкой MIL-dot — «точка = 1 MIL»; на пустом месте — ничего', () => {
    expect(nearestReticleMark('mil-dot', 2.1, 0.1)?.caption).toBe('точка = 1 MIL');
    expect(nearestReticleMark('mil-dot', 2.5, 2.5)).toBeNull();
  });

  it('у Ёлки полуметка — 0,5 MIL, у MOA штрих — 1 MOA', () => {
    expect(nearestReticleMark('tree', 1.55, 0)?.caption).toBe('полуметка = 0,5 MIL');
    expect(nearestReticleMark('tree', 2, 0.05)?.caption).toBe('штрих = 1 MIL');
    expect(nearestReticleMark('moa-grid', 0.3, 0)?.caption).toBe('штрих = 1 MOA = 0,29 MIL');
  });

  it('берётся ближайшая метка, а не первая в списке', () => {
    expect(nearestReticleMark('tree', 0.95, 0)?.rightMil).toBe(1);
  });

  it('на схеме — только метки в пределах поля схемы', () => {
    const marks = reticleSchemeMarks('moa-grid');
    expect(marks.every(mark => Math.abs(mark.rightMil) <= RETICLE_SCHEME_HALF_MIL && Math.abs(mark.downMil) <= RETICLE_SCHEME_HALF_MIL)).toBe(true);
    expect(marks.length).toBeGreaterThan(0);
  });
});

describe('фокальная плоскость', () => {
  it('в первой плоскости метка растёт вместе с гонгом, во второй — нет', () => {
    const low = focalPlaneView(3);
    const high = focalPlaneView(12);
    expect(high.gongRadius / low.gongRadius).toBeCloseTo(4, 9);
    expect(high.firstPlaneMilSpacing / low.firstPlaneMilSpacing).toBeCloseTo(4, 9);
    expect(high.secondPlaneMilSpacing).toBeCloseTo(low.secondPlaneMilSpacing, 9);
  });

  it('во второй плоскости метки верны только на 12×', () => {
    expect(focalPlaneView(12).secondPlaneCaption).toBe('на 12× точка = 1 MIL — верно');
    expect(focalPlaneView(6).secondPlaneCaption).toBe('на 6× точка = 2 MIL — верно только на 12×');
    expect(focalPlaneView(6).firstPlaneCaption).toBe('на 6× точка = 1 MIL — верно на любой кратности');
  });
});

describe('траектория (U6)', () => {
  it('точки кривой — строки карточки Б, ноль в 100 м', () => {
    const view = trajectoryView(cards.get('B')!);
    expect(view.points).toEqual(cards.get('B')!.rows.map(row => ({ distanceM: row.distanceM, elevationMil: row.elevationMil })));
    expect(view.zeroM).toBe(COURSE_RIFLE.zeroM);
    expect(view.points.find(point => point.distanceM === COURSE_RIFLE.zeroM)!.elevationMil).toBe(0);
  });

  it('метки времени полёта — из колонки t', () => {
    const view = trajectoryView(cards.get('B')!);
    for (const mark of view.timeMarks) {
      expect(mark.timeOfFlightS).toBe(dopeRowAt(cards.get('B')!, mark.distanceM).timeOfFlightS);
    }
    expect(view.timeMarks.map(mark => mark.distanceM)).toEqual([300, 600, 1000]);
  });
});

describe('часы ветра (U5)', () => {
  it('доля на схеме = windClockShare для 1–12 ч', () => {
    for (let hour = 1; hour <= 12; hour++) {
      expect(windClockView(hour).share).toBe(windClockShare(hour));
    }
  });

  it('подпись: «2 ч — доля 0,87», «9 ч — доля 1», «12 ч — доля 0»', () => {
    expect(windClockView(2).caption).toBe('2 ч — доля 0,87');
    expect(windClockView(9).caption).toBe('9 ч — доля 1');
    expect(windClockView(12).caption).toBe('12 ч — доля 0');
    expect(windClockView(3).arrowFromDeg).toBe(90);
  });
});

describe('патроны (U6)', () => {
  it('три патрона; кривые падения и сноса — строки их карточек', () => {
    const view = cartridgesView(cards as CardsByCartridge);
    expect(view.map(item => item.id)).toEqual(['A', 'B', 'C']);
    for (const item of view) {
      const card = cards.get(item.id)!;
      expect(item.drop).toEqual(card.rows.map(row => ({ distanceM: row.distanceM, mil: row.elevationMil })));
      expect(item.driftPerWindUnit).toEqual(card.rows.map(row => ({ distanceM: row.distanceM, mil: row.distanceM / row.windConstant })));
    }
  });

  it('у патрона — масса, скорость, BC и энергия у дула', () => {
    const patronB = cartridgesView(cards as CardsByCartridge)[1];
    expect(patronB.facts).toEqual(['10,9 г', '800 м/с', 'BC 0,218', '3490 Дж']);
    expect(cartridgesLabels('metric').maxDistanceM).toBe(1000);
  });
});

describe('зоны ветра', () => {
  it('зоны до 600 м с весами строки 600 карточки, флажки 200 / 400 / 600', () => {
    const view = zonesView(cards.get('B')!);
    const weights = dopeRowAt(cards.get('B')!, 600).zoneWeights;
    expect(view.distanceM).toBe(600);
    expect(view.zones.map(zone => zone.weight)).toEqual(weights);
    expect(view.zones.map(zone => [zone.fromM, zone.toM])).toEqual([[0, 150], [150, 350], [350, 550], [550, 600]]);
    expect(view.flags.map(flag => flag.distanceM)).toEqual(FLAG_DISTANCES_M);
  });
});

describe('группа', () => {
  it('СТП — центр группы; перенос — в обратную сторону, в кликах', () => {
    const view = groupView();
    const center = analyseGroup(GROUP_EXAMPLE_IMPACTS, COURSE_RIFLE.groupSigmaMrad)!.center;
    expect(view.center).toEqual(center);
    expect(view.caption).toBe('СТП ↓ 0,8 → 0,5 MIL — перенеси ↑ 8 ← 5 кл.');
  });
});

describe('схемы в имперских (T1.8c)', () => {
  const yardsOf = (distanceM: number) => Number((distanceM / 0.9144).toFixed(6));

  it('траектория: ноль 100 ярдов, метки 300 / 600 / 1000 ярдов, подписи в ярдах', () => {
    const view = trajectoryView(imperialCards.get('B')!);
    expect(yardsOf(view.zeroM)).toBe(100);
    expect(view.timeMarks.map(mark => yardsOf(mark.distanceM))).toEqual([300, 600, 1000]);
    expect(view.labels.zero).toBe('ноль 100 ярдов');
    expect(view.labels.ticks.map(tick => [yardsOf(tick.distanceM), tick.text])).toEqual([[0, '0 ярдов'], [500, '500 ярдов'], [1000, '1000 ярдов']]);
    expect(yardsOf(view.labels.maxDistanceM)).toBe(1000);
    expect(view.labels.maxElevation).toMatch(/^на 1000 ярдов: ↑ [\d,]+ MIL$/);
    expect(trajectoryView(cards.get('B')!).labels.ticks.map(tick => tick.text)).toEqual(['0 м', '500 м', '1000 м']);
  });

  it('зоны: до 600 ярдов, границы 150 / 350 / 550 ярдов, флажки 200 / 400 / 600; подпись — ярды', () => {
    const view = zonesView(imperialCards.get('B')!);
    expect(yardsOf(view.distanceM)).toBe(600);
    expect(view.zones.map(zone => [yardsOf(zone.fromM), yardsOf(zone.toM)])).toEqual([[0, 150], [150, 350], [350, 550], [550, 600]]);
    expect(view.flags.map(flag => [yardsOf(flag.distanceM), flag.text])).toEqual([[200, '200'], [400, '400'], [600, '600']]);
    expect(view.zones.map(zone => zone.weight)).toEqual(dopeRowAt(imperialCards.get('B')!, view.distanceM).zoneWeights);
    expect(view.caption).toContain('Строка 600 ярдов:');
    expect(view.caption).toContain('последние ярды');
    expect(zonesView(cards.get('B')!).caption).toContain('Строка 600 м:');
  });

  it('патроны: гран, фут/с, фут-фунт; снос на 1 миль/ч; ось — 1000 ярдов', () => {
    const view = cartridgesView(imperialCards as CardsByCartridge);
    expect(view[1].facts).toEqual(['168 гранов', '2625 фут/с', 'BC 0,218', '2570 фут-фунт']);
    const card = imperialCards.get('B')!;
    expect(view[1].driftPerWindUnit).toEqual(card.rows.map(row => ({ distanceM: row.distanceM, mil: (row.distanceM / row.windConstant) * 0.44704 })));
    expect(cartridgesLabels('imperial').driftTitle).toBe('снос на 1 миль/ч, MIL');
    expect(cartridgesLabels('imperial').axis(2.4)).toBe('1000 ярдов · 2,4 MIL');
    expect(cartridgesLabels('metric').axis(2.4)).toBe('1000 м · 2,4 MIL');
    expect(cartridgesLabels('metric').driftTitle).toBe('снос на 1 м/с, MIL');
  });
});
