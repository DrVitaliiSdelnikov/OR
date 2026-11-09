import { beforeAll, describe, expect, it } from 'vitest';
import { checkManualSteps, checkPreparation } from '../../core/calc-check';
import { cartridgeById } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { NotebookMode } from '../../core/exercise-scoring';
import { exerciseById, ExerciseShotRecord } from '../../sim/course';
import { CheckTruth, checkInputs, createNotebook, enterWind, Notebook, placeChip, recordStation, recordStep, setSign, toggleFactor, typeTape } from '../../sim/notebook';
import { scopeById } from '../../sim/scope-model';
import { ShotCheck } from '../position/position-session';
import { CauseKind, missBreakdown, MissBreakdown } from '../../sim/miss-breakdown';
import { Correction } from '../../core/types';
import { causesView, checkSheet, correctionText, diagnosisText, directionArrow, dopeNoteTexts, groupText, shotPointsText, targetPlaques, withDopeNote } from './review.model';

const scope = scopeById('course-dot');
let card: DopeCard;

beforeAll(async () => {
  card = await buildDopeCard(new BallisticsEngine(), cartridgeById('B'), 0.1);
});

function notebookAt(distanceM: number, mode: NotebookMode): Notebook {
  return createNotebook({ card, scope, target: { sizeM: 0.5, distanceM }, hasZones: false, canTakeWindFromStation: false, seed: 3 }, mode);
}

function snapshot(notebook: Notebook, truth: CheckTruth): ShotCheck {
  const inputs = checkInputs(notebook, truth);
  const result = notebook.mode === 'auto' ? checkPreparation(inputs.preparation) : checkManualSteps(inputs.steps, card.clickMil);
  return { notebook, truth, inputs, result };
}

function record(fields: Partial<ExerciseShotRecord>): ExerciseShotRecord {
  return { stageIndex: 0, targetIndex: 0, distanceM: 300, isHit: true, isColdBore: false, impact: { upMrad: 0, rightMrad: 0 }, diagnosis: 'clean', ...fields };
}

describe('points of a shot', () => {
  it('gong: 10 first, 5 second, miss; paper: hit or not', () => {
    expect(shotPointsText(true, true, false)).toBe('10 · первым');
    expect(shotPointsText(true, false, false)).toBe('5 · вторым');
    expect(shotPointsText(false, true, false)).toBe('промах');
    expect(shotPointsText(true, false, true)).toBe('попадание');
    expect(shotPointsText(false, false, true)).toBe('мимо');
  });
});

describe('diagnosis and correction', () => {
  it('says where the reticle went on an execution miss', () => {
    expect(diagnosisText('execution', { upMrad: 0.1, rightMrad: 0.4 })).toBe('Сетка ушла вправо на 0.4 — ошибка выполнения');
    expect(diagnosisText('execution', { upMrad: -0.6, rightMrad: 0.1 })).toBe('Сетка ушла вниз на 0.6 — ошибка выполнения');
    expect(diagnosisText('data', { upMrad: 0, rightMrad: 0 })).toBe('Сетка была на цели — ошибка в данных');
    expect(diagnosisText('clean', { upMrad: 0, rightMrad: 0 })).toBe('Чисто: сетка на цели, попадание');
  });

  it('the correction is for the turret, like a spotter calls it', () => {
    expect(correctionText({ upClicks: 0, rightClicks: -3 }, 'data')).toBe('Пуля правее на 0.3 → 3 кл. влево на барабане');
    expect(correctionText({ upClicks: 4, rightClicks: 2 }, 'data')).toBe('Пуля ниже на 0.4 → 4 кл. вверх на барабане · Пуля левее на 0.2 → 2 кл. вправо на барабане');
    expect(correctionText({ upClicks: 0, rightClicks: 0 }, 'execution')).toBe('Данные верны — повтори чисто');
    expect(correctionText({ upClicks: 0, rightClicks: 0 }, 'clean')).toBe('Поправка не нужна');
    expect(correctionText(null, 'data')).toBeNull();
  });
});

