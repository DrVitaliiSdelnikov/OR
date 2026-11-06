import { STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C } from './content';
import type { DopeRow } from './dope-card';
import { windClockShare } from './field';

const MIL_PER_RADIAN_SCALE = 1000;
const ATMOSPHERE_COLUMN_STEP = 10;
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
