import { ExerciseClass, NotebookMode } from '../../core/exercise-scoring';
import { ValueRange } from '../../core/scenario';
import { CartridgeId } from '../../core/types';
import { COURSE, courseProgress, CourseResults, ExerciseDef, ExerciseId, ExerciseTargets, TargetDistance } from '../../sim/course';

export interface ExerciseSheet {
  id: ExerciseId;
  title: string;
  targets: string;
  shots: string;
  wind: string;
  atmosphere: string;
  mode: string;
  terms: readonly string[];
}

export type TrailNodeState = 'passed' | 'current' | 'open' | 'locked';
export type ClassStamp = 'gold' | 'silver' | 'bronze';

export interface TrailNode {
  id: ExerciseId;
  title: string;
  state: TrailNodeState;
  stamp: ClassStamp | null;
  isIntro: boolean;
  isAttestation: boolean;
}

const INTRO_ID: ExerciseId = '00';
const ATTESTATION_ID: ExerciseId = '12';
const GONG_DIAMETER_M = 0.5;
const LARGE_GONG_DIAMETER_M = 0.7;
const LARGE_GONG_FROM_M = 600;
const PAPER_TARGET_DISTANCE_M = 100;
const OBLIQUE_CLOCK_COUNT = 8;
const CARTRIDGE_LETTERS: Record<CartridgeId, string> = { A: 'А', B: 'Б', C: 'В' };
export const MODE_LABELS: Record<NotebookMode, string> = { auto: 'АВТО', 'manual-easy': 'САМ · лёгкий', 'manual-hard': 'САМ · сложный' };
const STAMPS: Record<Exclude<ExerciseClass, 0>, ClassStamp> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

export function trailNodes(results: CourseResults, isEverythingUnlocked = false): TrailNode[] {
  const progress = courseProgress(results, isEverythingUnlocked);
  return COURSE.map(def => {
    const bestClass = results.bestClasses[def.id] ?? 0;
    const isIntro = def.id === INTRO_ID;
    const isPassed = isIntro ? results.isIntroCompleted : bestClass !== 0;
    return {
      id: def.id,
      title: def.title,
      state: nodeState(def.id, isPassed, progress.nextExerciseId, progress.unlockedIds),
      stamp: bestClass === 0 ? null : STAMPS[bestClass],
      isIntro,
      isAttestation: def.id === ATTESTATION_ID,
    };
  });
}

function nodeState(id: ExerciseId, isPassed: boolean, nextId: ExerciseId | null, unlockedIds: readonly ExerciseId[]): TrailNodeState {
  if (isPassed) {
    return 'passed';
  }
  if (id === nextId) {
    return 'current';
  }
  return unlockedIds.includes(id) ? 'open' : 'locked';
}

export function exerciseSheet(def: ExerciseDef): ExerciseSheet {
  const { conditions } = def;
  return {
    id: def.id,
    title: def.title,
    targets: def.targets ? targetsText(def.targets) : 'без стрельбы',
    shots: shotsText(def),
    wind: windText(conditions.windScale, conditions.windSpeedRangeMps, conditions.windClocks, conditions.isWindUniform),
    atmosphere: atmosphereText(conditions.temperatureRangeC, conditions.pressureRangeHpa),
    mode: def.notebookMode ? MODE_LABELS[def.notebookMode] : '—',
    terms: def.terms,
  };
}

function targetsText(targets: ExerciseTargets): string {
  const [nearM, farM] = distanceBounds(targets.distance);
  const isPaper = nearM === PAPER_TARGET_DISTANCE_M && farM === PAPER_TARGET_DISTANCE_M;
  const diameters = targets.diameterM !== undefined ? [targets.diameterM] : [gongDiameterM(nearM), gongDiameterM(farM)];
  const sizeText = diameters[0] === diameters[diameters.length - 1] ? metres(diameters[0]) : `${decimal(diameters[0])}–${metres(diameters[diameters.length - 1])}`;
  const outAndBack = targets.isOutAndBack ? ', туда и обратно' : '';
  return `${targets.count} × ${isPaper ? 'бумажная мишень' : 'гонг'} ${sizeText} · ${distanceText(targets.distance)}${outAndBack}`;
}

function shotsText(def: ExerciseDef): string {
  if (def.stages.length === 0) {
    return '—';
  }
  const [stage] = def.stages;
  const shots = stage.closesOnHit ? `до ${stage.maxShotsPerTarget} выстрелов на цель` : `${stage.maxShotsPerTarget} выстрелов`;
  const letters = def.stages.map(candidate => CARTRIDGE_LETTERS[candidate.cartridgeId]);
  return `${shots} · ${letters.length > 1 ? `патроны ${letters.join(', ')}` : `патрон ${letters[0]}`}`;
}

function windText(windScale: number | undefined, speedRange: ValueRange | undefined, clocks: readonly number[] | undefined, isUniform: boolean | undefined): string {
  if (windScale === 0) {
    return 'штиль';
  }
  if (isUniform === false) {
    return 'разный по зонам';
  }
  const speed = speedRange ? `${rangeText(speedRange)} м/с` : 'по погоде';
  if (!clocks) {
    return speed;
  }
  return clocks.length === OBLIQUE_CLOCK_COUNT ? `${speed} · косой` : `${speed} · с ${clocks.join(' или ')} ч`;
}

function atmosphereText(temperatureRange: ValueRange | undefined, pressureRange: ValueRange | undefined): string {
  if (!temperatureRange || !pressureRange) {
    return 'по погоде';
  }
  const [coldest, warmest] = temperatureRange;
  const temperature = coldest === warmest ? `${signed(coldest)} C` : `${signed(coldest)}…${decimal(warmest)} C`;
  return `${temperature} · ${rangeText(pressureRange)} гПа`;
}

function distanceText(distance: TargetDistance): string {
  switch (distance.kind) {
    case 'fixed':
      return `${distance.distanceM} м`;
    case 'known':
      return `${distance.fromM}–${distance.toM} м`;
    case 'unknown':
      return `неизвестная, ${distance.fromM}–${distance.toM} м`;
  }
}

function distanceBounds(distance: TargetDistance): [number, number] {
  return distance.kind === 'fixed' ? [distance.distanceM, distance.distanceM] : [distance.fromM, distance.toM];
}

function gongDiameterM(distanceM: number): number {
  return distanceM > LARGE_GONG_FROM_M ? LARGE_GONG_DIAMETER_M : GONG_DIAMETER_M;
}

function rangeText([low, high]: ValueRange): string {
  return low === high ? decimal(low) : `${decimal(low)}–${decimal(high)}`;
}

function metres(value: number): string {
  return `${decimal(value)} м`;
}

function signed(value: number): string {
  if (value > 0) {
    return `+${decimal(value)}`;
  }
  return value < 0 ? `−${decimal(-value)}` : '0';
}

function decimal(value: number): string {
  return String(value).replace('.', ',');
}
