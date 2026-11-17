import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { UnitSystem } from '../../core/units';
import { createNotebook, Notebook } from '../../sim/notebook';
import { PencilMark } from '../../sim/pencil-marks';
import { scopeById } from '../../sim/scope-model';
import { hubRows } from './calc-sheet.model';
import { pencilNotes } from './pencil.model';

let cards: Record<UnitSystem, DopeCard>;

beforeAll(async () => {
  const engine = new BallisticsEngine();
  cards = { metric: await buildDopeCard(engine, courseLoadout('B'), 0.1), imperial: await buildDopeCard(engine, courseLoadout('B', 'imperial'), 0.1, 'imperial') };
});

function notebookOf(system: UnitSystem = 'metric'): Notebook {
  return createNotebook({ card: cards[system], scope: scopeById('course-dot'), target: { sizeM: 0.5, distanceM: 500 }, hasZones: false, canTakeWindFromStation: false, seed: 4 }, 'manual-easy');
}

function mark(fields: Partial<PencilMark>): PencilMark {
  return { place: 'dope', kind: 'dope', quantity: 'mil', player: 3.8, truth: 3.5, seal: '', ...fields };
}

describe('красный карандаш в блокноте (T2.2)', () => {
  it('САМ: на шаге — значение игрока и «надо» в MIL со стрелкой стороны шага', () => {
    expect(pencilNotes([mark({})], notebookOf()).dope).toEqual({ player: '↑ 3,8 MIL', needed: 'надо ↑ 3,5 MIL' });
    expect(pencilNotes([mark({ place: 'wind', kind: 'wind-calc', player: -0.3, truth: -0.5 })], notebookOf()).wind).toEqual({ player: '← 0,3 MIL', needed: 'надо ← 0,5 MIL' });
    expect(pencilNotes([mark({ place: 'spin', kind: 'earth', player: -0.3, truth: -0.1 })], notebookOf()).spin).toEqual({ player: '← 0,3 MIL', needed: 'надо ← 0,1 MIL' });
  });

  it('две метки на одном шаге — через точку; дальность и ветер — в единицах игрока', () => {
    const marks = [mark({ place: 'wind', kind: 'wind-speed', quantity: 'windSpeed', player: 2, truth: 4.1 }), mark({ place: 'wind', kind: 'wind-clock', quantity: 'clock', player: 2, truth: 3 })];
    expect(pencilNotes(marks, notebookOf()).wind).toEqual({ player: '2 м/с · 2 ч', needed: 'надо 4,1 м/с · 3 ч' });
    expect(pencilNotes(marks, notebookOf('imperial')).wind).toEqual({ player: '4,5 миль/ч · 2 ч', needed: 'надо 9,2 миль/ч · 3 ч' });
    expect(pencilNotes([mark({ place: 'milling', kind: 'distance', quantity: 'distance', player: 413, truth: 455 })], notebookOf()).milling).toEqual({ player: '413 м', needed: 'надо 455 м' });
  });

  it('без меток — пусто', () => {
    expect(pencilNotes([], notebookOf())).toEqual({});
  });

  it('хаб САМ: у строки шага — метка, у остальных — нет', () => {
    const rows = hubRows(notebookOf(), pencilNotes([mark({})], notebookOf()));
    expect(rows.find(row => row.step === 'dope')!.pencil).toEqual({ player: '↑ 3,8 MIL', needed: 'надо ↑ 3,5 MIL' });
    expect(rows.find(row => row.step === 'wind')!.pencil).toBeNull();
  });
});
