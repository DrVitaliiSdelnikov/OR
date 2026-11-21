import { describe, expect, it } from 'vitest';
import { CourseResults, ExerciseId } from '../../sim/course';
import { admissionsHeader, continueCard, withExamResult, withExerciseResult, withIntroCompleted } from './home.model';

const ADMISSION_IDS: ExerciseId[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

function results(bestClasses: CourseResults['bestClasses'], isIntroCompleted = true): CourseResults {
  return { isIntroCompleted, bestClasses };
}

describe('continue card', () => {
  it('first launch: start with 00', () => {
    expect(continueCard(results({}, false))).toEqual({ kind: 'start', exerciseId: '00', title: 'Винтовка и прицел' });
  });

  it('in progress: the next exercise, new or not passed yet', () => {
    const fourAdmitted = results({ '01': 3, '02': 3, '03': 1, '04': 2 });
    expect(continueCard(fourAdmitted)).toEqual({ kind: 'continue', exerciseId: '05', title: 'Дистанции: ДОПЕ и дальномер', status: 'new' });
    expect(continueCard(results({ ...fourAdmitted.bestClasses, '05': 0 }))).toEqual({
      kind: 'continue',
      exerciseId: '05',
      title: 'Дистанции: ДОПЕ и дальномер',
      status: 'not-admitted',
    });
  });

  it('course finished with 13–14: drills', () => {
    expect(continueCard(results(Object.fromEntries([...ADMISSION_IDS, '13', '14'].map(id => [id, 3]))))).toEqual({ kind: 'drills' });
  });

  it('after the attestation: continue with 13', () => {
    expect(continueCard(results(Object.fromEntries(ADMISSION_IDS.map(id => [id, 3]))))).toEqual({ kind: 'continue', exerciseId: '13', title: 'Горный склон', status: 'new' });
  });
});

describe('admissions header (T4.4: no ranks)', () => {
  it.each([0, 3, 12])('%i admissions of 12', admissions => {
    const bestClasses = Object.fromEntries(ADMISSION_IDS.slice(0, admissions).map(id => [id, 1]));
    expect(admissionsHeader(results(bestClasses))).toEqual({ admissions, admissionsTotal: 12 });
  });
});

describe('course progress in storage', () => {
  it('a repeat never lowers the class; a failed repeat keeps it', () => {
    let course = results({}, false);
    course = withExerciseResult(course, '01', 3);
    expect(course.bestClasses['01']).toBe(3);
    course = withExerciseResult(course, '01', 2);
    expect(course.bestClasses['01']).toBe(2);
    course = withExerciseResult(course, '01', 0);
    expect(course.bestClasses['01']).toBe(2);
  });

  it('the best total is kept per exercise: a better one replaces it, a worse one does not (A6.3)', () => {
    let course = results({});
    course = withExerciseResult(course, '04', 3, 25);
    expect(course.bestTotals?.['04']).toBe(25);
    course = withExerciseResult(course, '04', 0, 10);
    expect(course.bestTotals?.['04']).toBe(25);
    course = withExerciseResult(course, '04', 2, 40);
    expect(course.bestTotals?.['04']).toBe(40);
  });

  it('the intro is marked as completed', () => {
    expect(withIntroCompleted(results({}, false)).isIntroCompleted).toBe(true);
  });
});

describe('название 10 в единицах игрока (T1.8c)', () => {
  it('«Пристрелка на 425» в имперских, «на 400» в метрике', () => {
    const toTen = results(Object.fromEntries(ADMISSION_IDS.slice(0, 9).map(id => [id, 3])));
    expect(continueCard(toTen, 'imperial')).toMatchObject({ exerciseId: '10', title: 'Пристрелка на 425' });
    expect(continueCard(toTen)).toMatchObject({ exerciseId: '10', title: 'Пристрелка на 400' });
  });
});

describe('exam result (T3.6)', () => {
  const examRun = (hitShare: number) => ({ hitShare, exerciseClass: 2 as const, total: 180 });

  it('passed: the exam flag and the class and total of 12', () => {
    expect(withExamResult(results({ '01': 3 }), examRun(0.9))).toEqual({ isIntroCompleted: true, isExamPassed: true, bestClasses: { '01': 3, '12': 2 }, bestTotals: { '12': 180 } });
  });

  it('failed: the course does not change', () => {
    const before = results({ '01': 3 });
    expect(withExamResult(before, examRun(0.8))).toBe(before);
  });
});
