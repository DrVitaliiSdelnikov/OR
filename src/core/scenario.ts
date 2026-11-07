import { FLAG_DISTANCES_M, WIND_ZONE_LIMITS_M } from './content';
import { mulberry32 } from './rng';
import { Atmosphere, WindZone } from './types';

export interface Gust {
  zoneIndex: number;
  startS: number;
  durationS: number;
  amplitude: number;
}

export interface WindDynamics {
  periodS: number;
  amplitude: number;
  phases: number[];
  zoneLagS: number;
  directionAmplitudeDeg: number;
  gusts: Gust[];
}

export interface GaugeReading {
  temperatureC: number;
  pressureHpa: number;
  relativeHumidity: number;
  windSpeedMps: number;
  windClock: number;
}

export interface FlagReading {
  distanceM: number;
  lateralWindMps: number;
}

export interface Scenario {
  seed: number;
  isWindUniform: boolean;
  startTimeS: number;
  dynamics: WindDynamics;
  gaugeSpeedBias: number;
  atmosphere: Atmosphere;
  zones: WindZone[];
  gauge: GaugeReading;
  flags: FlagReading[];
}

export type ValueRange = readonly [min: number, max: number];

export interface ScenarioOptions {
  windScale?: number;
  isWindUniform?: boolean;
  temperatureRangeC?: ValueRange;
  pressureRangeHpa?: ValueRange;
  windSpeedRangeMps?: ValueRange;
  windClocks?: readonly number[];
}

const GUST_TIMELINE_S = 1500;

export const normalizeDeg = (degrees: number): number => ((degrees % 360) + 360) % 360;

export function lateralWindMps(zone: Pick<WindZone, 'speedMps' | 'fromDeg'>): number {
  return zone.speedMps * Math.sin((zone.fromDeg * Math.PI) / 180);
}

export function clockFromDeg(fromDeg: number): number {
  const hour = Math.round(normalizeDeg(360 - fromDeg) / 30) % 12;
  return hour === 0 ? 12 : hour;
}

export function degFromClock(hour: number): number {
  return normalizeDeg(360 - hour * 30);
}

export function createScenario(seed: number, options: ScenarioOptions = {}): Scenario {
  const random = mulberry32(seed);
  const atmosphere: Atmosphere = {
    temperatureC: Math.round((4 + random() * 28) * 10) / 10,
    pressureHpa: Math.round(985 + random() * 40),
    relativeHumidity: Math.round((0.3 + random() * 0.5) * 100) / 100,
  };
  if (options.temperatureRangeC) {
    atmosphere.temperatureC = Math.round(valueInRange(options.temperatureRangeC, random()) * 10) / 10;
  }
  if (options.pressureRangeHpa) {
    atmosphere.pressureHpa = Math.round(valueInRange(options.pressureRangeHpa, random()));
  }
  const baseSpeedMps = 1 + random() * 5;
  const baseFromDeg = (random() < 0.5 ? 90 : 270) + (random() - 0.5) * 80;
  let zones: WindZone[] = WIND_ZONE_LIMITS_M.map(untilM => ({
    untilM,
    speedMps: Math.round(baseSpeedMps * (0.6 + random() * 0.9) * 10) / 10,
    fromDeg: Math.round(normalizeDeg(baseFromDeg + (random() - 0.5) * 50)),
  }));
  const dynamics: WindDynamics = {
    periodS: 28 + random() * 22,
    amplitude: 0.12 + random() * 0.2,
    phases: WIND_ZONE_LIMITS_M.map(() => random() * Math.PI * 2),
    zoneLagS: 1 + random() * 2,
    directionAmplitudeDeg: 8 + random() * 14,
    gusts: [],
  };
  for (let zoneIndex = 0; zoneIndex < WIND_ZONE_LIMITS_M.length; zoneIndex++) {
    let startS = random() * 20;
    while (startS < GUST_TIMELINE_S) {
      dynamics.gusts.push({ zoneIndex, startS, durationS: 4 + random() * 5, amplitude: 0.2 + random() * 0.35 });
      startS += 18 + random() * 40;
    }
  }
  const startTimeS = Math.floor(random() * 200);
  const gaugeSpeedBias = 0.88 + random() * 0.24;
  const shooterZone = zones[0];
  const gauge: GaugeReading = {
    temperatureC: Math.round((atmosphere.temperatureC + (random() - 0.5)) * 10) / 10,
    pressureHpa: Math.round(atmosphere.pressureHpa + (random() - 0.5) * 3),
    relativeHumidity: Math.round((atmosphere.relativeHumidity + (random() - 0.5) * 0.06) * 100) / 100,
    windSpeedMps: Math.round(shooterZone.speedMps * 10) / 10,
    windClock: clockFromDeg(shooterZone.fromDeg + (random() - 0.5) * 20),
  };

  const windScale = options.windScale ?? 1;
  zones = zones.map(zone => ({ ...zone, speedMps: Math.round(zone.speedMps * windScale * 10) / 10 }));
  const isWindUniform = options.isWindUniform ?? false;
  if (isWindUniform) {
    zones = zones.map(zone => ({ ...zone, speedMps: zones[0].speedMps, fromDeg: zones[0].fromDeg }));
  }
  if (options.windSpeedRangeMps) {
    const speedMps = Math.round(valueInRange(options.windSpeedRangeMps, random()) * 10) / 10;
    zones = zones.map(zone => ({ ...zone, speedMps }));
  }
  if (options.windClocks) {
    const fromDeg = degFromClock(options.windClocks[Math.floor(random() * options.windClocks.length)]);
    zones = zones.map(zone => ({ ...zone, fromDeg }));
    gauge.windClock = clockFromDeg(fromDeg);
  }
  gauge.windSpeedMps = Math.round(zones[0].speedMps * 10) / 10;

  return {
    seed,
    isWindUniform,
    startTimeS,
    dynamics,
    gaugeSpeedBias,
    atmosphere,
    zones,
    gauge,
    flags: flagReadings(zones),
  };
}

