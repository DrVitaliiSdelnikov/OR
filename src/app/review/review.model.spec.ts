import { beforeAll, describe, expect, it } from 'vitest';
import { checkManualSteps, checkPreparation } from '../../core/calc-check';
import { COURSE_RIFLE, courseLoadout } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { NotebookMode } from '../../core/exercise-scoring';
import { exerciseById, ExerciseShotRecord } from '../../sim/course';
import { CheckTruth, checkInputs, createNotebook, enterWind, measureRange, Notebook, placeChip, recordStation, recordStep, setSign, toggleFactor, typeTape } from '../../sim/notebook';
import { scopeById } from '../../sim/scope-model';
import { ShotCheck } from '../position/position-session';
import { GreyCauseKind, missBreakdown, MissBreakdown } from '../../sim/miss-breakdown';
import { CHAIN_ORDER, ChainLink, ChainLinkKind, ChainQuantity, ChainValue } from '../../sim/miss-chain';
import { roundToClicks } from '../../core/game-formulas';
import { Correction } from '../../core/types';
import { flightAxisTexts } from './review.model';
import { causesView, checkSheet, correctionText, diagnosisText, directionArrow, dopeNoteTexts, groupText, shotPointsText, targetPlaques, withDopeNote } from './review.model';

const scope = scopeById('course-dot');
let card: DopeCard;

beforeAll(async () => {
  card = await buildDopeCard(new BallisticsEngine(), courseLoadout('B'), 0.1);
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
    expect(diagnosisText('execution', { upMrad: 0.1, rightMrad: 0.4 })).toBe('Сетка ушла вправо на 0,4 — ошибка выполнения');
    expect(diagnosisText('execution', { upMrad: -0.6, rightMrad: 0.1 })).toBe('Сетка ушла вниз на 0,6 — ошибка выполнения');
    expect(diagnosisText('execution', { upMrad: 0, rightMrad: -1.2 }, true)).toBe('Упреждение назад: сетка позади цели — выноси по ходу');
    expect(diagnosisText('data', { upMrad: 0, rightMrad: 0 })).toBe('Сетка была на цели — ошибка в данных');
    expect(diagnosisText('clean', { upMrad: 0, rightMrad: 0 })).toBe('Чисто: сетка на цели, попадание');
  });

  it('the correction is for the turret, like a spotter calls it', () => {
    expect(correctionText({ upClicks: 0, rightClicks: -3 }, 'data')).toBe('Пуля правее на 0,3 → 3 кл. влево на барабане');
    expect(correctionText({ upClicks: 4, rightClicks: 2 }, 'data')).toBe('Пуля ниже на 0,4 → 4 кл. вверх на барабане · Пуля левее на 0,2 → 2 кл. вправо на барабане');
    expect(correctionText({ upClicks: 0, rightClicks: 0 }, 'execution')).toBe('Данные верны — повтори чисто');
    expect(correctionText({ upClicks: 0, rightClicks: 0 }, 'clean')).toBe('Поправка не нужна');
    expect(correctionText(null, 'data')).toBeNull();
  });

  it('an execution miss with a data error too does not say the data are right', () => {
    expect(diagnosisText('execution', { upMrad: -1.7, rightMrad: 0 }, false, true)).toBe('Сетка ушла вниз на 1,7 — ошибка выполнения и в данных');
    expect(correctionText({ upClicks: 25, rightClicks: 0 }, 'execution', true)).toBe('Пуля ниже на 2,5 → 25 кл. вверх на барабане');
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
    expect(sheet.rows[0]).toMatchObject({ label: 'Ветер', player: '← 1,4', reference: '← 0,7', diff: '7 кл.', status: 'error' });
    expect(sheet.mainError).toEqual({ label: 'ШАГ 1 · ПОДСТАНОВКА', phrase: 'В слот V⊥ поставлено 3,2, а нужно 1,6', term: 'САМ' });
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

  it('a click of ¼ MOA: the reference is shown to the click, not to a tenth', async () => {
    const moaCard = await buildDopeCard(new BallisticsEngine(), courseLoadout('B'), scopeById('moa').clickMrad);
    let notebook = enterWind(createNotebook({ card: moaCard, scope: scopeById('moa'), target: { sizeM: 0.5, distanceM: 200 }, hasZones: false, canTakeWindFromStation: false, seed: 3 }, 'manual-easy'), 3.5, 5);
    notebook = placeChip(placeChip(notebook, 'wind', 'crosswind'), 'wind', 'distance');
    notebook = recordStep(setSign(typeTape(notebook, 'wind', 2, 0.29), 'wind', 1), 'wind');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 5, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }), 'manual-easy');
    expect(sheet.rows[0].reference).toMatch(/^[←→] \d,\d\d$/);
    expect(checkSheet(windSheet('crosswind', 0.7), 'manual-hard').rows[0].reference).toBe('← 0,7');
  });

  it('a wrong milled distance is told in metres, not in MIL', () => {
    let notebook = measureRange(createNotebook({ card, scope, target: { sizeM: 1.5, distanceM: null }, hasZones: false, canTakeWindFromStation: false, seed: 3 }, 'manual-easy'), 3);
    notebook = placeChip(placeChip(notebook, 'distance', 'target-size'), 'distance', 'reticle-mil');
    notebook = recordStep(typeTape(notebook, 'distance', 0, 100), 'distance');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 12, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }), 'manual-easy');
    expect(sheet.mainError?.phrase).toBe('Формула и подстановка верны, но выходит 500 м, а у тебя 100 м');
  });

  it('a reversed side is СТОРОНА in the difference', () => {
    const sheet = checkSheet(windSheet('crosswind', 0.7, 1), 'manual-hard');
    expect(sheet.rows[0].diff).toBe('СТОРОНА');
    expect(sheet.mainError?.phrase).toBe('Число верное, сторона обратная: брать влево');
  });
});

