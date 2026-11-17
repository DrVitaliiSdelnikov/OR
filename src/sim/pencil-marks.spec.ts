import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout } from '../core/content';
import { buildDopeCard, DopeCard } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { roundToClicks } from '../core/game-formulas';
import { Correction } from '../core/types';
import { CHAIN_ORDER, ChainLink, ChainLinkKind, ChainLinkPart } from './miss-chain';
import { NotebookMode } from '../core/exercise-scoring';
import { createNotebook, enterWind, measureRange, Notebook, NotebookStepId, placeChip, readFlag, recordStation, recordStep, setSign, stepSheet, typeTape } from './notebook';
import { PencilMark, pencilMarksAfterShot, withoutStaleMarks } from './pencil-marks';
import { scopeById } from './scope-model';

const CLICK_MIL = 0.1;
const STATION = { temperatureC: 5, pressureHpa: 1025, relativeHumidity: 0.5, windSpeedMps: 4, windClock: 9 };
let card: DopeCard;

beforeAll(async () => {
  card = await buildDopeCard(new BallisticsEngine(), courseLoadout('B'), CLICK_MIL);
});

function notebookOf(mode: NotebookMode, distanceM: number | null = 500, hasZones = false): Notebook {
  const notebook = createNotebook({ card, scope: scopeById('course-dot'), target: { sizeM: 0.5, distanceM }, hasZones, canTakeWindFromStation: false, seed: 4 }, mode);
  return enterWind(recordStation(notebook, STATION, 3, 0), 2, 9);
}

function solved(notebook: Notebook, step: NotebookStepId, finalValue: number): Notebook {
  const sheet = stepSheet(notebook, step);
  const placed = sheet.slots.reduce((current, slot) => placeChip(current, step, slot.chipKind), notebook);
  return recordStep(setSign(typeTape(placed, step, sheet.tapeLength - 1, finalValue), step, 1), step);
}

function linkOf(kind: ChainLinkKind, vector: Correction, values: Partial<ChainLink> = {}): ChainLink {
  return { kind, vector, clicks: Math.abs(roundToClicks(Math.hypot(vector.upMrad, vector.rightMrad), CLICK_MIL)), quantity: 'mil', player: 1, truth: 2, ...values };
}

function chainWith(errors: Partial<Record<ChainLinkKind, Correction>>, values: Partial<Record<ChainLinkKind, Partial<ChainLink>>> = {}): ChainLink[] {
  return CHAIN_ORDER.map(kind => linkOf(kind, errors[kind] ?? { upMrad: 0, rightMrad: 0 }, values[kind]));
}

function places(marks: readonly PencilMark[]): string[] {
  return marks.map(mark => `${mark.kind}→${mark.place}`);
}

const ONE_CLICK: Correction = { upMrad: 0.1, rightMrad: 0 };
const UNDER_CLICK: Correction = { upMrad: 0.04, rightMrad: 0 };

