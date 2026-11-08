import { cartridgeById } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { createScenario, Scenario } from '../../core/scenario';
import { resolveShot, ShotResult } from '../../core/shot';
import { CartridgeId, Target } from '../../core/types';
import { BoltEvent } from '../../sim/bolt';
import { ExerciseDef, exerciseResult, ExerciseResult, ExerciseSetup, ExerciseShotRecord, setupExercise } from '../../sim/course';
import { FiringEvent, FiringLine } from '../../sim/firing-line';
import { changeContext, createNotebook, Notebook, NotebookContext, NotebookTotal, total } from '../../sim/notebook';
import { scopeById, TurretMove } from '../../sim/scope-model';
import { ScopeSession } from '../../sim/scope-session';
import { diagnoseShot } from '../../sim/shot-review';
import { TriggerAccessibility } from '../../sim/trigger';
import { TurretProgress, turretProgress } from '../../sim/turret-target';
import { TurretAxis } from './position.model';

export interface PositionStart {
  def: ExerciseDef;
  seed: number;
  engine: BallisticsEngine;
  accessibility: TriggerAccessibility;
}

export interface PositionShot {
  record: ExerciseShotRecord;
  result: ShotResult;
  events: FiringEvent[];
  boltEvents: BoltEvent[];
}

interface DialTracking {
  startClicks: number;
  hasOvershot: boolean;
}

export const POSITION_RESTING_BPM = 65;
const CARD_CLICK_MIL = 0.1;

export class PositionSession {
  readonly scope: ScopeSession;
  readonly firingLine: FiringLine;
  private currentNotebook: Notebook;
  private readonly shotRecords: ExerciseShotRecord[] = [];
  private readonly dialTracking: Record<TurretAxis, DialTracking> = {
    elevation: { startClicks: 0, hasOvershot: false },
    windage: { startClicks: 0, hasOvershot: false },
  };

  private constructor(
    readonly def: ExerciseDef,
    readonly setup: ExerciseSetup,
    readonly scenario: Scenario,
    private readonly cards: ReadonlyMap<CartridgeId, DopeCard>,
    private readonly engine: BallisticsEngine,
    accessibility: TriggerAccessibility,
  ) {
    this.firingLine = new FiringLine(setup.plan);
    this.scope = new ScopeSession(scopeById(def.scopeId), POSITION_RESTING_BPM, scenario.seed, accessibility, this.firingLine.magazineLoaded);
    this.currentNotebook = createNotebook(this.notebookContext(), def.notebookMode ?? 'auto');
  }

  static async start(options: PositionStart): Promise<PositionSession> {
    const setup = setupExercise(options.def, options.seed);
    const cartridgeIds = [...new Set(options.def.stages.map(stage => stage.cartridgeId))];
    const cards = new Map<CartridgeId, DopeCard>();
    for (const cartridgeId of cartridgeIds) {
      cards.set(cartridgeId, await buildDopeCard(options.engine, cartridgeById(cartridgeId), CARD_CLICK_MIL));
    }
    const scenario = createScenario(options.seed, setup.scenarioOptions);
    return new PositionSession(options.def, setup, scenario, cards, options.engine, options.accessibility);
  }

  get notebook(): Notebook {
    return this.currentNotebook;
  }

  get target(): Target {
    return this.setup.targets[this.firingLine.targetIndex];
  }

  get total(): NotebookTotal {
    return total(this.currentNotebook);
  }

  get records(): readonly ExerciseShotRecord[] {
    return this.shotRecords;
  }

  get hasFired(): boolean {
    return this.shotRecords.length > 0;
  }

  get isFinished(): boolean {
    return this.firingLine.isFinished;
  }

  get isMagazineChangeDue(): boolean {
    return !this.firingLine.isFinished && this.firingLine.magazineLeft === 0;
  }

  get isTapTrigger(): boolean {
    return this.def.trigger === 'tap';
  }

  progress(axis: TurretAxis): TurretProgress {
    return turretProgress(this.dialTracking[axis].startClicks, this.turretClicks(axis), this.targetClicks(axis));
  }

