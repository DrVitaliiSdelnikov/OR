import { beforeAll, describe, expect, it } from 'vitest';
import { cartridgeById } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { NotebookMode } from '../../core/exercise-scoring';
import { changeContext, createNotebook, enterWind, hideFlagsBehindBerm, Notebook, placeChip, readFlag, recordStation, recordStep, setSign, stepSheet, typeTape } from '../../sim/notebook';
import { scopeById } from '../../sim/scope-model';
import { chipText, editDraft, formulaTokens, hubRows, missingInput, modeBadge, sideOptions, tapeLabels } from './calc-sheet.model';

const scope = scopeById('course-dot');
let cards: Map<string, DopeCard>;

beforeAll(async () => {
  const engine = new BallisticsEngine();
  cards = new Map([
    ['B', await buildDopeCard(engine, cartridgeById('B'), 0.1)],
    ['C', await buildDopeCard(engine, cartridgeById('C'), 0.1)],
  ]);
});

function notebookAt(distanceM: number | null, mode: NotebookMode = 'manual-easy'): Notebook {
  return createNotebook({ card: cards.get('B')!, scope, target: { sizeM: 0.5, distanceM }, hasZones: false, canTakeWindFromStation: false, seed: 3 }, mode);
}

function tokenText(notebook: Notebook, step: 'wind' | 'atmosphere' | 'distance' | 'dope'): string {
  return formulaTokens(notebook, step)
    .map(token => (token.kind === 'text' ? token.text : `[${token.label}]`))
    .join('');
}

function windRecorded(): Notebook {
  let notebook = enterWind(notebookAt(300), 3.2, 9);
  notebook = placeChip(placeChip(notebook, 'wind', 'crosswind'), 'wind', 'distance');
  notebook = typeTape(typeTape(typeTape(notebook, 'wind', 0, 960), 'wind', 1, 0.596), 'wind', 2, 0.6);
  return recordStep(setSign(notebook, 'wind', -1), 'wind');
}

describe('formula with slots', () => {
  it('easy: the wind constant is printed from the card row (set А)', () => {
    expect(tokenText(enterWind(notebookAt(300), 3.2, 9), 'wind')).toBe('W = [V⊥] × [D] / 1610');
  });

  it('hard: the wind constant is a slot too', () => {
    expect(tokenText(enterWind(notebookAt(300, 'manual-hard'), 3.2, 9), 'wind')).toBe('W = [V⊥] × [D] / [K]');
  });

  it('easy: atmosphere prints both card columns; distance and DOPE have only slots', () => {
    expect(tokenText(notebookAt(600), 'atmosphere')).toMatch(/^ΔВЕРТ = \(15 − \[T\]\) \/ 10 × 0\.1\d \+ \(\[P\] − 1013\) \/ 10 × 0\.0\d$/);
    expect(tokenText(notebookAt(null), 'distance')).toBe('Д = [размер] × 1000 / [MIL]');
    expect(tokenText(notebookAt(300), 'dope')).toBe('ВЕРТ = строка карточки на [D]');
  });

  it('a slot carries its index in the sheet and what is placed in it', () => {
    const notebook = placeChip(enterWind(notebookAt(300), 3.2, 9), 'wind', 'distance', 1);
    const slots = formulaTokens(notebook, 'wind').filter(token => token.kind === 'slot');
    expect(slots.map(slot => (slot.kind === 'slot' ? [slot.index, slot.placedText] : null))).toEqual([
      [0, null],
      [1, '300 м'],
    ]);
  });
});

describe('chips and tape', () => {
  it('a chip says its value and where it came from', () => {
    expect(chipText({ kind: 'crosswind', value: 3.2, group: 'instruments' }, 300)).toEqual({ value: '3.2', source: 'V⊥ после часов' });
    expect(chipText({ kind: 'wind-constant', value: 1610, group: 'cartridge' }, 300)).toEqual({ value: '1610', source: 'K строка 300 м' });
    expect(chipText({ kind: 'distance', value: 300, group: 'instruments' }, 300)).toEqual({ value: '300 м', source: 'D' });
    expect(chipText({ kind: 'temperature', value: -5, group: 'instruments' }, 600)).toEqual({ value: '-5 C', source: 'T станция' });
  });

  it('the wind tape has three lines with the printed constant; DOPE has one', () => {
    expect(tapeLabels(enterWind(notebookAt(300), 3.2, 9), 'wind')).toEqual(['V⊥ × D =', '÷ 1610 =', 'до клика 0.1 =']);
    expect(tapeLabels(enterWind(notebookAt(300, 'manual-hard'), 3.2, 9), 'wind')).toEqual(['V⊥ × D =', '÷ K =', 'до клика 0.1 =']);
    expect(tapeLabels(notebookAt(300), 'dope')).toEqual(['ВЕРТ =']);
    expect(tapeLabels(notebookAt(null), 'distance')).toEqual(['Д =']);
  });

  it('sides: wind left is minus, DOPE up is plus, distance has none', () => {
    expect(sideOptions('wind')).toEqual([
      { label: '← Влево', sign: -1 },
      { label: 'Вправо →', sign: 1 },
    ]);
    expect(sideOptions('dope')).toEqual([
      { label: '↑ Вверх', sign: 1 },
      { label: '↓ Вниз', sign: -1 },
    ]);
    expect(sideOptions('distance')).toEqual([]);
  });

  it('says which input is missing before a step can be filled', () => {
    expect(missingInput(notebookAt(300), 'wind')).toBe('сначала введи ветер на вкладке «Ветер»');
    expect(missingInput(notebookAt(300), 'atmosphere')).toBe('сначала сделай замер на вкладке «Условия»');
    expect(missingInput(notebookAt(null), 'dope')).toBe('сначала шаг «Дистанция»');
    expect(missingInput(notebookAt(null), 'distance')).toBe('сначала отметь гонг на вкладке «Дистанция»');
    expect(missingInput(enterWind(notebookAt(300), 3.2, 9), 'wind')).toBeNull();
  });
});

