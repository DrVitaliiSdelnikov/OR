import { RandomSource } from '../core/rng';
import { previewNoise } from './noise';

export interface PulseSource {
  readonly kind: 'task' | 'device';
  targetBpm(timeS: number): number;
}

export class TaskPulse implements PulseSource {
  readonly kind = 'task';

  constructor(private readonly restingBpm: number) {}

  targetBpm(): number {
    return this.restingBpm;
  }
}

export const PULSE_PRESETS = { rest: 62, climb: 92, stress: 118 } as const;
export const PULSE_WANDER_BPM = 5;
export const PULSE_WANDER_STEP_BPM = 1.2;
export const PULSE_APPROACH_PER_S = 0.8;
export const BEAT_INTERVAL_JITTER = 0.045;
export const REFERENCE_BPM = 65;

export class Heart {
  private wanderBpm = 0;
  private currentBpm: number;
  private secondsToBeat = 0.4;
  private elapsedS = 0;

  constructor(
    private readonly random: RandomSource,
    private readonly source: PulseSource,
  ) {
    this.currentBpm = source.targetBpm(0);
  }

  get bpm(): number {
    return this.currentBpm;
  }

  get amplitudeScale(): number {
    return this.currentBpm / REFERENCE_BPM;
  }

  step(dtS: number): boolean {
    this.elapsedS += dtS;
    const baseBpm = this.source.targetBpm(this.elapsedS);
    const desiredBpm = baseBpm + this.wanderBpm;
    this.currentBpm += (desiredBpm - this.currentBpm) * Math.min(1, dtS * PULSE_APPROACH_PER_S);
    this.secondsToBeat -= dtS;
    if (this.secondsToBeat > 0) {
      return false;
    }
    this.wanderBpm = Math.max(
      -PULSE_WANDER_BPM,
      Math.min(PULSE_WANDER_BPM, this.wanderBpm + (this.random() - 0.5) * 2 * PULSE_WANDER_STEP_BPM),
    );
    this.secondsToBeat += (60 / this.currentBpm) * (1 + previewNoise(this.random) * BEAT_INTERVAL_JITTER);
    return true;
  }
}
