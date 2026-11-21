import { CheckErrorType } from '../../core/calc-check';
import { decimal } from '../../i18n/format';
import { UnitSystem } from '../../core/units';
import { DopeCard } from '../../core/dope-card';
import { ExerciseClass, NotebookMode } from '../../core/exercise-scoring';
import { CartridgeId } from '../../core/types';
import { COURSE, courseProgress, CourseResults, exerciseById, ExerciseId, ExerciseResult, ExerciseShotRecord, exerciseTitle, isExerciseTask, PositionTask } from '../../sim/course';
import { CAUSE_ORDER, CauseAmount, CauseKind, isExecutionCause, MainCause, mainOfAmounts } from '../../sim/miss-breakdown';
import { roundToClicks } from '../../core/game-formulas';
import { MODE_LABELS } from '../course/course-trail.model';
import { CARTRIDGE_LETTERS, cartridgeLetter } from '../notebook/notebook.model';
import { text } from '../../i18n';
import { classStamp, MAIN_CAUSE_PHRASES, STAMP_TONES, StampTone } from '../result/result.model';
import { DopeNotes } from '../review/review.model';

export interface JournalShot {
  distanceM: number;
  isHit: boolean;
  isFirstAtTarget: boolean;
  mainCause: MainCause | null;
  errorTypes: readonly CheckErrorType[];
  windSpeedMps: number;
  mode: NotebookMode;
  causes?: CauseAmount[];
  clickMil?: number;
  isTimedOut?: boolean;
}

export interface JournalSeries {
  id: string;
  startedAtIso: string;
  kind: 'exercise' | 'free';
  exerciseId: ExerciseId | null;
  title: string;
  mode: NotebookMode;
  cartridgeIds: CartridgeId[];
  exerciseClass: ExerciseClass | null;
  total: number | null;
  isInterrupted: boolean;
  isTapTrigger?: boolean;
  shots: JournalShot[];
}

export interface SeriesInput {
  id: string;
  task: PositionTask;
  startedAtIso: string;
  records: readonly ExerciseShotRecord[];
  result: ExerciseResult | null;
  isTapTriggerChosen?: boolean;
}

export interface FeedItemView {
  id: string;
  title: string;
  meta: string;
  stamp: string | null;
  stampTone: StampTone | 'graphite';
  shots: string[];
}

export interface ErrorRowView {
  key: string;
  label: string;
  count: number;
  last: string;
  isTop: boolean;
}

export interface BarView {
  label: string;
  count: number;
  share: number;
}

export interface StatsView {
  isEnough: boolean;
  byDistance: BarView[];
  byWind: BarView[];
  byMode: BarView[];
}

export interface CardView {
  title: string;
  rows: { distance: string; factory: string; player: string | null }[];
}

export interface AchievementsView {
  admissions: string;
  classes: { id: ExerciseId; title: string; stamp: string | null }[];
  records: string[];
}

export const JOURNAL_LIMIT = 200;
export const STATS_MIN_SHOTS = 10;
const T = text.screens.journal;
const ADMISSIONS_TOTAL = 12;
const DISTANCE_BUCKET_M = 100;
const DISTANCE_BUCKETS_M = Array.from({ length: 10 }, (_, index) => (index + 1) * DISTANCE_BUCKET_M);
const WIND_BUCKETS: readonly { label: string; belowMps: number }[] = [
  { label: T.windBuckets.calm, belowMps: 0.5 },
  { label: T.windBuckets.light, belowMps: 3 },
  { label: T.windBuckets.moderate, belowMps: 6.5 },
  { label: T.windBuckets.strong, belowMps: Infinity },
];
const TIME_ERROR_KEY = 'time';
const ERROR_ORDER: readonly CheckErrorType[] = ['side', 'substitution', 'arithmetic', 'factor', 'reading', 'lead', 'rounding', 'units', 'turret'];
const EXECUTION_CAUSES: readonly MainCause[] = ['hold', 'trigger', 'wind-under', 'wind-over'];
const LINK_ERROR_KEY_PREFIX = 'link:';
const CHECKED_LINKS: Partial<Record<CauseKind, CheckErrorType>> = { turret: 'turret', 'lead-calc': 'lead' };