describe('manual hub', () => {
  it('known distance: DOPE, atmosphere, wind; unknown distance starts with the distance step', () => {
    expect(hubRows(notebookAt(450)).map(row => row.title)).toEqual(['ДОПЕ', 'Атмосфера', 'Ветер']);
    expect(hubRows(notebookAt(null)).map(row => row.title)).toEqual(['Дистанция', 'ДОПЕ', 'Атмосфера', 'Ветер']);
    expect(hubRows(notebookAt(450)).map(row => row.number)).toEqual([1, 2, 3]);
  });

  it('empty, recorded with the value and side, and the soft hint in easy', () => {
    const empty = hubRows(notebookAt(300))[2];
    expect(empty).toMatchObject({ step: 'wind', state: 'empty', valueText: '', note: 'не записано' });
    const recorded = hubRows(windRecorded())[2];
    expect(recorded).toMatchObject({ state: 'recorded', valueText: '← 0.6', note: 'записано' });
    let wrong = enterWind(notebookAt(300), 3.2, 9);
    wrong = placeChip(placeChip(wrong, 'wind', 'crosswind'), 'wind', 'distance');
    wrong = recordStep(setSign(typeTape(wrong, 'wind', 2, 1.2), 'wind', -1), 'wind');
    expect(hubRows(wrong)[2].note).toBe('записано · проверь умножение и деление');
  });

  it('a stale step says why', () => {
    const stale = changeContext(windRecorded(), { card: cards.get('C')! });
    expect(hubRows(stale)[2]).toMatchObject({ state: 'stale', valueText: '', note: 'устарело · патрон сменён' });
    const remeasured = recordStation(windRecorded(), { temperatureC: 15, pressureHpa: 1013, relativeHumidity: 0.5, windSpeedMps: 3, windClock: 9 }, 3, 0);
    expect(hubRows(remeasured)[2].state).toBe('recorded');
  });
});

describe('keypad draft', () => {
  it('builds a number key by key', () => {
    expect((['1', '.', '2', '5'] as const).reduce<string>(editDraft, '')).toBe('1.25');
    expect(editDraft('', '.')).toBe('0.');
    expect(editDraft('1.2', '.')).toBe('1.2');
    expect(editDraft('1.255', '7')).toBe('1.255');
    expect(editDraft('12345', '6')).toBe('123456');
    expect(editDraft('123456', '7')).toBe('123456');
    expect(editDraft('1.2', 'back')).toBe('1.');
    expect(editDraft('', 'back')).toBe('');
    expect(editDraft('0', '5')).toBe('5');
  });
});

describe('mode badge', () => {
  it('names the mode and its multiplier', () => {
    expect(modeBadge('manual-easy')).toBe('САМ · ЛЁГКИЙ ×1.5');
    expect(modeBadge('manual-hard')).toBe('САМ · СЛОЖНЫЙ ×2');
    expect(modeBadge('auto')).toBe('АВТО ×1');
  });
});

describe('zones step: flags (A9.3a)', () => {
  const zonedAt = (distanceM: number) =>
    enterWind(createNotebook({ card: cards.get('B')!, scope, target: { sizeM: 0.5, distanceM }, hasZones: true, canTakeWindFromStation: false, seed: 3 }, 'manual-easy'), 3, 9);

  it('an unread flag says to tap it in the glass', () => {
    expect(missingInput(readFlag(zonedAt(650), 0, 2), 'zones')).toBe('сначала тапни флажок 400 м в стекле');
  });

  it('a flag behind the berm is a zero chip labelled so; the step can be filled', () => {
    const notebook = hideFlagsBehindBerm(readFlag(readFlag(zonedAt(500), 0, 2), 1, 4), [2]);
    const flag600 = stepSheet(notebook, 'zones').chips.find(chip => chip.kind === 'zone-600')!;
    expect(chipText(flag600, 500)).toEqual({ value: '0.0', source: 'флажок 600 м за валом' });
    expect(missingInput(notebook, 'zones')).toBeNull();
  });
});
