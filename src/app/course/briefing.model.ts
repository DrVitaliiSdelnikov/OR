import { modeMultiplier, NotebookMode, SECOND_CLASS_SHARE, THIRD_CLASS_SHARE } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { CourseResults, ExerciseDef, TargetDistance } from '../../sim/course';
import { teachingScript } from '../instructor/teaching.model';
import { classStamp, firstClassGoalText, isPaperExercise } from '../result/result.model';
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
const T = text.briefing;

export function briefingCard(def: ExerciseDef, course: CourseResults): BriefingCard {
  const bestClass = course.bestClasses[def.id];
  const bestTotal = course.bestTotals?.[def.id];
  const isAdmittedBefore = bestClass !== undefined && bestClass !== 0;
  const isIntro = def.id === INTRO_ID;
  return {
    header: T.header({ exerciseId: def.id, kind: isIntro ? 'intro' : def.id === ATTESTATION_ID ? 'attestation' : 'training' }),
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
          T.thirdClass({ minShare: THIRD_CLASS_SHARE }),
          T.secondClass({ minShare: SECOND_CLASS_SHARE, goal: def.goals.second }),
          T.firstClass({ goal: firstClassGoalText(def) }),
        ],
    mode: def.notebookMode ? modeLabel(def.notebookMode) : T.noMode,
    modeOptions: def.modeChoices ? def.modeChoices.map(mode => ({ mode, label: modeLabel(mode) })) : null,
    novelty: !isAdmittedBefore && def.novelty ? T.novelty({ novelty: def.novelty }) : null,
    best: bestTotal !== undefined ? T.best({ stamp: bestClass ? classStamp(bestClass).toLowerCase() : T.bestNotAdmitted, total: bestTotal }) : null,
    termsLine: def.terms.length > 0 ? T.terms({ terms: def.terms }) : null,
    instructor: teachingScript(def.id) ? { isDefaultOn: !isAdmittedBefore } : null,
    introLine: isIntro ? T.introLine : null,
  };
}

function distanceText(distance: TargetDistance): string {
  switch (distance.kind) {
    case 'fixed':
      return T.fixedDistance({ distanceM: distance.distanceM });
    case 'known':
      return T.knownDistance(distance);
    case 'unknown':
      return T.unknownDistance(distance);
  }
}

function modeLabel(mode: NotebookMode): string {
  return T.mode({ label: MODE_LABELS[mode], multiplier: modeMultiplier(mode, false) });
}
