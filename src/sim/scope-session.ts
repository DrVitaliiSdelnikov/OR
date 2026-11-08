import { mulberry32, RandomSource } from '../core/rng';
import { Correction } from '../core/types';
import { BoltAction, MAGAZINE_CAPACITY } from './bolt';
import { Heart, TaskPulse } from './heart';
import { Vector2 } from './noise';
import { defaultMagnification, ptPerMil, ScopeModel, stepMagnification, Turret, TurretMove } from './scope-model';
import { ScopeSway } from './sway';
import { TriggerAccessibility, TriggerPull } from './trigger';

export const INITIAL_AIM_MIL: Vector2 = { x: 0.9, y: -0.7 };
export const BOLT_KNOCK_MIL = 0.15;

export interface FireOutcome {
  hold: Correction;
  dial: Correction;
  triggerQuality: number;
}

export class ScopeSession {
  readonly heart: Heart;
  readonly sway: ScopeSway;
  readonly bolt: BoltAction;
  elevation: Turret;
  windage: Turret;
  magnification: number;
  aim: Vector2 = { ...INITIAL_AIM_MIL };
  trigger: TriggerPull | null = null;
  private readonly random: RandomSource;
  private shotCounter = 0;
  private lastBeat = false;

  constructor(
    public scope: ScopeModel,
    restingBpm: number,
    private readonly seed: number,
    private readonly accessibility: TriggerAccessibility,
    loadedRounds = MAGAZINE_CAPACITY,
  ) {
    this.bolt = new BoltAction(loadedRounds - 1, 'live');
    this.random = mulberry32(seed);
    this.heart = new Heart(this.random, new TaskPulse(restingBpm));
    this.sway = new ScopeSway(this.random, this.heart);
    this.elevation = Turret.elevation(scope);
    this.windage = Turret.windage(scope);
    this.magnification = defaultMagnification(scope);
  }

  get ptPerMil(): number {
    return ptPerMil(this.magnification);
  }

  get isBeat(): boolean {
    return this.lastBeat;
  }

  get dial(): Correction {
    return {
      upMrad: this.elevation.clicks * this.scope.clickMrad,
      rightMrad: -this.windage.clicks * this.scope.clickMrad,
    };
  }

  get crossOffsetMil(): Vector2 {
    const sway = this.sway.offsetMil;
    return { x: this.aim.x + sway.x, y: this.aim.y + sway.y };
  }

  get targetOffsetPt(): Vector2 {
    const cross = this.crossOffsetMil;
    return { x: -cross.x * this.ptPerMil, y: cross.y * this.ptPerMil };
  }

  setScope(scope: ScopeModel): void {
    this.scope = scope;
    this.elevation = Turret.elevation(scope);
    this.windage = Turret.windage(scope);
    this.magnification = defaultMagnification(scope);
  }

  zoom(direction: 1 | -1): void {
    this.magnification = stepMagnification(this.scope, this.magnification, direction);
  }

  turnElevation(deltaClicks: number): TurretMove {
    const move = this.elevation.turn(deltaClicks);
    this.aim.y -= move.appliedClicks * this.scope.clickMrad;
    return move;
  }

  turnWindageLeft(deltaClicks: number): TurretMove {
    const move = this.windage.turn(deltaClicks);
    this.aim.x += move.appliedClicks * this.scope.clickMrad;
    return move;
  }

  dragPicture(deltaXPt: number, deltaYPt: number): void {
    this.aim.x -= deltaXPt / this.ptPerMil;
    this.aim.y += deltaYPt / this.ptPerMil;
  }

  resetAim(): void {
    this.aim = { ...INITIAL_AIM_MIL };
    this.elevation.reset();
    this.windage.reset();
  }

  startTrigger(): boolean {
    if (!this.bolt.canFire) {
      return false;
    }
    this.trigger = new TriggerPull(mulberry32(this.seed * 13 + this.shotCounter), this.accessibility);
    return true;
  }

  cancelTrigger(): void {
    this.trigger = null;
  }

  step(dtS: number, finger: Vector2 | null): boolean {
    this.lastBeat = this.heart.step(dtS);
    this.sway.step(dtS, this.lastBeat);
    if (!this.trigger) {
      return false;
    }
    return this.trigger.step(dtS, this.heart.bpm, this.lastBeat, finger);
  }

  fire(): FireOutcome | null {
    if (!this.bolt.canFire) {
      return null;
    }
    const cross = this.crossOffsetMil;
    const bpm = this.heart.bpm;
    const spread = this.trigger ? this.trigger.extraSpread(bpm, this.seed + this.shotCounter * 7) : { upMrad: 0, rightMrad: 0 };
    const triggerQuality = this.trigger ? this.trigger.quality(bpm) : 1;
    this.bolt.fire();
    this.sway.fireRecoil();
    this.trigger = null;
    this.shotCounter++;
    return {
      hold: { upMrad: cross.y + spread.upMrad, rightMrad: cross.x + spread.rightMrad },
      dial: this.dial,
      triggerQuality,
    };
  }

  knockAimAfterCycle(): void {
    this.aim.x += (this.random() - 0.5) * 2 * BOLT_KNOCK_MIL;
    this.aim.y += (this.random() - 0.5) * 2 * BOLT_KNOCK_MIL;
  }
}
