import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BallisticsEngine } from './engine';
import { ComparisonRow, comparedRows, comparisonSummary, REFERENCE_TABLES } from './reference-check';

const REFERENCE_DIR = 'src/core/reference';
const DISTANCES_M = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

function row(fields: Partial<ComparisonRow>): ComparisonRow {
  return { distanceM: 100, ourUpMil: 1, referenceUpMil: 1, upDifferenceMil: 0, ourRightMil: 0, referenceRightMil: 0, rightDifferenceMil: 0, timeDifferenceShare: 0, ...fields };
}

describe('эталоны для экрана «Модель» (T5.3)', () => {
  it('все файлы эталона, .308 первым, у каждого 3 набора и источник', () => {
    const files = readdirSync(REFERENCE_DIR).filter(name => name.endsWith('.json')).map(name => name.replace('.json', ''));
    expect(REFERENCE_TABLES.map(table => table.id).sort()).toEqual(files.sort());
    expect(REFERENCE_TABLES[0].id).toBe('308-175');
    for (const table of REFERENCE_TABLES) {
      expect(table.sets.map(set => set.id)).toEqual(['sea-level-calm', 'altitude-1500-wind-3', 'uphill-15-coriolis-55n-east']);
      expect(table.source).toMatchObject({ library: '@joelbenway/lob', generatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    }
  });
});

describe('сверка набора с эталоном', () => {
  it('10 строк 100–1000 м: эталон из JSON, Δ = ядро − эталон, ядро в допуске и не равно эталону', async () => {
    const table = REFERENCE_TABLES[0];
    const set = table.sets[1];
    const rows = await comparedRows(new BallisticsEngine(), table, set);
    expect(rows.map(item => item.distanceM)).toEqual(DISTANCES_M);
    rows.forEach((item, index) => {
      const reference = set.rows[index];
      expect(item.referenceUpMil).toBe(reference.upMil);
      expect(item.referenceRightMil).toBe(reference.impactRightMil);
      expect(item.upDifferenceMil).toBeCloseTo(item.ourUpMil - reference.upMil, 12);
      expect(item.rightDifferenceMil).toBeCloseTo(item.ourRightMil - reference.impactRightMil, 12);
      expect(Math.abs(item.upDifferenceMil)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(item.rightDifferenceMil)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(item.timeDifferenceShare)).toBeLessThanOrEqual(0.01);
    });
    const farthest = rows.at(-1)!;
    expect(farthest.ourRightMil).toBeLessThan(-1.5);
    expect(farthest.upDifferenceMil).not.toBe(0);
    expect(farthest.rightDifferenceMil).not.toBe(0);
    expect(farthest.timeDifferenceShare).not.toBe(0);
  });

  it('Δ времени — доля со знаком: ядро короче эталона под углом 15°', async () => {
    const table = REFERENCE_TABLES[0];
    const rows = await comparedRows(new BallisticsEngine(), table, table.sets[2]);
    expect(rows.at(-1)!.timeDifferenceShare).toBeLessThan(-0.005);
    expect(rows.at(-1)!.timeDifferenceShare).toBeGreaterThan(-0.015);
  });
});

describe('итог сверки', () => {
  it('наибольшие |Δ| по колонкам; в допуске, если все три в пределах', () => {
    const summary = comparisonSummary([row({ upDifferenceMil: -0.04, rightDifferenceMil: 0.01, timeDifferenceShare: 0.002 }), row({ upDifferenceMil: 0.02, rightDifferenceMil: -0.03, timeDifferenceShare: -0.005 })], 0);
    expect(summary).toEqual({ maxUpDifferenceMil: 0.04, maxRightDifferenceMil: 0.03, maxTimeDifferenceShare: 0.005, isWithinTolerance: true });
  });

  it('вне допуска: возвышение > 0,1, вбок > 0,05, время > 1 % на ровной линии', () => {
    expect(comparisonSummary([row({ upDifferenceMil: -0.11 })], 0).isWithinTolerance).toBe(false);
    expect(comparisonSummary([row({ rightDifferenceMil: 0.06 })], 0).isWithinTolerance).toBe(false);
    expect(comparisonSummary([row({ timeDifferenceShare: -0.012 })], 0).isWithinTolerance).toBe(false);
  });

  it('под углом время допускается до 1,5 %', () => {
    expect(comparisonSummary([row({ timeDifferenceShare: -0.012 })], 15).isWithinTolerance).toBe(true);
    expect(comparisonSummary([row({ timeDifferenceShare: -0.016 })], 15).isWithinTolerance).toBe(false);
  });
});
