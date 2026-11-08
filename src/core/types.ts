export type CartridgeId = 'A' | 'B' | 'C';

export interface Rifle {
  name: string;
  sightHeightCm: number;
  zeroM: number;
  groupSigmaMrad: number;
  bulletDiameterIn: number;
  coldBoreShiftMil: Correction;
}

export interface Cartridge {
  id: CartridgeId;
  name: string;
  blurb: string;
  massG: number;
  bcG7: number;
  muzzleVelocityMps: number;
  muzzleVelocitySdMps: number;
}

export interface Target {
  distanceM: number;
  diameterM: number;
}

export interface Atmosphere {
  temperatureC: number;
  pressureHpa: number;
  relativeHumidity: number;
}

export interface WindZone {
  untilM: number;
  speedMps: number;
  fromDeg: number;
}

export interface Correction {
  upMrad: number;
  rightMrad: number;
}

export interface TrajectoryPoint {
  distanceM: number;
  dropMrad: number;
  windageMrad: number;
  timeS: number;
  velocityMps: number;
}

export interface RequiredCorrection extends Correction {
  timeS: number;
  velocityMps: number;
}