describe('check sheet, the lead (В43)', () => {
  it('the lead has no side: both columns are plain numbers', () => {
    let notebook = createNotebook({ card, scope, target: { sizeM: 0.5, distanceM: 400, movement: { speedMps: 1.2, clock: 9 } }, hasZones: false, canTakeWindFromStation: false, seed: 3 }, 'manual-easy');
    for (const chip of ['target-crosswind', 'time-of-flight', 'distance'] as const) {
      notebook = placeChip(notebook, 'lead', chip);
    }
    notebook = recordStep(typeTape(notebook, 'lead', 2, 1.8), 'lead');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 9, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }), 'manual-easy');
    expect(sheet.rows.find(row => row.label === 'Упреждение')).toMatchObject({ player: '1,8', reference: '1,8' });
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
    expect(sheet.rows[0]).toMatchObject({ player: '2,4 м/с', reference: '3,2 м/с' });
    expect(sheet.rows[3].reference).toBe('итог ↑ 5,7');
    expect(sheet.mainError).toEqual({ label: 'ВЕТЕР: СКОРОСТЬ · ПОКАЗАНИЯ', phrase: 'Станция показала 3,2 м/с, ты ввёл 2,4', term: 'метеостанция' });
    expect(sheet.others).toBe('ещё 1 · Учтённые факторы');
    expect(sheet.subtitle).toBe('Ветер: скорость 4 кл. · Учтённые факторы 3 кл.');
    expect(sheet.pointsText).toBe('+0 за расчёт · ×1');
  });

  it('a turret error label does not repeat the type', () => {
    const notebook = toggleFactor(enterWind(notebookAt(300, 'auto'), 0, 12), 'conditions');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 12, dialedElevationClicks: 0, dialedWindageLeftClicks: 0 }), 'auto');
    expect(sheet.mainError).toEqual({ label: 'БАРАБАН ВЕРТ', phrase: 'В блокноте ↑ 1,6, на барабане ↑ 0,0: 16 кл.', term: 'барабан' });
  });

  it('wind not measured: the speed reference is the station at the shot, and the row is an error (QA 22.11)', () => {
    const notebook = toggleFactor(notebookAt(300, 'auto'), 'conditions');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 9, stationWindSpeedMps: 6, dialedElevationClicks: 16, dialedWindageLeftClicks: 0 }), 'auto');
    expect(sheet.rows.find(row => row.label === 'Ветер: скорость')).toMatchObject({ player: '—', reference: '6,0 м/с', status: 'error' });
    expect(sheet.stamp).toBe('ОШИБКА');
  });

  it('exact preparation: the short subtitle and the dialled line', () => {
    const notebook = toggleFactor(enterWind(notebookAt(300, 'auto'), 0, 12), 'conditions');
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 12, dialedElevationClicks: 16, dialedWindageLeftClicks: 0 }), 'auto');
    expect(sheet.stamp).toBe('ТОЧНО');
    expect(sheet.subtitle).toBe('Показания, факторы и барабаны совпали');
    expect(sheet.dialed).toBe('↑ 1,6');
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
    expect(texts.get(300)).toBe('↑ 1,7');
    expect(texts.get(500)).toBe('↑ 3,5 · 450 м');
    expect(texts.get(400)).toBeUndefined();
  });
});

