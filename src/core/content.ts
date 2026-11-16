import { text } from '../i18n';
import { CartridgeId, CourseCartridge, Loadout, Rifle, ShotGeometry, Target } from './types';
import { fromInput, UnitSystem } from './units';

export const COURSE_RIFLE: Rifle = {
  name: text.content.rifleName,
  sightHeightCm: 5,
  zeroM: 100,
  groupSigmaMrad: 0.1,
  coldBoreShiftMil: { upMrad: 0.15, rightMrad: 0.05 },
  twistInchesPerTurn: 10,
  twistDirection: 'right',
};

/** @deprecated T1.2: винтовка берётся из снаряжения задачи — `COURSE_RIFLE` или `courseLoadout`. Удалить в T1.5. */
export const RIFLE: Rifle = COURSE_RIFLE;

const COURSE_BULLET = { bulletDiameterIn: 0.308, dragModel: 'G7' } as const;

export const CARTRIDGES: readonly CourseCartridge[] = [
  { id: 'A', ...text.content.cartridges.A, ...COURSE_BULLET, massG: 9.7, bulletLengthMm: 28.5, ballisticCoefficient: 0.19, muzzleVelocityMps: 860, muzzleVelocitySdMps: 10 },
  { id: 'B', ...text.content.cartridges.B, ...COURSE_BULLET, massG: 10.9, bulletLengthMm: 31.2, ballisticCoefficient: 0.218, muzzleVelocityMps: 800, muzzleVelocitySdMps: 7 },
  { id: 'C', ...text.content.cartridges.C, ...COURSE_BULLET, massG: 11.7, bulletLengthMm: 32.5, ballisticCoefficient: 0.255, muzzleVelocityMps: 775, muzzleVelocitySdMps: 6 },
];

export const FLAT_GEOMETRY: ShotGeometry = { lookAngleDeg: 0, coriolis: null, isSpinDriftOn: false };

export const MAX_TRAJECTORY_M = 1000;
export const TRAJECTORY_STEP_M = 100;
/** @deprecated T1.8c: флажки зависят от системы — `rangeLayout(system).flagDistancesM`. Удалить в T2.1. */
export const FLAG_DISTANCES_M = [200, 400, 600] as const;
/** @deprecated T1.8c: границы зон зависят от системы — `rangeLayout(system).windZoneLimitsM`. Удалить в T2.1. */
export const WIND_ZONE_LIMITS_M = [150, 350, 550, Infinity] as const;
export const FLAG_DEG_PER_MPS = 9;
export const FLAG_MAX_DEG = 80;
export const STANDARD_PRESSURE_HPA = 1013;
export const STANDARD_TEMPERATURE_C = 15;
export const STANDARD_RELATIVE_HUMIDITY = 0.5;

export function cartridgeById(id: CartridgeId): CourseCartridge {
  return CARTRIDGES.find(cartridge => cartridge.id === id) ?? CARTRIDGES[1];
}

export function isCourseCartridgeId(id: string): id is CartridgeId {
  return CARTRIDGES.some(cartridge => cartridge.id === id);
}

export interface RangeLayout {
  flagDistancesM: readonly number[];
  windZoneLimitsM: readonly number[];
  courseZeroM: number;
}

const FLAG_DISTANCES_IN_SYSTEM = [200, 400, 600];
const WIND_ZONE_LIMITS_IN_SYSTEM = [150, 350, 550];
const COURSE_ZERO_IN_SYSTEM = 100;

const inMetres = (system: UnitSystem) => (value: number): number => fromInput('distance', value, system);

const RANGE_LAYOUTS: Record<UnitSystem, RangeLayout> = {
  metric: rangeLayoutIn('metric'),
  imperial: rangeLayoutIn('imperial'),
};

function rangeLayoutIn(system: UnitSystem): RangeLayout {
  return {
    flagDistancesM: FLAG_DISTANCES_IN_SYSTEM.map(inMetres(system)),
    windZoneLimitsM: [...WIND_ZONE_LIMITS_IN_SYSTEM.map(inMetres(system)), Infinity],
    courseZeroM: inMetres(system)(COURSE_ZERO_IN_SYSTEM),
  };
}

export function rangeLayout(system: UnitSystem): RangeLayout {
  return RANGE_LAYOUTS[system];
}

export function courseLoadout(id: CartridgeId, system: UnitSystem = 'metric'): Loadout {
  const zeroM = rangeLayout(system).courseZeroM;
  return { rifle: zeroM === COURSE_RIFLE.zeroM ? COURSE_RIFLE : { ...COURSE_RIFLE, zeroM }, cartridge: cartridgeById(id) };
}

export function targetRadiusMrad(target: Target): number {
  return (target.diameterM / 2 / target.distanceM) * 1000;
}

export function flagAngleDeg(lateralWindMps: number): number {
  return Math.min(FLAG_MAX_DEG, Math.abs(lateralWindMps) * FLAG_DEG_PER_MPS);
}