function valueInRange([min, max]: ValueRange, share: number): number {
  return min + (max - min) * share;
}

function flagReadings(zones: readonly WindZone[]): FlagReading[] {
  return FLAG_DISTANCES_M.map((distanceM, index) => ({ distanceM, lateralWindMps: lateralWindMps(zones[index + 1]) }));
}

function zoneSpeedFactor(scenario: Scenario, zoneIndex: number, timeS: number): number {
  const { dynamics } = scenario;
  const laggedTimeS = timeS - zoneIndex * dynamics.zoneLagS;
  let factor = 1 + dynamics.amplitude * Math.sin((2 * Math.PI * laggedTimeS) / dynamics.periodS + dynamics.phases[zoneIndex]);
  for (const gust of dynamics.gusts) {
    if (gust.zoneIndex !== zoneIndex) {
      continue;
    }
    const gustProgress = (laggedTimeS - gust.startS) / gust.durationS;
    if (gustProgress > 0 && gustProgress < 1) {
      factor += gust.amplitude * Math.sin(Math.PI * gustProgress) ** 2;
    }
  }
  return Math.max(0.1, factor);
}

export function windAt(scenario: Scenario, timeS: number): WindZone[] {
  const zones = zoneWindsAt(scenario, timeS);
  if (!scenario.isWindUniform) {
    return zones;
  }
  return zones.map(zone => ({ ...zone, speedMps: zones[0].speedMps, fromDeg: zones[0].fromDeg }));
}

function zoneWindsAt(scenario: Scenario, timeS: number): WindZone[] {
  const { dynamics } = scenario;
  return scenario.zones.map((zone, zoneIndex) => ({
    untilM: zone.untilM,
    speedMps: Math.round(zone.speedMps * zoneSpeedFactor(scenario, zoneIndex, timeS) * 100) / 100,
    fromDeg:
      Math.round(
        normalizeDeg(
          zone.fromDeg +
            dynamics.directionAmplitudeDeg *
              Math.sin((2 * Math.PI * (timeS - zoneIndex * dynamics.zoneLagS)) / (dynamics.periodS * 1.7) + dynamics.phases[zoneIndex] * 2),
        ) * 10,
      ) / 10,
  }));
}

export function gaugeWindAt(scenario: Scenario, timeS: number, noiseMps = 0): { speedMps: number; clock: number } {
  const shooterZone = windAt(scenario, timeS)[0];
  return {
    speedMps: Math.max(0, shooterZone.speedMps * scenario.gaugeSpeedBias + noiseMps),
    clock: clockFromDeg(shooterZone.fromDeg + ((scenario.gauge.windClock % 3) - 1) * 4),
  };
}
