import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ExerciseId } from '../../sim/course';
import { InstructorSnapshot } from './instructor-snapshot';
import { forgottenFactorTeaching, isFactorGuarded, nextTeaching, teachingScript, TeachingView } from './teaching.model';

function snapshot(exerciseId: ExerciseId, fields: Partial<InstructorSnapshot> = {}): InstructorSnapshot {
  return {
    exerciseId,
    sheetTab: null,
    hasOpenedNotebook: false,
    isEntered: false,
    dopeMil: 1.6,
    elevation: null,
    windageTargetClicks: null,
    shotsFired: 0,
    isReviewOpen: false,
    isResultOpen: false,
    isBoltCycleDue: false,
    lastCorrection: null,
    turnedSinceShot: { upClicks: 0, rightClicks: 0 },
    aimOffMil: 1.1,
    isStationMeasured: false,
    stationSpeedMps: null,
    windSpeedMps: null,
    reticleMil: null,
    measuredDistanceM: null,
    targetSizeM: 0.5,
    recordedSteps: [],
    stageIndex: 0,
    isMagazineChangeDue: false,
    cartridgeLetter: 'Б',
    nextCartridgeLetter: null,
    isCallMarked: false,
    isDopeNoted: false,
    openCalcStep: null,
    flagsRead: 0,
    ...fields,
  };
}

function next(state: InstructorSnapshot, acknowledged: string[] = []): TeachingView | null {
  return nextTeaching(teachingScript(state.exerciseId)!, new Set(acknowledged), state);
}

function acknowledgeAll(id: ExerciseId): string[] {
  return teachingScript(id)!.filter(step => step.kind === 'explain').map(step => step.id);
}

describe('teaching — 01 in order', () => {
  it('starts on the glass, 1 of 8, then the notebook tile after «ПОНЯЛ»', () => {
    const first = next(snapshot('01'))!;
    expect([first.anchor, first.kind, first.number, first.count]).toEqual(['glass', 'explain', 1, 9]);
    const second = next(snapshot('01'), [first.id])!;
    expect([second.anchor, second.kind, second.number]).toEqual(['tile-notebook', 'action', 2]);
  });

  it('an action goes out when it is done: the sheet opened, the total entered, the drum on its mark', () => {
    const glass = next(snapshot('01'))!.id;
    const opened = next(snapshot('01', { hasOpenedNotebook: true, sheetTab: 'total' }), [glass])!;
    expect([opened.anchor, opened.number]).toEqual(['factor-dope', 3]);
    const enter = next(snapshot('01', { hasOpenedNotebook: true, sheetTab: 'total' }), [glass, opened.id])!;
    expect(enter.anchor).toBe('enter-turrets');
    const drum = next(snapshot('01', { hasOpenedNotebook: true, isEntered: true, elevation: { remainingClicks: 16, direction: 'up', isOnTarget: false, overshootClicks: 0 }, windageTargetClicks: 0 }), [glass, opened.id])!;
    expect([drum.anchor, drum.number]).toEqual(['drum-elevation', 5]);
    const onMark = next(snapshot('01', { hasOpenedNotebook: true, isEntered: true, elevation: { remainingClicks: 0, direction: 'none', isOnTarget: true, overshootClicks: 0 }, windageTargetClicks: 0 }), [glass, opened.id])!;
    expect([onMark.anchor, onMark.number]).toEqual(['drum-windage', 6]);
  });

  it('done before its turn: the notebook already open skips straight to DOPE', () => {
    const glass = next(snapshot('01'))!.id;
    expect(next(snapshot('01', { hasOpenedNotebook: true, sheetTab: 'total' }), [glass])!.number).toBe(3);
  });

  it('a step waits for its moment: DOPE needs the «Итог» tab, the review step needs the review', () => {
    const glass = next(snapshot('01'))!.id;
    expect(next(snapshot('01', { hasOpenedNotebook: true, sheetTab: 'wind' }), [glass])).toBeNull();
    const fired = snapshot('01', { hasOpenedNotebook: true, isEntered: true, shotsFired: 1 });
    expect(next(fired, acknowledgeAll('01').filter(id => id !== 'review'))).toBeNull();
    const review = next({ ...fired, isReviewOpen: true }, acknowledgeAll('01').filter(id => id !== 'review'))!;
    expect([review.anchor, review.kind, review.number]).toEqual(['review-next', 'explain', 9]);
  });

  it('a step not due yet holds the later ones back', () => {
    expect(next(snapshot('01', { hasOpenedNotebook: true, sheetTab: 'total' }))).toBeNull();
  });

  it('the side drum explanation is skipped when the side drum has clicks', () => {
    const state = snapshot('01', { hasOpenedNotebook: true, isEntered: true, elevation: { remainingClicks: 0, direction: 'none', isOnTarget: true, overshootClicks: 0 }, windageTargetClicks: 3 });
    expect(next(state, [next(snapshot('01'))!.id, 'dope'])!.anchor).toBe('glass');
    expect(next({ ...state, aimOffMil: 0.2 }, [next(snapshot('01'))!.id, 'dope'])!.anchor).toBe('fire-control');
  });

  it('after the last step and on the result sheet — nothing', () => {
    const done = snapshot('01', { hasOpenedNotebook: true, isEntered: true, shotsFired: 1 });
    expect(next(done, acknowledgeAll('01'))).toBeNull();
    expect(next(snapshot('01', { isResultOpen: true }))).toBeNull();
  });
});

