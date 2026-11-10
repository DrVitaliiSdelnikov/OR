import { CheckErrorType } from '../../core/calc-check';
import { DopeCard } from '../../core/dope-card';
import { ExerciseClass, NotebookMode } from '../../core/exercise-scoring';
import { CartridgeId } from '../../core/types';
import { COURSE, courseProgress, CourseResults, ExerciseId, ExerciseResult, ExerciseShotRecord, isExerciseTask, PositionTask } from '../../sim/course';
import { MainCause } from '../../sim/miss-breakdown';
import { MODE_LABELS } from '../course/course-trail.model';
import { RANK_LABELS } from '../home/home.model';
import { CARTRIDGE_LETTERS } from '../notebook/notebook.model';
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
  rank: string;
  admissions: string;
  classes: { id: ExerciseId; title: string; stamp: string | null }[];
  records: string[];
}

export const JOURNAL_LIMIT = 200;
export const STATS_MIN_SHOTS = 10;
const MONTHS = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const ADMISSIONS_TOTAL = 12;
const DISTANCE_BUCKET_M = 100;
const DISTANCE_BUCKETS_M = Array.from({ length: 10 }, (_, index) => (index + 1) * DISTANCE_BUCKET_M);
const WIND_BUCKETS: readonly { label: string; belowMps: number }[] = [
  { label: 'штиль', belowMps: 0.5 },
  { label: 'слабый', belowMps: 3 },
  { label: 'умеренный', belowMps: 6.5 },
  { label: 'сильный', belowMps: Infinity },
];
const ERROR_LABELS: Record<CheckErrorType, string> = {
  side: 'СТОРОНА',
  substitution: 'ПОДСТАНОВКА',
  arithmetic: 'АРИФМЕТИКА',
  factor: 'ФАКТОР',
  reading: 'ПОКАЗАНИЯ',
  lead: 'УПРЕЖДЕНИЕ',
  rounding: 'ОКРУГЛЕНИЕ',
  units: 'ЕДИНИЦЫ',
  turret: 'БАРАБАН',
};
const EXECUTION_CAUSES: readonly MainCause[] = ['hold', 'trigger', 'wind-under', 'wind-over'];

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
      };
    }),
  };
}

export function withSeries(journal: readonly JournalSeries[], series: JournalSeries): JournalSeries[] {
  return [series, ...journal].slice(0, JOURNAL_LIMIT);
}

