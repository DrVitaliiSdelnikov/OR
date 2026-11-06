import { windClockShare } from './field';

const MIL_PER_RADIAN_SCALE = 1000;
const REFERENCE_TEMPERATURE_C = 15;
const REFERENCE_PRESSURE_HPA = 1013;
const TEMPERATURE_FACTOR_PER_DEGREE = 0.002;
const PRESSURE_FACTOR_PER_HPA = 0.001;
const CLOCK_HOURS_PER_TURN = 12;
const TAIL_WIND_CLOCK_HOURS = 6;
const CLICK_ROUNDING_EPSILON = 1e-9;

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

export function roundToClicks(mil: number, clickMil: number): number {
  const clicks = Math.floor(Math.abs(mil) / clickMil + 0.5 + CLICK_ROUNDING_EPSILON);
  return clicks === 0 ? 0 : Math.sign(mil) * clicks;
}

export function clicksDifference(playerMil: number, referenceMil: number, clickMil: number): number {
  return Math.abs(roundToClicks(playerMil, clickMil) - roundToClicks(referenceMil, clickMil));
}

export function atmosphereFactor(temperatureC: number, pressureHpa: number): number {
  return (
    1 -
    TEMPERATURE_FACTOR_PER_DEGREE * (temperatureC - REFERENCE_TEMPERATURE_C) +
    PRESSURE_FACTOR_PER_HPA * (pressureHpa - REFERENCE_PRESSURE_HPA)
  );
}

export function atmosphereCorrectionMil(dopeMil: number, factor: number): number {
  return dopeMil * (factor - 1);
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
