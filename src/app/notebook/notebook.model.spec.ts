import { beforeAll, describe, expect, it } from 'vitest';
import { cartridgeById } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { ExerciseShotRecord } from '../../sim/course';
import { createNotebook, enterWind, factorContributions, hideFlagsBehindBerm, Notebook, readFlag, recordStation, total } from '../../sim/notebook';
import { scopeById } from '../../sim/scope-model';
import { clockFromDialAngle, clockShareLines, clockText, contributionText, correctionLine, dopeTable, factorDetail, millingSize, moaPerMilText, rangeClockText, referencePriceText, shotStrip, snapMilling, stepSpeed, totalLine, zoneTable } from './notebook.model';

const scope = scopeById('course-tree');
let card: DopeCard;

beforeAll(async () => {
  card = await buildDopeCard(new BallisticsEngine(), cartridgeById('B'), 0.1);
});

function notebookAt(distanceM: number | null): Notebook {
  return createNotebook({ card, scope, target: { sizeM: 0.5, distanceM }, hasZones: false, canTakeWindFromStation: false, seed: 1 }, 'auto');
}

function shot(distanceM: number, isHit: boolean): ExerciseShotRecord {
  return { stageIndex: 0, targetIndex: 0, distanceM, isHit, isColdBore: false, impact: { upMrad: 0, rightMrad: 0 }, diagnosis: 'clean' };
}

describe('total line', () => {
  it('set А: up, left, and the clicks in words', () => {
    expect(totalLine(scope, total(enterWind(notebookAt(300), 3.2, 9)))).toBe('↑ 1.6 · ← 0.6 · 16 кл. вверх · 6 кл. влево');
  });

  it('wind from the right reads to the right', () => {
    expect(totalLine(scope, total(enterWind(notebookAt(300), 3.2, 3)))).toBe('↑ 1.6 · → 0.6 · 16 кл. вверх · 6 кл. вправо');
  });

  it('no wind leaves out the horizontal part', () => {
    expect(totalLine(scope, total(notebookAt(300)))).toBe('↑ 1.6 · 16 кл. вверх');
  });

  it('an empty total is a dash', () => {
    expect(totalLine(scope, total(notebookAt(null)))).toBe('→ —');
  });

  it('set И: a total below ZERO STOP keeps the rest as a hold', () => {
    const belowZero = { ...total(notebookAt(300)), upMil: -0.1, elevation: { targetClicks: 0, holdMil: -0.1 }, holdUpMil: -0.1 };
    expect(totalLine(scope, belowZero)).toBe('↑ 0.0 · удержание ↓ 0.1');
  });
});

describe('factor contributions (Б22)', () => {
  it('set Г: conditions off still show ↑ 3 кл. and stay out of the total', () => {
    const measured = recordStation(notebookAt(600), { temperatureC: -5, pressureHpa: 1030, relativeHumidity: 0.5, windSpeedMps: 3.2, windClock: 9 }, 3, 0);
    const factors = factorContributions(measured);
    expect(factors.conditions.isOn).toBe(false);
    expect(contributionText('conditions', factors.conditions)).toBe('↑ 3 кл.');
    expect(total(measured).elevation.targetClicks).toBe(factors.dope.clicks);
  });

  it('wind left reads ←, wind right reads →, nothing yet reads —', () => {
    expect(contributionText('wind', factorContributions(enterWind(notebookAt(300), 3.2, 9)).wind)).toBe('← 6 кл.');
    expect(contributionText('wind', factorContributions(enterWind(notebookAt(300), 3.2, 3)).wind)).toBe('→ 6 кл.');
    expect(contributionText('wind', factorContributions(notebookAt(300)).wind)).toBe('—');
    expect(contributionText('wind', factorContributions(enterWind(notebookAt(300), 3.2, 12)).wind)).toBe('0 кл.');
  });
});

