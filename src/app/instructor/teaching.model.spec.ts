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

  it('only 01–03 have a script', () => {
    expect(teachingScript('04')).toBeNull();
    expect(teachingScript('00')).toBeNull();
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
  const markup = ['../position/position.page.html', '../position/fire-control.component.ts', '../notebook/notebook-sheet.component.ts', '../notebook/total-tab.component.ts', '../review/review-sheet.component.ts']
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf-8'))
    .join('\n');

  it('each anchor of 01–03 is marked with data-hint', () => {
    const samples = [snapshot('02', { lastCorrection: { upClicks: 3, rightClicks: 0 } }), snapshot('02', { lastCorrection: { upClicks: 0, rightClicks: 3 } })];
    const anchors = new Set((['01', '02', '03'] as ExerciseId[]).flatMap(id => teachingScript(id)!.flatMap(step => samples.map(sample => step.anchor(sample)))));
    for (const anchor of [...anchors].filter(name => !name.startsWith('factor-'))) {
      expect(markup.includes(`data-hint="${anchor}"`), anchor).toBe(true);
    }
  });

  it('the factor rows and switches are marked for every factor', () => {
    expect(markup).toContain(`[attr.data-hint]="'factor-' + row.factor"`);
    expect(markup).toContain(`[attr.data-hint]="'toggle-' + row.factor"`);
  });
});
