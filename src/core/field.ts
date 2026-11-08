const SPEED_OF_SOUND_BASE_MPS = 331.3;
const SPEED_OF_SOUND_PER_DEGREE = 0.606;
const DEGREES_PER_CLOCK_HOUR = 30;
const SHARE_DECIMALS_FACTOR = 100;

export function windClockShare(clockHours: number): number {
  const angleFromLineOfFireRad = (clockHours * DEGREES_PER_CLOCK_HOUR * Math.PI) / 180;
  return Math.round(Math.abs(Math.sin(angleFromLineOfFireRad)) * SHARE_DECIMALS_FACTOR) / SHARE_DECIMALS_FACTOR;
}

export function speedOfSoundMps(temperatureC: number): number {
  return SPEED_OF_SOUND_BASE_MPS + SPEED_OF_SOUND_PER_DEGREE * temperatureC;
}

export function impactSoundDelayS(timeOfFlightS: number, distanceM: number, temperatureC: number): number {
  return timeOfFlightS + distanceM / speedOfSoundMps(temperatureC);
}
