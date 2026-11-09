import { ExerciseClass } from '../../core/exercise-scoring';
import { courseProgress, CourseResults, ExerciseDef, exerciseById, ExerciseResult, ExerciseShotRecord, GoalCheck } from '../../sim/course';
import { MainCause } from '../../sim/miss-breakdown';
import { RANK_LABELS } from '../home/home.model';

export type StampTone = 'gold' | 'silver' | 'bronze' | 'red';

export interface ClassRowView {
  label: string;
  text: string;
  isMet: boolean;
}

export interface ResultSheetView {
  stamp: string;
  stampTone: StampTone;
  struckClass: string | null;
  rankPlate: string | null;
  classRows: ClassRowView[];
  scoreLine: string;
  recordLine: string;
  mainError: string;
  newTerms: readonly string[];
  openedLine: string | null;
  isAdmitted: boolean;
}

export interface ResultInput {
  def: ExerciseDef;
  result: ExerciseResult;
  records: readonly ExerciseShotRecord[];
  courseBefore: CourseResults;
  courseAfter: CourseResults;
}

const PERCENT = 100;
const THIRD_CLASS_SHARE = 0.7;
const SECOND_CLASS_SHARE = 0.85;
const FIRST_CLASS_SHARE = 1;
const SHARE_EPSILON = 1e-9;
const FIRST_SHOT_POINTS = 10;
export const STAMP_TONES: Record<ExerciseClass, StampTone> = { 0: 'red', 1: 'gold', 2: 'silver', 3: 'bronze' };
const MAIN_CAUSE_ORDER: readonly MainCause[] = ['calc', 'wind-under', 'wind-over', 'hold', 'trigger', 'zero'];
export const MAIN_CAUSE_PHRASES: Record<MainCause, string> = {
  calc: 'ошибка расчёта',
  'wind-under': 'недооценка ветра',
  'wind-over': 'переоценка ветра',
  hold: 'удержание сетки',
  trigger: 'срыв спуска',
  zero: 'ноль прицела',
};

export function classStamp(exerciseClass: ExerciseClass): string {
  return exerciseClass === 0 ? 'НЕ ЗАЧТЕНО' : `${exerciseClass} КЛАСС`;
}

export function isPaperExercise(def: ExerciseDef): boolean {
  return def.stages.length > 0 && def.stages.every(stage => !stage.closesOnHit);
}

export function allFirstText(def: ExerciseDef): string {
  return isPaperExercise(def) ? 'все в мишень' : 'все первым';
}

export function resultSheet(input: ResultInput): ResultSheetView {
  const { def, result, courseBefore, courseAfter } = input;
  const previousClass = courseBefore.bestClasses[def.id];
  const isFirstAdmission = result.isAdmitted && !previousClass;
  const rankBefore = courseProgress(courseBefore).rank;
  const progressAfter = courseProgress(courseAfter);
  const openedId = progressAfter.unlockedIds.find(id => !courseProgress(courseBefore).unlockedIds.includes(id));
  return {
    stamp: classStamp(result.exerciseClass),
    stampTone: STAMP_TONES[result.exerciseClass],
    struckClass: previousClass && result.exerciseClass !== 0 && result.exerciseClass < previousClass ? classStamp(previousClass) : null,
    rankPlate: progressAfter.rank !== rankBefore ? `Звание: ${RANK_LABELS[progressAfter.rank]}` : null,
    classRows: classRows(def, result),
    scoreLine: scoreLine(def, result),
    recordLine: recordLine(result.total, courseBefore.bestTotals?.[def.id]),
    mainError: mainError(def, result, input.records),
    newTerms: isFirstAdmission ? def.terms : [],
    openedLine: openedId ? `Открыто: ${openedId} · ${exerciseById(openedId)!.title}` : null,
    isAdmitted: result.isAdmitted,
  };
}

