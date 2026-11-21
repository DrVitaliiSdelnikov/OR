import { ExerciseClass, Rank } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { ATTESTATION_ID, courseProgress, CourseResults, exerciseById, ExerciseId, ExerciseResult, exerciseTitle, isExamPassed, mergeBestClass } from '../../sim/course';
import { UnitSystem } from '../../core/units';

export type ContinueCard =
  | { kind: 'start'; exerciseId: ExerciseId; title: string }
  | { kind: 'continue'; exerciseId: ExerciseId; title: string; status: 'new' | 'not-admitted' }
  | { kind: 'drills' };

export interface RankHeader {
  rankLabel: string;
  admissions: number;
  admissionsTotal: number;
}

export const ADMISSIONS_TOTAL = 12;

export const RANK_LABELS: Record<Rank, string> = text.screens.home.ranks;

export function continueCard(results: CourseResults, system: UnitSystem = 'metric'): ContinueCard {
  const nextId = courseProgress(results).nextExerciseId;
  if (nextId === null) {
    return { kind: 'drills' };
  }
  const title = exerciseTitle(exerciseById(nextId)!, system);
  if (!results.isIntroCompleted) {
    return { kind: 'start', exerciseId: nextId, title };
  }
  return { kind: 'continue', exerciseId: nextId, title, status: results.bestClasses[nextId] === undefined ? 'new' : 'not-admitted' };
}

export function rankHeader(results: CourseResults): RankHeader {
  const progress = courseProgress(results);
  return { rankLabel: RANK_LABELS[progress.rank], admissions: progress.admissions, admissionsTotal: ADMISSIONS_TOTAL };
}

export function withExerciseResult(results: CourseResults, exerciseId: ExerciseId, exerciseClass: ExerciseClass, total?: number): CourseResults {
  const bestClasses = { ...results.bestClasses, [exerciseId]: mergeBestClass(results.bestClasses[exerciseId], exerciseClass) };
  if (total === undefined) {
    return { ...results, bestClasses };
  }
  const previousTotal = results.bestTotals?.[exerciseId];
  const bestTotal = previousTotal === undefined ? total : Math.max(previousTotal, total);
  return { ...results, bestClasses, bestTotals: { ...results.bestTotals, [exerciseId]: bestTotal } };
}

export function withExamResult(results: CourseResults, result: Pick<ExerciseResult, 'hitShare' | 'exerciseClass' | 'total'>): CourseResults {
  if (!isExamPassed(result)) {
    return results;
  }
  return { ...withExerciseResult(results, ATTESTATION_ID, result.exerciseClass, result.total), isExamPassed: true };
}

export function withIntroCompleted(results: CourseResults): CourseResults {
  return { ...results, isIntroCompleted: true };
}
