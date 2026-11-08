import { describe, expect, it } from 'vitest';
import { CheckVerdict } from '../core/calc-check';
import { createScenario } from '../core/scenario';
import { Correction } from '../core/types';
import {
  COURSE,
  courseProgress,
  CourseResults,
  ExerciseDef,
  exerciseById,
  ExerciseId,
  exerciseResult,
  ExerciseRun,
  ExerciseShotRecord,
  mergeBestClass,
  setupExercise,
  ShotCheckSummary,
  skillGoals,
} from './course';

function exercise(id: ExerciseId): ExerciseDef {
  return exerciseById(id)!;
}

function shot(fields: Partial<ExerciseShotRecord> = {}): ExerciseShotRecord {
  return {
    stageIndex: 0,
    targetIndex: 0,
    distanceM: 300,
    isHit: true,
    isColdBore: false,
    impact: { upMrad: 0, rightMrad: 0 },
    diagnosis: 'clean',
    ...fields,
  };
}

function firstShotHits(count: number, fields: Partial<ExerciseShotRecord> = {}): ExerciseShotRecord[] {
  return Array.from({ length: count }, (_, targetIndex) => shot({ targetIndex, ...fields }));
}

function run(shots: ExerciseShotRecord[], fields: Partial<ExerciseRun> = {}): ExerciseRun {
  return { mode: 'auto', hasOpenedReference: false, shots, ...fields };
}

function check(verdict: CheckVerdict, fields: Partial<ShotCheckSummary> = {}): ShotCheckSummary {
  return { verdict, rowVerdicts: {}, errorTypes: [], ...fields };
}

function point(upMrad: number, rightMrad: number): Correction {
  return { upMrad, rightMrad };
}

const SEEDS = Array.from({ length: 40 }, (_, index) => 1000 + index * 37);

