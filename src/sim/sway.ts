import { RandomSource } from '../core/rng';
import { Heart } from './heart';
import { DampedSpring, previewNoise, Vector2 } from './noise';

export const BREATH_HOLD_CALM_S = 5;
export const BREATH_HOLD_MAX_S = 8;
export const BREATH_HOLD_CALM_FACTOR = 0.22;
export const BREATH_HOLD_STRAIN_RATE = 0.5;
export const BREATH_HOLD_STRAIN_MULTIPLIER = 1.5;
export const BREATH_COOLDOWN_S = 2.5;
export const HOLD_FACTOR_APPROACH_PER_S = 5;

const BEAT_SPRING_HZ = 3.6;
const BEAT_SPRING_DAMPING = 0.28;
const BEAT_AMPLITUDE_MIL = 0.035;
const BEAT_AMPLITUDE_JITTER = 0.35;
const DRIFT_TIME_CONSTANT_S = 1.6;
const DRIFT_SIGMA = 0.22;
const DRIFT_WEIGHT = 0.5;
const BREATH_HZ = 0.21;
const BREATH_WEIGHT = 0.07;
const RECOIL_DURATION_S = 0.5;
const RECOIL_DECAY = 9;
const RECOIL_ANGULAR_FREQUENCY = 30;
const RECOIL_UP_MIL = 0.8 * 0.9;
const RECOIL_SIDE_MIL = 0.25 * 0.6;

export type BreathState = 'free' | 'holding' | 'cooldown';

export class BreathHold {
  private holdElapsedS = 0;
  private cooldownLeftS = 0;
  private isHolding = false;
  private smoothedFactor = 1;
  private wasForcedOut = false;

  get state(): BreathState {
    if (this.isHolding) {
      return 'holding';
    }
    return this.cooldownLeftS > 0 ? 'cooldown' : 'free';
  }

  get heldS(): number {
    return this.isHolding ? this.holdElapsedS : 0;
  }

  get factor(): number {
    return this.smoothedFactor;
  }

  get wasExhaleForced(): boolean {
    return this.wasForcedOut;
  }

  press(): boolean {
    if (this.isHolding || this.cooldownLeftS > 0) {
      return false;
    }
    this.isHolding = true;
    this.holdElapsedS = 0;
    this.wasForcedOut = false;
    return true;
  }

  release(): void {
    if (!this.isHolding) {
      return;
    }
    this.isHolding = false;
    this.cooldownLeftS = BREATH_COOLDOWN_S;
  }

  targetFactor(): number {
    if (!this.isHolding) {
      return 1;
    }
    if (this.holdElapsedS < BREATH_HOLD_CALM_S) {
      return BREATH_HOLD_CALM_FACTOR;
    }
    return (BREATH_HOLD_CALM_FACTOR + (this.holdElapsedS - BREATH_HOLD_CALM_S) * BREATH_HOLD_STRAIN_RATE) * BREATH_HOLD_STRAIN_MULTIPLIER;
  }

  step(dtS: number): void {
    if (this.isHolding) {
      this.holdElapsedS += dtS;
      if (this.holdElapsedS >= BREATH_HOLD_MAX_S) {
        this.release();
        this.wasForcedOut = true;
      }
    } else if (this.cooldownLeftS > 0) {
      this.cooldownLeftS = Math.max(0, this.cooldownLeftS - dtS);
    }
    this.smoothedFactor += (this.targetFactor() - this.smoothedFactor) * Math.min(1, dtS * HOLD_FACTOR_APPROACH_PER_S);
  }
}

export class ScopeSway {
  readonly breath = new BreathHold();
  private readonly beatSpring = new DampedSpring(2 * Math.PI * BEAT_SPRING_HZ, BEAT_SPRING_DAMPING);
  private drift: Vector2 = { x: 0, y: 0 };
  private elapsedS = 0;
  private recoilAgeS = Infinity;
  private recoilSide = 0;

  constructor(
    private readonly random: RandomSource,
    private readonly heart: Heart,
  ) {}

  get offsetMil(): Vector2 {
    const holdFactor = this.breath.factor;
    const breathWave = Math.sin(2 * Math.PI * BREATH_HZ * this.elapsedS * (1 + 0.12 * Math.sin(0.37 * this.elapsedS)));
    const recoil = this.recoilOffset();
    return {
      x: (this.drift.x * DRIFT_WEIGHT + this.beatSpring.position.x) * holdFactor + recoil.x,
      y: (this.drift.y * DRIFT_WEIGHT + breathWave * BREATH_WEIGHT + this.beatSpring.position.y) * holdFactor + recoil.y,
    };
  }

  fireRecoil(): void {
    this.recoilAgeS = 0;
    this.recoilSide = this.random() - 0.5;
  }

  step(dtS: number, isBeat: boolean): void {
    const clampedDtS = Math.max(0.001, Math.min(0.05, dtS));
    this.elapsedS += clampedDtS;
    this.recoilAgeS += clampedDtS;
    this.breath.step(clampedDtS);
    if (isBeat) {
      const amplitude = BEAT_AMPLITUDE_MIL * (1 + previewNoise(this.random) * BEAT_AMPLITUDE_JITTER) * this.heart.amplitudeScale;
      this.beatSpring.impulse({
        x: (this.random() - 0.5) * amplitude * 50,
        y: amplitude * 60 * (1 + this.random() * 0.4),
      });
    }
    this.beatSpring.step(clampedDtS);
    const driftNoise = DRIFT_SIGMA * Math.sqrt(clampedDtS);
    this.drift = {
      x: this.drift.x - (this.drift.x / DRIFT_TIME_CONSTANT_S) * clampedDtS + driftNoise * previewNoise(this.random),
      y: this.drift.y - (this.drift.y / DRIFT_TIME_CONSTANT_S) * clampedDtS + driftNoise * previewNoise(this.random),
    };
  }

  private recoilOffset(): Vector2 {
    if (this.recoilAgeS >= RECOIL_DURATION_S) {
      return { x: 0, y: 0 };
    }
    const envelope = Math.exp(-this.recoilAgeS * RECOIL_DECAY) * Math.cos(this.recoilAgeS * RECOIL_ANGULAR_FREQUENCY);
    return { x: this.recoilSide * 2 * RECOIL_SIDE_MIL * envelope, y: RECOIL_UP_MIL * envelope };
  }
}
