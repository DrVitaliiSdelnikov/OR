import { Cartridge, CartridgeId, Rifle, Target } from './types';

export const RIFLE: Rifle = {
  name: '«Рубеж-1», класс .308',
  sightHeightCm: 5,
  zeroM: 100,
  groupSigmaMrad: 0.1,
  bulletDiameterIn: 0.308,
  coldBoreShiftMil: { upMrad: 0.15, rightMrad: 0.05 },
};

export const CARTRIDGES: readonly Cartridge[] = [
  { id: 'A', name: 'Патрон А', blurb: 'лёгкая быстрая пуля', massG: 9.7, bcG7: 0.19, muzzleVelocityMps: 860, muzzleVelocitySdMps: 10 },
  { id: 'B', name: 'Патрон Б', blurb: 'средняя пуля', massG: 10.9, bcG7: 0.218, muzzleVelocityMps: 800, muzzleVelocitySdMps: 7 },
  { id: 'C', name: 'Патрон В', blurb: 'тяжёлая пуля, высокий BC', massG: 11.7, bcG7: 0.255, muzzleVelocityMps: 775, muzzleVelocitySdMps: 6 },
];

export const MAX_TRAJECTORY_M = 1000;
export const TRAJECTORY_STEP_M = 100;
export const FLAG_DISTANCES_M = [200, 400, 600] as const;
export const WIND_ZONE_LIMITS_M = [150, 350, 550, Infinity] as const;
export const FLAG_DEG_PER_MPS = 9;
export const FLAG_MAX_DEG = 80;
export const STANDARD_PRESSURE_HPA = 1013;
export const STANDARD_TEMPERATURE_C = 15;
export const STANDARD_RELATIVE_HUMIDITY = 0.5;

export function cartridgeById(id: CartridgeId): Cartridge {
  return CARTRIDGES.find(cartridge => cartridge.id === id) ?? CARTRIDGES[1];
}

export function targetRadiusMrad(target: Target): number {
  return (target.diameterM / 2 / target.distanceM) * 1000;
}

export function flagAngleDeg(lateralWindMps: number): number {
  return Math.min(FLAG_MAX_DEG, Math.abs(lateralWindMps) * FLAG_DEG_PER_MPS);
}

