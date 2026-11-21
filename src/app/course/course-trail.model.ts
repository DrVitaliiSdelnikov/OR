import { ExerciseClass, NotebookMode } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { decimal } from '../../i18n/format';
import { ScenarioOptions, ValueRange } from '../../core/scenario';
import { UnitSystem } from '../../core/units';
import { CartridgeId } from '../../core/types';
import { ATTESTATION_ID, COURSE, courseProgress, CourseResults, ExerciseDef, ExerciseId, ExerciseTargets, exerciseTitle, isExamCredited, targetDiameterM, TargetDistance, targetDistanceIn } from '../../sim/course';

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
export type TrailStamp = ClassStamp | 'exam';

export interface TrailNode {
  id: ExerciseId;
  title: string;
  state: TrailNodeState;
  stamp: TrailStamp | null;
  isIntro: boolean;
  isAttestation: boolean;
}

const INTRO_ID: ExerciseId = '00';
const PAPER_TARGET_DISTANCE_M = 100;
const OBLIQUE_CLOCK_COUNT = 8;
const T = text.screens.exerciseSheet;
const UNITS = text.units;
const CARTRIDGE_LETTERS: Record<CartridgeId, string> = T.cartridgeLetters;
export const MODE_LABELS: Record<NotebookMode, string> = text.screens.courseTrail.modes;
const STAMPS: Record<Exclude<ExerciseClass, 0>, ClassStamp> = { 1: 'gold', 2: 'silver', 3: 'bronze' };
export const STAMP_CLASSES: Record<ClassStamp, Exclude<ExerciseClass, 0>> = { gold: 1, silver: 2, bronze: 3 };

export function trailNodes(results: CourseResults, isEverythingUnlocked = false, system: UnitSystem = 'metric'): TrailNode[] {
  const progress = courseProgress(results, isEverythingUnlocked);
  return COURSE.map(def => {
    const bestClass = results.bestClasses[def.id] ?? 0;
    const isIntro = def.id === INTRO_ID;
    const isCreditedByExam = isExamCredited(results, def.id);
    const isPassed = isIntro ? results.isIntroCompleted : bestClass !== 0 || isCreditedByExam;
    return {
      id: def.id,
      title: exerciseTitle(def, system),
      state: nodeState(def.id, isPassed, progress.nextExerciseId, progress.unlockedIds),
      stamp: bestClass !== 0 ? STAMPS[bestClass] : isCreditedByExam ? 'exam' : null,
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

export function exerciseSheet(def: ExerciseDef, system: UnitSystem = 'metric'): ExerciseSheet {
  const { conditions } = def;
  return {
    id: def.id,
    title: exerciseTitle(def, system),
    targets: def.targets ? targetsText(def.targets, system) : T.noShooting,
    shots: shotsText(def),
    wind: windText(conditions.windScale, conditions.windSpeedRangeMps, conditions.windClocks, conditions.isWindUniform, system),
    atmosphere: [atmosphereText(conditions.temperatureRangeC, conditions.pressureRangeHpa, system), ...terrainTexts(conditions, system)].join(T.conditionsSeparator),
    mode: def.notebookMode ? MODE_LABELS[def.notebookMode] : T.none,
    terms: def.terms,
  };
}

function targetsText(targets: ExerciseTargets, system: UnitSystem): string {
  const [courseNearM, courseFarM] = distanceBounds(targets.distance);
  const isPaper = courseNearM === PAPER_TARGET_DISTANCE_M && courseFarM === PAPER_TARGET_DISTANCE_M;
  const [nearM, farM] = distanceBounds(targetDistanceIn(targets.distance, system));
  const diameters = targets.diameterM !== undefined ? [targetDiameterM(targets, nearM, system)] : [targetDiameterM(targets, nearM, system), targetDiameterM(targets, farM, system)];
  const lastDiameterM = diameters[diameters.length - 1];
  const sizeText = UNITS.rangeText('targetSize', [diameters[0], lastDiameterM], system);
  return T.targets({ count: targets.count, isPaper, size: sizeText, distance: distanceText(targets.distance, system), isOutAndBack: targets.isOutAndBack === true });
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

function windText(windScale: number | undefined, speedRange: ValueRange | undefined, clocks: readonly number[] | undefined, isUniform: boolean | undefined, system: UnitSystem): string {
  if (windScale === 0) {
    return T.calm;
  }
  if (isUniform === false) {
    return T.windByZones;
  }
  const speed = speedRange ? UNITS.rangeText('windSpeed', speedRange, system) : T.byWeather;
  if (!clocks) {
    return speed;
  }
  return clocks.length === OBLIQUE_CLOCK_COUNT ? T.windOblique({ speed }) : T.windFromClocks({ speed, clocks });
}

function atmosphereText(temperatureRange: ValueRange | undefined, pressureRange: ValueRange | undefined, system: UnitSystem): string {
  if (!temperatureRange || !pressureRange) {
    return T.byWeather;
  }
  return T.atmosphere({ temperature: UNITS.rangeText('temperature', temperatureRange, system), pressure: UNITS.rangeText('pressure', pressureRange, system) });
}

function terrainTexts(conditions: ScenarioOptions, system: UnitSystem): string[] {
  return [
    ...(conditions.lookAngleRangeDeg ? [T.slope({ range: rangeText(conditions.lookAngleRangeDeg), isEitherWay: conditions.isLookAngleEitherWay === true })] : []),
    ...(conditions.altitudeRangeM ? [T.altitude({ range: UNITS.rangeText('altitude', conditions.altitudeRangeM, system) })] : []),
    ...(conditions.isSpinDriftOn ? [T.spinDrift] : []),
    ...(conditions.coriolisLatitudeRangeDeg ? [T.latitude({ range: rangeText(conditions.coriolisLatitudeRangeDeg) })] : []),
  ];
}

function distanceText(courseDistance: TargetDistance, system: UnitSystem): string {
  const distance = targetDistanceIn(courseDistance, system);
  switch (distance.kind) {
    case 'fixed':
      return UNITS.rangeText('distance', [distance.distanceM, distance.distanceM], system);
    case 'known':
      return UNITS.rangeText('distance', [distance.fromM, distance.toM], system);
    case 'unknown':
      return T.unknownDistance({ range: UNITS.rangeText('distance', [distance.fromM, distance.toM], system) });
  }
}

function distanceBounds(distance: TargetDistance): [number, number] {
  return distance.kind === 'fixed' ? [distance.distanceM, distance.distanceM] : [distance.fromM, distance.toM];
}

function rangeText([low, high]: ValueRange): string {
  return low === high ? decimal(low) : `${decimal(low)}–${decimal(high)}`;
}

