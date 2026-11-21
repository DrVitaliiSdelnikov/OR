import { ExerciseClass, FIRST_CLASS_SHARE, FIRST_SHOT_POINTS, SECOND_CLASS_SHARE, THIRD_CLASS_SHARE } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { courseProgress, CourseResults, EXAM_PASS_SHARE, exerciseById, ExerciseDef, ExerciseResult, ExerciseShotRecord, exerciseTitle, GoalCheck, isExamPassed } from '../../sim/course';
import { CAUSE_ORDER, MainCause, mainOfAmounts } from '../../sim/miss-breakdown';
import { lowerFirst } from '../../i18n/format';
import { SKILL_IDS, SkillRatings } from '../../sim/skill-rating';
import { UnitSystem } from '../../core/units';

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
  skillGrowth: SkillGrowthView[];
  classRows: ClassRowView[];
  scoreLine: string;
  recordLine: string;
  mainError: string;
  newTerms: readonly string[];
  openedLine: string | null;
  examLine: string | null;
  isAdmitted: boolean;
}

export interface SkillGrowthView {
  skill: string;
  text: string;
  isUp: boolean;
}

export interface ResultInput {
  def: ExerciseDef;
  result: ExerciseResult;
  records: readonly ExerciseShotRecord[];
  courseBefore: CourseResults;
  courseAfter: CourseResults;
  skillsBefore?: SkillRatings;
  skillsAfter?: SkillRatings;
  system?: UnitSystem;
  isExam?: boolean;
}

const T = text.result;
const SHARE_EPSILON = 1e-9;
export const STAMP_TONES: Record<ExerciseClass, StampTone> = { 0: 'red', 1: 'gold', 2: 'silver', 3: 'bronze' };
const MAIN_CAUSE_ORDER: readonly MainCause[] = ['calc', 'wind-under', 'wind-over', 'lead', 'hold', 'trigger', 'zero'];
export const MAIN_CAUSE_PHRASES: Record<MainCause, string> = T.mainCauses;

export function classStamp(exerciseClass: ExerciseClass): string {
  return exerciseClass === 0 ? T.notAdmittedStamp : T.classStamp({ exerciseClass });
}

export function isPaperExercise(def: ExerciseDef): boolean {
  return def.stages.length > 0 && def.stages.every(stage => !stage.closesOnHit);
}

export function allFirstText(def: ExerciseDef): string {
  return isPaperExercise(def) ? T.allFirstPaper : T.allFirst;
}

export function firstClassGoalText(def: ExerciseDef): string {
  return def.goals.first ? T.bothGoals({ allFirst: allFirstText(def), goal: def.goals.first }) : allFirstText(def);
}

function examLine(result: ExerciseResult): string {
  const shares = { share: result.hitShare, minShare: EXAM_PASS_SHARE };
  return isExamPassed(result) ? T.examPassed(shares) : T.examFailed(shares);
}

export function resultSheet(input: ResultInput): ResultSheetView {
  const { def, result, courseBefore, courseAfter } = input;
  const previousClass = courseBefore.bestClasses[def.id];
  const isFirstAdmission = result.isAdmitted && !previousClass;
  const progressAfter = courseProgress(courseAfter);
  const openedId = progressAfter.unlockedIds.find(id => !courseProgress(courseBefore).unlockedIds.includes(id));
  return {
    stamp: classStamp(result.exerciseClass),
    stampTone: STAMP_TONES[result.exerciseClass],
    struckClass: previousClass && result.exerciseClass !== 0 && result.exerciseClass < previousClass ? classStamp(previousClass) : null,
    skillGrowth: input.skillsBefore && input.skillsAfter ? skillGrowth(input.skillsBefore, input.skillsAfter) : [],
    classRows: classRows(def, result),
    scoreLine: scoreLine(def, result),
    recordLine: recordLine(result.total, courseBefore.bestTotals?.[def.id]),
    mainError: mainError(def, result, input.records),
    newTerms: isFirstAdmission ? def.terms : [],
    examLine: input.isExam ? examLine(result) : null,
    openedLine: openedId ? T.opened({ exerciseId: openedId, title: exerciseTitle(exerciseById(openedId)!, input.system ?? 'metric') }) : null,
    isAdmitted: result.isAdmitted,
  };
}

export function skillGrowth(before: SkillRatings, after: SkillRatings): SkillGrowthView[] {
  return SKILL_IDS.flatMap(skill => {
    const [wasRating, isRating] = [Math.round(before[skill].rating), Math.round(after[skill].rating)];
    return wasRating === isRating ? [] : [{ skill: text.drills.skills[skill], text: T.skillGrowth({ before: wasRating, after: isRating }), isUp: isRating > wasRating }];
  });
}

