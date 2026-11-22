import { describe, expect, it } from 'vitest';
import { CourseResults, exerciseById, ExerciseId, exerciseResult, ExerciseResult, ExerciseRun, ExerciseShotRecord, ShotCheckSummary } from '../../sim/course';
import { CauseKind, MainCause } from '../../sim/miss-breakdown';
import { initialRatings, SkillRatings } from '../../sim/skill-rating';
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

function sheetFor(id: ExerciseId, shots: ExerciseShotRecord[], before: CourseResults = { isIntroCompleted: true, bestClasses: {} }, fields: Partial<ExerciseRun> = {}, skills?: { before: SkillRatings; after: SkillRatings }) {
  const def = exerciseById(id)!;
  const result: ExerciseResult = exerciseResult(def, run(shots, fields));
  const after = withExerciseResult(before, id, result.exerciseClass, result.total);
  return { result, sheet: resultSheet({ def, result, records: shots, courseBefore: before, courseAfter: after, skillsBefore: skills?.before, skillsAfter: skills?.after }) };
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

  it('1st-class goal met but the 2nd class missed: the row says the 2nd class is still needed (QA 22.11)', () => {
    const speedWrong: ShotCheckSummary = { verdict: 'error', rowVerdicts: { 'reading-speed': 'error', 'turret-windage': 'exact' }, errorTypes: [] };
    const { sheet } = sheetFor('04', hits(3, { check: speedWrong }));
    expect(sheet.stamp).toBe('3 КЛАСС');
    expect(sheet.classRows[2]).toEqual({ label: '1 класс', text: 'все первым и вклад ветра учтён на всех — 3 из 3 · нужен 2 класс', isMet: false });
    expect(sheetFor('04', [...hits(2, { check: speedRight }), shot({ targetIndex: 2, check: windageOff })]).sheet.classRows[2].text).toBe('все первым и вклад ветра учтён на всех — 2 из 3');
  });

  it('01 has no 1st-class skill goal: the row is «все первым»; 02 on paper — «все в мишень» and the group in MIL', () => {
    expect(sheetFor('01', hits(3, { isDialExactFirstTry: true })).sheet.classRows[2].text).toBe('все первым — 3 из 3');
    const paper = [shot({ distanceM: 100, isColdBore: true }), shot({ distanceM: 100, impact: { upMrad: 0.1, rightMrad: 0 } }), shot({ distanceM: 100, impact: { upMrad: 0.9, rightMrad: 0 } }), shot({ distanceM: 100 }), shot({ distanceM: 100 })];
    const rows = sheetFor('02', paper).sheet.classRows;
    expect(rows[1].text).toBe('≥ 85 % и группа 2–4 ≤ 1 MIL — 0,9 MIL');
    expect(rows[2].text.startsWith('все в мишень и ')).toBe(true);
  });
});

