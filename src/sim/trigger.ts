import { mulberry32, RandomSource } from '../core/rng';
import { Correction } from '../core/types';
import { DampedSpring, previewNoise, Vector2 } from './noise';

export const ZONE_RADIUS_MAX_PT = 74;
export const ZONE_RADIUS_MIN_PT = 22;
export const ZONE_SHRINK_PT_PER_BPM = 0.62;
export const PRESSURE_GAIN_PER_S = 0.22;
export const PRESSURE_LOSS_OUTSIDE_PER_S = 0.35;
export const PRESSURE_LOSS_RELEASED_PER_S = 0.5;
export const OUTSIDE_DISTANCE_PENALTY = 1.4;
export const MAX_TRIGGER_SPREAD_MIL = 0.4;
export const MARKER_LIMIT_PT = 150;
export const LARGER_ZONE_FACTOR = 1.3;

const FINGER_PULL_PER_S = 7;
const VELOCITY_RETENTION_PER_S = 0.18;
const EXCITATION_BASE = 24;
const EXCITATION_PER_BPM = 0.55;
const EXCITATION_GAIN = 3;
const BEAT_SPRING_HZ = 3.2;
const BEAT_SPRING_DAMPING = 0.3;
const BEAT_IMPULSE_BASE = 60;
const BEAT_IMPULSE_PER_BPM = 1.6;
const BEAT_SPRING_COUPLING = 0.4;

export type TriggerQualityLabel = 'clean' | 'medium' | 'jerk';

export const TRIGGER_QUALITY_TEXT: Record<TriggerQualityLabel, string> = {
  clean: 'ЧИСТЫЙ СПУСК',
  medium: 'СРЕДНИЙ СПУСК',
  jerk: 'РЫВОК',
};

export interface TriggerAccessibility {
  isZoneLarger: boolean;
  isMarkerDriftOff: boolean;
}

export function zoneRadiusPt(bpm: number, isZoneLarger = false): number {
  const radius = Math.max(ZONE_RADIUS_MIN_PT, Math.min(ZONE_RADIUS_MAX_PT, ZONE_RADIUS_MAX_PT - (bpm - 60) * ZONE_SHRINK_PT_PER_BPM));
  return isZoneLarger ? radius * LARGER_ZONE_FACTOR : radius;
}

export function qualityLabel(quality: number): TriggerQualityLabel {
  if (quality > 0.7) {
    return 'clean';
  }
  return quality >= 0.4 ? 'medium' : 'jerk';
}

export class TriggerPull {
  marker: Vector2 = { x: 60, y: 40 };
  private markerVelocity: Vector2 = { x: 0, y: 0 };
  private readonly beatSpring = new DampedSpring(2 * Math.PI * BEAT_SPRING_HZ, BEAT_SPRING_DAMPING);
  private pressureShare = 0;
  private distanceSum = 0;
  private sampleCount = 0;
  private hasFired = false;

  constructor(
    private readonly random: RandomSource,
    private readonly accessibility: TriggerAccessibility = { isZoneLarger: false, isMarkerDriftOff: false },
  ) {}

  get pressure(): number {
    return this.pressureShare;
  }

  get fired(): boolean {
    return this.hasFired;
  }

  radiusPt(bpm: number): number {
    return zoneRadiusPt(bpm, this.accessibility.isZoneLarger);
  }

  isMarkerInside(bpm: number): boolean {
    return Math.hypot(this.marker.x, this.marker.y) < this.radiusPt(bpm);
  }

  quality(bpm: number): number {
    const averageDistance = this.distanceSum / Math.max(1, this.sampleCount);
    return Math.max(0, 1 - averageDistance / this.radiusPt(bpm));
  }

  extraSpread(bpm: number, seed: number): Correction {
    const angle = mulberry32(seed)() * Math.PI * 2;
    const radiusMil = MAX_TRIGGER_SPREAD_MIL * (1 - this.quality(bpm));
    return { rightMrad: Math.cos(angle) * radiusMil, upMrad: Math.sin(angle) * radiusMil };
  }

  step(dtS: number, bpm: number, isBeat: boolean, finger: Vector2 | null): boolean {
    if (this.hasFired) {
      return false;
    }
    const clampedDtS = Math.max(0.001, Math.min(0.05, dtS));
    if (isBeat) {
      this.beatSpring.impulse({
        x: 0,
        y: -(BEAT_IMPULSE_BASE + (bpm - 60) * BEAT_IMPULSE_PER_BPM) * (1 + previewNoise(this.random) * 0.25),
      });
    }
    this.beatSpring.step(clampedDtS);
    if (!this.accessibility.isMarkerDriftOff) {
      const excitation = (EXCITATION_BASE + (bpm - 60) * EXCITATION_PER_BPM) * Math.sqrt(clampedDtS) * EXCITATION_GAIN;
      this.markerVelocity.x += previewNoise(this.random) * excitation;
      this.markerVelocity.y += previewNoise(this.random) * excitation;
    }
    if (finger) {
      this.markerVelocity.x += (finger.x - this.marker.x) * FINGER_PULL_PER_S * clampedDtS;
      this.markerVelocity.y += (finger.y - this.marker.y) * FINGER_PULL_PER_S * clampedDtS;
    }
    const retention = Math.pow(VELOCITY_RETENTION_PER_S, clampedDtS);
    this.markerVelocity.x *= retention;
    this.markerVelocity.y *= retention;
    this.marker.x = clampMarker(this.marker.x + this.markerVelocity.x * clampedDtS);
    this.marker.y = clampMarker(this.marker.y + this.markerVelocity.y * clampedDtS + this.beatSpring.velocity.y * clampedDtS * BEAT_SPRING_COUPLING);

    const distance = Math.hypot(this.marker.x, this.marker.y);
    const isInside = distance < this.radiusPt(bpm);
    if (finger) {
      this.sampleCount++;
      if (isInside) {
        this.pressureShare = Math.min(1, this.pressureShare + clampedDtS * PRESSURE_GAIN_PER_S);
        this.distanceSum += distance;
      } else {
        this.pressureShare = Math.max(0, this.pressureShare - clampedDtS * PRESSURE_LOSS_OUTSIDE_PER_S);
        this.distanceSum += distance * OUTSIDE_DISTANCE_PENALTY;
      }
    } else {
      this.pressureShare = Math.max(0, this.pressureShare - clampedDtS * PRESSURE_LOSS_RELEASED_PER_S);
    }
    if (this.pressureShare >= 1) {
      this.hasFired = true;
      return true;
    }
    return false;
  }
}

function clampMarker(value: number): number {
  return Math.max(-MARKER_LIMIT_PT, Math.min(MARKER_LIMIT_PT, value));
}