export function journalSeries(input: SeriesInput): JournalSeries | null {
  if (input.records.length === 0) {
    return null;
  }
  const task = input.task;
  const isExercise = isExerciseTask(task);
  const mode = task.notebookMode ?? 'auto';
  const seen = new Set<string>();
  return {
    id: input.id,
    startedAtIso: input.startedAtIso,
    kind: task.kind,
    exerciseId: isExercise ? task.id : null,
    title: task.title,
    mode,
    cartridgeIds: [...new Set(task.stages.map(stage => stage.cartridgeId))],
    exerciseClass: input.result?.exerciseClass ?? null,
    total: input.result?.total ?? null,
    isInterrupted: isExercise && input.result === null,
    isTapTrigger: (input.isTapTriggerChosen ?? false) && task.trigger === 'pressure',
    shots: input.records.map(record => {
      const key = `${record.stageIndex}:${record.targetIndex}`;
      const isFirstAtTarget = !seen.has(key);
      seen.add(key);
      return {
        distanceM: record.distanceM,
        isHit: record.isHit,
        isFirstAtTarget,
        mainCause: record.mainCause ?? null,
        errorTypes: record.check?.errorTypes ?? [],
        windSpeedMps: record.windSpeedMps ?? 0,
        mode,
        ...(record.causes && record.clickMil !== undefined ? { causes: record.causes, clickMil: record.clickMil } : {}),
        ...(record.isTimedOut ? { isTimedOut: true } : {}),
      };
    }),
  };
}

export function withSeries(journal: readonly JournalSeries[], series: JournalSeries): JournalSeries[] {
  if (journal.some(saved => saved.id === series.id)) {
    return journal.map(saved => (saved.id === series.id ? series : saved));
  }
  return [series, ...journal].slice(0, JOURNAL_LIMIT);
}