describe('teaching — numbers come from the calculation', () => {
  it('01: DOPE and the clicks left are read from the snapshot', () => {
    const glass = next(snapshot('01'))!.id;
    expect(next(snapshot('01', { hasOpenedNotebook: true, sheetTab: 'total' }), [glass])!.text).toBe('ДОПЕ — падение пули: ↑ 1.6 MIL');
    expect(next(snapshot('01', { hasOpenedNotebook: true, sheetTab: 'total', dopeMil: 2.3 }), [glass])!.text).toBe('ДОПЕ — падение пули: ↑ 2.3 MIL');
    const drum = (remaining: number, direction: 'up' | 'down') =>
      next(snapshot('01', { hasOpenedNotebook: true, isEntered: true, elevation: { remainingClicks: remaining, direction, isOnTarget: false, overshootClicks: 0 } }), [glass, 'dope'])!.text;
    expect(drum(16, 'up')).toBe('Крути вверх: ещё 16 кл.');
    expect(drum(2, 'down')).toBe('Крути вниз: ещё 2 кл.');
  });

  it('02: the correction minus what is already dialled; the larger axis gets the cut-out', () => {
    const afterFour = snapshot('02', { shotsFired: 4, lastCorrection: { upClicks: 3, rightClicks: -1 } });
    const drum = next(afterFour, acknowledgeAll('02'))!;
    expect([drum.anchor, drum.text, drum.number, drum.count]).toEqual(['drum-elevation', 'Крути вверх: ещё 3 кл.', 6, 7]);
    expect(next({ ...afterFour, turnedSinceShot: { upClicks: 1, rightClicks: 0 } }, acknowledgeAll('02'))!.text).toBe('Крути вверх: ещё 2 кл.');
    const side = next({ ...afterFour, lastCorrection: { upClicks: 1, rightClicks: -4 } }, acknowledgeAll('02'))!;
    expect([side.anchor, side.text]).toEqual(['drum-windage', 'Крути влево: ещё 4 кл.']);
    const reaim = next({ ...afterFour, turnedSinceShot: { upClicks: 3, rightClicks: 0 } }, acknowledgeAll('02'))!;
    expect([reaim.anchor, reaim.text, reaim.number]).toEqual(['glass', 'Барабан сдвинул картинку — наведи снова в центр', 7]);
    expect(next({ ...afterFour, turnedSinceShot: { upClicks: 3, rightClicks: 0 }, aimOffMil: 0.1 }, acknowledgeAll('02'))).toBeNull();
  });
});

describe('teaching — aiming before the shot', () => {
  const ready = (fields: Partial<InstructorSnapshot> = {}) => snapshot('01', { hasOpenedNotebook: true, isEntered: true, elevation: { remainingClicks: 0, direction: 'none', isOnTarget: true, overshootClicks: 0 }, windageTargetClicks: 0, ...fields });

  it('after the drums: aim at the gong on the glass, then fire', () => {
    const aim = next(ready(), acknowledgeAll('01'))!;
    expect([aim.anchor, aim.kind, aim.number]).toEqual(['glass', 'action', 7]);
    expect(next(ready({ aimOffMil: 0.3 }), acknowledgeAll('01'))!.anchor).toBe('fire-control');
    expect(next(ready({ aimOffMil: 0.31 }), acknowledgeAll('01'))!.anchor).toBe('glass');
  });

  it('02 aims at the centre of the paper', () => {
    expect(next(snapshot('02'), ['zero'])!.text).toBe('Наведи перекрестие в центр мишени');
    expect(next(snapshot('02', { aimOffMil: 0 }), ['zero'])!.text).toBe('Первый — холодный. Огонь');
  });
});