describe('correction line under the wind and conditions tabs', () => {
  it('set А wind: ← 0.60 MIL · 6 кл.; nothing entered: a dash', () => {
    expect(correctionLine('wind', factorContributions(enterWind(notebookAt(300), 3.2, 9)).wind)).toBe('поправка ← 0.60 MIL · 6 кл.');
    expect(correctionLine('wind', factorContributions(notebookAt(300)).wind)).toBe('поправка: —');
  });

  it('set Г conditions: ↑ 0.2x MIL · 3 кл.', () => {
    const measured = recordStation(notebookAt(600), { temperatureC: -5, pressureHpa: 1030, relativeHumidity: 0.5, windSpeedMps: 3.2, windClock: 9 }, 3, 0);
    expect(correctionLine('conditions', factorContributions(measured).conditions)).toMatch(/^поправка ↑ 0\.2\d MIL · 3 кл\.$/);
  });
});

describe('factor detail with the numbers put in by the game', () => {
  it('set А: DOPE row and the wind', () => {
    const notebook = enterWind(notebookAt(300), 3.2, 9);
    expect(factorDetail(notebook, 'dope')).toBe('строка 300 м карточки: ↑ 1.6');
    expect(factorDetail(notebook, 'wind')).toBe('3.2 м/с с 9 ч · V⊥ 3.2 · W = V⊥ × 300 / 1610 = ← 0.60');
  });

  it('set Г: the conditions', () => {
    const measured = recordStation(notebookAt(600), { temperatureC: -5, pressureHpa: 1030, relativeHumidity: 0.5, windSpeedMps: 3.2, windClock: 9 }, 3, 0);
    expect(factorDetail(measured, 'conditions')).toMatch(/^\(15 − -5\) \/ 10 × 0\.1\d \+ \(1030 − 1013\) \/ 10 × 0\.0\d = ↑ 0\.2\d$/);
  });

  it('says what is missing', () => {
    expect(factorDetail(notebookAt(300), 'wind')).toBe('ветер не введён');
    expect(factorDetail(notebookAt(300), 'conditions')).toBe('нет замера');
    expect(factorDetail(notebookAt(null), 'dope')).toBe('дистанция не измерена');
  });
});

describe('wind clock (Б11)', () => {
  it('the hand snaps to the nearest half hour', () => {
    expect(clockFromDialAngle((8.75 / 12) * 360)).toBe(9);
    expect(clockFromDialAngle((10 + 20 / 60) / 12 * 360)).toBe(10.5);
    expect(clockFromDialAngle((11 + 50 / 60) / 12 * 360)).toBe(12);
    expect(clockFromDialAngle(0)).toBe(12);
    expect(clockFromDialAngle(-30)).toBe(11);
    expect(clockFromDialAngle(375)).toBe(0.5);
  });

  it('reads as hours or hours and thirty minutes', () => {
    expect(clockText(9)).toBe('9 ч');
    expect(clockText(10.5)).toBe('10:30');
    expect(clockText(0.5)).toBe('12:30');
  });
});

describe('speed wheel', () => {
  it('steps by 0.1 within 0..15 m/s', () => {
    expect(stepSpeed(3.2, 1)).toBe(3.3);
    expect(stepSpeed(3.2, -1)).toBe(3.1);
    expect(stepSpeed(0, -1)).toBe(0);
    expect(stepSpeed(15, 1)).toBe(15);
    expect(stepSpeed(0.1, 2)).toBe(0.3);
  });
});