  turn(axis: TurretAxis, clicks: number): TurretMove {
    const move = axis === 'elevation' ? this.scope.turnElevation(clicks) : this.scope.turnWindageLeft(clicks);
    if (this.progress(axis).overshootClicks > 0) {
      this.dialTracking[axis].hasOvershot = true;
    }
    return move;
  }

  async fire(timeS: number): Promise<PositionShot | null> {
    if (this.firingLine.isFinished) {
      return null;
    }
    const isDialExactFirstTry = this.isDialExact();
    const isBreathHeld = this.scope.sway.breath.state === 'holding';
    const isColdBore = this.firingLine.isNextShotCold;
    const stageIndex = this.firingLine.stageIndex;
    const targetIndex = this.firingLine.targetIndex;
    const target = this.target;
    const outcome = this.scope.fire();
    if (!outcome) {
      return null;
    }
    const result = await resolveShot(this.engine, this.scenario, cartridgeById(this.firingLine.cartridgeId), target, outcome.dial, this.shotRecords.length, {
      timeS,
      hold: outcome.hold,
      isColdBore,
      sightOffset: this.setup.sightOffset,
    });
    const isFirstShotAtTarget = !this.shotRecords.some(record => record.stageIndex === stageIndex && record.targetIndex === targetIndex);
    const record: ExerciseShotRecord = {
      stageIndex,
      targetIndex,
      distanceM: target.distanceM,
      isHit: result.isHit,
      isColdBore,
      impact: result.impact,
      diagnosis: diagnoseShot(outcome.hold, result.isHit),
      isDialExactFirstTry: isFirstShotAtTarget && isDialExactFirstTry,
      isBreathHeld,
    };
    this.shotRecords.push(record);
    const events = this.firingLine.recordShot(result.isHit);
    const boltEvents = this.isTapTrigger ? this.scope.bolt.cycle() : [];
    if (events.includes('next-target') || events.includes('stage-done')) {
      this.followNewTarget();
    }
    return { record, result, events, boltEvents };
  }

  changeMagazine(): BoltEvent[] {
    this.firingLine.changeMagazine();
    const events = this.scope.bolt.insertMagazine(this.firingLine.magazineLoaded);
    return this.isTapTrigger ? [...events, ...this.scope.bolt.cycle()] : events;
  }

  result(): ExerciseResult | null {
    if (!this.firingLine.isFinished) {
      return null;
    }
    return exerciseResult(this.def, { mode: this.def.notebookMode ?? 'auto', hasOpenedReference: this.currentNotebook.hasOpenedReference, shots: this.shotRecords });
  }

  private isDialExact(): boolean {
    return (['elevation', 'windage'] as const).every(axis => this.turretClicks(axis) === this.targetClicks(axis) && !this.dialTracking[axis].hasOvershot);
  }

  private followNewTarget(): void {
    this.currentNotebook = changeContext(this.currentNotebook, { card: this.cards.get(this.firingLine.cartridgeId)!, target: this.notebookTarget() });
    for (const axis of ['elevation', 'windage'] as const) {
      this.dialTracking[axis] = { startClicks: this.turretClicks(axis), hasOvershot: false };
    }
  }

  private notebookContext(): NotebookContext {
    return {
      card: this.cards.get(this.firingLine.cartridgeId)!,
      scope: this.scope.scope,
      target: this.notebookTarget(),
      hasZones: this.def.conditions.isWindUniform === false,
      canTakeWindFromStation: false,
      seed: this.scenario.seed,
    };
  }

  private notebookTarget(): NotebookContext['target'] {
    return { sizeM: this.target.diameterM, distanceM: this.target.distanceM };
  }

  private turretClicks(axis: TurretAxis): number {
    return axis === 'elevation' ? this.scope.elevation.clicks : this.scope.windage.clicks;
  }

  private targetClicks(axis: TurretAxis): number {
    const current = this.total;
    return axis === 'elevation' ? current.elevation.targetClicks : current.windageLeft.targetClicks;
  }
}