function dayText(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function timeText(iso: string): string {
  const date = new Date(iso);
  return `${dayText(iso)}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function distancesText(shots: readonly JournalShot[]): string {
  const distances = shots.map(shot => shot.distanceM);
  const low = Math.min(...distances);
  const high = Math.max(...distances);
  return low === high ? `${low} м` : `${low}–${high} м`;
}

function seriesTitle(series: JournalSeries): string {
  return series.kind === 'free' ? `Свободная · ${distancesText(series.shots)}` : `${series.exerciseId} · ${series.title}`;
}

function seriesStamp(series: JournalSeries): string | null {
  if (series.isInterrupted) {
    return 'прервано';
  }
  return series.exerciseClass === null ? null : classStamp(series.exerciseClass);
}

export function feedView(journal: readonly JournalSeries[]): FeedItemView[] {
  return journal.map(series => ({
    id: series.id,
    title: seriesTitle(series),
    meta: `патрон ${series.cartridgeIds.map(id => CARTRIDGE_LETTERS[id]).join(', ')} · ${MODE_LABELS[series.mode]}${series.isTapTrigger ? ' · спуск тапом' : ''} · ${timeText(series.startedAtIso)}`,
    stamp: seriesStamp(series),
    stampTone: series.isInterrupted || series.exerciseClass === null ? 'graphite' : STAMP_TONES[series.exerciseClass],
    shots: series.shots.map((shot, index) => {
      const cause = !shot.isHit && shot.mainCause ? ` · ${MAIN_CAUSE_PHRASES[shot.mainCause]}` : '';
      return `${index + 1} · ${shot.distanceM} м · ${shot.isHit ? '✓' : '✕'}${cause}`;
    }),
  }));
}

export function errorsView(journal: readonly JournalSeries[]): ErrorRowView[] {
  const rows = new Map<string, { label: string; count: number; last: string; order: number }>();
  const note = (key: string, label: string, series: JournalSeries, order: number): void => {
    const row = rows.get(key);
    const where = `${series.exerciseId ?? 'своб.'} · ${dayText(series.startedAtIso)}`;
    if (row) {
      row.count++;
    } else {
      rows.set(key, { label, count: 1, last: where, order });
    }
  };
  const errorKeys = Object.keys(ERROR_LABELS) as CheckErrorType[];
  for (const series of journal) {
    for (const shot of series.shots) {
      for (const type of shot.errorTypes) {
        note(type, ERROR_LABELS[type], series, errorKeys.indexOf(type));
      }
      if (shot.mainCause && EXECUTION_CAUSES.includes(shot.mainCause)) {
        note(shot.mainCause, MAIN_CAUSE_PHRASES[shot.mainCause], series, errorKeys.length + EXECUTION_CAUSES.indexOf(shot.mainCause));
      }
    }
  }
  return [...rows.entries()]
    .sort(([, first], [, second]) => second.count - first.count || first.order - second.order)
    .map(([key, row], index) => ({ key, label: row.label, count: row.count, last: row.last, isTop: index === 0 }));
}

function bar(label: string, shots: readonly JournalShot[]): BarView {
  return { label, count: shots.length, share: shots.length === 0 ? 0 : shots.filter(shot => shot.isHit).length / shots.length };
}

function distanceBucket(distanceM: number): number {
  return Math.min(DISTANCE_BUCKETS_M[DISTANCE_BUCKETS_M.length - 1], Math.max(DISTANCE_BUCKET_M, Math.round(distanceM / DISTANCE_BUCKET_M) * DISTANCE_BUCKET_M));
}

export function statsView(journal: readonly JournalSeries[]): StatsView {
  const firstShots = journal.flatMap(series => series.shots.filter(shot => shot.isFirstAtTarget));
  const windLabel = (speedMps: number) => WIND_BUCKETS.find(bucket => speedMps < bucket.belowMps)!.label;
  return {
    isEnough: firstShots.length >= STATS_MIN_SHOTS,
    byDistance: DISTANCE_BUCKETS_M.map(bucket => bar(String(bucket), firstShots.filter(shot => distanceBucket(shot.distanceM) === bucket))),
    byWind: WIND_BUCKETS.map(bucket => bar(bucket.label, firstShots.filter(shot => windLabel(shot.windSpeedMps) === bucket.label))),
    byMode: (Object.keys(MODE_LABELS) as NotebookMode[]).map(mode => bar(MODE_LABELS[mode], firstShots.filter(shot => shot.mode === mode))),
  };
}

function elevationText(mil: number): string {
  return `${mil < 0 ? '↓' : '↑'} ${Math.abs(mil).toFixed(1)}`;
}

export function cardsView(cards: readonly DopeCard[], notes: DopeNotes): CardView[] {
  return cards.map(card => ({
    title: `Патрон ${CARTRIDGE_LETTERS[card.cartridgeId]}`,
    rows: card.rows.map(row => {
      const note = (notes[card.cartridgeId] ?? []).find(item => item.distanceM === row.distanceM);
      return { distance: String(row.distanceM), factory: elevationText(row.elevationMil), player: note ? elevationText(note.elevationMil) : null };
    }),
  }));
}

export function achievementsView(course: CourseResults): AchievementsView {
  const progress = courseProgress(course);
  const graded = COURSE.filter(def => def.targets !== null);
  return {
    rank: RANK_LABELS[progress.rank],
    admissions: `допуски ${progress.admissions} / ${ADMISSIONS_TOTAL}`,
    classes: graded.map(def => {
      const best = course.bestClasses[def.id];
      return { id: def.id, title: def.title, stamp: best === undefined ? null : classStamp(best) };
    }),
    records: graded.filter(def => course.bestTotals?.[def.id] !== undefined).map(def => `${def.id} · ${course.bestTotals![def.id]} очк.`),
  };
}
