import { BallisticsEngine } from './engine';
import { Atmosphere, Loadout, ShotGeometry, WindZone } from './types';

export type EffectKind = 'angle' | 'spinDrift' | 'coriolis';

export interface EffectContribution {
  impactUpMil: number;
  impactRightMil: number;
}

export type EffectContributions = Record<EffectKind, EffectContribution>;

const NO_CONTRIBUTION: EffectContribution = { impactUpMil: 0, impactRightMil: 0 };

const WITHOUT_EFFECT: Record<EffectKind, (geometry: ShotGeometry) => ShotGeometry | null> = {
  angle: geometry => (geometry.lookAngleDeg === 0 ? null : { ...geometry, lookAngleDeg: 0 }),
  spinDrift: geometry => (geometry.isSpinDriftOn ? { ...geometry, isSpinDriftOn: false } : null),
  coriolis: geometry => (geometry.coriolis ? { ...geometry, coriolis: null } : null),
};

const contributionsByEngine = new WeakMap<BallisticsEngine, Map<string, Promise<EffectContributions>>>();

export function effectContributions(
  engine: BallisticsEngine,
  loadout: Loadout,
  atmosphere: Atmosphere | null,
  windZones: readonly WindZone[] | null,
  geometry: ShotGeometry,
  distanceM: number,
): Promise<EffectContributions> {
  const cache = contributionsByEngine.get(engine) ?? new Map<string, Promise<EffectContributions>>();
  contributionsByEngine.set(engine, cache);
  const key = JSON.stringify([loadout, atmosphere, windZones, geometry, distanceM]);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const computing = computeContributions(engine, loadout, atmosphere, windZones, geometry, distanceM);
  cache.set(key, computing);
  return computing;
}

async function computeContributions(
  engine: BallisticsEngine,
  loadout: Loadout,
  atmosphere: Atmosphere | null,
  windZones: readonly WindZone[] | null,
  geometry: ShotGeometry,
  distanceM: number,
): Promise<EffectContributions> {
  const requiredWith = async (shotGeometry: ShotGeometry) =>
    BallisticsEngine.interpolated(await engine.trajectory(loadout, atmosphere, windZones, undefined, distanceM, shotGeometry), distanceM);
  const withAll = await requiredWith(geometry);
  const contributionOf = async (effect: EffectKind): Promise<EffectContribution> => {
    const withoutEffect = WITHOUT_EFFECT[effect](geometry);
    if (!withoutEffect) {
      return NO_CONTRIBUTION;
    }
    const without = await requiredWith(withoutEffect);
    return { impactUpMil: without.upMrad - withAll.upMrad, impactRightMil: without.rightMrad - withAll.rightMrad };
  };
  const [angle, spinDrift, coriolis] = await Promise.all((['angle', 'spinDrift', 'coriolis'] as const).map(contributionOf));
  return { angle, spinDrift, coriolis };
}
