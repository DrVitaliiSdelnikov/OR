import { describe, expect, it } from 'vitest';
import { CourseResults, ExerciseId } from '../../sim/course';
import { continueCard, rankHeader, withExerciseResult, withIntroCompleted } from './home.model';

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

  it('course finished: free play', () => {
    expect(continueCard(results(Object.fromEntries(ADMISSION_IDS.map(id => [id, 3]))))).toEqual({ kind: 'free-play' });
  });
});

describe('rank header', () => {
  it.each([
    [0, false, 'Курсант'],
    [3, false, 'Стрелок'],
    [7, false, 'Старший стрелок'],
    [12, false, 'Снайпер'],
    [12, true, 'Снайпер-инструктор'],
  ] as const)('%i admissions (all 1st class: %s) → %s', (admissions, isAllTop, label) => {
    const bestClasses = Object.fromEntries(ADMISSION_IDS.slice(0, admissions).map(id => [id, isAllTop ? 1 : 3]));
    expect(rankHeader(results(bestClasses))).toEqual({ rankLabel: label, admissions, admissionsTotal: 12 });
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

  it('the intro is marked as completed', () => {
    expect(withIntroCompleted(results({}, false)).isIntroCompleted).toBe(true);
  });
});