function classRows(def: ExerciseDef, result: ExerciseResult): ClassRowView[] {
  const share = result.hitShare;
  const isShareAtLeast = (limit: number): boolean => share >= limit - SHARE_EPSILON;
  const firstFact = def.goals.first ? goalFact(result.goals.top) : firstShotFact(def, result);
  return [
    { label: T.classLabel({ exerciseClass: 3 }), text: T.thirdClassRow({ minShare: THIRD_CLASS_SHARE, share }), isMet: isShareAtLeast(THIRD_CLASS_SHARE) },
    {
      label: T.classLabel({ exerciseClass: 2 }),
      text: T.secondClassRow({ minShare: SECOND_CLASS_SHARE, goal: def.goals.second, fact: goalFact(result.goals.skill) }),
      isMet: isShareAtLeast(SECOND_CLASS_SHARE) && result.goals.skill.isMet,
    },
    { label: T.classLabel({ exerciseClass: 1 }), text: T.firstClassRow({ goal: firstClassGoalText(def), fact: firstFact }), isMet: result.exerciseClass === 1 },
  ];
}

function goalFact(goal: GoalCheck): string {
  if (goal.valueMil !== undefined) {
    return T.factMil({ valueMil: goal.valueMil });
  }
  if (goal.total !== undefined) {
    return T.factTally({ passed: goal.passed ?? 0, total: goal.total });
  }
  return goal.isMet ? T.factYes : T.factNo;
}

function firstShotFact(def: ExerciseDef, result: ExerciseResult): string {
  const firstShotHits = result.targetPoints.filter(points => points === FIRST_SHOT_POINTS).length;
  return isPaperExercise(def) ? T.sharePercent({ share: result.hitShare }) : T.factTally({ passed: firstShotHits, total: result.targetPoints.length });
}

function scoreLine(def: ExerciseDef, result: ExerciseResult): string {
  const { targetSum, calcSum, multiplier, referencePenalty } = result.score;
  const prefix = isPaperExercise(def) ? T.paperHits({ hits: targetSum / FIRST_SHOT_POINTS, shots: def.stages[0].maxShotsPerTarget }) : '';
  const multiplied = multiplier === 1 ? '' : T.multiplied({ multiplier, total: result.total + referencePenalty });
  const penalty = referencePenalty > 0 ? T.referencePenalty({ penalty: referencePenalty, total: result.total }) : '';
  return T.score({ prefix, targetSum, calcSum, sum: targetSum + calcSum, suffix: multiplied + penalty });
}

function recordLine(total: number, previousBest: number | undefined): string {
  if (total > 0 && (previousBest === undefined || total > previousBest)) {
    return T.newRecord;
  }
  return T.record({ total: Math.max(previousBest ?? 0, total) });
}

function mainError(def: ExerciseDef, result: ExerciseResult, records: readonly ExerciseShotRecord[]): string {
  if (result.exerciseClass === 1) {
    return T.noErrors;
  }
  const linkLine = mainLinkLine(records);
  if (linkLine) {
    return linkLine;
  }
  const counts = MAIN_CAUSE_ORDER.map(cause => ({ cause, count: records.filter(record => record.mainCause === cause).length }));
  const top = counts.reduce((best, next) => (next.count > best.count ? next : best));
  if (top.count > 0) {
    return T.mainCauseLine({ count: top.count, total: records.length, cause: MAIN_CAUSE_PHRASES[top.cause] });
  }
  return T.unmetGoal({ goal: firstUnmetGoal(def, result) });
}

function mainLinkLine(records: readonly ExerciseShotRecord[]): string | null {
  if (!records.every(record => record.causes && record.clickMil !== undefined)) {
    return null;
  }
  const mains = records.map(record => mainOfAmounts(record.causes!, record.clickMil!));
  const counts = CAUSE_ORDER.map(kind => ({ kind, count: mains.filter(main => main === kind).length }));
  const top = counts.reduce((best, next) => (next.count > best.count ? next : best));
  return top.count > 0 ? T.mainCauseLine({ count: top.count, total: records.length, cause: lowerFirst(text.review.causeNames[top.kind]) }) : null;
}

function firstUnmetGoal(def: ExerciseDef, result: ExerciseResult): string {
  const share = result.hitShare;
  const steps: { isMet: boolean; text: string }[] = [
    { isMet: share >= THIRD_CLASS_SHARE - SHARE_EPSILON, text: T.minShareGoal({ minShare: THIRD_CLASS_SHARE }) },
    { isMet: share >= SECOND_CLASS_SHARE - SHARE_EPSILON, text: T.minShareGoal({ minShare: SECOND_CLASS_SHARE }) },
    { isMet: result.goals.skill.isMet, text: def.goals.second },
    { isMet: share >= FIRST_CLASS_SHARE - SHARE_EPSILON, text: allFirstText(def) },
    { isMet: result.goals.top.isMet, text: def.goals.first ?? allFirstText(def) },
  ];
  return steps.find(step => !step.isMet)?.text ?? allFirstText(def);
}
