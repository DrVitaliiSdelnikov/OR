import { describe, expect, it } from 'vitest';
import { CourseResults, exerciseById, ExerciseId, exerciseResult, ExerciseResult, ExerciseRun, ExerciseShotRecord, ShotCheckSummary } from '../../sim/course';
import { MainCause } from '../../sim/miss-breakdown';
import { withExerciseResult } from '../home/home.model';
import { resultSheet } from './result.model';

function shot(fields: Partial<ExerciseShotRecord> = {}): ExerciseShotRecord {
  return { stageIndex: 0, targetIndex: 0, distanceM: 300, isHit: true, isColdBore: false, impact: { upMrad: 0, rightMrad: 0 }, diagnosis: 'clean', mainCause: null, ...fields };
}

function hits(count: number, fields: Partial<ExerciseShotRecord> = {}): ExerciseShotRecord[] {
  return Array.from({ length: count }, (_, targetIndex) => shot({ targetIndex, ...fields }));
}

function run(shots: ExerciseShotRecord[], fields: Partial<ExerciseRun> = {}): ExerciseRun {
  return { mode: 'auto', hasOpenedReference: false, shots, ...fields };
}

function sheetFor(id: ExerciseId, shots: ExerciseShotRecord[], before: CourseResults = { isIntroCompleted: true, bestClasses: {} }, fields: Partial<ExerciseRun> = {}) {
  const def = exerciseById(id)!;
  const result: ExerciseResult = exerciseResult(def, run(shots, fields));
  const after = withExerciseResult(before, id, result.exerciseClass, result.total);
  return { result, sheet: resultSheet({ def, result, records: shots, courseBefore: before, courseAfter: after }) };
}

const speedRight: ShotCheckSummary = { verdict: 'exact', rowVerdicts: { 'reading-speed': 'exact', 'turret-windage': 'exact' }, errorTypes: [] };
const windageOff: ShotCheckSummary = { verdict: 'close', rowVerdicts: { 'reading-speed': 'exact', 'turret-windage': 'close' }, errorTypes: [] };

describe('resultSheet — stamp and class rows', () => {
  it('04 at 100 % with the skill goal but not the top one: 2nd class, ✓ ✓ ✕ with facts', () => {
    const shots = [...hits(2, { check: speedRight }), shot({ targetIndex: 2, check: windageOff })];
    const { sheet } = sheetFor('04', shots);
    expect(sheet.stamp).toBe('2 КЛАСС');
    expect(sheet.stampTone).toBe('silver');
    expect(sheet.classRows).toEqual([
      { label: '3 класс', text: '≥ 70 % очков — 100 %', isMet: true },
      { label: '2 класс', text: '≥ 85 % и скорость перенесена без ошибки — 3 из 3', isMet: true },
      { label: '1 класс', text: 'все первым и вклад ветра учтён на всех — 2 из 3', isMet: false },
    ]);
  });

  it('below 70 %: «НЕ ЗАЧТЕНО» in red and every row ✕', () => {
    const shots = [shot({ targetIndex: 0 }), shot({ targetIndex: 1, isHit: false }), shot({ targetIndex: 1, isHit: false }), shot({ targetIndex: 2, isHit: false }), shot({ targetIndex: 2, isHit: false })];
    const { sheet } = sheetFor('04', shots);
    expect([sheet.stamp, sheet.stampTone, sheet.isAdmitted]).toEqual(['НЕ ЗАЧТЕНО', 'red', false]);
    expect(sheet.classRows.map(row => row.isMet)).toEqual([false, false, false]);
  });

  it('a met 3rd class row with a failed 2nd class share stays ✕ in the 2nd row even when the skill goal is met', () => {
    const shots = [shot({ targetIndex: 0, check: speedRight }), shot({ targetIndex: 1, check: speedRight }), shot({ targetIndex: 2, isHit: false, check: speedRight }), shot({ targetIndex: 2, check: speedRight })];
    const { sheet } = sheetFor('04', shots);
    expect(sheet.classRows.map(row => row.isMet)).toEqual([true, false, false]);
    expect(sheet.classRows[0].text).toBe('≥ 70 % очков — 83 %');
  });

  it('01 has no 1st-class skill goal: the row is «все первым»; 02 on paper — «все в мишень» and the group in MIL', () => {
    expect(sheetFor('01', hits(3, { isDialExactFirstTry: true })).sheet.classRows[2].text).toBe('все первым — 3 из 3');
    const paper = [shot({ distanceM: 100, isColdBore: true }), shot({ distanceM: 100, impact: { upMrad: 0.1, rightMrad: 0 } }), shot({ distanceM: 100, impact: { upMrad: 0.9, rightMrad: 0 } }), shot({ distanceM: 100 }), shot({ distanceM: 100 })];
    const rows = sheetFor('02', paper).sheet.classRows;
    expect(rows[1].text).toBe('≥ 85 % и группа 2–4 ≤ 1 MIL — 0.9 MIL');
    expect(rows[2].text.startsWith('все в мишень и ')).toBe(true);
  });
});

