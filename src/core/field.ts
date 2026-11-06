import { degFromClock, normalizeDeg } from './scenario';

const FULL_VALUE_TOLERANCE_DEG = 15;
const SPEED_OF_SOUND_BASE_MPS = 331.3;
const SPEED_OF_SOUND_PER_DEGREE = 0.606;
export const TRANSONIC_MACH = 1.2;

export type WindValueShare = 0 | 0.5 | 1;

export function windClockShare(clockHours: number): WindValueShare {
  const fromDeg = normalizeDeg(degFromClock(clockHours));
  const offsetFromSideDeg = Math.abs(Math.abs(fromDeg - 180) - 90);
  if (offsetFromSideDeg <= FULL_VALUE_TOLERANCE_DEG) {
    return 1;
  }
  if (90 - offsetFromSideDeg <= FULL_VALUE_TOLERANCE_DEG) {
    return 0;
  }
  return 0.5;
}

export function crosswindByClockRule(speedMps: number, clockHours: number): number {
  return speedMps * windClockShare(clockHours);
}

export function formatClock(clockHours: number): string {
  const wholeHours = Math.floor(clockHours);
  const minutes = Math.round((clockHours - wholeHours) * 60);
  const displayHours = wholeHours === 0 ? 12 : wholeHours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')}`;
}

export function densityAltitudeM(temperatureC: number, pressureHpa: number): number {
  const pressureInHg = pressureHpa * 0.02953;
  const temperatureR = temperatureC * 1.8 + 32 + 459.67;
  const densityAltitudeFt = 145442.16 * (1 - Math.pow((17.326 * pressureInHg) / temperatureR, 0.235));
  return densityAltitudeFt * 0.3048;
}

export function speedOfSoundMps(temperatureC: number): number {
  return SPEED_OF_SOUND_BASE_MPS + SPEED_OF_SOUND_PER_DEGREE * temperatureC;
}

export function isTransonic(velocityMps: number, temperatureC: number): boolean {
  return velocityMps < TRANSONIC_MACH * speedOfSoundMps(temperatureC);
}

export function impactSoundDelayS(timeOfFlightS: number, distanceM: number, temperatureC: number): number {
  return timeOfFlightS + distanceM / speedOfSoundMps(temperatureC);
}
