import { modeMultiplier, NotebookMode } from '../../core/exercise-scoring';
import { CourseResults, ExerciseDef, TargetDistance } from '../../sim/course';
import { teachingScript } from '../instructor/teaching.model';
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
  modeOptions: { mode: NotebookMode; label: string }[] | null;
  novelty: string | null;
  best: string | null;
  termsLine: string | null;
  instructor: { isDefaultOn: boolean } | null;
  introLine: string | null;
}

const ATTESTATION_ID = '12';
const INTRO_ID = '00';
const INTRO_LINE = 'Без стрельбы и оценки. Семь шагов: винтовка, прицел, барабан, кратность, сетки, патроны, затвор';

export function briefingCard(def: ExerciseDef, course: CourseResults): BriefingCard {
  const bestClass = course.bestClasses[def.id];
  const bestTotal = course.bestTotals?.[def.id];
  const isAdmittedBefore = bestClass !== undefined && bestClass !== 0;
  const isIntro = def.id === INTRO_ID;
  return {
    header: `ЗАДАНИЕ ${def.id} · ${isIntro ? 'ВВОДНОЕ' : def.id === ATTESTATION_ID ? 'АТТЕСТАЦИЯ' : 'УЧЕБНОЕ'}`,
    title: def.title,
    scheme: {
      distanceText: def.targets ? distanceText(def.targets.distance) : '',
      isPaper: isPaperExercise(def),
      hasFlag: def.conditions.windScale !== 0,
      targetCount: def.targets?.count ?? 0,
    },
    facts: exerciseSheet(def),
    classRows: isIntro
      ? []
      : [
          '3 класс — от 70 % очков',
          `2 класс — 85 % и ${def.goals.second}`,
          `1 класс — ${def.goals.first ? `${allFirstText(def)} и ${def.goals.first}` : allFirstText(def)}`,
        ],
    mode: def.notebookMode ? modeLabel(def.notebookMode) : '—',
    modeOptions: def.modeChoices ? def.modeChoices.map(mode => ({ mode, label: modeLabel(mode) })) : null,
    novelty: !isAdmittedBefore && def.novelty ? `Новое: ${def.novelty}` : null,
    best: bestTotal !== undefined ? `лучший: ${bestClass ? classStamp(bestClass).toLowerCase() : 'не зачтено'} · ${bestTotal} очк.` : null,
    termsLine: def.terms.length > 0 ? `узнаешь: ${def.terms.join(' · ')}` : null,
    instructor: teachingScript(def.id) ? { isDefaultOn: !isAdmittedBefore } : null,
    introLine: isIntro ? INTRO_LINE : null,
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

function modeLabel(mode: NotebookMode): string {
  return `${MODE_LABELS[mode]} × ${modeMultiplier(mode, false).toFixed(1)}`;
}