describe('COURSE catalog', () => {
  it('has the intro and twelve exercises in order', () => {
    expect(COURSE.map(def => def.id)).toEqual(['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
    expect(exercise('00').targets).toBeNull();
    expect(exerciseById('13' as ExerciseId)).toBeUndefined();
  });

  it('exercise 08 is three stages with cartridges A, B and C', () => {
    expect(exercise('08').stages.map(stage => stage.cartridgeId)).toEqual(['A', 'B', 'C']);
  });

  it('cold bore starts at 02; 01 has none', () => {
    expect(exercise('01').hasColdBore).toBe(false);
    expect(COURSE.filter(def => def.targets && def.id !== '01').every(def => def.hasColdBore)).toBe(true);
  });

  it('the course shoots the 3–12× tree to 05 and the 3–12× MIL-dot from 06', () => {
    const treeIds = ['00', '01', '02', '03', '04', '05'];
    for (const def of COURSE) {
      expect(def.scopeId).toBe(treeIds.includes(def.id) ? 'course-tree' : 'course-dot');
    }
  });

  it('01 and 02 fire with a tap, from 03 the trigger needs pressure', () => {
    expect(COURSE.filter(def => def.trigger === 'tap').map(def => def.id)).toEqual(['00', '01', '02']);
    expect(exercise('03').trigger).toBe('pressure');
    expect(exercise('12').trigger).toBe('pressure');
  });

  it('the notebook mode follows the course: AUTO to 05, SAM easy from 06, SAM hard in 10', () => {
    expect(['01', '02', '03', '04', '05'].map(id => exercise(id as ExerciseId).notebookMode)).toEqual(['auto', 'auto', 'auto', 'auto', 'auto']);
    expect(exercise('06').notebookMode).toBe('manual-easy');
    expect(exercise('10').notebookMode).toBe('manual-hard');
  });
});

describe('setupExercise — targets', () => {
  it('03: five 0.35 m gongs at 300 m', () => {
    const { targets } = setupExercise(exercise('03'), 1);
    expect(targets).toEqual(Array.from({ length: 5 }, () => ({ distanceM: 300, diameterM: 0.35 })));
  });

  it('02: one 0.5 m paper target at 100 m, five shots that hits do not close', () => {
    const setup = setupExercise(exercise('02'), 1);
    expect(setup.targets).toEqual([{ distanceM: 100, diameterM: 0.5 }]);
    expect(setup.plan).toEqual({
      kind: 'exercise',
      hasColdBore: true,
      stages: [{ cartridgeId: 'B', targetCount: 1, maxShotsPerTarget: 5, closesOnHit: false }],
    });
  });

  it('gongs are 0.5 m up to 600 m and 0.7 m beyond', () => {
    for (const seed of SEEDS) {
      for (const target of setupExercise(exercise('09'), seed).targets) {
        expect(target.diameterM).toBe(target.distanceM > 600 ? 0.7 : 0.5);
      }
    }
    expect(setupExercise(exercise('08'), 1).targets).toEqual([{ distanceM: 600, diameterM: 0.5 }]);
  });

  it('06: known distances from 400, 450 and 500 m', () => {
    const seen = new Set<number>();
    for (const seed of SEEDS) {
      for (const target of setupExercise(exercise('06'), seed).targets) {
        expect([400, 450, 500]).toContain(target.distanceM);
        seen.add(target.distanceM);
      }
    }
    expect(seen.size).toBe(3);
  });

  it('05: unknown distances in 300–600 m, multiples of 5 but never of 50', () => {
    for (const seed of SEEDS) {
      const { targets } = setupExercise(exercise('05'), seed);
      expect(targets).toHaveLength(3);
      for (const target of targets) {
        expect(target.distanceM).toBeGreaterThanOrEqual(300);
        expect(target.distanceM).toBeLessThanOrEqual(600);
        expect(target.distanceM % 5).toBe(0);
        expect(target.distanceM % 50).not.toBe(0);
      }
    }
  });

  it('12: ten gongs in 200–700 m, out and back', () => {
    for (const seed of SEEDS) {
      const distances = setupExercise(exercise('12'), seed).targets.map(target => target.distanceM);
      expect(distances).toHaveLength(10);
      expect(distances.every(distanceM => distanceM >= 200 && distanceM <= 700)).toBe(true);
      const outward = distances.slice(0, 5);
      const back = distances.slice(5);
      expect(outward).toEqual([...outward].sort((a, b) => a - b));
      expect(back).toEqual([...back].sort((a, b) => b - a));
    }
  });

  it('the plan shoots every target with two shots per target', () => {
    expect(setupExercise(exercise('12'), 1).plan).toEqual({
      kind: 'exercise',
      hasColdBore: true,
      stages: [{ cartridgeId: 'B', targetCount: 10, maxShotsPerTarget: 2, closesOnHit: true }],
    });
  });

  it('the same seed gives the same setup, another seed other distances', () => {
    expect(setupExercise(exercise('12'), 77)).toEqual(setupExercise(exercise('12'), 77));
    const distancesBySeed = SEEDS.map(seed => setupExercise(exercise('12'), seed).targets.map(target => target.distanceM).join());
    expect(new Set(distancesBySeed).size).toBeGreaterThan(1);
  });
});

describe('setupExercise — conditions and sight', () => {
  it('07: a cold morning of −5…0 C and 1025–1035 hPa', () => {
    for (const seed of SEEDS) {
      const { atmosphere } = createScenario(seed, setupExercise(exercise('07'), seed).scenarioOptions);
      expect(atmosphere.temperatureC).toBeGreaterThanOrEqual(-5);
      expect(atmosphere.temperatureC).toBeLessThanOrEqual(0);
      expect(atmosphere.pressureHpa).toBeGreaterThanOrEqual(1025);
      expect(atmosphere.pressureHpa).toBeLessThanOrEqual(1035);
    }
  });

  it('04: one light wind from 3 or 9 o’clock', () => {
    for (const seed of SEEDS) {
      const scenario = createScenario(seed, setupExercise(exercise('04'), seed).scenarioOptions);
      expect([3, 9]).toContain(scenario.gauge.windClock);
      expect(scenario.isWindUniform).toBe(true);
      expect(scenario.gauge.windSpeedMps).toBeGreaterThanOrEqual(2);
      expect(scenario.gauge.windSpeedMps).toBeLessThanOrEqual(2.5);
    }
  });

  it('06: a moderate oblique wind', () => {
    for (const seed of SEEDS) {
      const scenario = createScenario(seed, setupExercise(exercise('06'), seed).scenarioOptions);
      expect([1, 2, 4, 5, 7, 8, 10, 11]).toContain(scenario.gauge.windClock);
      expect(scenario.gauge.windSpeedMps).toBeGreaterThanOrEqual(4);
      expect(scenario.gauge.windSpeedMps).toBeLessThanOrEqual(6);
    }
  });

  it('01: calm standard day', () => {
    const scenario = createScenario(5, setupExercise(exercise('01'), 5).scenarioOptions);
    expect(scenario.zones.every(zone => zone.speedMps === 0)).toBe(true);
    expect(scenario.atmosphere.temperatureC).toBe(15);
    expect(scenario.atmosphere.pressureHpa).toBe(1013);
  });

  it('09 and 12: wind differs by zone', () => {
    expect(setupExercise(exercise('09'), 1).scenarioOptions.isWindUniform).toBe(false);
    expect(setupExercise(exercise('12'), 1).scenarioOptions.isWindUniform).toBe(false);
  });

  it('02: the sight is knocked 0.5–1.5 MIL off; other exercises zero', () => {
    const directions = new Set<string>();
    for (const seed of SEEDS) {
      const { sightOffset } = setupExercise(exercise('02'), seed);
      const offsetMil = Math.hypot(sightOffset.upMrad, sightOffset.rightMrad);
      expect(offsetMil).toBeGreaterThanOrEqual(0.5);
      expect(offsetMil).toBeLessThanOrEqual(1.5);
      directions.add(`${Math.sign(sightOffset.upMrad)}${Math.sign(sightOffset.rightMrad)}`);
      expect(setupExercise(exercise('03'), seed).sightOffset).toEqual({ upMrad: 0, rightMrad: 0 });
    }
    expect(directions.size).toBe(4);
  });
});

describe('skillGoals', () => {
  it('01: dial exact first try at every target', () => {
    expect(skillGoals(exercise('01'), run(firstShotHits(3, { isDialExactFirstTry: true }))).isSkillGoalMet).toBe(true);
    const shots = firstShotHits(3, { isDialExactFirstTry: true });
    shots[1] = { ...shots[1], isDialExactFirstTry: false };
    expect(skillGoals(exercise('01'), run(shots)).isSkillGoalMet).toBe(false);
  });

  it('01: only the first shot at a target counts', () => {
    const shots = [
      shot({ targetIndex: 0, isHit: false, isDialExactFirstTry: true }),
      shot({ targetIndex: 0, isDialExactFirstTry: false }),
    ];
    expect(skillGoals(exercise('01'), run(shots)).isSkillGoalMet).toBe(true);
  });

  function zeroing(groupImpacts: Correction[], cold: Partial<ExerciseShotRecord> = {}, control: Correction = point(0.1, 0.1)): ExerciseRun {
    return run([
      shot({ distanceM: 100, isColdBore: true, impact: point(0.9, 0.4), ...cold }),
      ...groupImpacts.map(impact => shot({ distanceM: 100, impact })),
      shot({ distanceM: 100, impact: control }),
    ]);
  }

  it('02: a group of 0.9 MIL meets the goal, 1.1 MIL does not', () => {
    expect(skillGoals(exercise('02'), zeroing([point(1, 1), point(1, 1.9), point(1.2, 1.4)])).isSkillGoalMet).toBe(true);
    expect(skillGoals(exercise('02'), zeroing([point(1, 1), point(1, 2.1), point(1.2, 1.4)])).isSkillGoalMet).toBe(false);
  });

  it('02: the cold shot does not belong to the group', () => {
    const groupRun = zeroing([point(1, 1), point(1, 1.5), point(1.2, 1.2)], { impact: point(-1, -1) });
    expect(skillGoals(exercise('02'), groupRun).isSkillGoalMet).toBe(true);
  });

  it('02: top goal — a clean cold shot and the control shot within 0.3 MIL', () => {
    const group = [point(1, 1), point(1, 1.5), point(1.2, 1.2)];
    expect(skillGoals(exercise('02'), zeroing(group)).isTopSkillGoalMet).toBe(true);
    expect(skillGoals(exercise('02'), zeroing(group, { diagnosis: 'execution' })).isTopSkillGoalMet).toBe(false);
    expect(skillGoals(exercise('02'), zeroing(group, {}, point(0.3, 0.2))).isTopSkillGoalMet).toBe(false);
  });

  it('03: no jerked trigger; top — breath held on all five', () => {
    const clean = firstShotHits(5, { isBreathHeld: true });
    expect(skillGoals(exercise('03'), run(clean))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: true });
    const jerked = [...clean.slice(0, 4), shot({ targetIndex: 4, diagnosis: 'execution', isBreathHeld: true })];
    expect(skillGoals(exercise('03'), run(jerked)).isSkillGoalMet).toBe(false);
    const breathless = [...clean.slice(0, 4), shot({ targetIndex: 4, isBreathHeld: false })];
    expect(skillGoals(exercise('03'), run(breathless)).isTopSkillGoalMet).toBe(false);
  });

  it('04: speed read without error; top — windage turret exact', () => {
    const good = check('exact', { rowVerdicts: { 'reading-speed': 'close', 'turret-windage': 'exact' } });
    expect(skillGoals(exercise('04'), run(firstShotHits(3, { check: good })))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: true });
    const misread = check('error', { rowVerdicts: { 'reading-speed': 'error', 'turret-windage': 'exact' } });
    expect(skillGoals(exercise('04'), run([...firstShotHits(2, { check: good }), shot({ targetIndex: 2, check: misread })])).isSkillGoalMet).toBe(false);
    const roughWindage = check('close', { rowVerdicts: { 'reading-speed': 'exact', 'turret-windage': 'close' } });
    expect(skillGoals(exercise('04'), run([...firstShotHits(2, { check: good }), shot({ targetIndex: 2, check: roughWindage })])).isTopSkillGoalMet).toBe(false);
  });

  it('a check goal is not met when a shot has no check', () => {
    expect(skillGoals(exercise('06'), run(firstShotHits(4))).isSkillGoalMet).toBe(false);
  });

  it('05: range within 10 % for 2nd class, within 5 % for 1st', () => {
    const within9 = firstShotHits(3, { distanceM: 400, rangeEstimateM: 436 });
    expect(skillGoals(exercise('05'), run(within9))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: false });
    const within4 = firstShotHits(3, { distanceM: 400, rangeEstimateM: 384 });
    expect(skillGoals(exercise('05'), run(within4)).isTopSkillGoalMet).toBe(true);
    const off11 = [...within4.slice(0, 2), shot({ targetIndex: 2, distanceM: 400, rangeEstimateM: 444 })];
    expect(skillGoals(exercise('05'), run(off11)).isSkillGoalMet).toBe(false);
  });

  it('06: no error on every check; top — exact on every check', () => {
    expect(skillGoals(exercise('06'), run(firstShotHits(4, { check: check('close') })))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: false });
    expect(skillGoals(exercise('06'), run(firstShotHits(4, { check: check('exact') }))).isTopSkillGoalMet).toBe(true);
    const withError = [...firstShotHits(3, { check: check('exact') }), shot({ targetIndex: 3, check: check('error') })];
    expect(skillGoals(exercise('06'), run(withError)).isSkillGoalMet).toBe(false);
  });

  it('07: the conditions step without error, even when another step has one', () => {
    const windWrong = check('error', { rowVerdicts: { atmosphere: 'close', wind: 'error' } });
    expect(skillGoals(exercise('07'), run(firstShotHits(4, { check: windWrong })))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: false });
    const conditionsWrong = check('error', { rowVerdicts: { atmosphere: 'error' } });
    expect(skillGoals(exercise('07'), run(firstShotHits(4, { check: conditionsWrong }))).isSkillGoalMet).toBe(false);
  });

  it('08: no error for all three cartridges; top — exact for all', () => {
    const stages = (verdict: CheckVerdict) => [0, 1, 2].map(stageIndex => shot({ stageIndex, distanceM: 600, check: check(verdict) }));
    expect(skillGoals(exercise('08'), run(stages('close')))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: false });
    expect(skillGoals(exercise('08'), run(stages('exact'))).isTopSkillGoalMet).toBe(true);
  });

  it('09: no SIDE error; top — exact everywhere', () => {
    const rounding = check('error', { errorTypes: ['rounding'] });
    expect(skillGoals(exercise('09'), run(firstShotHits(4, { check: rounding }))).isSkillGoalMet).toBe(true);
    const side = check('error', { errorTypes: ['side'] });
    expect(skillGoals(exercise('09'), run([...firstShotHits(3, { check: check('exact') }), shot({ targetIndex: 3, check: side })])).isSkillGoalMet).toBe(false);
  });

  it('10: every first-shot miss finished with the second; top — every call accurate', () => {
    const finished = [shot({ targetIndex: 0, isHit: false, isCallAccurate: true }), shot({ targetIndex: 0, isCallAccurate: true }), ...firstShotHits(2, { isCallAccurate: true }).map(record => ({ ...record, targetIndex: record.targetIndex + 1 }))];
    expect(skillGoals(exercise('10'), run(finished))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: true });
    const unfinished = [shot({ targetIndex: 0, isHit: false, isCallAccurate: true }), shot({ targetIndex: 0, isHit: false, isCallAccurate: true }), shot({ targetIndex: 1, isCallAccurate: true }), shot({ targetIndex: 2, isCallAccurate: true })];
    expect(skillGoals(exercise('10'), run(unfinished)).isSkillGoalMet).toBe(false);
    const badCall = finished.map((record, index) => (index === 3 ? { ...record, isCallAccurate: false } : record));
    expect(skillGoals(exercise('10'), run(badCall)).isTopSkillGoalMet).toBe(false);
  });

  it('11: at least 7 of 10 targets hit and no SIDE error; top — 10 of 10, ambush targets first shot', () => {
    const sevenHit = Array.from({ length: 10 }, (_, targetIndex) => [
      shot({ targetIndex, isHit: targetIndex < 7, check: check('exact') }),
      ...(targetIndex < 7 ? [] : [shot({ targetIndex, isHit: false, check: check('exact') })]),
    ]).flat();
    expect(skillGoals(exercise('11'), run(sevenHit))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: false });
    const sixHit = sevenHit.map(record => (record.targetIndex === 6 ? { ...record, isHit: false } : record));
    expect(skillGoals(exercise('11'), run(sixHit)).isSkillGoalMet).toBe(false);
    const sideError = sevenHit.map((record, index) => (index === 0 ? { ...record, check: check('error', { errorTypes: ['side'] }) } : record));
    expect(skillGoals(exercise('11'), run(sideError)).isSkillGoalMet).toBe(false);
    const allHitAmbushSecond = [
      ...firstShotHits(9, { check: check('exact') }),
      shot({ targetIndex: 9, isHit: false, isAmbush: true, check: check('exact') }),
      shot({ targetIndex: 9, isAmbush: true, check: check('exact') }),
    ];
    expect(skillGoals(exercise('11'), run(allHitAmbushSecond))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: false });
    const allHitTrackingSecond = allHitAmbushSecond.map(record => ({ ...record, isAmbush: false }));
    expect(skillGoals(exercise('11'), run(allHitTrackingSecond)).isTopSkillGoalMet).toBe(true);
    const nineHit = [...firstShotHits(9, { check: check('exact') }), shot({ targetIndex: 9, isHit: false, check: check('exact') }), shot({ targetIndex: 9, isHit: false, check: check('exact') })];
    expect(skillGoals(exercise('11'), run(nineHit)).isTopSkillGoalMet).toBe(false);
  });

  it('12: reference not opened; top — SAM hard', () => {
    const shots = firstShotHits(10);
    expect(skillGoals(exercise('12'), run(shots, { mode: 'manual-easy' }))).toEqual({ isSkillGoalMet: true, isTopSkillGoalMet: false });
    expect(skillGoals(exercise('12'), run(shots, { mode: 'manual-easy', hasOpenedReference: true })).isSkillGoalMet).toBe(false);
    expect(skillGoals(exercise('12'), run(shots, { mode: 'manual-hard' })).isTopSkillGoalMet).toBe(true);
  });

  it('an empty run meets nothing', () => {
    expect(skillGoals(exercise('06'), run([]))).toEqual({ isSkillGoalMet: false, isTopSkillGoalMet: false });
  });
});

