import { describe, expect, it } from 'vitest';
import { DopeCard, DopeRow } from '../../core/dope-card';
import { NotebookTotal } from '../../sim/notebook';
import { scopeById } from '../../sim/scope-model';
import { subtitleText, windTileText } from './position.model';
import { boltHandlePosition, boltHeader, boltSteps, breathRing, correctionCells, dopeTileText, drumCounter, flagReadingText, geometryLineText, isGlassTap, patrolLineText, markerTarget, NOTEBOOK_SHEET_MIN_HEIGHT_PT, notebookSheetTopPt, pressureText } from './position.model';

const scope = scopeById('course-tree');

function total(elevationClicks: number, windageLeftClicks: number, holdUpMil = 0, holdRightMil = 0, leadMil = 0): NotebookTotal {
  return {
    isEmpty: false,
    upMil: elevationClicks * 0.1 + holdUpMil,
    rightMil: -windageLeftClicks * 0.1 + holdRightMil,
    elevation: { targetClicks: elevationClicks, holdMil: holdUpMil },
    windageLeft: { targetClicks: windageLeftClicks, holdMil: -holdRightMil },
    holdUpMil,
    holdRightMil,
    leadMil,
  };
}

describe('correction cells (Б4)', () => {
  it('shows what is dialled and the notebook target in brass until reached', () => {
    const cells = correctionCells(scope, { elevation: 8, windageLeft: 2 }, total(16, 6), 300);
    expect(cells).toEqual([
      { label: 'ВЕРТ', value: '↑ 0,8', target: '↑ 1,6', isOnTarget: false },
      { label: 'ГОР', value: '← 0,2 L', target: '← 0,6 L', isOnTarget: false },
      { label: 'ДИСТ', value: '300 м', target: null, isOnTarget: true },
    ]);
  });

  it('on target the value is plain, with no tail', () => {
    const cells = correctionCells(scope, { elevation: 16, windageLeft: 0 }, total(16, 0), 300);
    expect(cells[0]).toEqual({ label: 'ВЕРТ', value: '↑ 1,6', target: null, isOnTarget: true });
    expect(cells[1]).toEqual({ label: 'ГОР', value: '0,0', target: null, isOnTarget: true });
  });

  it('MOA scope: the turret cells say MOA; the course MIL scope stays as is (QA 22.11)', () => {
    const moa = scopeById('moa');
    const labels = correctionCells(moa, { elevation: 0, windageLeft: 0 }, null, 300).map(cell => cell.label);
    expect(labels).toEqual(['ВЕРТ · MOA', 'ГОР · MOA', 'ДИСТ']);
    expect(correctionCells(scope, { elevation: 0, windageLeft: 0 }, null, 300).map(cell => cell.label)).toEqual(['ВЕРТ', 'ГОР', 'ДИСТ']);
  });

  it('wind to the right reads → R', () => {
    expect(correctionCells(scope, { elevation: 0, windageLeft: -4 }, total(0, -4), 300)[1].value).toBe('→ 0,4 R');
  });

  it('an empty notebook shows → —', () => {
    const cells = correctionCells(scope, { elevation: 3, windageLeft: 0 }, null, 300);
    expect(cells[0]).toEqual({ label: 'ВЕРТ', value: '↑ 0,3', target: '—', isOnTarget: false });
  });

  it('В43: the hold cell takes the lead side from where the target walks now', () => {
    const walking = total(0, 0, 0, 0, 0.9);
    expect(correctionCells(scope, { elevation: 0, windageLeft: 0 }, walking, 400, 1)[3].value).toMatch(/→ 0,9 R$/);
    expect(correctionCells(scope, { elevation: 0, windageLeft: 0 }, walking, 400, -1)[3].value).toMatch(/← 0,9 L$/);
  });

  it('the hold cell appears only when a turret ran out of travel', () => {
    expect(correctionCells(scope, { elevation: 0, windageLeft: 0 }, total(0, 0, -0.04, 0), 300)).toHaveLength(3);
    const cells = correctionCells(scope, { elevation: 0, windageLeft: 60 }, total(0, 60, -0.1, -0.5), 300);
    expect(cells[3]).toEqual({ label: 'УДЕРЖ.', value: '↓ 0,1 · ← 0,5 L', target: null, isOnTarget: true });
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
    expect(breathRing('holding', 2.9)).toEqual({ share: 0.6375, secondsText: '5,1 с', isCooldown: false });
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

describe('notebook sheet on a short screen (iPhone Safari)', () => {
  it('opens under the crosshair while it leaves the sheet its minimum height', () => {
    expect(notebookSheetTopPt(358, 844)).toBe(358);
    expect(844 - notebookSheetTopPt(358, 844)).toBeGreaterThan(NOTEBOOK_SHEET_MIN_HEIGHT_PT);
  });

  it('rises above the crosshair when the screen is too short for the minimum height', () => {
    expect(notebookSheetTopPt(358, 664)).toBe(664 - NOTEBOOK_SHEET_MIN_HEIGHT_PT);
    expect(NOTEBOOK_SHEET_MIN_HEIGHT_PT).toBe(360);
  });
});

describe('reading a flag in the glass (A9.3a)', () => {
  it('a tap is a touch that barely moves and lets go quickly; anything else is aiming', () => {
    expect(isGlassTap({ x: 0, y: 0 }, { x: 6, y: 6 }, 200)).toBe(true);
    expect(isGlassTap({ x: 0, y: 0 }, { x: 12, y: 0 }, 100)).toBe(false);
    expect(isGlassTap({ x: 0, y: 0 }, { x: 0, y: 0 }, 400)).toBe(false);
  });

  it('the plate says distance, angle, speed and where the wind comes from', () => {
    expect(flagReadingText(400, { angleDeg: 35, crosswindMps: 3.9, isAtLimit: false })).toBe('400 м · 35° · 3,9 м/с слева');
    expect(flagReadingText(200, { angleDeg: 20, crosswindMps: -2.2, isAtLimit: false })).toBe('200 м · 20° · 2,2 м/с справа');
    expect(flagReadingText(600, { angleDeg: 80, crosswindMps: 8.9, isAtLimit: true })).toBe('600 м · 80° · ≥ 8,9 м/с слева');
    expect(flagReadingText(200, { angleDeg: 0, crosswindMps: 0, isAtLimit: false })).toBe('200 м · 0° · штиль');
  });
});

describe('the patrol on the position (A9.3b)', () => {
  const crosswise = { speedMps: 1.1, movementClock: 3, startOffsetM: -8.8, halfWidthM: 8.8 };

  it('U7: speed, heading and where it walks now; the arrow flips after the turn', () => {
    expect(patrolLineText({ path: crosswise, isAmbush: false }, 0)).toBe('1,1 м/с · поперёк →');
    expect(patrolLineText({ path: crosswise, isAmbush: false }, 17)).toBe('1,1 м/с · поперёк ←');
    expect(patrolLineText({ path: { ...crosswise, movementClock: 1.5, startOffsetM: -5, halfWidthM: 5 }, isAmbush: false }, 0)).toBe('1,1 м/с · наискось ↗');
    expect(patrolLineText({ path: { ...crosswise, movementClock: 10.5, startOffsetM: 5, halfWidthM: 5 }, isAmbush: true }, 0)).toBe('1,1 м/с · наискось ↖ · засада');
  });

  it('the lead is held with the reticle: it joins the УДЕРЖ. cell, the drum stays on the wind', () => {
    const withLead = { ...total(16, 6), leadMil: 1.8 };
    const cells = correctionCells(scope, { elevation: 16, windageLeft: 6 }, withLead, 400, 1);
    expect(cells[1].target).toBeNull();
    expect(cells[3]).toEqual({ label: 'УДЕРЖ.', value: '↑ 0,0 · → 1,8 R', target: null, isOnTarget: true });
  });
});


describe('DOPE tile rounds like the calculation check (T0.4a)', () => {
  const row = (distanceM: number, elevationMil: number): DopeRow =>
    ({ distanceM, elevationMil, clicks: 0, timeOfFlightS: 0, windConstant: 0, colderStepMil: 0, pressureStepMil: 0, zoneWeights: [1, 0, 0, 0], spinDriftMil: 0 });
  const card: DopeCard = { cartridgeId: 'B', cartridgeName: 'Патрон Б', zeroM: 100, clickMil: 0.1, zeroAngleMil: 0, rows: [row(400, 2.8), row(500, 4.1)] };

  it('an interpolated 3,45 reads as the nearest click 3,5, not 3,4', () => {
    expect(dopeTileText(card, 450)).toBe('ДОПЕ · 450 м ↑ 3,5');
  });

  it('a printed row reads as printed', () => {
    expect(dopeTileText(card, 400)).toBe('ДОПЕ · 400 м ↑ 2,8');
  });

  it('with an MOA scope the tile says the card is in MIL (QA 22.11)', () => {
    expect(dopeTileText(card, 400, 'metric', scopeById('moa'))).toBe('ДОПЕ · 400 м ↑ 2,8 MIL');
    expect(dopeTileText(card, 400, 'metric', scope)).toBe('ДОПЕ · 400 м ↑ 2,8');
  });
});

describe('строка условий (T1.4b)', () => {
  it('только заданные части: угол со знаком, широта с полушарием, азимут', () => {
    expect(geometryLineText({ lookAngleDeg: 0, coriolis: null, isSpinDriftOn: false })).toBeNull();
    expect(geometryLineText({ lookAngleDeg: 15, coriolis: null, isSpinDriftOn: false })).toBe('∠ +15°');
    expect(geometryLineText({ lookAngleDeg: -20, coriolis: null, isSpinDriftOn: true })).toBe('∠ −20°');
    expect(geometryLineText({ lookAngleDeg: 0, coriolis: { latitudeDeg: 55, azimuthDeg: 120 }, isSpinDriftOn: true })).toBe('55° с. ш. · аз. 120°');
    expect(geometryLineText({ lookAngleDeg: 10, coriolis: { latitudeDeg: -40, azimuthDeg: 0 }, isSpinDriftOn: false })).toBe('∠ +10° · 40° ю. ш. · аз. 0°');
  });

  it('одна деривация строки не даёт: её видно в блокноте', () => {
    expect(geometryLineText({ lookAngleDeg: 0, coriolis: null, isSpinDriftOn: true })).toBeNull();
  });
});

describe('позиция в имперских единицах (T1.8a)', () => {
  const crosswise = { speedMps: 1.1, movementClock: 3, startOffsetM: -8.8, halfWidthM: 8.8 };
  const row = (distanceM: number, elevationMil: number): DopeRow =>
    ({ distanceM, elevationMil, clicks: 0, timeOfFlightS: 0, windConstant: 0, colderStepMil: 0, pressureStepMil: 0, zoneWeights: [1, 0, 0, 0], spinDriftMil: 0 });
  const card: DopeCard = { cartridgeId: 'B', cartridgeName: 'Патрон Б', zeroM: 100, clickMil: 0.1, zeroAngleMil: 0, rows: [row(400, 2.8), row(500, 4.1)] };

  it('ДИСТ — ярды; MIL на барабанах не меняются', () => {
    const cells = correctionCells(scope, { elevation: 8, windageLeft: 2 }, total(16, 6), 300, 0, 'imperial');
    expect(cells.map(cell => cell.value)).toEqual(['↑ 0,8', '← 0,2 L', '328 ярдов']);
  });

  it('ДОПЕ-плитка — ярды', () => {
    expect(dopeTileText(card, 400, 'imperial')).toBe('ДОПЕ · 437 ярдов ↑ 2,8');
  });

  it('флажок — ярды и миль/ч', () => {
    expect(flagReadingText(400, { angleDeg: 35, crosswindMps: 3.9, isAtLimit: false }, 'imperial')).toBe('437 ярдов · 35° · 8,7 миль/ч слева');
    expect(flagReadingText(200, { angleDeg: 0, crosswindMps: 0, isAtLimit: false }, 'imperial')).toBe('219 ярдов · 0° · штиль');
  });

  it('дозор — миль/ч', () => {
    expect(patrolLineText({ path: crosswise, isAmbush: false }, 0, 'imperial')).toBe('2,5 миль/ч · поперёк →');
  });
});

describe('подзаголовок и ветер на плитке (T1.8a)', () => {
  it('метрика — как раньше; имперские — ярды и миль/ч', () => {
    expect(subtitleText(300, 1, 3, 'metric')).toBe('рубеж · 300 м · цель 1 / 3');
    expect(subtitleText(300, 1, 3, 'imperial')).toBe('рубеж · 328 ярдов · цель 1 / 3');
    expect(subtitleText(null, 2, 3, 'imperial')).toBe('рубеж · дистанция неизвестна · цель 2 / 3');
    expect(windTileText(2.5, 'metric')).toBe('2,5 м/с');
    expect(windTileText(2.5, 'imperial')).toBe('5,6 миль/ч');
  });
});
