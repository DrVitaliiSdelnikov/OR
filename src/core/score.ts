/** @deprecated Заменяется `core/exercise-scoring.ts`, удалить в S8 (docs/code/REMOVAL-CANDIDATES.md). */
export const POINTS_CENTER = 10;
/** @deprecated Заменяется `core/exercise-scoring.ts`, удалить в S8 (docs/code/REMOVAL-CANDIDATES.md). */
export const POINTS_PLATE = 5;
/** @deprecated Заменяется `core/exercise-scoring.ts`, удалить в S8 (docs/code/REMOVAL-CANDIDATES.md). */
export const STAR_THRESHOLDS = [0.7, 0.85, 1] as const;

/** @deprecated Заменяется `core/exercise-scoring.ts`, удалить в S8 (docs/code/REMOVAL-CANDIDATES.md). */
export function shotPoints(missMrad: number, radiusMrad: number): number {
  if (missMrad <= radiusMrad * 0.5) {
    return POINTS_CENTER;
  }
  return missMrad <= radiusMrad ? POINTS_PLATE : 0;
}

/** @deprecated Заменяется `core/exercise-scoring.ts`, удалить в S8 (docs/code/REMOVAL-CANDIDATES.md). */
export function starsFor(score: number, maxScore: number): 0 | 1 | 2 | 3 {
  if (maxScore <= 0) {
    return 0;
  }
  const share = score / maxScore;
  return STAR_THRESHOLDS.filter(threshold => share >= threshold - 1e-9).length as 0 | 1 | 2 | 3;
}

/** @deprecated Заменяется `core/exercise-scoring.ts`, удалить в S8 (docs/code/REMOVAL-CANDIDATES.md). */
export function isPassed(score: number, maxScore: number): boolean {
  return starsFor(score, maxScore) >= 1;
}
