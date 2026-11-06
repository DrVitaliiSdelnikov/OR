import { gaussian, RandomSource } from '../core/rng';

export const PREVIEW_NOISE_SIGMA = 0.8;

export function previewNoise(random: RandomSource): number {
  return gaussian(random) * PREVIEW_NOISE_SIGMA;
}

export interface Vector2 {
  x: number;
  y: number;
}

export class DampedSpring {
  position: Vector2 = { x: 0, y: 0 };
  velocity: Vector2 = { x: 0, y: 0 };
  private static readonly SUBSTEP_S = 0.003;

  constructor(
    private readonly angularFrequency: number,
    private readonly dampingRatio: number,
  ) {}

  impulse(deltaVelocity: Vector2): void {
    this.velocity.x += deltaVelocity.x;
    this.velocity.y += deltaVelocity.y;
  }

  step(dtS: number): void {
    const substeps = Math.ceil(dtS / DampedSpring.SUBSTEP_S);
    const substepS = dtS / substeps;
    const stiffness = this.angularFrequency * this.angularFrequency;
    const damping = 2 * this.dampingRatio * this.angularFrequency;
    for (let index = 0; index < substeps; index++) {
      this.velocity.x += (-stiffness * this.position.x - damping * this.velocity.x) * substepS;
      this.velocity.y += (-stiffness * this.position.y - damping * this.velocity.y) * substepS;
      this.position.x += this.velocity.x * substepS;
      this.position.y += this.velocity.y * substepS;
    }
  }
}