describe('teaching — 04 wind and the station', () => {
  it('wind tile → «Условия» → «Замер» → «Ветер» → the clock, in order', () => {
    expect(next(snapshot('04'))!.anchor).toBe('wind-tile');
    const opened = snapshot('04', { hasOpenedNotebook: true, sheetTab: 'total' });
    expect([next(opened)!.anchor, next(opened)!.number, next(opened)!.count]).toEqual(['tab-conditions', 2, 5]);
    expect(next({ ...opened, sheetTab: 'conditions' })!.anchor).toBe('measure');
    const measured = { ...opened, sheetTab: 'conditions' as const, isStationMeasured: true, stationSpeedMps: 3.2 };
    expect(next(measured)!.anchor).toBe('tab-wind');
    expect(next({ ...measured, sheetTab: 'wind' })!.anchor).toBe('wind-clock');
  });

  it('measured before the hint — straight to «Ветер»; the clock hint shows the station speed', () => {
    const measured = snapshot('04', { hasOpenedNotebook: true, sheetTab: 'total', isStationMeasured: true, stationSpeedMps: 3.2 });
    expect(next(measured)!.anchor).toBe('tab-wind');
    expect(next({ ...measured, sheetTab: 'wind' })!.text).toBe('Стрелка — откуда дует, по флажку у бруствера. Скорость — 3.2, со станции');
    expect(next({ ...measured, sheetTab: 'wind', stationSpeedMps: 2.4 })!.text).toContain('Скорость — 2.4');
  });

  it('a tab hint waits for the sheet; the wind written with its speed ends the script', () => {
    expect(next(snapshot('04', { hasOpenedNotebook: true }))).toBeNull();
    expect(next(snapshot('04', { hasOpenedNotebook: true, sheetTab: 'wind', isStationMeasured: true, windSpeedMps: 0 }))!.anchor).toBe('wind-clock');
    expect(next(snapshot('04', { hasOpenedNotebook: true, sheetTab: 'wind', isStationMeasured: true, windSpeedMps: 3.2 }))).toBeNull();
  });
});

describe('teaching — 05 milling', () => {
  it('notebook → «Дистанция» → two touches on the gong → the formula with the numbers', () => {
    expect(next(snapshot('05'))!.anchor).toBe('tile-notebook');
    expect(next(snapshot('05', { hasOpenedNotebook: true, sheetTab: 'total' }))!.anchor).toBe('tab-distance');
    const onTab = snapshot('05', { hasOpenedNotebook: true, sheetTab: 'distance' });
    expect([next(onTab)!.anchor, next(onTab)!.text]).toEqual(['milling', 'Гонг 0,5 м. Коснись верхнего и нижнего края, затем «Посчитать»']);
    const counted = { ...onTab, reticleMil: 1.62, measuredDistanceM: 308.6 };
    expect([next(counted)!.anchor, next(counted)!.text, next(counted)!.kind]).toEqual(['milling-result', 'Д = 0,5 × 1000 / 1.62 = 309 м', 'explain']);
    expect(next(counted, ['result'])).toBeNull();
    const small = { ...counted, targetSizeM: 0.35, reticleMil: 1.17, measuredDistanceM: 299.1 };
    expect(next({ ...onTab, targetSizeM: 0.35 })!.text).toBe('Гонг 0,35 м. Коснись верхнего и нижнего края, затем «Посчитать»');
    expect(next(small)!.text).toBe('Д = 0,35 × 1000 / 1.17 = 299 м');
  });
});

describe('teaching — 06 SAM', () => {
  it('wind first, then the wind step, chips, tape; nothing blocks the sheet while it is filled; the recorded step ends it', () => {
    expect(next(snapshot('06'))!.anchor).toBe('tile-notebook');
    const open = snapshot('06', { hasOpenedNotebook: true, sheetTab: 'total' });
    expect([next(open)!.anchor, next(open)!.count, next(open)!.kind]).toEqual(['tab-wind', 5, 'explain']);
    expect(next({ ...open, windSpeedMps: 3.1 })).toBeNull();
    expect(next({ ...open, windSpeedMps: 3.1, sheetTab: 'wind' })!.anchor).toBe('wind-step-link');
    expect(next({ ...open, sheetTab: 'wind' }, ['wind-first'])).toBeNull();
    const stepOpen = { ...open, windSpeedMps: 3.1, openCalcStep: 'wind' as const };
    expect(next(stepOpen)!.anchor).toBe('calc-formula');
    expect(next(stepOpen, ['chips'])!.anchor).toBe('calc-tape');
    expect(next(stepOpen, ['chips', 'tape'])).toBeNull();
    expect(next({ ...open, openCalcStep: 'distance' as const }, ['wind-first'])).toBeNull();
    expect(next({ ...open, recordedSteps: ['wind'] })).toBeNull();
  });
});