describe('DOPE table (Б7)', () => {
  it('ten rows 100-1000 m; the current distance is circled', () => {
    const rows = dopeTable(card, 300);
    expect(rows.map(row => row.distanceM)).toEqual([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(rows.filter(row => row.isCurrent).map(row => row.distanceM)).toEqual([300]);
    expect(rows[2].elevation).toBe('1.6');
    expect(rows[2].clicks).toBe('16');
  });

  it('a milled 294 m circles the nearest row; no distance circles nothing', () => {
    expect(dopeTable(card, 294).filter(row => row.isCurrent).map(row => row.distanceM)).toEqual([300]);
    expect(dopeTable(card, 349).filter(row => row.isCurrent).map(row => row.distanceM)).toEqual([300]);
    expect(dopeTable(card, null).some(row => row.isCurrent)).toBe(false);
  });
});

describe('milling grid (В10)', () => {
  it('taps snap to 0.05 MIL; the size is the gap between them', () => {
    expect(snapMilling(1.234)).toBeCloseTo(1.25, 9);
    expect(snapMilling(1.22)).toBeCloseTo(1.2, 9);
    expect(millingSize(0.35, -1.35)).toBeCloseTo(1.7, 9);
    expect(millingSize(-1.35, 0.35)).toBeCloseTo(1.7, 9);
  });
});

describe('last shots strip (Б8)', () => {
  it('keeps the last five, newest on the right', () => {
    const records = [shot(300, true), shot(300, false), shot(400, true), shot(400, true), shot(500, false), shot(600, true)];
    expect(shotStrip(records)).toEqual(['✕ 300', '✓ 400', '✓ 400', '✕ 500', '✓ 600']);
    expect(shotStrip([])).toEqual([]);
  });

  it('an unknown distance shows the player estimate, not the true distance', () => {
    expect(shotStrip([{ ...shot(431, true), rangeEstimateM: 418.6 }])).toEqual(['✓ 419']);
  });
});

describe('range clock', () => {
  it('the range day starts at 14:00', () => {
    expect(rangeClockText(0)).toBe('14:00');
    expect(rangeClockText(125)).toBe('14:02');
    expect(rangeClockText(3600)).toBe('15:00');
  });
});

describe('zone weights and flags on the WIND tab (В29, A9.3a)', () => {
  const zonedAt = (distanceM: number | null) => createNotebook({ card, scope, target: { sizeM: 0.5, distanceM }, hasZones: true, canTakeWindFromStation: false, seed: 1 }, 'manual-easy');

  it('without zones there is no table', () => {
    expect(zoneTable(notebookAt(600))).toBeNull();
  });

  it('the weights of the DOPE row at the player distance: station, 200, 400, 600 m — multiples of 0.05 that add up to 1', () => {
    const table = zoneTable(zonedAt(600))!;
    expect(table.weights.map(weight => weight.label)).toEqual(['станция', '200 м', '400 м', '600 м']);
    const values = table.weights.map(weight => Number(weight.value.replace(',', '.')));
    expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 9);
    for (const value of values) {
      expect(Math.round(value * 20)).toBeCloseTo(value * 20, 9);
    }
  });

  it('an unknown distance has no weights yet', () => {
    expect(zoneTable(zonedAt(null))!.weights.map(weight => weight.value)).toEqual(['—', '—', '—', '—']);
  });

  it('each flag says its reading, that it is unread, or that it is behind the berm', () => {
    const notebook = hideFlagsBehindBerm(readFlag(zonedAt(500), 0, -2.2), [2]);
    expect(zoneTable(notebook)!.flags).toEqual([
      { distanceM: 200, text: '2,2 м/с справа', isRead: true },
      { distanceM: 400, text: 'тапни флажок в стекле', isRead: false },
      { distanceM: 600, text: 'за валом', isRead: true },
    ]);
  });
});

describe('formulas reference (A10)', () => {
  it('clock shares come from the share formula, with a decimal comma', () => {
    expect(clockShareLines()).toEqual(['12, 6 ч → 0', '1, 5, 7, 11 ч → 0,5', '2, 4, 8, 10 ч → 0,87', '3, 9 ч → 1']);
  });

  it('the price is the reference penalty, with the word agreeing with the number', () => {
    expect(referencePriceText()).toBe('Справочник стоит 30 очков');
    expect(referencePriceText(21)).toBe('Справочник стоит 21 очко');
    expect(referencePriceText(22)).toBe('Справочник стоит 22 очка');
  });

  it('MIL in MOA from the scope unit, with a decimal comma', () => {
    expect(moaPerMilText()).toBe('3,44');
  });
});