describe('exerciseResult', () => {
  it('10, 5, 0 is half the points — not admitted', () => {
    const shots = [shot({ targetIndex: 0 }), shot({ targetIndex: 1, isHit: false }), shot({ targetIndex: 1 }), shot({ targetIndex: 2, isHit: false }), shot({ targetIndex: 2, isHit: false })];
    const result = exerciseResult(exercise('04'), run(shots));
    expect(result.targetPoints).toEqual([10, 5, 0]);
    expect(result.hitShare).toBeCloseTo(0.5, 9);
    expect(result.exerciseClass).toBe(0);
    expect(result.isAdmitted).toBe(false);
  });

  it('10, 10, 5 is 83 % — 3rd class, admitted', () => {
    const shots = [shot({ targetIndex: 0 }), shot({ targetIndex: 1 }), shot({ targetIndex: 2, isHit: false }), shot({ targetIndex: 2 })];
    const result = exerciseResult(exercise('01'), run(shots.map(record => ({ ...record, isDialExactFirstTry: true }))));
    expect(result.total).toBe(25);
    expect(result.exerciseClass).toBe(3);
    expect(result.isAdmitted).toBe(true);
  });

  it('all first shot with the goals is 1st class', () => {
    const result = exerciseResult(exercise('03'), run(firstShotHits(5, { isBreathHeld: true })));
    expect(result.exerciseClass).toBe(1);
  });

  it('targets never shot count as zero', () => {
    const result = exerciseResult(exercise('04'), run([shot({ targetIndex: 0 })]));
    expect(result.targetPoints).toEqual([10, 0, 0]);
  });

  it('calculation points and the mode multiplier go into the total', () => {
    const shots = firstShotHits(4, { check: check('close') });
    const result = exerciseResult(exercise('06'), run(shots, { mode: 'manual-easy' }));
    expect(result.total).toBe(Math.round((40 + 4 * 5) * 1.5));
  });

  it('a calculation counts once per target, from its first shot', () => {
    const shots = [shot({ targetIndex: 0, isHit: false, check: check('exact') }), shot({ targetIndex: 0, check: check('exact') }), ...firstShotHits(3, { check: check('exact') }).map(record => ({ ...record, targetIndex: record.targetIndex + 1 }))];
    expect(exerciseResult(exercise('06'), run(shots)).total).toBe(5 + 30 + 4 * 10);
  });

  it('exercise 08 scores each cartridge stage as its own target', () => {
    const shots = [shot({ stageIndex: 0 }), shot({ stageIndex: 1, isHit: false }), shot({ stageIndex: 1 }), shot({ stageIndex: 2 })];
    expect(exerciseResult(exercise('08'), run(shots)).targetPoints).toEqual([10, 5, 10]);
  });

  it('02 counts hits on paper out of five', () => {
    const shots = [shot({ isColdBore: true }), shot(), shot({ isHit: false }), shot(), shot()];
    const result = exerciseResult(exercise('02'), run(shots));
    expect(result.hitShare).toBeCloseTo(0.8, 9);
    expect(result.total).toBe(40);
    expect(result.exerciseClass).toBe(3);
  });

  it('02 left after two shots counts the share out of five', () => {
    expect(exerciseResult(exercise('02'), run([shot({ isColdBore: true }), shot()])).hitShare).toBeCloseTo(0.4, 9);
  });

  it('the intro has no class and no admission', () => {
    expect(exerciseResult(exercise('00'), run([]))).toEqual({ targetPoints: [], hitShare: 0, total: 0, exerciseClass: 0, isAdmitted: false });
  });

  it('an empty run is not admitted', () => {
    expect(exerciseResult(exercise('04'), run([])).isAdmitted).toBe(false);
  });
});