describe('teaching — 09 flags along the range', () => {
  it('flags in the glass, the tap, the zone weights on the WIND tab, the zones step; 4 hints', () => {
    const start = next(snapshot('09'))!;
    expect([start.anchor, start.kind, start.count]).toEqual(['glass', 'explain', 4]);
    expect(start.text).toBe('Ветер по трассе разный. Флажки на 200, 400, 600 м — левее цели, веди прицел к ним');
    const tap = next(snapshot('09'), ['flags'])!;
    expect([tap.anchor, tap.kind, tap.text]).toEqual(['glass', 'action', 'Тапни флажок — угол и скорость запишутся в блокнот']);
    const read = snapshot('09', { flagsRead: 1 });
    expect(next(read)).toBeNull();
    const windTab = next({ ...read, hasOpenedNotebook: true, sheetTab: 'wind' })!;
    expect([windTab.anchor, windTab.number]).toEqual(['zone-weights', 3]);
    const zonesStep = next({ ...read, hasOpenedNotebook: true, sheetTab: 'total', openCalcStep: 'zones' }, ['weights'])!;
    expect([zonesStep.anchor, zonesStep.text]).toEqual(['calc-formula', 'Средний ветер — сумма: вес × V⊥ зоны. Станция — с вкладки «Ветер», флажки — из стекла']);
    expect(next({ ...read, recordedSteps: ['zones'] })).toBeNull();
    expect(next(snapshot('09', { shotsFired: 1 }))).toBeNull();
  });
});

describe('teaching — 08 cartridge change', () => {
  it('waits for the empty magazine, names the next cartridge, then its own card', () => {
    expect(next(snapshot('08', { shotsFired: 1 }))).toBeNull();
    const empty = snapshot('08', { shotsFired: 2, isMagazineChangeDue: true, nextCartridgeLetter: 'В' });
    expect([next(empty)!.anchor, next(empty)!.text]).toEqual(['change-magazine', 'Магазин пуст. Дальше — патрон В']);
    const changed = snapshot('08', { shotsFired: 2, stageIndex: 1, cartridgeLetter: 'В' });
    expect([next(changed)!.anchor, next(changed)!.text]).toEqual(['tile-dope', 'У патрона В своя карточка ДОПЕ — пересчитай']);
    expect(next(changed, ['card'])).toBeNull();
  });
});

describe('teaching — 10 call and pencil', () => {
  it('traps first; the call waits for the review; «в ДОПЕ» after the call, gone once noted', () => {
    expect(next(snapshot('10', { hasOpenedNotebook: true, sheetTab: 'total' }))!.anchor).toBe('manual-mode');
    const review = snapshot('10', { shotsFired: 1, isReviewOpen: true });
    expect(next(review, ['traps'])!.anchor).toBe('call-pick');
    expect(next({ ...review, isCallMarked: true }, ['traps'])!.anchor).toBe('review-dope');
    expect(next({ ...review, isCallMarked: true, isDopeNoted: true }, ['traps'])).toBeNull();
    expect(next(snapshot('10', { shotsFired: 1 }), ['traps'])).toBeNull();
    expect(next(snapshot('10'), ['traps'])).toBeNull();
  });
});

