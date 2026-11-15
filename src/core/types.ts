export type CartridgeId = 'A' | 'B' | 'C';

export type TwistDirection = 'right' | 'left';

export type DragModel = 'G1' | 'G7';

export interface Rifle {
  name: string;
  sightHeightCm: number;
  zeroM: number;
  groupSigmaMrad: number;
  coldBoreShiftMil: Correction;
  twistInchesPerTurn: number;
  twistDirection: TwistDirection;
}

export interface Cartridge {
  id: CartridgeId;
  name: string;
  blurb: string;
  massG: number;
  bulletDiameterIn: number;
  bulletLengthMm: number;
  dragModel: DragModel;
  ballisticCoefficient: number;
  muzzleVelocityMps: number;
  muzzleVelocitySdMps: number;
}

export interface Loadout {
  rifle: Rifle;
  cartridge: Cartridge;
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