describe('check sheet, SAM', () => {
  function windSheet(crosswindChip: 'crosswind' | 'speed', answer: number, sign: 1 | -1 = -1): ShotCheck {
    let notebook = enterWind(notebookAt(600, 'manual-hard'), 3.2, 11);
    notebook = placeChip(placeChip(placeChip(notebook, 'wind', crosswindChip), 'wind', 'distance'), 'wind', 'wind-constant');
    notebook = recordStep(setSign(typeTape(notebook, 'wind', 2, answer), 'wind', sign), 'wind');
    return snapshot(notebook, { trueWindClock: 11, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 });
  }

  it('set В: V instead of V⊥ is a substitution error with the numbers', () => {
    const sheet = checkSheet(windSheet('speed', 1.4), 'manual-hard');
    expect(sheet.stamp).toBe('ОШИБКА');
    expect(sheet.rows[0]).toMatchObject({ label: 'Ветер', player: '← 1.4', reference: '← 0.7', diff: '7 кл.', status: 'error' });
    expect(sheet.mainError).toEqual({ label: 'ШАГ 1 · ПОДСТАНОВКА', phrase: 'В слот V⊥ поставлено 3.2, а нужно 1.6' });
    expect(sheet.subtitle).toBe('1 ошибка');
    expect(sheet.pointsText).toBe('+0 за расчёт · ×2');
  });

  it('an exact step: ТОЧНО, all steps right, points with the multiplier', () => {
    const sheet = checkSheet(windSheet('crosswind', 0.7), 'manual-hard');
    expect(sheet.stamp).toBe('ТОЧНО');
    expect(sheet.subtitle).toBe('1 из 1 шагов верны');
    expect(sheet.mainError).toBeNull();
    expect(sheet.pointsText).toBe('+20 за расчёт · ×2');
  });

  it('a wrong chip in the second slot names that slot', () => {
    let notebook = enterWind(createNotebook({ card, scope, target: { sizeM: 0.5, distanceM: 600, neighborDistanceM: 700 }, hasZones: false, canTakeWindFromStation: false, seed: 3 }, 'manual-hard'), 3.2, 9);
    notebook = placeChip(placeChip(placeChip(notebook, 'wind', 'crosswind'), 'wind', 'neighbor-distance'), 'wind', 'wind-constant');
    notebook = recordStep(setSign(typeTape(notebook, 'wind', 2, 1.6), 'wind', -1), 'wind');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 9, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }), 'manual-hard');
    expect(sheet.mainError?.phrase).toBe('В слот D поставлено 700, а нужно 600');
  });

  it('a reversed side is СТОРОНА in the difference', () => {
    const sheet = checkSheet(windSheet('crosswind', 0.7, 1), 'manual-hard');
    expect(sheet.rows[0].diff).toBe('СТОРОНА');
    expect(sheet.mainError?.phrase).toBe('Число верное, сторона обратная: брать влево');
  });
});

describe('check sheet, AUTO', () => {
  it('set Г: conditions off and 2.4 typed instead of 3.2; turrets on the notebook total', () => {
    let notebook = recordStation(notebookAt(600, 'auto'), { temperatureC: -5, pressureHpa: 1030, relativeHumidity: 0.5, windSpeedMps: 3.2, windClock: 9 }, 3, 0);
    notebook = enterWind(notebook, 2.4, 9);
    const planned = { elevation: 57, windageLeft: 10 };
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 9, dialedElevationClicks: planned.elevation, dialedWindageLeftClicks: planned.windageLeft }), 'auto');
    expect(sheet.stamp).toBe('ОШИБКА');
    expect(sheet.rows.map(row => [row.label, row.diff])).toEqual([
      ['Ветер: скорость', '4 кл.'],
      ['Ветер: направление', '0'],
      ['Учтённые факторы', '3 кл.'],
      ['Барабан ВЕРТ', '0'],
      ['Барабан ГОР', '0'],
    ]);
    expect(sheet.rows[0]).toMatchObject({ player: '2.4 м/с', reference: '3.2 м/с' });
    expect(sheet.rows[3].reference).toBe('итог ↑ 5.7');
    expect(sheet.mainError).toEqual({ label: 'ВЕТЕР: СКОРОСТЬ · ПОКАЗАНИЯ', phrase: 'Станция показала 3.2 м/с, ты ввёл 2.4' });
    expect(sheet.others).toBe('ещё 1 · Учтённые факторы');
    expect(sheet.subtitle).toBe('Ветер: скорость 4 кл. · Учтённые факторы 3 кл.');
    expect(sheet.pointsText).toBe('+0 за расчёт · ×1');
  });

  it('a turret error label does not repeat the type', () => {
    const notebook = toggleFactor(enterWind(notebookAt(300, 'auto'), 0, 12), 'conditions');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 12, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }), 'auto');
    expect(sheet.mainError).toEqual({ label: 'БАРАБАН ВЕРТ', phrase: 'В блокноте ↑ 1.6, на барабане ↑ 0.0: 16 кл.' });
  });

  it('exact preparation: the short subtitle and the dialled line', () => {
    const notebook = toggleFactor(enterWind(notebookAt(300, 'auto'), 0, 12), 'conditions');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 12, dialedElevationClicks: 16, dialedWindageLeftClicks: 0 }), 'auto');
    expect(sheet.stamp).toBe('ТОЧНО');
    expect(sheet.subtitle).toBe('Показания, факторы и барабаны совпали');
    expect(sheet.dialed).toBe('↑ 1.6');
  });
});

