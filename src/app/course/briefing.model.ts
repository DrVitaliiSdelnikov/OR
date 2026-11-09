import { modeMultiplier } from '../../core/exercise-scoring';
import { CourseResults, ExerciseDef, TargetDistance } from '../../sim/course';
import { allFirstText, classStamp, isPaperExercise } from '../result/result.model';
import { exerciseSheet, ExerciseSheet, MODE_LABELS } from './course-trail.model';

export interface BriefingScheme {
  distanceText: string;
  isPaper: boolean;
  hasFlag: boolean;
  targetCount: number;
}

export interface BriefingCard {
  header: string;
  title: string;
  scheme: BriefingScheme;
  facts: ExerciseSheet;
  classRows: string[];
  mode: string;
  novelty: string | null;
  best: string | null;
  termsLine: string | null;
}

const ATTESTATION_ID = '12';

export function briefingCard(def: ExerciseDef, course: CourseResults): BriefingCard {
  const bestClass = course.bestClasses[def.id];
  const bestTotal = course.bestTotals?.[def.id];
  const isAdmittedBefore = bestClass !== undefined && bestClass !== 0;
  return {
    header: `ЗАДАНИЕ ${def.id} · ${def.id === ATTESTATION_ID ? 'АТТЕСТАЦИЯ' : 'УЧЕБНОЕ'}`,
    title: def.title,
    scheme: {
      distanceText: def.targets ? distanceText(def.targets.distance) : '',
      isPaper: isPaperExercise(def),
      hasFlag: def.conditions.windScale !== 0,
      targetCount: def.targets?.count ?? 0,
    },
    facts: exerciseSheet(def),
    classRows: [
      '3 класс — от 70 % очков',
      `2 класс — 85 % и ${def.goals.second}`,
      `1 класс — ${def.goals.first ? `${allFirstText(def)} и ${def.goals.first}` : allFirstText(def)}`,
    ],
    mode: def.notebookMode ? `${MODE_LABELS[def.notebookMode]} × ${modeMultiplier(def.notebookMode, false).toFixed(1)}` : '—',
    novelty: !isAdmittedBefore && def.novelty ? `Новое: ${def.novelty}` : null,
    best: bestTotal !== undefined ? `лучший: ${bestClass ? classStamp(bestClass).toLowerCase() : 'не зачтено'} · ${bestTotal} очк.` : null,
    termsLine: def.terms.length > 0 ? `узнаешь: ${def.terms.join(' · ')}` : null,
  };
}

function distanceText(distance: TargetDistance): string {
  switch (distance.kind) {
    case 'fixed':
      return `${distance.distanceM} м`;
    case 'known':
      return `${distance.fromM}–${distance.toM} м`;
    case 'unknown':
      return `${distance.fromM}–${distance.toM} м · неизвестно`;
  }
}
