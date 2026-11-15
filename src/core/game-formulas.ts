import { STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C } from './content';
import type { DopeRow } from './dope-card';
import { windClockShare } from './field';

const MIL_PER_RADIAN_SCALE = 1000;
const ATMOSPHERE_COLUMN_STEP = 10;
const CLOCK_HOURS_PER_TURN = 12;
const TAIL_WIND_CLOCK_HOURS = 6;
const CLICK_ROUNDING_EPSILON = 1e-9;
const RADIANS_PER_DEGREE = Math.PI / 180;
const EARTH_ROTATION_RAD_PER_S = 7.292115e-5;
const YARDS_PER_MIL_PER_INCH = 27.78;
const YARDS_PER_MOA_PER_INCH = 95.5;
const MPS_PER_MPH = 0.44704;
const METERS_PER_YARD = 0.9144;
const IMPERIAL_WIND_CONSTANT_ROUNDING = 10;
const IMPERIAL_LEAD_SCALE = (MPS_PER_MPH / METERS_PER_YARD) * MIL_PER_RADIAN_SCALE;

export function crosswindMps(speedMps: number, clockHours: number): number {
  return speedMps * windClockShare(clockHours);
}

export function windCorrectionMil(speedMps: number, clockHours: number, distanceM: number, windConstant: number): number {
  const correctionSize = (crosswindMps(speedMps, clockHours) * distanceM) / windConstant;
  return correctionSize === 0 ? 0 : correctionSign(clockHours) * correctionSize;
}

function correctionSign(clockHours: number): number {
  const normalizedHours = ((clockHours % CLOCK_HOURS_PER_TURN) + CLOCK_HOURS_PER_TURN) % CLOCK_HOURS_PER_TURN;
  return normalizedHours > TAIL_WIND_CLOCK_HOURS ? -1 : 1;
}

export function averageCrosswindMps(zoneCrosswindsMps: readonly number[], zoneWeights: readonly number[]): number {
  if (zoneCrosswindsMps.length !== zoneWeights.length) {
    throw new RangeError(`${zoneCrosswindsMps.length} zone winds for ${zoneWeights.length} zone weights`);
  }
  return zoneCrosswindsMps.reduce((total, crosswindMps, index) => total + crosswindMps * zoneWeights[index], 0);
}

export function roundToClicks(mil: number, clickMil: number): number {
  const clicks = Math.floor(Math.abs(mil) / clickMil + 0.5 + CLICK_ROUNDING_EPSILON);
  return clicks === 0 ? 0 : Math.sign(mil) * clicks;
}

export function clicksDifference(playerMil: number, referenceMil: number, clickMil: number): number {
  return Math.abs(roundToClicks(playerMil, clickMil) - roundToClicks(referenceMil, clickMil));
}

export function atmosphereCorrectionMil(
  row: Pick<DopeRow, 'colderBy10CMil' | 'pressureUp10HpaMil'>,
  temperatureC: number,
  pressureHpa: number,
): number {
  const tensOfDegreesColder = (STANDARD_TEMPERATURE_C - temperatureC) / ATMOSPHERE_COLUMN_STEP;
  const tensOfHpaHigher = (pressureHpa - STANDARD_PRESSURE_HPA) / ATMOSPHERE_COLUMN_STEP;
  return tensOfDegreesColder * row.colderBy10CMil + tensOfHpaHigher * row.pressureUp10HpaMil;
}

export function rangeByMilling(targetSizeM: number, sizeOnReticleMil: number): number {
  if (sizeOnReticleMil <= 0) {
    throw new RangeError(`size on reticle must be positive, got ${sizeOnReticleMil} MIL`);
  }
  return (targetSizeM * MIL_PER_RADIAN_SCALE) / sizeOnReticleMil;
}

export function isRangeWithinTolerance(estimatedM: number, trueM: number, toleranceShare: number): boolean {
  return Math.abs(estimatedM - trueM) <= toleranceShare * trueM;
}

export function leadMil(targetSpeedMps: number, movementClockHours: number, timeOfFlightS: number, distanceM: number): number {
  if (distanceM === 0) {
    return 0;
  }
  return ((targetSpeedMps * windClockShare(movementClockHours) * timeOfFlightS) / distanceM) * MIL_PER_RADIAN_SCALE;
}

export function inclineElevationMil(dopeElevationMil: number, zeroAngleMil: number, lookAngleDeg: number): number {
  return (dopeElevationMil + zeroAngleMil) * Math.cos(lookAngleDeg * RADIANS_PER_DEGREE) - zeroAngleMil;
}

export function coriolisHorizontalMil(timeOfFlightS: number, latitudeDeg: number): number {
  return MIL_PER_RADIAN_SCALE * EARTH_ROTATION_RAD_PER_S * timeOfFlightS * Math.sin(latitudeDeg * RADIANS_PER_DEGREE);
}

export function coriolisVerticalMil(timeOfFlightS: number, latitudeDeg: number, azimuthDeg: number): number {
  return (
    MIL_PER_RADIAN_SCALE * EARTH_ROTATION_RAD_PER_S * timeOfFlightS * Math.cos(latitudeDeg * RADIANS_PER_DEGREE) * Math.sin(azimuthDeg * RADIANS_PER_DEGREE)
  );
}

export function rangeByMillingYards(targetSizeInches: number, sizeOnReticleMil: number): number {
  if (sizeOnReticleMil <= 0) {
    throw new RangeError(`size on reticle must be positive, got ${sizeOnReticleMil} MIL`);
  }
  return (targetSizeInches * YARDS_PER_MIL_PER_INCH) / sizeOnReticleMil;
}

export function rangeByMoaYards(targetSizeInches: number, sizeOnReticleMoa: number): number {
  if (sizeOnReticleMoa <= 0) {
    throw new RangeError(`size on reticle must be positive, got ${sizeOnReticleMoa} MOA`);
  }
  return (targetSizeInches * YARDS_PER_MOA_PER_INCH) / sizeOnReticleMoa;
}

export function imperialWindConstant(windConstant: number): number {
  return Math.round(windConstant / (MPS_PER_MPH * METERS_PER_YARD) / IMPERIAL_WIND_CONSTANT_ROUNDING) * IMPERIAL_WIND_CONSTANT_ROUNDING;
}

export function leadMilImperial(targetSpeedMph: number, movementClockHours: number, timeOfFlightS: number, distanceYards: number): number {
  if (distanceYards === 0) {
    return 0;
  }
  return (IMPERIAL_LEAD_SCALE * targetSpeedMph * windClockShare(movementClockHours) * timeOfFlightS) / distanceYards;
}