describe('target plaques', () => {
  it('01 after two targets: 10, 5, the current one', () => {
    const records = [record({ targetIndex: 0 }), record({ targetIndex: 1, isHit: false }), record({ targetIndex: 1 })];
    expect(targetPlaques(exerciseById('01')!, records, { stageIndex: 0, targetIndex: 2 }, false)).toEqual(['1 · 10', '2 · 5', '3 · сейчас']);
  });

  it('a target missed twice is ✕; a future one is a dot; 02 counts hits', () => {
    const records = [record({ isHit: false }), record({ isHit: false })];
    expect(targetPlaques(exerciseById('01')!, records, { stageIndex: 0, targetIndex: 1 }, false)).toEqual(['1 · ✕', '2 · сейчас', '3 · ·']);
    expect(targetPlaques(exerciseById('02')!, [record({}), record({ isHit: false })], { stageIndex: 0, targetIndex: 0 }, false)).toEqual(['1 · 1 из 2']);
  });
});

describe('DOPE notes (Б7)', () => {
  it('one note per cartridge and distance, the last wins', () => {
    let notes = withDopeNote({}, 'B', 300, 1.7);
    notes = withDopeNote(notes, 'B', 300, 1.8);
    notes = withDopeNote(notes, 'C', 300, 1.5);
    expect(notes).toEqual({ B: [{ distanceM: 300, elevationMil: 1.8 }], C: [{ distanceM: 300, elevationMil: 1.5 }] });
  });

  it('a note shows in its row; between rows in the nearest one with its distance', () => {
    const texts = dopeNoteTexts([{ distanceM: 300, elevationMil: 1.74 }, { distanceM: 450, elevationMil: 3.46 }], card);
    expect(texts.get(300)).toBe('↑ 1.7');
    expect(texts.get(500)).toBe('↑ 3.5 · 450 м');
    expect(texts.get(400)).toBeUndefined();
  });
});

function breakdownWith(vectors: Partial<Record<CauseKind, [number, number]>>): MissBreakdown {
  const zero: Correction = { upMrad: 0, rightMrad: 0 };
  return missBreakdown({
    ideal: zero,
    formulaTruth: vectors.formula ? { upMrad: vectors.formula[0], rightMrad: vectors.formula[1] } : zero,
    formulaPlayerWind: { upMrad: (vectors.formula?.[0] ?? 0) + (vectors.wind?.[0] ?? 0), rightMrad: (vectors.formula?.[1] ?? 0) + (vectors.wind?.[1] ?? 0) },
    dial: {
      upMrad: (vectors.formula?.[0] ?? 0) + (vectors.wind?.[0] ?? 0) + (vectors.calc?.[0] ?? 0),
      rightMrad: (vectors.formula?.[1] ?? 0) + (vectors.wind?.[1] ?? 0) + (vectors.calc?.[1] ?? 0),
    },
    plannedHold: zero,
    reticle: vectors.hold ? { upMrad: vectors.hold[0], rightMrad: vectors.hold[1] } : zero,
    triggerSpread: vectors.trigger ? { upMrad: vectors.trigger[0], rightMrad: vectors.trigger[1] } : zero,
    velocitySpread: vectors.rifle ? { upMrad: vectors.rifle[0], rightMrad: vectors.rifle[1] } : zero,
    rifleGroup: zero,
    coldBore: vectors['cold-bore'] ? { upMrad: vectors['cold-bore'][0], rightMrad: vectors['cold-bore'][1] } : zero,
    sightOffset: vectors.zero ? { upMrad: vectors.zero[0], rightMrad: vectors.zero[1] } : zero,
    hasKnockedSight: vectors.zero !== undefined,
    clickMil: 0.1,
  });
}