function classRows(def: ExerciseDef, result: ExerciseResult): ClassRowView[] {
  const share = result.hitShare;
  const isShareAtLeast = (limit: number): boolean => share >= limit - SHARE_EPSILON;
  const firstGoal = def.goals.first ? `${allFirstText(def)} и ${def.goals.first}` : allFirstText(def);
  const firstFact = def.goals.first ? goalFact(result.goals.top) : firstShotFact(def, result);
  return [
    { label: '3 класс', text: `≥ 70 % очков — ${Math.round(share * PERCENT)} %`, isMet: isShareAtLeast(THIRD_CLASS_SHARE) },
    { label: '2 класс', text: `≥ 85 % и ${def.goals.second} — ${goalFact(result.goals.skill)}`, isMet: isShareAtLeast(SECOND_CLASS_SHARE) && result.goals.skill.isMet },
    { label: '1 класс', text: `${firstGoal} — ${firstFact}`, isMet: result.exerciseClass === 1 },
  ];
}

function goalFact(goal: GoalCheck): string {
  if (goal.valueMil !== undefined) {
    return `${goal.valueMil.toFixed(1)} MIL`;
  }
  if (goal.total !== undefined) {
    return `${goal.passed} из ${goal.total}`;
  }
  return goal.isMet ? 'да' : 'нет';
}

function firstShotFact(def: ExerciseDef, result: ExerciseResult): string {
  const firstShotHits = result.targetPoints.filter(points => points === FIRST_SHOT_POINTS).length;
  return isPaperExercise(def) ? `${Math.round(result.hitShare * PERCENT)} %` : `${firstShotHits} из ${result.targetPoints.length}`;
}

function scoreLine(def: ExerciseDef, result: ExerciseResult): string {
  const { targetSum, calcSum, multiplier, referencePenalty } = result.score;
  const sum = targetSum + calcSum;
  const paperPrefix = isPaperExercise(def) ? `попаданий ${targetSum / FIRST_SHOT_POINTS} из ${def.stages[0].maxShotsPerTarget} · ` : '';
  const multiplied = multiplier === 1 ? '' : ` × ${multiplier} = ${result.total + referencePenalty}`;
  const penalty = referencePenalty > 0 ? ` − ${referencePenalty} справочник = ${result.total}` : '';
  return `${paperPrefix}цели ${targetSum} + расчёт ${calcSum} = ${sum}${multiplied}${penalty}`;
}

function recordLine(total: number, previousBest: number | undefined): string {
  if (total > 0 && (previousBest === undefined || total > previousBest)) {
    return 'новый рекорд';
  }
  return `рекорд ${Math.max(previousBest ?? 0, total)}`;
}

function mainError(def: ExerciseDef, result: ExerciseResult, records: readonly ExerciseShotRecord[]): string {
  if (result.exerciseClass === 1) {
    return 'Ошибок нет';
  }
  const counts = MAIN_CAUSE_ORDER.map(cause => ({ cause, count: records.filter(record => record.mainCause === cause).length }));
  const top = counts.reduce((best, next) => (next.count > best.count ? next : best));
  if (top.count > 0) {
    return `${top.count} из ${records.length} — ${MAIN_CAUSE_PHRASES[top.cause]}`;
  }
  return `Не выполнено: ${firstUnmetGoal(def, result)}`;
}

function firstUnmetGoal(def: ExerciseDef, result: ExerciseResult): string {
  const share = result.hitShare;
  const steps: { isMet: boolean; text: string }[] = [
    { isMet: share >= THIRD_CLASS_SHARE - SHARE_EPSILON, text: '≥ 70 % очков' },
    { isMet: share >= SECOND_CLASS_SHARE - SHARE_EPSILON, text: '≥ 85 % очков' },
    { isMet: result.goals.skill.isMet, text: def.goals.second },
    { isMet: share >= FIRST_CLASS_SHARE - SHARE_EPSILON, text: allFirstText(def) },
    { isMet: result.goals.top.isMet, text: def.goals.first ?? allFirstText(def) },
  ];
  return steps.find(step => !step.isMet)?.text ?? allFirstText(def);
}