type Vector = [number, number];
type LinkSpec = Vector | { vector: Vector; quantity: ChainQuantity; player: ChainValue; truth: ChainValue };
type ExecutionSpec = Partial<Record<'hold' | 'lead' | 'trigger' | 'zero' | GreyCauseKind, Vector>>;

const CLICK_MIL = 0.1;

function correction([upMrad, rightMrad]: Vector): Correction {
  return { upMrad, rightMrad };
}

// Звенья цепочки задаются прямо, барабан накручен по ним — как у `missChain`, сумма причин сходится.
function breakdownWith(execution: ExecutionSpec, links: Partial<Record<ChainLinkKind, LinkSpec>> = {}): MissBreakdown {
  const zero: Correction = { upMrad: 0, rightMrad: 0 };
  const chain: ChainLink[] = CHAIN_ORDER.map(kind => {
    const spec = links[kind];
    const values = spec && !Array.isArray(spec) ? spec : { vector: (spec as Vector | undefined) ?? [0, 0], quantity: 'mil-vector' as const, player: null, truth: null };
    const vector = correction(values.vector);
    return { kind, vector, clicks: Math.abs(roundToClicks(Math.hypot(vector.upMrad, vector.rightMrad), CLICK_MIL)), quantity: values.quantity, player: values.player, truth: values.truth };
  });
  const linkSum = chain.filter(link => link.kind !== 'lead').reduce((sum, link) => ({ upMrad: sum.upMrad + link.vector.upMrad, rightMrad: sum.rightMrad + link.vector.rightMrad }), zero);
  const formula = execution.formula ? correction(execution.formula) : zero;
  const trueWindMil = execution.zero ? 0 : 0.5;
  return missBreakdown({
    ideal: { upMrad: 0, rightMrad: trueWindMil },
    formulaTruth: { upMrad: formula.upMrad, rightMrad: formula.rightMrad + trueWindMil },
    dial: execution.zero ? zero : { upMrad: formula.upMrad + linkSum.upMrad, rightMrad: formula.rightMrad + trueWindMil + linkSum.rightMrad },
    plannedHold: zero,
    reticle: execution.hold ? correction(execution.hold) : zero,
    ...(execution.lead ? { targetMotion: { upMrad: 0, rightMrad: -execution.lead[1] } } : {}),
    triggerSpread: execution.trigger ? correction(execution.trigger) : zero,
    velocitySpread: execution.rifle ? correction(execution.rifle) : zero,
    rifleGroup: zero,
    coldBore: execution['cold-bore'] ? correction(execution['cold-bore']) : zero,
    sightOffset: execution.zero ? correction(execution.zero) : zero,
    hasKnockedSight: execution.zero !== undefined,
    clickMil: CLICK_MIL,
    chain,
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

describe('causesView: одна лестница (T2.2)', () => {
  const WIND_SPEED: LinkSpec = { vector: [0, -0.3], quantity: 'windSpeed', player: 2, truth: 4.1 };
  const DISTANCE: LinkSpec = { vector: [-0.5, 0], quantity: 'distance', player: 413, truth: 455 };

  it('звенья и исполнение вперемешку по убыванию; крупнейшая — главная; нулевые скрыты; удержание и спуск — всегда; серые — внизу', () => {
    const view = causesView(breakdownWith({ hold: [0.1, 0], 'cold-bore': [0.15, 0.05], formula: [0.02, 0] }, { 'wind-speed': WIND_SPEED, distance: DISTANCE, dope: [0.04, 0] }));
    expect(view.rows.map(row => [row.name, row.text, row.isPlayerError, row.isMain])).toEqual([
      ['Дальность', '↓ 5 кл.', true, true],
      ['Скорость ветра', '← 3 кл.', true, false],
      ['Удержание', '↑ 1 кл.', true, false],
      ['Спуск', 'чисто', true, false],
      ['Холодный ствол', '↑ 2 кл.', false, false],
    ]);
  });

  it('у звена — «было / надо» в единицах игрока, у исполнения — нет', () => {
    const view = causesView(breakdownWith({ hold: [0.1, 0] }, { 'wind-speed': WIND_SPEED, distance: DISTANCE }));
    expect(view.rows.map(row => row.values)).toEqual(['413 вместо 455 м', '2 вместо 4,1 м/с', null, null]);
    const imperial = causesView(breakdownWith({}, { 'wind-speed': WIND_SPEED, distance: DISTANCE }), 'imperial');
    expect(imperial.rows.map(row => row.values).slice(0, 2)).toEqual(['452 вместо 498 ярдов', '4,5 вместо 9,2 миль/ч']);
  });

  it('«было / надо» по видам величин', () => {
    const valuesOf = (kind: ChainLinkKind, spec: LinkSpec): string | null => causesView(breakdownWith({}, { [kind]: spec })).rows.find(row => row.kind === (kind === 'lead' ? 'lead-calc' : kind))!.values;
    expect(valuesOf('wind-clock', { vector: [0, 0.2], quantity: 'clock', player: 2, truth: 2.8 })).toBe('2 ч вместо 3 ч');
    expect(valuesOf('wind-clock', { vector: [0, 0.2], quantity: 'clock', player: 3, truth: 3.4 })).toBe('3 ч вместо 3:30');
    expect(valuesOf('zones', { vector: [0, 0.2], quantity: 'crosswinds', player: [1, 3, 1], truth: [1, 1, 1] })).toBe('1 · 3 · 1 вместо 1 · 1 · 1 м/с');
    expect(valuesOf('dope', { vector: [0.3, 0], quantity: 'mil', player: 3.8, truth: 3.5 })).toBe('↑ 3,8 вместо ↑ 3,5 MIL');
    expect(valuesOf('conditions', { vector: [-0.2, 0], quantity: 'mil', player: 0.1, truth: 0.3 })).toBe('↑ 0,1 вместо ↑ 0,3 MIL');
    expect(valuesOf('dope', { vector: [0.1, 0], quantity: 'mil', player: 3.84, truth: 3.76 })).toBe('↑ 3,84 вместо ↑ 3,76 MIL');
    expect(valuesOf('wind-calc', { vector: [0, 0.2], quantity: 'mil', player: -0.3, truth: -0.5 })).toBe('← 0,3 вместо ← 0,5 MIL');
    expect(valuesOf('lead', { vector: [0, -0.3], quantity: 'mil', player: 0.8, truth: 1.1 })).toBe('0,8 вместо 1,1 MIL');
    expect(valuesOf('earth', { vector: [0, -0.2], quantity: 'mil-vector', player: { upMrad: 0, rightMrad: 0.1 }, truth: { upMrad: 0.1, rightMrad: 0.3 } })).toBe('→ 0,1 вместо ↑ 0,1 · → 0,3 MIL');
    expect(valuesOf('turret', { vector: [0.2, 0], quantity: 'dial', player: { upMrad: 3.7, rightMrad: 0.2 }, truth: { upMrad: 3.5, rightMrad: 0.2 } })).toBe('накручено ↑ 37 вместо ↑ 35 кл.');
    expect(valuesOf('turret', { vector: [0, -0.2], quantity: 'dial', player: { upMrad: 3.5, rightMrad: -0.4 }, truth: { upMrad: 3.5, rightMrad: -0.2 } })).toBe('накручено ← 4 вместо ← 2 кл.');
  });

  it('новые строки: «Упреждение: расчёт» и «Упреждение сеткой» порознь', () => {
    const view = causesView(breakdownWith({ lead: [0, -0.6] }, { lead: { vector: [0, -0.3], quantity: 'mil', player: 0.8, truth: 1.1 } }));
    expect(view.rows.map(row => row.name)).toEqual(['Упреждение: расчёт', 'Упреждение сеткой', 'Удержание', 'Спуск']);
  });

  it('полоска — доля кликов от крупнейшей строки', () => {
    const view = causesView(breakdownWith({ hold: [0, 0.2] }, { distance: [0.4, 0] }));
    expect(view.rows.find(row => row.kind === 'distance')!.share).toBe(1);
    expect(view.rows.find(row => row.kind === 'hold')!.share).toBe(0.5);
    expect(view.rows.find(row => row.kind === 'trigger')!.share).toBe(0);
  });

  it('вывод называет крупнейшую причину с «было / надо», потом «спуск чистый»', () => {
    expect(causesView(breakdownWith({}, { 'wind-speed': WIND_SPEED })).conclusion).toBe('Скорость ветра: 2 вместо 4,1 м/с — ← 3 кл., спуск чистый');
    expect(causesView(breakdownWith({ trigger: [0.1, 0] }, { distance: DISTANCE })).conclusion).toBe('Дальность: 413 вместо 455 м — ↓ 5 кл.');
    expect(causesView(breakdownWith({ hold: [0.2, 0.2] })).conclusion).toBe('Сетку увело ↗ на 3 кл., спуск чистый');
    expect(causesView(breakdownWith({ trigger: [-0.2, 0.2], hold: [0.1, 0] })).conclusion).toBe('Сорвал спуск: ↘ 3 кл.');
    expect(causesView(breakdownWith({ zero: [-0.6, -0.6] })).conclusion).toBe('Ноль прицела: СТП ↙ 8 кл., спуск чистый');
    expect(causesView(breakdownWith({ lead: [0, -0.6] })).conclusion).toBe('Упреждение: пуля ← на 6 кл. от цели, спуск чистый');
  });

  it('нет твоих ошибок от клика: винтовка, если видны серые, иначе чисто', () => {
    expect(causesView(breakdownWith({ rifle: [0.2, 0] })).conclusion).toBe('Твоих ошибок нет — это разброс винтовки');
    expect(causesView(breakdownWith({})).conclusion).toBe('Чисто');
  });
});

describe('groupText', () => {
  const at = (upMrad: number, rightMrad: number): Correction => ({ upMrad, rightMrad });

  it('fewer than 3 shots — no diagnosis yet', () => {
    expect(groupText([at(0, 0), at(0.1, 0)], COURSE_RIFLE.groupSigmaMrad)).toBe('Диагноз группы — от 3 выстрелов');
  });

  it('3 shots and more — the fundamentals by the group shape', () => {
    expect(groupText([at(0.3, 0), at(-0.3, 0.02), at(0, -0.02)], COURSE_RIFLE.groupSigmaMrad)).toBe('Вертикальная струна — дыхание');
    expect(groupText([at(0, 0.3), at(0.02, -0.3), at(-0.02, 0)], COURSE_RIFLE.groupSigmaMrad)).toBe('Горизонтальная струна — завал оружия');
    expect(groupText([at(1, 1), at(-1, -1), at(0.5, -0.8)], COURSE_RIFLE.groupSigmaMrad)).toBe('Разброс — позиция, окуляр');
    expect(groupText([at(-0.3, 0.3), at(-0.32, 0.28), at(-0.28, 0.31)], COURSE_RIFLE.groupSigmaMrad)).toBe('Низко-вправо — кисть, спуск');
    expect(groupText([at(0.4, 0), at(0.42, 0.02), at(0.38, -0.02)], COURSE_RIFLE.groupSigmaMrad)).toBe('Плотная, но не в центре — ноль прицела');
    expect(groupText([at(0.05, 0), at(-0.03, 0.02), at(0, -0.04)], COURSE_RIFLE.groupSigmaMrad)).toBe('Плотная группа — основы в порядке');
  });
});

describe('разбор в имперских единицах (T1.8a)', () => {
  it('проверка АВТО: скорость станции и игрока в миль/ч; фраза без единицы у игрока', () => {
    let notebook = recordStation(notebookAt(600, 'auto'), { temperatureC: -5, pressureHpa: 1030, relativeHumidity: 0.5, windSpeedMps: 3.2, windClock: 9 }, 3, 0);
    notebook = enterWind(notebook, 2.4, 9);
    const sheet = checkSheet(snapshot(notebook, { trueWindClock: 9, dialedElevationClicks: 57, dialedWindageLeftClicks: 10 }), 'auto', 'imperial');
    expect(sheet.rows[0]).toMatchObject({ player: '5,4 миль/ч', reference: '7,2 миль/ч' });
    expect(sheet.mainError!.phrase).toBe('Станция показала 7,2 миль/ч, ты ввёл 5,4');
  });

  it('заметка «в ДОПЕ» между строками — с дистанцией в ярдах', () => {
    const texts = dopeNoteTexts([{ distanceM: 450, elevationMil: 3.46 }], card, 'imperial');
    expect(texts.get(500)).toBe('↑ 3,5 · 492 ярда');
  });

  it('траектория: ось в ярдах, масштаб в дюймах; метрика — метры и см', () => {
    expect(flightAxisTexts(600, 30, true, 'imperial')).toEqual({ start: '0 ярдов', end: '656 ярдов', scale: '↑ выше · 11,8 дюйма' });
    expect(flightAxisTexts(600, 30, false, 'metric')).toEqual({ start: '0 м', end: '600 м', scale: '↑ левее · 30 см' });
  });
});
