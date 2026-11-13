import { ExerciseClass, NotebookMode } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { decimal } from '../../i18n/format';
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
const T = text.screens.exerciseSheet;
const CARTRIDGE_LETTERS: Record<CartridgeId, string> = T.cartridgeLetters;
export const MODE_LABELS: Record<NotebookMode, string> = text.screens.courseTrail.modes;
const STAMPS: Record<Exclude<ExerciseClass, 0>, ClassStamp> = { 1: 'gold', 2: 'silver', 3: 'bronze' };
export const STAMP_CLASSES: Record<ClassStamp, Exclude<ExerciseClass, 0>> = { gold: 1, silver: 2, bronze: 3 };

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
    targets: def.targets ? targetsText(def.targets) : T.noShooting,
    shots: shotsText(def),
    wind: windText(conditions.windScale, conditions.windSpeedRangeMps, conditions.windClocks, conditions.isWindUniform),
    atmosphere: atmosphereText(conditions.temperatureRangeC, conditions.pressureRangeHpa),
    mode: def.notebookMode ? MODE_LABELS[def.notebookMode] : T.none,
    terms: def.terms,
  };
}

function targetsText(targets: ExerciseTargets): string {
  const [nearM, farM] = distanceBounds(targets.distance);
  const isPaper = nearM === PAPER_TARGET_DISTANCE_M && farM === PAPER_TARGET_DISTANCE_M;
  const diameters = targets.diameterM !== undefined ? [targets.diameterM] : [gongDiameterM(nearM), gongDiameterM(farM)];
  const lastDiameterM = diameters[diameters.length - 1];
  const sizeText = diameters[0] === lastDiameterM ? T.metres({ valueM: diameters[0] }) : T.metresRange({ fromM: diameters[0], toM: lastDiameterM });
  return T.targets({ count: targets.count, isPaper, size: sizeText, distance: distanceText(targets.distance), isOutAndBack: targets.isOutAndBack === true });
}

function shotsText(def: ExerciseDef): string {
  if (def.stages.length === 0) {
    return T.none;
  }
  const [stage] = def.stages;
  const shots = stage.closesOnHit ? T.shotsUntilHit({ maxShots: stage.maxShotsPerTarget }) : T.shotsFixed({ maxShots: stage.maxShotsPerTarget });
  const letters = def.stages.map(candidate => CARTRIDGE_LETTERS[candidate.cartridgeId]);
  return T.shotsWithCartridges({ shots, letters });
}

function windText(windScale: number | undefined, speedRange: ValueRange | undefined, clocks: readonly number[] | undefined, isUniform: boolean | undefined): string {
  if (windScale === 0) {
    return T.calm;
  }
  if (isUniform === false) {
    return T.windByZones;
  }
  const speed = speedRange ? T.windSpeed({ range: rangeText(speedRange) }) : T.byWeather;
  if (!clocks) {
    return speed;
  }
  return clocks.length === OBLIQUE_CLOCK_COUNT ? T.windOblique({ speed }) : T.windFromClocks({ speed, clocks });
}

function atmosphereText(temperatureRange: ValueRange | undefined, pressureRange: ValueRange | undefined): string {
  if (!temperatureRange || !pressureRange) {
    return T.byWeather;
  }
  const [coldest, warmest] = temperatureRange;
  const temperature = coldest === warmest ? T.temperature({ celsius: coldest }) : T.temperatureRange({ coldestC: coldest, warmestC: warmest });
  return T.atmosphere({ temperature, pressureRange: rangeText(pressureRange) });
}

function distanceText(distance: TargetDistance): string {
  switch (distance.kind) {
    case 'fixed':
      return T.fixedDistance({ distanceM: distance.distanceM });
    case 'known':
      return T.knownDistance({ fromM: distance.fromM, toM: distance.toM });
    case 'unknown':
      return T.unknownDistance({ fromM: distance.fromM, toM: distance.toM });
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

