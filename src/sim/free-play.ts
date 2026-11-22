import { text } from '../i18n';
import { ScenarioOptions } from '../core/scenario';
import { CartridgeId } from '../core/types';
import { distanceBoundsIn, FreePlayTask, FreePlayUnlocks } from './course';
import { fromInput, UnitSystem } from '../core/units';
import { NotebookMode } from '../core/exercise-scoring';
import { freePlayScopes, ScopeId, SCOPES } from './scope-model';
import { loadoutOf, RifleProfile, scopeOf } from './rifle-profile';

export type WindPreset = 'calm' | 'light' | 'moderate' | 'strong' | 'gusty';
export type Terrain = 'plain' | 'mountains' | 'long-range';
export type FreePlayRifle = 'course' | 'own';

export interface FreePlaySettings {
  distanceM: number;
  isDistanceUnknown: boolean;
  wind: WindPreset;
  terrain: Terrain;
  scopeId: ScopeId;
  cartridgeId: CartridgeId;
  notebookMode: NotebookMode;
  isInstructorNear: boolean;
  rifle: FreePlayRifle;
}

export const DEFAULT_FREE_PLAY: FreePlaySettings = {
  distanceM: 300,
  isDistanceUnknown: false,
  wind: 'light',
  terrain: 'plain',
  scopeId: 'course-tree',
  cartridgeId: 'B',
  notebookMode: 'auto',
  isInstructorNear: false,
  rifle: 'course',
};

const MIN_DISTANCE_M = 100;
const MAX_DISTANCE_M = 1000;
const DISTANCE_STEP_M = 50;
const SLIDER_DISTANCES_IN_SYSTEM: readonly number[] = Array.from({ length: (MAX_DISTANCE_M - MIN_DISTANCE_M) / DISTANCE_STEP_M + 1 }, (_, index) => MIN_DISTANCE_M + index * DISTANCE_STEP_M);
const FREE_PLAY_DISTANCES: Record<UnitSystem, readonly number[]> = {
  metric: SLIDER_DISTANCES_IN_SYSTEM,
  imperial: SLIDER_DISTANCES_IN_SYSTEM.map(yards => fromInput('distance', yards, 'imperial')),
};
/** @deprecated T1.8c: ползунок зависит от системы — `freePlayDistances(system)`. Удалить в T2.1. */
export const FREE_PLAY_DISTANCES_M: readonly number[] = FREE_PLAY_DISTANCES.metric;

export function freePlayDistances(system: UnitSystem): readonly number[] {
  return FREE_PLAY_DISTANCES[system];
}

export function terrainBoundsM(terrain: Terrain, system: UnitSystem): { fromM: number; toM: number } {
  const preset = TERRAIN_PRESETS[terrain];
  const bounds = distanceBoundsIn(system, preset.fromM, preset.toM);
  return { fromM: fromInput('distance', bounds.from, system), toM: fromInput('distance', bounds.to, system) };
}

export function freePlayInSystem(settings: FreePlaySettings, system: UnitSystem): FreePlaySettings {
  return { ...settings, distanceM: freePlayDistanceIn(system, settings.distanceM) };
}

export function freePlayDistanceIn(system: UnitSystem, distanceM: number): number {
  const otherSystem: UnitSystem = system === 'metric' ? 'imperial' : 'metric';
  const sameStep = FREE_PLAY_DISTANCES[otherSystem].indexOf(distanceM);
  if (!FREE_PLAY_DISTANCES[system].includes(distanceM) && sameStep >= 0) {
    return FREE_PLAY_DISTANCES[system][sameStep];
  }
  return freePlayDistances(system).reduce((nearest, candidate) => (Math.abs(candidate - distanceM) < Math.abs(nearest - distanceM) ? candidate : nearest));
}

export const WIND_PRESETS: Record<WindPreset, ScenarioOptions> = {
  calm: { windScale: 0, isWindUniform: true },
  light: { isWindUniform: true, windSpeedRangeMps: [2, 2.5] },
  moderate: { isWindUniform: true, windSpeedRangeMps: [4, 6] },
  strong: { isWindUniform: true, windSpeedRangeMps: [7, 9] },
  gusty: { isWindUniform: false, windSpeedRangeMps: [3, 7] },
};

