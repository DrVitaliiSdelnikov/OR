import { describe, expect, it } from 'vitest';
import { CheckVerdict } from '../core/calc-check';
import { createScenario } from '../core/scenario';
import { COURSE, courseProgress, CourseResults, ExerciseDef, exerciseById, ExerciseId, ExerciseRun, ExerciseShotRecord, setupTask, ShotCheckSummary, skillGoals } from './course';

const BEFORE_ATTESTATION: ExerciseId[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const SEEDS = Array.from({ length: 40 }, (_, index) => 2000 + index * 41);

function exercise(id: ExerciseId): ExerciseDef {
  return exerciseById(id)!;
}

function checkedShots(count: number, check: ShotCheckSummary): ExerciseShotRecord[] {
  return Array.from({ length: count }, (_, targetIndex) => ({
    stageIndex: 0,
    targetIndex,
    distanceM: 600,
    isHit: true,
    isColdBore: false,
    impact: { upMrad: 0, rightMrad: 0 },
    diagnosis: 'clean',
    check,
  }));
}

function check(verdict: CheckVerdict, rowVerdicts: ShotCheckSummary['rowVerdicts']): ShotCheckSummary {
  return { verdict, rowVerdicts, errorTypes: [] };
}

function run(shots: ExerciseShotRecord[]): ExerciseRun {
  return { mode: 'manual-easy', hasOpenedReference: false, shots };
}

function goalsMet(id: ExerciseId, shots: ExerciseShotRecord[]): [boolean, boolean] {
  const goals = skillGoals(exercise(id), run(shots));
  return [goals.skill.isMet, goals.top.isMet];
}

function allClasses(exerciseClass: 1 | 2 | 3, ids: readonly ExerciseId[]): CourseResults['bestClasses'] {
  return Object.fromEntries(ids.map(id => [id, exerciseClass]));
}

describe('13 «Горный склон» и 14 «Дальний рубеж» в курсе (В45)', () => {
  it('идут после зачёта 12; дальше упражнений нет', () => {
    expect(COURSE.map(def => def.id).slice(-3)).toEqual(['12', '13', '14']);
    expect(exerciseById('15' as ExerciseId)).toBeUndefined();
    expect(exercise('13').title).toBe('Горный склон');
    expect(exercise('14').title).toBe('Дальний рубеж');
  });

  it('13: 4 гонга на известных 400–700 м, САМ лёгкий, курсовой MIL-dot, патрон Б, слабый ветер одним', () => {
    const def = exercise('13');
    expect(def.targets).toEqual({ count: 4, distance: { kind: 'known', fromM: 400, toM: 700 } });
    expect(def.notebookMode).toBe('manual-easy');
    expect(def.modeChoices).toBeUndefined();
    expect(def.scopeId).toBe('course-dot');
    expect(def.stages.map(stage => stage.cartridgeId)).toEqual(['B']);
    expect(def.conditions).toMatchObject({ isWindUniform: true, windSpeedRangeMps: [2, 2.5], lookAngleRangeDeg: [10, 25], isLookAngleEitherWay: true, altitudeRangeM: [1000, 1500] });
    expect(def.conditions.isSpinDriftOn).toBeUndefined();
    expect(def.conditions.coriolisLatitudeRangeDeg).toBeUndefined();
  });

  it('14: 4 гонга 0,7 м на известных 800–1000 м, деривация и Кориолис 40–60°, без угла', () => {
    const def = exercise('14');
    expect(def.targets).toEqual({ count: 4, distance: { kind: 'known', fromM: 800, toM: 1000 } });
    expect(def.notebookMode).toBe('manual-easy');
    expect(def.scopeId).toBe('course-dot');
    expect(def.conditions).toMatchObject({ isWindUniform: true, windSpeedRangeMps: [2, 2.5], isSpinDriftOn: true, coriolisLatitudeRangeDeg: [40, 60] });
    expect(def.conditions.lookAngleRangeDeg).toBeUndefined();
    for (const seed of SEEDS) {
      expect(setupTask(def, seed).targets.every(target => target.diameterM === 0.7 && target.distanceM >= 800 && target.distanceM <= 1000)).toBe(true);
    }
  });

  it('13: склон ±10…25° — и вверх, и вниз на разных сидах; высота 1000–1500 м; Кориолиса нет', () => {
    const angles = SEEDS.map(seed => {
      const scenario = createScenario(seed, setupTask(exercise('13'), seed).scenarioOptions);
      expect(scenario.geometry.coriolis).toBeNull();
      expect(scenario.geometry.isSpinDriftOn).toBe(false);
      expect(scenario.atmosphere.altitudeM).toBeGreaterThanOrEqual(1000);
      expect(scenario.atmosphere.altitudeM).toBeLessThanOrEqual(1500);
      return scenario.geometry.lookAngleDeg;
    });
    expect(angles.every(angle => Math.abs(angle) >= 10 && Math.abs(angle) <= 25)).toBe(true);
    expect(angles.some(angle => angle > 0)).toBe(true);
    expect(angles.some(angle => angle < 0)).toBe(true);
  });

  it('14: широта 40–60°, деривация включена, угла нет', () => {
    for (const seed of SEEDS) {
      const geometry = createScenario(seed, setupTask(exercise('14'), seed).scenarioOptions).geometry;
      expect(geometry.lookAngleDeg).toBe(0);
      expect(geometry.isSpinDriftOn).toBe(true);
      expect(Math.abs(geometry.coriolis!.latitudeDeg)).toBeGreaterThanOrEqual(40);
      expect(Math.abs(geometry.coriolis!.latitudeDeg)).toBeLessThanOrEqual(60);
    }
  });
});

describe('цели навыка 13 и 14', () => {
  it('13: шаг угла без ошибки — 2 класс, даже если ошибся в другом шаге; «точно» на всех — 1 класс', () => {
    expect(goalsMet('13', checkedShots(4, check('error', { angle: 'close', wind: 'error' })))).toEqual([true, false]);
    expect(goalsMet('13', checkedShots(4, check('exact', { dope: 'exact', angle: 'exact' })))).toEqual([true, true]);
  });

  it('13: ошибка угла или незаписанный шаг угла — 2 класса нет', () => {
    expect(goalsMet('13', checkedShots(4, check('error', { angle: 'error' })))).toEqual([false, false]);
    expect(goalsMet('13', checkedShots(4, check('exact', { dope: 'exact' })))).toEqual([false, false]);
  });

  it('14: деривация и Кориолис без ошибки — 2 класс; ошибка одного из них — нет', () => {
    expect(goalsMet('14', checkedShots(4, check('close', { spin: 'close', coriolis: 'exact', eotvos: 'exact' })))).toEqual([true, false]);
    expect(goalsMet('14', checkedShots(4, check('error', { spin: 'error', coriolis: 'exact' })))[0]).toBe(false);
    expect(goalsMet('14', checkedShots(4, check('error', { spin: 'exact', coriolis: 'error' })))[0]).toBe(false);
  });

  it('14: ошибка только Этвёша 2 класс не закрывает, 1 класса нет; без шага Кориолиса — 2 класса нет', () => {
    expect(goalsMet('14', checkedShots(4, check('error', { spin: 'exact', coriolis: 'exact', eotvos: 'error' })))).toEqual([true, false]);
    expect(goalsMet('14', checkedShots(4, check('exact', { spin: 'exact' })))).toEqual([false, false]);
  });

  it('14: 1 класс — «точно» на всех и записаны все три шага, Этвёш тоже', () => {
    expect(goalsMet('14', checkedShots(4, check('exact', { spin: 'exact', coriolis: 'exact', eotvos: 'exact' })))).toEqual([true, true]);
    expect(goalsMet('14', checkedShots(4, check('exact', { spin: 'exact', coriolis: 'exact' })))).toEqual([true, false]);
  });

  it('тексты целей — из каталога', () => {
    expect(exercise('13').goals).toEqual({ second: 'шаг «Угол места» без ошибки на всех', first: '«точно» на всех' });
    expect(exercise('14').goals).toEqual({ second: 'деривация и Кориолис без ошибки на всех', first: '«точно» на всех' });
    expect(exercise('13').novelty).toBe('угол места: возвышение × cos, угол нуля Z; высота стрельбища');
    expect(exercise('14').novelty).toBe('деривация, Кориолис и Этвёш: широта и азимут');
  });
});

describe('прогресс: 13–14 после зачёта, звания по 00–12 (В46)', () => {
  it('допуск к 12 открывает 13, допуск к 13 — 14; без 12 — закрыто', () => {
    const before12 = courseProgress({ isIntroCompleted: true, bestClasses: allClasses(3, BEFORE_ATTESTATION.slice(0, 11)) });
    expect(before12.unlockedIds).not.toContain('13');
    const after12 = courseProgress({ isIntroCompleted: true, bestClasses: allClasses(3, BEFORE_ATTESTATION) });
    expect(after12.unlockedIds).toContain('13');
    expect(after12.unlockedIds).not.toContain('14');
    expect(after12.nextExerciseId).toBe('13');
    const after13 = courseProgress({ isIntroCompleted: true, bestClasses: { ...allClasses(3, BEFORE_ATTESTATION), '13': 3 } });
    expect(after13.unlockedIds).toContain('14');
    expect(after13.nextExerciseId).toBe('14');
  });

  it('13–14 допуски не меняют: 12 из 12', () => {
    const passed = courseProgress({ isIntroCompleted: true, bestClasses: allClasses(2, BEFORE_ATTESTATION) });
    expect(passed.admissions).toBe(12);
    const withAll = courseProgress({ isIntroCompleted: true, bestClasses: { ...allClasses(1, BEFORE_ATTESTATION), '13': 3, '14': 3 } });
    expect(withAll.admissions).toBe(12);
    expect(withAll.nextExerciseId).toBeNull();
    const onlyFirstEleven = courseProgress({ isIntroCompleted: true, bestClasses: { ...allClasses(2, BEFORE_ATTESTATION.slice(0, 11)), '13': 1, '14': 1 } });
    expect(onlyFirstEleven.admissions).toBe(11);
  });

  it('«открыть всё» открывает и 13, и 14', () => {
    expect(courseProgress({ isIntroCompleted: false, bestClasses: {} }, true).unlockedIds.slice(-2)).toEqual(['13', '14']);
  });
});
