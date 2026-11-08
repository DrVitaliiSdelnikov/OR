import { describe, expect, it } from 'vitest';
import { exerciseById, ExerciseId } from '../../sim/course';
import { NotebookTotal } from '../../sim/notebook';
import { scopeById } from '../../sim/scope-model';
import { boltHandlePosition, boltHeader, boltSteps, breathRing, correctionCells, drumCounter, endCard, markerTarget, playability, pressureText } from './position.model';

const scope = scopeById('course-tree');

function total(elevationClicks: number, windageLeftClicks: number, holdUpMil = 0, holdRightMil = 0): NotebookTotal {
  return {
    isEmpty: false,
    upMil: elevationClicks * 0.1 + holdUpMil,
    rightMil: -windageLeftClicks * 0.1 + holdRightMil,
    elevation: { targetClicks: elevationClicks, holdMil: holdUpMil },
    windageLeft: { targetClicks: windageLeftClicks, holdMil: -holdRightMil },
    holdUpMil,
    holdRightMil,
    leadMil: 0,
  };
}

describe('correction cells (Б4)', () => {
  it('shows what is dialled and the notebook target in brass until reached', () => {
    const cells = correctionCells(scope, { elevation: 8, windageLeft: 2 }, total(16, 6), 300);
    expect(cells).toEqual([
      { label: 'ВЕРТ', value: '↑ 0.8', target: '↑ 1.6', isOnTarget: false },
      { label: 'ГОР', value: '← 0.2 L', target: '← 0.6 L', isOnTarget: false },
      { label: 'ДИСТ', value: '300 м', target: null, isOnTarget: true },
    ]);
  });

  it('on target the value is plain, with no tail', () => {
    const cells = correctionCells(scope, { elevation: 16, windageLeft: 0 }, total(16, 0), 300);
    expect(cells[0]).toEqual({ label: 'ВЕРТ', value: '↑ 1.6', target: null, isOnTarget: true });
    expect(cells[1]).toEqual({ label: 'ГОР', value: '0.0', target: null, isOnTarget: true });
  });

  it('wind to the right reads → R', () => {
    expect(correctionCells(scope, { elevation: 0, windageLeft: -4 }, total(0, -4), 300)[1].value).toBe('→ 0.4 R');
  });

  it('an empty notebook shows → —', () => {
    const cells = correctionCells(scope, { elevation: 3, windageLeft: 0 }, null, 300);
    expect(cells[0]).toEqual({ label: 'ВЕРТ', value: '↑ 0.3', target: '—', isOnTarget: false });
  });

  it('the hold cell appears only when a turret ran out of travel', () => {
    expect(correctionCells(scope, { elevation: 0, windageLeft: 0 }, total(0, 0, -0.04, 0), 300)).toHaveLength(3);
    const cells = correctionCells(scope, { elevation: 0, windageLeft: 60 }, total(0, 60, -0.1, -0.5), 300);
    expect(cells[3]).toEqual({ label: 'УДЕРЖ.', value: '↓ 0.1 · ← 0.5 L', target: null, isOnTarget: true });
    expect(correctionCells(scope, { elevation: 0, windageLeft: 60 }, total(0, 60, 0, -0.5), 300)[3].label).toBe('УДЕРЖ.');
  });
});

describe('drum counter', () => {
  it('says how many clicks are left and which way', () => {
    expect(drumCounter('elevation', { remainingClicks: 8, direction: 'up', isOnTarget: false, overshootClicks: 0 })).toBe('ещё 8 кл. ↑');
    expect(drumCounter('elevation', { remainingClicks: 3, direction: 'down', isOnTarget: false, overshootClicks: 0 })).toBe('ещё 3 кл. ↓');
    expect(drumCounter('windage', { remainingClicks: 6, direction: 'up', isOnTarget: false, overshootClicks: 0 })).toBe('ещё 6 кл. ←');
    expect(drumCounter('windage', { remainingClicks: 6, direction: 'down', isOnTarget: false, overshootClicks: 0 })).toBe('ещё 6 кл. →');
  });

  it('overshooting says how many clicks are extra; on target says nothing', () => {
    expect(drumCounter('elevation', { remainingClicks: 2, direction: 'down', isOnTarget: false, overshootClicks: 2 })).toBe('лишние 2 кл.');
    expect(drumCounter('elevation', { remainingClicks: 0, direction: 'none', isOnTarget: true, overshootClicks: 0 })).toBe('');
  });
});