describe('directionArrow', () => {
  it('eight directions; nothing for no shift', () => {
    expect(directionArrow({ upMrad: 0.3, rightMrad: 0 })).toBe('↑');
    expect(directionArrow({ upMrad: 0.1, rightMrad: 0.1 })).toBe('↗');
    expect(directionArrow({ upMrad: 0, rightMrad: 0.2 })).toBe('→');
    expect(directionArrow({ upMrad: -0.2, rightMrad: 0.2 })).toBe('↘');
    expect(directionArrow({ upMrad: -0.4, rightMrad: 0.05 })).toBe('↓');
    expect(directionArrow({ upMrad: -0.2, rightMrad: -0.2 })).toBe('↙');
    expect(directionArrow({ upMrad: 0, rightMrad: -0.2 })).toBe('←');
    expect(directionArrow({ upMrad: 0.2, rightMrad: -0.2 })).toBe('↖');
    expect(directionArrow({ upMrad: 0, rightMrad: 0 })).toBe('');
  });
});

describe('causesView', () => {
  it('rows: player causes first, «чисто» at zero; grey from 1 click; the main one is marked', () => {
    const view = causesView(breakdownWith({ wind: [0, -0.3], 'cold-bore': [0.15, 0.05], formula: [0.02, 0] }));
    expect(view.rows.map(row => [row.name, row.text, row.isPlayerError, row.isMain])).toEqual([
      ['Расчёт', 'чисто', true, false],
      ['Оценка ветра', '← 3 кл.', true, true],
      ['Удержание', 'чисто', true, false],
      ['Спуск', 'чисто', true, false],
      ['Холодный ствол', '↑ 2 кл.', false, false],
    ]);
  });

  it('the bar width follows the clicks against the largest row', () => {
    const view = causesView(breakdownWith({ calc: [0.4, 0], hold: [0, 0.2] }));
    expect(view.rows.find(row => row.kind === 'calc')!.share).toBe(1);
    expect(view.rows.find(row => row.kind === 'hold')!.share).toBe(0.5);
    expect(view.rows.find(row => row.kind === 'trigger')!.share).toBe(0);
  });

  it('the conclusion names the main cause, then «спуск чистый» when the trigger was clean', () => {
    expect(causesView(breakdownWith({ formula: [0, 0.3], wind: [0, -0.1] })).conclusion).toBe('Недокрут по ветру 1 кл., спуск чистый');
    expect(causesView(breakdownWith({ wind: [0, 0.4] })).conclusion).toBe('Перекрут по ветру 4 кл., спуск чистый');
    expect(causesView(breakdownWith({ calc: [-0.4, 0] })).conclusion).toBe('Расчёт увёл пулю ↓ на 4 кл., спуск чистый');
    expect(causesView(breakdownWith({ hold: [0.2, 0.2] })).conclusion).toBe('Сетку увело ↗ на 3 кл., спуск чистый');
    expect(causesView(breakdownWith({ trigger: [-0.2, 0.2], hold: [0.1, 0] })).conclusion).toBe('Сорвал спуск: ↘ 3 кл.');
    expect(causesView(breakdownWith({ zero: [-0.6, -0.6] })).conclusion).toBe('Ноль прицела: СТП ↙ 8 кл., спуск чистый');
    expect(causesView(breakdownWith({ wind: [0, 0.3], trigger: [0.1, 0] })).conclusion).toBe('Перекрут по ветру 3 кл.');
  });

  it('no player error from a click: the rifle when grey causes show, otherwise clean', () => {
    expect(causesView(breakdownWith({ rifle: [0.2, 0] })).conclusion).toBe('Твоих ошибок нет — это разброс винтовки');
    expect(causesView(breakdownWith({})).conclusion).toBe('Чисто');
  });
});

describe('groupText', () => {
  const at = (upMrad: number, rightMrad: number): Correction => ({ upMrad, rightMrad });

  it('fewer than 3 shots — no diagnosis yet', () => {
    expect(groupText([at(0, 0), at(0.1, 0)])).toBe('Диагноз группы — от 3 выстрелов');
  });

  it('3 shots and more — the fundamentals by the group shape', () => {
    expect(groupText([at(0.3, 0), at(-0.3, 0.02), at(0, -0.02)])).toBe('Вертикальная струна — дыхание');
    expect(groupText([at(0, 0.3), at(0.02, -0.3), at(-0.02, 0)])).toBe('Горизонтальная струна — завал оружия');
    expect(groupText([at(1, 1), at(-1, -1), at(0.5, -0.8)])).toBe('Разброс — позиция, окуляр');
    expect(groupText([at(-0.3, 0.3), at(-0.32, 0.28), at(-0.28, 0.31)])).toBe('Низко-вправо — кисть, спуск');
    expect(groupText([at(0.4, 0), at(0.42, 0.02), at(0.38, -0.02)])).toBe('Плотная, но не в центре — ноль прицела');
    expect(groupText([at(0.05, 0), at(-0.03, 0.02), at(0, -0.04)])).toBe('Плотная группа — основы в порядке');
  });
});