describe('teaching — 02 and 03 moments', () => {
  it('02: the correction in the 4th review; skipped with no correction', () => {
    const review = snapshot('02', { shotsFired: 4, isReviewOpen: true, lastCorrection: { upClicks: 2, rightClicks: 0 } });
    const before = acknowledgeAll('02').filter(id => id !== 'correction');
    expect(next(review, before)!.anchor).toBe('review-correction');
    expect(next({ ...review, lastCorrection: { upClicks: 0, rightClicks: 0 }, aimOffMil: 0.1 }, before)).toBeNull();
    expect(next(snapshot('02', { shotsFired: 2, isReviewOpen: true, lastCorrection: { upClicks: 2, rightClicks: 0 } }), before)).toBeNull();
  });

  it('02: the group explanation comes after the first review, not during it', () => {
    const ack = ['zero'];
    expect(next(snapshot('02', { shotsFired: 1, isReviewOpen: true }), ack)).toBeNull();
    expect(next(snapshot('02', { shotsFired: 1 }), ack)!.text).toBe('Ещё три в одну точку — группа');
  });

  it('03: breathing first, the bolt after the review, «дыши между» before the second shot', () => {
    expect(next(snapshot('03'))!.text).toBe('Задержи дыхание — метка дрожит меньше. Окно 5 с');
    expect(next(snapshot('03'), ['breath'])!.text).toBe('Поправка — как в 01: открой блокнот');
    const dialled = { hasOpenedNotebook: true, isEntered: true, elevation: { remainingClicks: 0, direction: 'none' as const, isOnTarget: true, overshootClicks: 0 } };
    expect(next(snapshot('03', dialled), ['breath'])!.text).toBe('Наведи перекрестие на гонг: тяни картинку');
    expect(next(snapshot('03', { ...dialled, aimOffMil: 0.2 }), ['breath'])!.anchor).toBe('fire-control');
    const fired = snapshot('03', { shotsFired: 1, isBoltCycleDue: true });
    expect(next({ ...fired, isReviewOpen: true }, ['breath'])).toBeNull();
    expect(next(fired, ['breath'])!.anchor).toBe('bolt-track');
    const cycled = next({ ...fired, isBoltCycleDue: false }, ['breath'])!;
    expect([cycled.anchor, cycled.number, cycled.count]).toEqual(['hold', 8, 8]);
    expect(next({ ...fired, isBoltCycleDue: false, shotsFired: 2 }, ['breath'])).toBeNull();
  });

  it('scripts: 01–06, 08–10; none for 00, 07, 11, 12', () => {
    expect((['01', '02', '03', '04', '05', '06', '08', '09', '10'] as ExerciseId[]).every(id => teachingScript(id) !== null)).toBe(true);
    expect((['00', '07', '11', '12'] as ExerciseId[]).map(teachingScript)).toEqual([null, null, null, null]);
  });
});

describe('forgotten factor', () => {
  it('guarded in 01–03 only', () => {
    expect((['01', '02', '03', '04', '12'] as ExerciseId[]).map(isFactorGuarded)).toEqual([true, true, true, false, false]);
  });

  it('a cut-out on the factor switch with its contribution', () => {
    const off = (mil: number, clicks: number) => ({ isOn: false, mil, clicks });
    expect(forgottenFactorTeaching('conditions', off(0.2, 2))).toEqual({ id: 'forgotten-conditions', kind: 'action', anchor: 'toggle-conditions', text: 'Учти УСЛОВИЯ: ↑ 2 кл.', number: null, count: null });
    expect(forgottenFactorTeaching('dope', off(1.6, 16)).text).toBe('Учти ДОПЕ: ↑ 16 кл.');
    expect(forgottenFactorTeaching('conditions', off(-0.3, -3)).text).toBe('Учти УСЛОВИЯ: ↓ 3 кл.');
  });
});

describe('every cut-out has its element', () => {
  const markup = [
    '../position/position.page.html',
    '../position/fire-control.component.ts',
    '../notebook/notebook-sheet.component.ts',
    '../notebook/total-tab.component.ts',
    '../review/review-sheet.component.ts',
    '../notebook/conditions-tab.component.ts',
    '../notebook/wind-clock.component.ts',
    '../notebook/distance-tab.component.ts',
    '../notebook/manual-hub.component.ts',
    '../notebook/chip-tray.component.ts',
    '../notebook/calc-sheet.component.ts',
    '../notebook/wind-tab.component.ts',
  ]
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf-8'))
    .join('\n');

  it('each anchor of 01–03 is marked with data-hint', () => {
    const samples = [snapshot('02', { lastCorrection: { upClicks: 3, rightClicks: 0 } }), snapshot('02', { lastCorrection: { upClicks: 0, rightClicks: 3 } })];
    const anchors = new Set((['01', '02', '03', '04', '05', '06', '08', '10'] as ExerciseId[]).flatMap(id => teachingScript(id)!.flatMap(step => samples.map(sample => step.anchor(sample)))));
    for (const anchor of [...anchors].filter(name => !name.startsWith('factor-') && !name.startsWith('tab-') && !name.startsWith('step-'))) {
      expect(markup.includes(`data-hint="${anchor}"`), anchor).toBe(true);
    }
  });

  it('the factor rows and switches are marked for every factor', () => {
    expect(markup).toContain(`[attr.data-hint]="'factor-' + row.factor"`);
    expect(markup).toContain(`[attr.data-hint]="'toggle-' + row.factor"`);
    expect(markup).toContain(`[attr.data-hint]="'tab-' + item.id"`);
    expect(markup).toContain(`[attr.data-hint]="'step-' + row.step"`);
  });
});