export const TERRAIN_PRESETS: Record<Terrain, { conditions: ScenarioOptions; fromM: number; toM: number }> = {
  plain: { conditions: {}, fromM: MIN_DISTANCE_M, toM: MAX_DISTANCE_M },
  mountains: { conditions: { lookAngleRangeDeg: [10, 25], isLookAngleEitherWay: true, altitudeRangeM: [1000, 1500] }, fromM: MIN_DISTANCE_M, toM: 700 },
  'long-range': { conditions: { isSpinDriftOn: true, coriolisLatitudeRangeDeg: [40, 60] }, fromM: 600, toM: MAX_DISTANCE_M },
};

const DEFAULT_SHOTS_PER_TARGET = 5;

export function freePlayTask(settings: FreePlaySettings, ownProfile: RifleProfile | null = null, system: UnitSystem = 'metric'): FreePlayTask {
  const terrain = TERRAIN_PRESETS[settings.terrain];
  const bounds = terrainBoundsM(settings.terrain, system);
  const fixedDistanceM = Math.min(bounds.toM, Math.max(bounds.fromM, settings.distanceM));
  return {
    kind: 'free',
    isOpenFire: true,
    title: text.content.freePlayTitle,
    targets: {
      count: 1,
      distance: settings.isDistanceUnknown ? { kind: 'unknown', fromM: terrain.fromM, toM: terrain.toM } : { kind: 'fixed', distanceM: fixedDistanceM },
    },
    stages: [{ cartridgeId: settings.cartridgeId, maxShotsPerTarget: DEFAULT_SHOTS_PER_TARGET, closesOnHit: false }],
    hasColdBore: false,
    hasKnockedSight: false,
    hasPatrol: false,
    trigger: 'pressure',
    notebookMode: settings.notebookMode,
    scopeId: settings.scopeId,
    conditions: { ...WIND_PRESETS[settings.wind], ...terrain.conditions },
    ...(settings.rifle === 'own' && ownProfile ? { rifle: { loadout: loadoutOf(ownProfile), scope: scopeOf(ownProfile) } } : {}),
  };
}

export function knownFreePlay(stored: Partial<FreePlaySettings> | undefined): FreePlaySettings {
  const known = { ...DEFAULT_FREE_PLAY };
  if (!stored) {
    return known;
  }
  if (typeof stored.distanceM === 'number' && (FREE_PLAY_DISTANCES.metric.includes(stored.distanceM) || FREE_PLAY_DISTANCES.imperial.includes(stored.distanceM))) {
    known.distanceM = stored.distanceM;
  }
  if (typeof stored.isDistanceUnknown === 'boolean') {
    known.isDistanceUnknown = stored.isDistanceUnknown;
  }
  if (stored.wind && stored.wind in WIND_PRESETS) {
    known.wind = stored.wind;
  }
  if (stored.rifle === 'course' || stored.rifle === 'own') {
    known.rifle = stored.rifle;
  }
  if (stored.terrain && stored.terrain in TERRAIN_PRESETS) {
    known.terrain = stored.terrain;
  }
  if (stored.scopeId && SCOPES.some(scope => scope.id === stored.scopeId)) {
    known.scopeId = stored.scopeId;
  }
  if (stored.cartridgeId === 'A' || stored.cartridgeId === 'B' || stored.cartridgeId === 'C') {
    known.cartridgeId = stored.cartridgeId;
  }
  if (stored.notebookMode === 'auto' || stored.notebookMode === 'manual-easy' || stored.notebookMode === 'manual-hard') {
    known.notebookMode = stored.notebookMode;
  }
  if (typeof stored.isInstructorNear === 'boolean') {
    known.isInstructorNear = stored.isInstructorNear;
  }
  return known;
}

function allowedMode(mode: NotebookMode, unlocks: FreePlayUnlocks): NotebookMode {
  if (mode === 'manual-hard' && !unlocks.manualHard) {
    return unlocks.manualEasy ? 'manual-easy' : 'auto';
  }
  if (mode === 'manual-easy' && !unlocks.manualEasy) {
    return 'auto';
  }
  return mode;
}

export function allowedFreePlay(settings: FreePlaySettings, unlocks: FreePlayUnlocks): FreePlaySettings {
  const openScopes = freePlayScopes(unlocks).map(scope => scope.id);
  return {
    ...settings,
    isDistanceUnknown: settings.isDistanceUnknown && unlocks.unknownDistance,
    cartridgeId: settings.cartridgeId === 'B' || unlocks.cartridgesAC ? settings.cartridgeId : 'B',
    notebookMode: allowedMode(settings.notebookMode, unlocks),
    wind: settings.wind === 'gusty' && !unlocks.gustyWind ? 'light' : settings.wind,
    scopeId: openScopes.includes(settings.scopeId) ? settings.scopeId : DEFAULT_FREE_PLAY.scopeId,
  };
}
