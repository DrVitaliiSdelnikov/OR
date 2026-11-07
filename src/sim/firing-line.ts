import { CartridgeId } from '../core/types';
import { MAGAZINE_CAPACITY } from './bolt';

export type FiringEvent = 'target-closed' | 'next-target' | 'magazine-empty' | 'stage-done' | 'exercise-done';

export interface FiringStage {
  cartridgeId: CartridgeId;
  targetCount: number;
  maxShotsPerTarget: number;
  closesOnHit: boolean;
}

export type FiringPlan =
  | { kind: 'exercise'; stages: readonly FiringStage[]; hasColdBore: boolean }
  | { kind: 'free'; cartridgeId: CartridgeId };

export interface FiredShot {
  isHit: boolean;
  isColdBore: boolean;
}

export interface FiringSeries {
  cartridgeId: CartridgeId;
  targets: FiredShot[][];
}

export class FiringLine {
  private currentStageIndex = 0;
  private currentTargetIndex = 0;
  private loadedRounds = 0;
  private roundsInMagazine = 0;
  private stageRoundsFired = 0;
  private hasFired = false;
  private isExerciseDone = false;
  private readonly seriesList: FiringSeries[] = [];

  constructor(private readonly plan: FiringPlan) {
    this.startSeries(plan.kind === 'free' ? plan.cartridgeId : plan.stages[0].cartridgeId);
    this.loadMagazine();
  }

  get cartridgeId(): CartridgeId {
    return this.currentSeries.cartridgeId;
  }

  get stageIndex(): number {
    return this.currentStageIndex;
  }

  get targetIndex(): number {
    return this.currentTargetIndex;
  }

  get magazineLoaded(): number {
    return this.loadedRounds;
  }

  get magazineLeft(): number {
    return this.roundsInMagazine;
  }

  get isFinished(): boolean {
    return this.isExerciseDone;
  }

  get isNextShotCold(): boolean {
    const isColdBoreOn = this.plan.kind === 'free' || this.plan.hasColdBore;
    return isColdBoreOn && !this.hasFired;
  }

  get series(): readonly FiringSeries[] {
    return this.seriesList;
  }

  recordShot(isHit: boolean): FiringEvent[] {
    if (this.isExerciseDone) {
      throw new RangeError('the exercise is over');
    }
    if (this.roundsInMagazine === 0) {
      throw new RangeError('the magazine is empty, change it first');
    }
    this.currentShots.push({ isHit, isColdBore: this.isNextShotCold });
    this.hasFired = true;
    this.roundsInMagazine--;
    this.stageRoundsFired++;
    const events = this.plan.kind === 'exercise' ? this.advanceExercise(this.plan, isHit) : [];
    if (this.roundsInMagazine === 0 && !events.includes('stage-done') && !this.isExerciseDone) {
      events.push('magazine-empty');
    }
    return events;
  }

  changeMagazine(cartridgeId?: CartridgeId): void {
    if (this.plan.kind === 'exercise') {
      if (this.roundsInMagazine > 0) {
        throw new RangeError('the course changes a magazine only when it is empty');
      }
      this.loadMagazine();
      return;
    }
    const nextCartridgeId = cartridgeId ?? this.cartridgeId;
    if (this.currentShots.length === 0) {
      this.currentSeries.cartridgeId = nextCartridgeId;
    } else {
      this.startSeries(nextCartridgeId);
    }
    this.loadMagazine();
  }

  private get currentSeries(): FiringSeries {
    return this.seriesList[this.seriesList.length - 1];
  }

  private get currentShots(): FiredShot[] {
    return this.currentSeries.targets[this.currentTargetIndex];
  }

  private advanceExercise(plan: Extract<FiringPlan, { kind: 'exercise' }>, isHit: boolean): FiringEvent[] {
    const stage = plan.stages[this.currentStageIndex];
    const isTargetClosed = (stage.closesOnHit && isHit) || this.currentShots.length === stage.maxShotsPerTarget;
    if (!isTargetClosed) {
      return [];
    }
    if (this.currentTargetIndex + 1 < stage.targetCount) {
      this.currentTargetIndex++;
      this.currentSeries.targets.push([]);
      return ['target-closed', 'next-target'];
    }
    if (this.currentStageIndex + 1 < plan.stages.length) {
      this.currentStageIndex++;
      this.currentTargetIndex = 0;
      this.stageRoundsFired = 0;
      this.roundsInMagazine = 0;
      this.startSeries(plan.stages[this.currentStageIndex].cartridgeId);
      return ['target-closed', 'stage-done'];
    }
    this.isExerciseDone = true;
    return ['target-closed', 'exercise-done'];
  }

  private startSeries(cartridgeId: CartridgeId): void {
    this.seriesList.push({ cartridgeId, targets: [[]] });
  }

  private loadMagazine(): void {
    this.loadedRounds = Math.min(MAGAZINE_CAPACITY, this.roundsLeft());
    this.roundsInMagazine = this.loadedRounds;
  }

  private roundsLeft(): number {
    if (this.plan.kind === 'free') {
      return MAGAZINE_CAPACITY;
    }
    const stage = this.plan.stages[this.currentStageIndex];
    return stage.targetCount * stage.maxShotsPerTarget - this.stageRoundsFired;
  }
}