describe('course progress', () => {
  it('a fresh start opens only the intro', () => {
    const progress = courseProgress({ isIntroCompleted: false, bestClasses: {} });
    expect(progress.unlockedIds).toEqual(['00']);
    expect(progress.nextExerciseId).toBe('00');
    expect(progress.rank).toBe('cadet');
  });

  it('the intro opens 01; 3rd class in 01 opens 02', () => {
    expect(courseProgress({ isIntroCompleted: true, bestClasses: {} }).unlockedIds).toEqual(['00', '01']);
    const progress = courseProgress({ isIntroCompleted: true, bestClasses: { '01': 3 } });
    expect(progress.unlockedIds).toEqual(['00', '01', '02']);
    expect(progress.nextExerciseId).toBe('02');
    expect(progress.admissions).toBe(1);
  });

  it('a failed exercise does not open the next one', () => {
    expect(courseProgress({ isIntroCompleted: true, bestClasses: { '01': 0 } }).unlockedIds).toEqual(['00', '01']);
  });

  it('ranks by admissions: 3 → rifleman, 12 all 1st class → sniper-instructor', () => {
    const ids: ExerciseId[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const firstThree: CourseResults['bestClasses'] = Object.fromEntries(ids.slice(0, 3).map(id => [id, 3]));
    expect(courseProgress({ isIntroCompleted: true, bestClasses: firstThree }).rank).toBe('rifleman');
    const allTop: CourseResults['bestClasses'] = Object.fromEntries(ids.map(id => [id, 1]));
    const finished = courseProgress({ isIntroCompleted: true, bestClasses: allTop });
    expect(finished.freePlayUnlocks.secondFocalPlaneScope).toBe(true);
    expect(courseProgress({ isIntroCompleted: true, bestClasses: { ...allTop, '12': 0 } }).freePlayUnlocks.secondFocalPlaneScope).toBe(false);
    expect(courseProgress({ isIntroCompleted: true, bestClasses: { '09': 3 } }).freePlayUnlocks.longRangeScope).toBe(true);
    expect(finished.rank).toBe('sniper-instructor');
    expect(finished.nextExerciseId).toBeNull();
    const oneSecond: CourseResults['bestClasses'] = { ...allTop, '07': 2 };
    expect(courseProgress({ isIntroCompleted: true, bestClasses: oneSecond }).rank).toBe('sniper');
  });

  it('free play unlocks follow the course', () => {
    const after05 = courseProgress({ isIntroCompleted: true, bestClasses: { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3 } }).freePlayUnlocks;
    expect(after05.milDotScope).toBe(false);
    expect(after05.moaScope).toBe(false);
    const after06 = courseProgress({ isIntroCompleted: true, bestClasses: { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3 } }).freePlayUnlocks;
    expect(after06).toEqual({
      unknownDistance: true,
      manualEasy: true,
      moaScope: true,
      milDotScope: true,
      cartridgesAC: false,
      gustyWind: false,
      longRangeScope: false,
      manualHard: false,
      secondFocalPlaneScope: false,
    });
  });

  it('"unlock everything" opens every exercise and free play option but leaves the rank', () => {
    const progress = courseProgress({ isIntroCompleted: false, bestClasses: {} }, true);
    expect(progress.unlockedIds).toEqual(COURSE.map(def => def.id));
    expect(Object.values(progress.freePlayUnlocks).every(Boolean)).toBe(true);
    expect(progress.rank).toBe('cadet');
  });

  it('a repeat never lowers the best class', () => {
    expect(mergeBestClass(2, 3)).toBe(2);
    expect(mergeBestClass(3, 1)).toBe(1);
    expect(mergeBestClass(2, 0)).toBe(2);
    expect(mergeBestClass(0, 3)).toBe(3);
    expect(mergeBestClass(undefined, 0)).toBe(0);
  });
});