describe('resultSheet — score and record', () => {
  it('targets plus calculation times the multiplier; the reference penalty after it', () => {
    const shots = [...hits(2, { check: { ...speedRight } }), shot({ targetIndex: 2, isHit: false, check: windageOff }), shot({ targetIndex: 2, check: windageOff }), shot({ targetIndex: 3, isHit: false, check: windageOff }), shot({ targetIndex: 3, isHit: false, check: windageOff })];
    expect(sheetFor('06', shots, undefined, { mode: 'manual-easy' }).sheet.scoreLine).toBe('цели 25 + расчёт 30 = 55 × 1,5 = 83');
    expect(sheetFor('06', shots, undefined, { mode: 'manual-easy', hasOpenedReference: true }).sheet.scoreLine).toBe('цели 25 + расчёт 30 = 55 × 1,5 = 83 − 30 справочник = 53');
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

  it('T2.3: по звеньям, как в разборе — главная причина каждого выстрела; ничья — по порядку лестницы', () => {
    const linked = (kind: CauseKind, targetIndex: number, isHit = false) => shot({ targetIndex, isHit, mainCause: 'calc', causes: [{ kind, mil: 0.6 }, { kind: 'hold', mil: 0.2 }], clickMil: 0.1 });
    const shots = [linked('wind-speed', 0), linked('wind-speed', 0, true), linked('dope', 1), linked('wind-speed', 2), shot({ targetIndex: 2, causes: [], clickMil: 0.1 })];
    expect(sheetFor('04', shots).sheet.mainError).toBe('3 из 5 — скорость ветра');
    const tie = [linked('hold', 0), linked('dope', 0), shot({ targetIndex: 1, causes: [], clickMil: 0.1 }), shot({ targetIndex: 2, causes: [], clickMil: 0.1 })];
    expect(sheetFor('04', tie).sheet.mainError).toBe('1 из 4 — строка ДОПЕ');
  });

  it('T2.3: есть выстрел без величин — итог по грубой причине, как раньше', () => {
    const shots = [shot({ targetIndex: 0, isHit: false, mainCause: 'hold', causes: [{ kind: 'hold', mil: 0.6 }], clickMil: 0.1 }), shot({ targetIndex: 0, isHit: false, mainCause: 'calc' }), shot({ targetIndex: 1 }), shot({ targetIndex: 2 })];
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

  it('skill growth replaces the rank plate: changed whole ratings only, in skill order, up or down', () => {
    const before = initialRatings();
    const after = { ...before, wind: { rating: 44.4, attempts: 3 }, distance: { rating: 38.6, attempts: 1 }, dope: { rating: 40.4, attempts: 1 } };
    const sheet = sheetFor('03', hits(5, { isBreathHeld: true }), { isIntroCompleted: true, bestClasses: { '01': 3, '02': 3 } }, {}, { before, after }).sheet;
    expect(sheet.skillGrowth).toEqual([
      { skill: 'дальность', text: '40 → 39', isUp: false },
      { skill: 'ветер', text: '40 → 44', isUp: true },
    ]);
    expect('rankPlate' in sheet).toBe(false);
    expect(sheetFor('03', hits(5)).sheet.skillGrowth).toEqual([]);
  });

  it('a better repeat strikes the old class out; a worse one does not', () => {
    const before: CourseResults = { isIntroCompleted: true, bestClasses: { '03': 3 } };
    expect(sheetFor('03', hits(5, { isBreathHeld: true }), before).sheet.struckClass).toBe('3 КЛАСС');
    const best: CourseResults = { isIntroCompleted: true, bestClasses: { '03': 1 } };
    expect(sheetFor('03', hits(5, { isBreathHeld: false }), best).sheet.struckClass).toBeNull();
  });
});

describe('итог: открытое упражнение в единицах игрока (T1.8c)', () => {
  it('после 09 открыто «10 · Пристрелка на 425» в имперских', () => {
    const before: CourseResults = { isIntroCompleted: true, bestClasses: Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08'].map(id => [id, 3])) };
    const def = exerciseById('09')!;
    const shots = hits(4);
    const result = exerciseResult(def, run(shots));
    const after = withExerciseResult(before, '09', result.exerciseClass, result.total);
    expect(result.isAdmitted).toBe(true);
    expect(resultSheet({ def, result, records: shots, courseBefore: before, courseAfter: after, system: 'imperial' }).openedLine).toBe('Открыто: 10 · Пристрелка на 425');
    expect(resultSheet({ def, result, records: shots, courseBefore: before, courseAfter: after }).openedLine).toBe('Открыто: 10 · Пристрелка на 400');
  });
});

describe('resultSheet — экзамен (T3.6)', () => {
  const examSheet = (hitTargets: number, isExam = true) => {
    const def = exerciseById('12')!;
    const shots = Array.from({ length: 10 }, (_, targetIndex) => shot({ targetIndex, isHit: targetIndex < hitTargets }));
    const result = exerciseResult(def, run(shots, { mode: 'manual-easy' }));
    const before: CourseResults = { isIntroCompleted: true, bestClasses: {} };
    return resultSheet({ def, result, records: shots, courseBefore: before, courseAfter: before, isExam });
  };

  it('сдан — доля, порог и зачёт 01–11; не сдан — доля меньше порога; не экзамен — строки нет', () => {
    expect(examSheet(9).examLine).toBe('ЭКЗАМЕН СДАН · 90 % ≥ 85 % · 01–11 зачтены');
    expect(examSheet(8).examLine).toBe('ЭКЗАМЕН НЕ СДАН · 80 % < 85 %');
    expect(examSheet(9, false).examLine).toBeNull();
  });
});