describe('end card', () => {
  it('an admitted exercise shows the class and the points', () => {
    expect(endCard({ targetPoints: [10, 10, 10], hitShare: 1, total: 30, exerciseClass: 1, isAdmitted: true })).toEqual({
      heading: 'Класс 1',
      points: '30 очк.',
      share: '100 %',
      isAdmitted: true,
    });
  });

  it('below 70 % it is not admitted', () => {
    expect(endCard({ targetPoints: [10, 0, 0], hitShare: 1 / 3, total: 10, exerciseClass: 0, isAdmitted: false }).heading).toBe('Не зачтено');
  });
});

describe('playability', () => {
  it('01, 02 and 03 are playable now', () => {
    expect(playability(exerciseById('01')!)).toEqual({ isPlayable: true, reason: null });
    expect(playability(exerciseById('02')!)).toEqual({ isPlayable: true, reason: null });
    expect(playability(exerciseById('03')!)).toEqual({ isPlayable: true, reason: null });
  });

  it('the rest say what is missing', () => {
    const reason = (id: ExerciseId) => playability(exerciseById(id)!).reason;
    expect(reason('04')).toBe('откроется позже: блокнот');
    expect(reason('11')).toBe('откроется позже: блокнот, движущиеся цели');
    expect(reason('00')).toBe('откроется позже: вводное');
    expect(playability(exerciseById('12')!).isPlayable).toBe(false);
  });
});

describe('fire controls (Б12)', () => {
  it('the pressure reads as a whole percent', () => {
    expect(pressureText(0.643)).toBe('64 %');
    expect(pressureText(0.646)).toBe('65 %');
    expect(pressureText(0)).toBe('0 %');
  });

  it('the finger offset on ОГОНЬ leads the marker one and a half times', () => {
    expect(markerTarget({ x: 10, y: -4 })).toEqual({ x: 15, y: -6 });
  });

  it('the air ring: holding 2.9 s leaves 5.1 s; at rest there is no ring; the exhale is empty and dimmed', () => {
    expect(breathRing('holding', 2.9)).toEqual({ share: 0.6375, secondsText: '5.1 с', isCooldown: false });
    expect(breathRing('free', 0)).toEqual({ share: 0, secondsText: '', isCooldown: false });
    expect(breathRing('cooldown', 0)).toEqual({ share: 0, secondsText: '', isCooldown: true });
    expect(breathRing('holding', 9).share).toBe(0);
  });
});

describe('bolt track (Затвор 1)', () => {
  it('labels the four strokes and marks the current one and the done ones', () => {
    expect(boltSteps('forward')).toEqual([
      { label: '1 ↑', isCurrent: false, isDone: true },
      { label: '2 ← НАЗАД', isCurrent: false, isDone: true },
      { label: '3 → ВПЕРЁД', isCurrent: true, isDone: false },
      { label: '4 ↓', isCurrent: false, isDone: false },
    ]);
    expect(boltHeader('back')).toBe('Затвор · шаг 2 из 4');
  });

  it('places the handle along the L: home, up, left, right, down', () => {
    expect(boltHandlePosition('up', 0)).toEqual({ x: 300, y: 110 });
    expect(boltHandlePosition('up', 1)).toEqual({ x: 300, y: 50 });
    expect(boltHandlePosition('back', 0.5)).toEqual({ x: 230, y: 50 });
    expect(boltHandlePosition('back', 1)).toEqual({ x: 160, y: 50 });
    expect(boltHandlePosition('forward', 1)).toEqual({ x: 300, y: 50 });
    expect(boltHandlePosition('down', 1)).toEqual({ x: 300, y: 110 });
  });
});
