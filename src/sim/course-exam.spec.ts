import { describe, expect, it } from 'vitest';
import { courseProgress, CourseResults, ExerciseId, isExamCredited, isExamOffered, isExamPassed } from './course';

const TRAINING_IDS: ExerciseId[] = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];

function results(fields: Partial<CourseResults> = {}): CourseResults {
  return { isIntroCompleted: true, bestClasses: {}, ...fields };
}

describe('экзамен вместо курса (T3.6)', () => {
  it('сдан при доле попаданий от 85 % включительно', () => {
    expect(isExamPassed({ hitShare: 0.85 })).toBe(true);
    expect(isExamPassed({ hitShare: 0.849 })).toBe(false);
  });

  it('сданный экзамен допускает 01–11 без класса: 11 допусков, следующий — 12, открыто до 12', () => {
    const progress = courseProgress(results({ isExamPassed: true }));
    expect(progress.admissions).toBe(11);
    expect(progress.nextExerciseId).toBe('12');
    expect(progress.unlockedIds).toContain('12');
    expect(progress.unlockedIds).not.toContain('13');
  });

  it('с классом 12 после экзамена — 12 допусков, открыты 13 и 14 по порядку', () => {
    const progress = courseProgress(results({ isExamPassed: true, bestClasses: { '12': 2 } }));
    expect(progress.admissions).toBe(12);
    expect(progress.nextExerciseId).toBe('13');
  });

  it('зачтено экзаменом — только 01–11 без своего класса', () => {
    const passed = results({ isExamPassed: true, bestClasses: { '03': 2 } });
    expect(isExamCredited(passed, '04')).toBe(true);
    expect(isExamCredited(passed, '03')).toBe(false);
    expect(isExamCredited(passed, '00')).toBe(false);
    expect(isExamCredited(passed, '12')).toBe(false);
    expect(isExamCredited(results(), '04')).toBe(false);
  });

  it('предлагается, пока хоть одно из 01–11 не допущено', () => {
    expect(isExamOffered(results())).toBe(true);
    const allButEleven = Object.fromEntries(TRAINING_IDS.slice(0, -1).map(id => [id, 3]));
    expect(isExamOffered(results({ bestClasses: allButEleven }))).toBe(true);
    expect(isExamOffered(results({ bestClasses: { ...allButEleven, '11': 3 } }))).toBe(false);
    expect(isExamOffered(results({ isExamPassed: true }))).toBe(false);
  });
});