describe('resultSheet — score and record', () => {
  it('targets plus calculation times the multiplier; the reference penalty after it', () => {
    const shots = [...hits(2, { check: { ...speedRight } }), shot({ targetIndex: 2, isHit: false, check: windageOff }), shot({ targetIndex: 2, check: windageOff }), shot({ targetIndex: 3, isHit: false, check: windageOff }), shot({ targetIndex: 3, isHit: false, check: windageOff })];
    expect(sheetFor('06', shots, undefined, { mode: 'manual-easy' }).sheet.scoreLine).toBe('цели 25 + расчёт 30 = 55 × 1.5 = 83');
    expect(sheetFor('06', shots, undefined, { mode: 'manual-easy', hasOpenedReference: true }).sheet.scoreLine).toBe('цели 25 + расчёт 30 = 55 × 1.5 = 83 − 30 справочник = 53');
  });

  it('×1 is not written; paper gives the hit count first', () => {
    expect(sheetFor('03', hits(5, { isBreathHeld: true })).sheet.scoreLine).toBe('цели 50 + расчёт 0 = 50');
    const paper = [shot({ distanceM: 100, isColdBore: true }), shot({ distanceM: 100 }), shot({ distanceM: 100, isHit: false }), shot({ distanceM: 100 }), shot({ distanceM: 100 })];
    expect(sheetFor('02', paper).sheet.scoreLine).toBe('попаданий 4 из 5 · цели 40 + расчёт 0 = 40');
  });

  it('a new record, or the record standing', () => {
    const shots = hits(5, { isBreathHeld: true });
    expect(sheetFor('03', shots).sheet.recordLine).toBe('новый рекорд');
    const before: CourseResults = { isIntroCompleted: true, bestClasses: { '03': 1 }, bestTotals: { '03': 50 } };
    expect(sheetFor('03', shots.slice(0, 4), before).sheet.recordLine).toBe('рекорд 50');
  });
});

describe('resultSheet — the main error', () => {
  const missed = (cause: MainCause) => [shot({ targetIndex: 0, isHit: false, mainCause: cause }), shot({ targetIndex: 0, mainCause: null })];

  it('the most frequent main cause over the series shots', () => {
    const shots = [...missed('wind-under'), shot({ targetIndex: 1, isHit: false, mainCause: 'wind-under' }), shot({ targetIndex: 1, isHit: false, mainCause: 'hold' }), shot({ targetIndex: 2, isHit: false, mainCause: 'wind-under' })];
    expect(sheetFor('04', shots).sheet.mainError).toBe('3 из 5 — недооценка ветра');
  });

  it('a tie goes by the order of the causes: calculation before hold', () => {
    const shots = [shot({ targetIndex: 0, isHit: false, mainCause: 'hold' }), shot({ targetIndex: 0, isHit: false, mainCause: 'calc' }), shot({ targetIndex: 1 }), shot({ targetIndex: 2 })];
    expect(sheetFor('04', shots).sheet.mainError).toBe('1 из 4 — ошибка расчёта');
  });

  it('1st class — «Ошибок нет» even with a cause on some shot', () => {
    expect(sheetFor('03', hits(5, { isBreathHeld: true, mainCause: 'trigger' })).sheet.mainError).toBe('Ошибок нет');
  });

  it('no cause on any shot — the first goal not met', () => {
    expect(sheetFor('03', hits(5, { isBreathHeld: false })).sheet.mainError).toBe('Не выполнено: все 5 с задержкой дыхания в окне');
    const shots = [shot({ targetIndex: 0 }), shot({ targetIndex: 1 }), shot({ targetIndex: 2, isHit: false }), shot({ targetIndex: 2 })];
    expect(sheetFor('01', shots.map(record => ({ ...record, isDialExactFirstTry: true }))).sheet.mainError).toBe('Не выполнено: ≥ 85 % очков');
  });
});

describe('resultSheet — what opens', () => {
  it('the first admission shows the terms and the next exercise; a repeat does not', () => {
    const before: CourseResults = { isIntroCompleted: true, bestClasses: { '01': 3, '02': 3, '03': 3 } };
    const first = sheetFor('04', hits(3, { check: speedRight }), before).sheet;
    expect(first.newTerms).toEqual(['ветер', 'правило часов', 'флажок', 'метеостанция', 'боковая составляющая']);
    expect(first.openedLine).toBe('Открыто: 05 · Дистанции: ДОПЕ и дальномер');
    const repeat = sheetFor('04', hits(3, { check: speedRight }), { ...before, bestClasses: { ...before.bestClasses, '04': 3 } }).sheet;
    expect(repeat.newTerms).toEqual([]);
    expect(repeat.openedLine).toBeNull();
  });

  it('a not admitted run opens nothing', () => {
    const shots = [shot({ targetIndex: 0, isHit: false }), shot({ targetIndex: 0, isHit: false })];
    const sheet = sheetFor('04', shots).sheet;
    expect([sheet.newTerms, sheet.openedLine]).toEqual([[], null]);
  });

  it('the third admission makes a «Стрелок»; the second does not', () => {
    const two: CourseResults = { isIntroCompleted: true, bestClasses: { '01': 3, '02': 3 } };
    expect(sheetFor('03', hits(5, { isBreathHeld: true }), two).sheet.rankPlate).toBe('Звание: Стрелок');
    const one: CourseResults = { isIntroCompleted: true, bestClasses: { '01': 3 } };
    expect(sheetFor('02', [shot({ distanceM: 100, isColdBore: true }), ...Array.from({ length: 4 }, () => shot({ distanceM: 100 }))], one).sheet.rankPlate).toBeNull();
  });

  it('a better repeat strikes the old class out; a worse one does not', () => {
    const before: CourseResults = { isIntroCompleted: true, bestClasses: { '03': 3 } };
    expect(sheetFor('03', hits(5, { isBreathHeld: true }), before).sheet.struckClass).toBe('3 КЛАСС');
    const best: CourseResults = { isIntroCompleted: true, bestClasses: { '03': 1 } };
    expect(sheetFor('03', hits(5, { isBreathHeld: false }), best).sheet.struckClass).toBeNull();
  });
});