function dayText(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${T.months[date.getMonth()]}`;
}

function timeText(iso: string): string {
  const date = new Date(iso);
  return `${dayText(iso)}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function distancesText(shots: readonly JournalShot[], system: UnitSystem): string {
  const distances = shots.map(shot => shot.distanceM);
  return text.units.rangeText('distance', [Math.min(...distances), Math.max(...distances)], system);
}

function seriesTitle(series: JournalSeries, system: UnitSystem): string {
  return series.kind === 'free' ? T.freeTitle({ distances: distancesText(series.shots, system) }) : `${series.exerciseId} · ${seriesExerciseTitle(series, system)}`;
}

function seriesStamp(series: JournalSeries): string | null {
  if (series.isInterrupted) {
    return T.interrupted;
  }
  return series.exerciseClass === null ? null : classStamp(series.exerciseClass);
}

export function feedView(journal: readonly JournalSeries[], system: UnitSystem = 'metric'): FeedItemView[] {
  return journal.map(series => ({
    id: series.id,
    title: seriesTitle(series, system),
    meta: T.meta({
      cartridges: series.cartridgeIds.map(id => CARTRIDGE_LETTERS[id]),
      mode: MODE_LABELS[series.mode],
      isTapTrigger: series.isTapTrigger === true,
      time: timeText(series.startedAtIso),
    }),
    stamp: seriesStamp(series),
    stampTone: series.isInterrupted || series.exerciseClass === null ? 'graphite' : STAMP_TONES[series.exerciseClass],
    shots: series.shots.map((shot, index) =>
      T.shotLine({ number: index + 1, distance: text.units.valueText('distance', shot.distanceM, system, 0), isHit: shot.isHit, cause: shot.isHit ? null : shot.isTimedOut ? T.timedOut : shotCause(shot) }),
    ),
  }));
}

export function errorsView(journal: readonly JournalSeries[]): ErrorRowView[] {
  const rows = new Map<string, { label: string; count: number; last: string; order: number }>();
  const note = (key: string, label: string, series: JournalSeries, order: number): void => {
    const row = rows.get(key);
    const where = T.errorPlace({ exerciseId: series.exerciseId, day: dayText(series.startedAtIso) });
    if (row) {
      row.count++;
    } else {
      rows.set(key, { label, count: 1, last: where, order });
    }
  };
  for (const series of journal) {
    for (const shot of series.shots) {
      if (shot.isTimedOut) {
        note(TIME_ERROR_KEY, T.timeError, series, ERROR_ORDER.length + CAUSE_ORDER.length + EXECUTION_CAUSES.length);
      }
      for (const type of shot.errorTypes) {
        note(type, text.review.errorLabels[type], series, ERROR_ORDER.indexOf(type));
      }
      if (shot.causes && shot.clickMil !== undefined) {
        for (const kind of linkErrors(shot.causes, shot.clickMil, shot.errorTypes, shot.isHit)) {
          note(`${LINK_ERROR_KEY_PREFIX}${kind}`, text.review.causeNames[kind], series, ERROR_ORDER.length + CAUSE_ORDER.indexOf(kind));
        }
      } else if (!shot.isHit && shot.mainCause && EXECUTION_CAUSES.includes(shot.mainCause)) {
        note(shot.mainCause, MAIN_CAUSE_PHRASES[shot.mainCause], series, ERROR_ORDER.length + CAUSE_ORDER.length + EXECUTION_CAUSES.indexOf(shot.mainCause));
      }
    }
  }
  return [...rows.entries()]
    .sort(([, first], [, second]) => second.count - first.count || first.order - second.order)
    .map(([key, row], index) => ({ key, label: row.label, count: row.count, last: row.last, isTop: index === 0 }));
}

function shotCause(shot: JournalShot): string | null {
  if (shot.causes && shot.clickMil !== undefined) {
    const main = mainOfAmounts(shot.causes, shot.clickMil);
    const amount = shot.causes.find(cause => cause.kind === main);
    return amount ? T.shotCause({ name: text.review.causeNames[amount.kind], mil: decimal(amount.mil, 1) }) : null;
  }
  return shot.mainCause ? MAIN_CAUSE_PHRASES[shot.mainCause] : null;
}

function linkErrors(causes: readonly CauseAmount[], clickMil: number, errorTypes: readonly CheckErrorType[], isHit: boolean): CauseKind[] {
  const isCheckedAlready = (kind: CauseKind) => {
    const checked = CHECKED_LINKS[kind];
    return checked !== undefined && errorTypes.includes(checked);
  };
  return causes
    .filter(cause => Math.abs(roundToClicks(cause.mil, clickMil)) > 0 && !isCheckedAlready(cause.kind) && !(isHit && isExecutionCause(cause.kind)))
    .map(cause => cause.kind);
}

export function errorRowCause(key: string): CauseKind | null {
  return key.startsWith(LINK_ERROR_KEY_PREFIX) ? (key.slice(LINK_ERROR_KEY_PREFIX.length) as CauseKind) : null;
}

function bar(label: string, shots: readonly JournalShot[]): BarView {
  return { label, count: shots.length, share: shots.length === 0 ? 0 : shots.filter(shot => shot.isHit).length / shots.length };
}

function distanceBucket(distanceM: number): number {
  return Math.min(DISTANCE_BUCKETS_M[DISTANCE_BUCKETS_M.length - 1], Math.max(DISTANCE_BUCKET_M, Math.round(distanceM / DISTANCE_BUCKET_M) * DISTANCE_BUCKET_M));
}

export function statsView(journal: readonly JournalSeries[], system: UnitSystem = 'metric'): StatsView {
  const firstShots = journal.flatMap(series => series.shots.filter(shot => shot.isFirstAtTarget));
  const windLabel = (speedMps: number) => WIND_BUCKETS.find(bucket => speedMps < bucket.belowMps)!.label;
  return {
    isEnough: firstShots.length >= STATS_MIN_SHOTS,
    byDistance: DISTANCE_BUCKETS_M.map(bucket => bar(text.units.numberText('distance', bucket, system, 0), firstShots.filter(shot => distanceBucket(shot.distanceM) === bucket))),
    byWind: WIND_BUCKETS.map(bucket => bar(bucket.label, firstShots.filter(shot => windLabel(shot.windSpeedMps) === bucket.label))),
    byMode: (Object.keys(MODE_LABELS) as NotebookMode[]).map(mode => bar(MODE_LABELS[mode], firstShots.filter(shot => shot.mode === mode))),
  };
}

function elevationText(mil: number): string {
  return `${mil < 0 ? '↓' : '↑'} ${decimal(Math.abs(mil), 1)}`;
}

export function cardsView(cards: readonly DopeCard[], notes: DopeNotes, system: UnitSystem = 'metric'): CardView[] {
  return cards.map(card => ({
    title: T.cardTitle({ letter: cartridgeLetter(card) }),
    rows: card.rows.map(row => {
      const note = (notes[card.cartridgeId] ?? []).find(item => item.distanceM === row.distanceM);
      return { distance: text.units.numberText('distance', row.distanceM, system, 0), factory: elevationText(row.elevationMil), player: note ? elevationText(note.elevationMil) : null };
    }),
  }));
}

export function achievementsView(course: CourseResults, system: UnitSystem = 'metric'): AchievementsView {
  const progress = courseProgress(course);
  const graded = COURSE.filter(def => def.targets !== null);
  return {
    admissions: T.admissions({ admissions: progress.admissions, admissionsTotal: ADMISSIONS_TOTAL }),
    classes: graded.map(def => {
      const best = course.bestClasses[def.id];
      return { id: def.id, title: exerciseTitle(def, system), stamp: best === undefined ? null : classStamp(best) };
    }),
    records: graded.filter(def => course.bestTotals?.[def.id] !== undefined).map(def => T.record({ exerciseId: def.id, total: course.bestTotals![def.id]! })),
  };
}

function seriesExerciseTitle(series: JournalSeries, system: UnitSystem): string {
  const def = series.exerciseId ? exerciseById(series.exerciseId) : undefined;
  return def ? exerciseTitle(def, system) : series.title;
}