describe('красный карандаш: где метка (T2.2)', () => {
  it('САМ: звено от клика — на своём шаге; ветер — на шаге «Ветер», флажки — на «Ветре по зонам»', () => {
    const chain = chainWith({ distance: ONE_CLICK, dope: ONE_CLICK, conditions: ONE_CLICK, angle: ONE_CLICK, 'wind-speed': ONE_CLICK, 'wind-clock': ONE_CLICK, zones: ONE_CLICK, 'wind-calc': ONE_CLICK, lead: ONE_CLICK });
    expect(places(pencilMarksAfterShot(notebookOf('manual-easy'), chain))).toEqual([
      'distance→distance',
      'dope→dope',
      'conditions→atmosphere',
      'angle→angle',
      'wind-speed→wind',
      'wind-clock→wind',
      'zones→zones',
      'wind-calc→wind',
      'lead→lead',
    ]);
  });

  it('меньше клика, накрутка и округление — без метки', () => {
    const chain = chainWith({ dope: UNDER_CLICK, turret: { upMrad: 0.5, rightMrad: 0 }, rounding: ONE_CLICK });
    expect(pencilMarksAfterShot(notebookOf('manual-easy'), chain)).toEqual([]);
  });

  it('САМ, вращение: метка на шаге того фактора, что ошибся от клика, со своим «надо»', () => {
    const parts: ChainLinkPart[] = [
      { factor: 'spin', player: -0.3, truth: -0.1 },
      { factor: 'coriolis', player: 0.02, truth: 0 },
      { factor: 'eotvos', player: 0, truth: 0 },
    ];
    const chain = chainWith({ earth: { upMrad: 0, rightMrad: -0.22 } }, { earth: { quantity: 'mil-vector', parts } });
    const marks = pencilMarksAfterShot(notebookOf('manual-easy'), chain);
    expect(places(marks)).toEqual(['earth→spin']);
    expect(marks[0]).toMatchObject({ quantity: 'mil', player: -0.3, truth: -0.1 });
  });

  it('АВТО: дальность — на миллинге (если мерил), ветер — на скорости, часе, флажках; шаги расчёта — без метки', () => {
    const chain = chainWith({ distance: ONE_CLICK, dope: ONE_CLICK, conditions: ONE_CLICK, 'wind-speed': ONE_CLICK, 'wind-clock': ONE_CLICK, zones: ONE_CLICK, 'wind-calc': ONE_CLICK });
    const milled = measureRange(notebookOf('auto', null), 1.1);
    expect(places(pencilMarksAfterShot(milled, chain))).toEqual(['distance→milling', 'wind-speed→wind-speed', 'wind-clock→wind-clock', 'zones→flags']);
    expect(places(pencilMarksAfterShot(notebookOf('auto'), chain))).toEqual(['wind-speed→wind-speed', 'wind-clock→wind-clock', 'zones→flags']);
  });

  it('метка несёт значения звена: что у игрока и что надо', () => {
    const chain = chainWith({ 'wind-speed': ONE_CLICK }, { 'wind-speed': { quantity: 'windSpeed', player: 2, truth: 4.1 } });
    expect(pencilMarksAfterShot(notebookOf('auto'), chain)[0]).toMatchObject({ kind: 'wind-speed', quantity: 'windSpeed', player: 2, truth: 4.1 });
  });
});

describe('красный карандаш: когда стирается (T2.2)', () => {
  it('САМ: держится, пока шаг не тронут; правка шага или другой шаг — своя метка стирается, чужая остаётся', () => {
    const notebook = solved(solved(notebookOf('manual-easy'), 'dope', 3.8), 'atmosphere', 0.2);
    const marks = pencilMarksAfterShot(notebook, chainWith({ dope: ONE_CLICK, conditions: ONE_CLICK }));
    expect(places(withoutStaleMarks(marks, notebook))).toEqual(['dope→dope', 'conditions→atmosphere']);
    expect(places(withoutStaleMarks(marks, typeTape(notebook, 'dope', 0, 1)))).toEqual(['conditions→atmosphere']);
    expect(places(withoutStaleMarks(marks, solved(notebook, 'dope', 3.5)))).toEqual(['conditions→atmosphere']);
  });

  it('САМ: шаг устарел (новый ветер) — метка шага «Ветер» стирается', () => {
    const notebook = solved(notebookOf('manual-easy'), 'wind', 0.3);
    const marks = pencilMarksAfterShot(notebook, chainWith({ 'wind-calc': ONE_CLICK }));
    expect(withoutStaleMarks(marks, notebook)).toHaveLength(1);
    expect(withoutStaleMarks(marks, enterWind(notebook, 4, 9))).toEqual([]);
  });

  it('АВТО: новый ввод ветра стирает метки скорости и часа; новый миллинг — метку дальности; флажок — метку флажков', () => {
    const notebook = measureRange(notebookOf('auto', null, true), 1.1);
    const marks = pencilMarksAfterShot(notebook, chainWith({ distance: ONE_CLICK, 'wind-speed': ONE_CLICK, 'wind-clock': ONE_CLICK, zones: ONE_CLICK }));
    expect(withoutStaleMarks(marks, notebook)).toHaveLength(4);
    expect(places(withoutStaleMarks(marks, enterWind(notebook, 4, 9)))).toEqual(['distance→milling', 'zones→flags']);
    expect(places(withoutStaleMarks(marks, measureRange(notebook, 1.0)))).toEqual(['wind-speed→wind-speed', 'wind-clock→wind-clock', 'zones→flags']);
    expect(places(withoutStaleMarks(marks, readFlag(notebook, 0, 1)))).not.toContain('zones→flags');
  });
});
