export type BoltStep = 'up' | 'back' | 'forward' | 'down';
export type ChamberState = 'empty' | 'live' | 'spent';
export type BoltEvent = 'unlock' | 'slide' | 'eject' | 'feed' | 'feed-empty' | 'chamber' | 'lock' | 'magazine';

export const BOLT_STEPS: readonly BoltStep[] = ['up', 'back', 'forward', 'down'];
export const BOLT_STEP_TRAVEL_PT: Record<BoltStep, number> = { up: 60, back: 140, forward: 140, down: 60 };
export const BOLT_STEP_DIRECTION: Record<BoltStep, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  back: { x: 1, y: 0 },
  forward: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
};
export const BOLT_STEP_COMPLETE = 0.98;
export const MAGAZINE_CAPACITY = 5;
export const BALL_GRAB_RADIUS_PT = 38;

export interface BoltCycleResult {
  events: BoltEvent[];
  stepCompleted: BoltStep | null;
  cycleTimeS: number | null;
}

export class BoltAction {
  private stepIndex = 0;
  private stepProgress = 0;
  private magazineRounds: number;
  private chamber: ChamberState;
  private isLocked = true;
  private cycleStartS: number | null = null;
  private readonly cycleTimesS: number[] = [];
  private ejectedSpent = 0;
  private ejectedLive = 0;

  constructor(initialRounds = MAGAZINE_CAPACITY, initialChamber: ChamberState = 'empty') {
    this.magazineRounds = initialRounds;
    this.chamber = initialChamber;
  }

  get currentStep(): BoltStep {
    return BOLT_STEPS[this.stepIndex];
  }

  get progress(): number {
    return this.stepProgress;
  }

  get rounds(): number {
    return this.magazineRounds;
  }

  get chamberState(): ChamberState {
    return this.chamber;
  }

  get locked(): boolean {
    return this.isLocked;
  }

  get canFire(): boolean {
    return this.isLocked && this.chamber === 'live';
  }

  get averageCycleTimeS(): number | null {
    if (this.cycleTimesS.length === 0) {
      return null;
    }
    return this.cycleTimesS.reduce((sum, value) => sum + value, 0) / this.cycleTimesS.length;
  }

  get casingsOnGround(): { spent: number; live: number } {
    return { spent: this.ejectedSpent, live: this.ejectedLive };
  }

  fire(): boolean {
    if (!this.canFire) {
      return false;
    }
    this.chamber = 'spent';
    return true;
  }

  insertMagazine(rounds = MAGAZINE_CAPACITY): BoltEvent[] {
    this.magazineRounds = rounds;
    return ['magazine'];
  }

  drag(deltaXPt: number, deltaYPt: number, nowS: number): BoltCycleResult {
    const step = this.currentStep;
    const direction = BOLT_STEP_DIRECTION[step];
    const alongStepPt = deltaXPt * direction.x + deltaYPt * direction.y;
    const events: BoltEvent[] = [];
    if (step === 'up' && this.stepProgress === 0 && alongStepPt > 0) {
      this.cycleStartS = nowS;
      this.isLocked = false;
    }
    this.stepProgress = Math.max(0, Math.min(1, this.stepProgress + alongStepPt / BOLT_STEP_TRAVEL_PT[step]));
    if (step === 'back' && alongStepPt > 0) {
      events.push('slide');
    }
    if (this.stepProgress < BOLT_STEP_COMPLETE) {
      return { events, stepCompleted: null, cycleTimeS: null };
    }
    events.push(...this.completeStep(step));
    let cycleTimeS: number | null = null;
    if (step === 'down' && this.cycleStartS !== null) {
      cycleTimeS = nowS - this.cycleStartS;
      this.cycleTimesS.push(cycleTimeS);
      this.cycleStartS = null;
    }
    this.stepIndex = (this.stepIndex + 1) % BOLT_STEPS.length;
    this.stepProgress = 0;
    return { events, stepCompleted: step, cycleTimeS };
  }

  private completeStep(step: BoltStep): BoltEvent[] {
    switch (step) {
      case 'up':
        this.isLocked = false;
        return ['unlock'];
      case 'back':
        return this.eject();
      case 'forward':
        return this.feed();
      case 'down':
        this.isLocked = true;
        return ['lock'];
    }
  }

  private eject(): BoltEvent[] {
    if (this.chamber === 'empty') {
      return [];
    }
    if (this.chamber === 'spent') {
      this.ejectedSpent++;
    } else {
      this.ejectedLive++;
    }
    this.chamber = 'empty';
    return ['eject'];
  }

  private feed(): BoltEvent[] {
    if (this.magazineRounds === 0) {
      return ['feed-empty'];
    }
    this.magazineRounds--;
    this.chamber = 'live';
    return ['feed', 'chamber'];
  }
}
