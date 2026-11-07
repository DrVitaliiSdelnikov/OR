import { ExerciseClass, Rank } from '../../core/exercise-scoring';
import { courseProgress, CourseResults, exerciseById, ExerciseId, mergeBestClass } from '../../sim/course';

export type ContinueCard =
  | { kind: 'start'; exerciseId: ExerciseId; title: string }
  | { kind: 'continue'; exerciseId: ExerciseId; title: string; status: 'new' | 'not-admitted' }
  | { kind: 'free-play' };

export interface RankHeader {
  rankLabel: string;
  admissions: number;
  admissionsTotal: number;
}

export const ADMISSIONS_TOTAL = 12;

const RANK_LABELS: Record<Rank, string> = {
  cadet: 'Курсант',
  rifleman: 'Стрелок',
  'senior-rifleman': 'Старший стрелок',
  sniper: 'Снайпер',
  'sniper-instructor': 'Снайпер-инструктор',
};

export function continueCard(results: CourseResults): ContinueCard {
  const nextId = courseProgress(results).nextExerciseId;
  if (nextId === null) {
    return { kind: 'free-play' };
  }
  const title = exerciseById(nextId)!.title;
  if (!results.isIntroCompleted) {
    return { kind: 'start', exerciseId: nextId, title };
  }
  return { kind: 'continue', exerciseId: nextId, title, status: results.bestClasses[nextId] === undefined ? 'new' : 'not-admitted' };
}

export function rankHeader(results: CourseResults): RankHeader {
  const progress = courseProgress(results);
  return { rankLabel: RANK_LABELS[progress.rank], admissions: progress.admissions, admissionsTotal: ADMISSIONS_TOTAL };
}

export function withExerciseResult(results: CourseResults, exerciseId: ExerciseId, exerciseClass: ExerciseClass): CourseResults {
  return { ...results, bestClasses: { ...results.bestClasses, [exerciseId]: mergeBestClass(results.bestClasses[exerciseId], exerciseClass) } };
}

export function withIntroCompleted(results: CourseResults): CourseResults {
  return { ...results, isIntroCompleted: true };
}
