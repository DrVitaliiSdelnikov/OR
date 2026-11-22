import { describe, expect, it } from 'vitest';
import { ComparisonRow, REFERENCE_TABLES } from '../../core/reference-check';
import { assumptionLines, comparisonTableView, formulaRows, referenceChips, setChips, sourceLine, summaryLine, toleranceLine } from './model.model';

function row(fields: Partial<ComparisonRow>): ComparisonRow {
  return { distanceM: 100, ourUpMil: 1, referenceUpMil: 1, upDifferenceMil: 0, ourRightMil: 0, referenceRightMil: 0, rightDifferenceMil: 0, timeDifferenceShare: 0, ...fields };
}

describe('экран «Модель»: выбор эталона (T5.3)', () => {
  it('чипы патронов с названиями из каталога, выбран один', () => {
    const chips = referenceChips('223-77');
    expect(chips.map(chip => chip.label)).toEqual(['.308 175 гр', '6,5 Creedmoor 140 гр', '.223 77 гр', '.338 LM 300 гр']);
    expect(chips.filter(chip => chip.isSelected).map(chip => chip.id)).toEqual(['223-77']);
  });

  it('чипы наборов: условия из данных набора, в единицах игрока', () => {
    const table = REFERENCE_TABLES[0];
    expect(setChips(table, 'altitude-1500-wind-3', 'metric').map(chip => [chip.label, chip.isSelected])).toEqual([
      ['Уровень моря · штиль', false],
      ['1500 м · ветер 4 м/с с 3 ч', true],
      ['Подъём 15° · 55° с. ш. · на восток', false],
    ]);
    expect(setChips(table, 'sea-level-calm', 'imperial')[1].label).toBe('4921 фут · ветер 8,9 миль/ч с 3 ч');
  });

  it('источник и допуск', () => {
    expect(sourceLine(REFERENCE_TABLES[0])).toBe('Эталон — @joelbenway/lob 0.14.0, решатель ELR, посчитан 15.11.2026. Числа ядра считаются сейчас, на этом устройстве.');
    expect(toleranceLine('metric')).toBe('Допуск на 100–1000 м: возвышение ≤ 0,1 MIL, вбок ≤ 0,05 MIL, время ≤ 1 % (под углом ≤ 1,5 %)');
    expect(toleranceLine('imperial')).toBe('Допуск на 109–1094 ярда: возвышение ≤ 0,1 MIL, вбок ≤ 0,05 MIL, время ≤ 1 % (под углом ≤ 1,5 %)');
  });
});

describe('таблица и итог сверки', () => {
  const rows = [row({ distanceM: 100, ourUpMil: 0.004, referenceUpMil: 0.012, upDifferenceMil: -0.008, rightDifferenceMil: 0.0031, timeDifferenceShare: 0.00047 }), row({ distanceM: 1000, ourUpMil: 14.1236, referenceUpMil: 14.169, upDifferenceMil: -0.0454, rightDifferenceMil: -0.012, timeDifferenceShare: -0.0107 })];

  it('строки: дистанция в единицах игрока, ВЕРТ до сотых, Δ со знаком, Δ t в процентах', () => {
    const metric = comparisonTableView(rows, 'metric');
    expect(metric.distanceHeader).toBe('ДИСТ, м');
    expect(metric.rows).toEqual([
      { distance: '100', ourUp: '0,00', referenceUp: '0,01', upDifference: '−0,01', rightDifference: '0,00', timeDifference: '+0,05 %' },
      { distance: '1000', ourUp: '14,12', referenceUp: '14,17', upDifference: '−0,05', rightDifference: '−0,01', timeDifference: '−1,07 %' },
    ]);
    const imperial = comparisonTableView(rows, 'imperial');
    expect(imperial.distanceHeader).toBe('ДИСТ, ярд');
    expect(imperial.rows.map(item => item.distance)).toEqual(['109', '1094']);
  });

  it('итог: наибольшие |Δ| и вердикт', () => {
    expect(summaryLine({ maxUpDifferenceMil: 0.0454, maxRightDifferenceMil: 0.012, maxTimeDifferenceShare: 0.0107, isWithinTolerance: true })).toBe(
      'Наибольшее |Δ|: ВЕРТ 0,05 · ВБОК 0,01 MIL · время 1,07 % — в допуске',
    );
    expect(summaryLine({ maxUpDifferenceMil: 0.2, maxRightDifferenceMil: 0, maxTimeDifferenceShare: 0, isWithinTolerance: false })).toMatch(/ — вне допуска$/);
  });
});

describe('игровые формулы и допущения', () => {
  it('семь шагов, у каждого формула, ядро и точность', () => {
    const rowsMetric = formulaRows('metric');
    expect(rowsMetric.map(item => item.title)).toEqual(['Дальность', 'Ветер', 'Атмосфера', 'Угол места', 'Деривация', 'Кориолис', 'Упреждение']);
    for (const item of rowsMetric) {
      expect([item.formula, item.core, item.accuracy].every(field => field.trim() !== ''), item.title).toBe(true);
    }
  });

  it('формулы — в системе игрока', () => {
    const formulaOf = (system: 'metric' | 'imperial', title: string) => formulaRows(system).find(item => item.title === title)!;
    expect(formulaOf('metric', 'Дальность').formula).toBe('Д = размер (м) × 1000 / MIL');
    expect(formulaOf('imperial', 'Дальность').formula).toBe('Д (ярды) = размер (дюймы) × 27,78 / MIL');
    expect(formulaOf('metric', 'Атмосфера').formula).toContain('(15 − T) / 10');
    expect(formulaOf('imperial', 'Атмосфера').formula).toContain('(59 − T) / 10');
    expect(formulaOf('imperial', 'Упреждение').formula).toContain('488,9');
    expect(formulaOf('metric', 'Ветер').accuracy).toBe('меньше клика на 100–1000 м при V⊥ до 12 м/с');
    expect(formulaOf('imperial', 'Ветер').accuracy).toBe('меньше клика на 109–1094 ярда при V⊥ до 26,8 миль/ч');
  });

  it('ноль в допущениях — стандартная атмосфера в единицах игрока', () => {
    expect(assumptionLines('metric')).toContain('Ноль — на ровной линии в стандартной атмосфере ICAO: +15 °C, 1013 гПа');
    expect(assumptionLines('imperial')).toContain('Ноль — на ровной линии в стандартной атмосфере ICAO: +59 °F, 29,92 дюйма рт. ст.');
  });
});
