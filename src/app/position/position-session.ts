import { cartridgeById } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { CheckErrorType, checkManualSteps, checkPreparation, CheckResult } from '../../core/calc-check';
import { targetRadiusMrad } from '../../core/content';
import { mulberry32 } from '../../core/rng';
import { clockFromDeg, createScenario, gaugeWindAt, Scenario, windAt } from '../../core/scenario';
import { resolveShot, ShotResult } from '../../core/shot';
import { CartridgeId, Correction, Target } from '../../core/types';
import { BoltCycleResult, BoltEvent } from '../../sim/bolt';
import { CheckRowKind, exerciseResult, ExerciseResult, ExerciseSetup, ExerciseShotRecord, isExerciseTask, PositionTask, setupTask, ShotCheckSummary } from '../../sim/course';
import { FiringEvent, FiringLine } from '../../sim/firing-line';
import { FlightPaths, flightPaths, flightSamples } from '../../sim/flight-path';
import { groupPoint, mainCauseOf, missBreakdown, MissBreakdown } from '../../sim/miss-breakdown';
import { Vector2 } from '../../sim/noise';
import {
  changeContext,
  checkInputs,
  CheckTruth,
  ChipKind,
  createNotebook,
  enterWind,
  formulaCorrectionMil,
  FormulaInputs,
  measureRange,
  Notebook,
  NotebookCheckInputs,
  NotebookContext,
  NotebookFactor,
  NotebookStepId,
  NotebookTotal,
  openReference,
  placeChip,
  recordStation,
  recordStep,
  removeChip,
  setSign,
  setUnits,
  signedCrosswindMps,
  softHint,
  StaleReason,
  staleness,
  stepSheet,
  StepSheet,
  toggleFactor,
  total,
  typeTape,
} from '../../sim/notebook';
import { scopeById, TurretMove } from '../../sim/scope-model';
import { FireOutcome, ScopeSession } from '../../sim/scope-session';
import { diagnoseShot, dopeNoteElevationMil, isCallAccurate, secondShotCorrection, ShotDiagnosis, TurretCorrection, warmImpact } from '../../sim/shot-review';
import { TriggerAccessibility } from '../../sim/trigger';
import { TurretProgress, turretProgress } from '../../sim/turret-target';
import { TurretAxis } from './position.model';

export interface PositionStart {
  def: PositionTask;
  seed: number;
  engine: BallisticsEngine;
  accessibility: TriggerAccessibility;
  recalcNotebook?: Notebook;
}

export interface ShotCheck {
  notebook: Notebook;
  truth: CheckTruth;
  inputs: NotebookCheckInputs;
  result: CheckResult;
}

export interface ShotReview {
  call: Correction;
  impact: Correction;
  warmImpact: Correction;
  diagnosis: ShotDiagnosis;
  correction: TurretCorrection | null;
  isFirstShotAtTarget: boolean;
  check: ShotCheck | null;
  dopeNoteMil: number | null;
  targetRadiusMil: number;
  distanceM: number;
  cartridgeId: CartridgeId;
  breakdown: MissBreakdown;
  flight: FlightPaths;
  group: Correction[];
}

export interface PositionShot {
  record: ExerciseShotRecord;
  result: ShotResult;
  events: FiringEvent[];
  boltEvents: BoltEvent[];
  review: ShotReview;
}

interface DialTracking {
  startClicks: number;
  hasOvershot: boolean;
}

export const POSITION_RESTING_BPM = 65;
// На холсте «назад» — влево, в `sim/bolt` — по +x: экранный жест зеркалится по X.
const BOLT_SCREEN_X_MIRROR = -1;
const CARD_CLICK_MIL = 0.1;
const FULL_MEASUREMENT_S = 3;
const FULL_MEASUREMENT_NOISE_MPS = 0.1;
const SHORT_MEASUREMENT_NOISE_MPS = 0.3;
const STATION_SPEED_DECIMALS = 10;
const FLIGHT_SAMPLES = 10;
const DEG_PER_CLOCK_HOUR = 30;

export class PositionSession {
  readonly scope: ScopeSession;
  readonly firingLine: FiringLine;
  readonly isRepeatAfterRecalc: boolean;
  private currentNotebook: Notebook;
  private entered: NotebookTotal | null = null;
  private stationMeasurements = 0;
  private lastCall: Correction | null = null;
  private readonly shotRecords: ExerciseShotRecord[] = [];
  private readonly groupPoints: Correction[] = [];
  private readonly shotCalls: Correction[] = [];
  private readonly dialTracking: Record<TurretAxis, DialTracking> = {
    elevation: { startClicks: 0, hasOvershot: false },
    windage: { startClicks: 0, hasOvershot: false },
  };

  private constructor(
    readonly def: PositionTask,
    readonly setup: ExerciseSetup,
    readonly scenario: Scenario,
    private readonly cards: ReadonlyMap<CartridgeId, DopeCard>,
    private readonly engine: BallisticsEngine,
    private readonly accessibility: TriggerAccessibility,
    recalcNotebook: Notebook | undefined,
  ) {
    this.firingLine = new FiringLine(setup.plan);
    this.scope = new ScopeSession(scopeById(def.scopeId), POSITION_RESTING_BPM, scenario.seed, accessibility, this.firingLine.magazineLoaded);
    this.isRepeatAfterRecalc = recalcNotebook !== undefined;
    this.currentNotebook = recalcNotebook
      ? changeContext(recalcNotebook, { card: this.cards.get(this.firingLine.cartridgeId)!, target: this.notebookTarget() })
      : createNotebook(this.notebookContext(), def.notebookMode ?? 'auto');
  }

  static async start(options: PositionStart): Promise<PositionSession> {
    const setup = setupTask(options.def, options.seed);
    const cartridgeIds = [...new Set(options.def.stages.map(stage => stage.cartridgeId))];
    const cards = new Map<CartridgeId, DopeCard>();
    for (const cartridgeId of cartridgeIds) {
      cards.set(cartridgeId, await buildDopeCard(options.engine, cartridgeById(cartridgeId), CARD_CLICK_MIL));
    }
    const scenario = createScenario(options.seed, setup.scenarioOptions);
    return new PositionSession(options.def, setup, scenario, cards, options.engine, options.accessibility, options.recalcNotebook);
  }

  restartForRecalc(engine: BallisticsEngine): Promise<PositionSession> {
    return PositionSession.start({ def: this.def, seed: this.scenario.seed, engine, accessibility: this.accessibility, recalcNotebook: this.currentNotebook });
  }

  recordCall(playerCall: Correction): boolean {
    const lastIndex = this.shotRecords.length - 1;
    if (lastIndex < 0 || !this.lastCall) {
      return false;
    }
    const isAccurate = isCallAccurate(playerCall, this.lastCall);
    this.shotRecords[lastIndex] = { ...this.shotRecords[lastIndex], isCallAccurate: isAccurate };
    return isAccurate;
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

  get enteredTotal(): NotebookTotal | null {
    return this.entered;
  }

  enterOnTurrets(): NotebookTotal {
    this.entered = this.total;
    return this.entered;
  }

  measureStation(holdS: number, timeS: number): void {
    const noiseLimitMps = holdS < FULL_MEASUREMENT_S ? SHORT_MEASUREMENT_NOISE_MPS : FULL_MEASUREMENT_NOISE_MPS;
    const random = mulberry32(this.scenario.seed + ++this.stationMeasurements);
    const wind = gaugeWindAt(this.scenario, timeS, (random() * 2 - 1) * noiseLimitMps);
    const windSpeedMps = Math.round(wind.speedMps * STATION_SPEED_DECIMALS) / STATION_SPEED_DECIMALS;
    this.currentNotebook = recordStation(this.currentNotebook, { ...this.scenario.gauge, windSpeedMps, windClock: wind.clock }, holdS, timeS);
  }

  enterWind(speedMps: number, clock: number): void {
    this.currentNotebook = enterWind(this.currentNotebook, speedMps, clock);
  }

  measureRange(reticleMil: number): void {
    this.currentNotebook = measureRange(this.currentNotebook, reticleMil);
  }

  toggleFactor(factor: NotebookFactor): void {
    this.currentNotebook = toggleFactor(this.currentNotebook, factor);
  }

  stepSheet(step: NotebookStepId): StepSheet {
    return stepSheet(this.currentNotebook, step);
  }

  placeChip(step: NotebookStepId, chipKind: ChipKind, slotIndex?: number): void {
    this.currentNotebook = placeChip(this.currentNotebook, step, chipKind, slotIndex);
  }

  removeChip(step: NotebookStepId, slotIndex: number): void {
    this.currentNotebook = removeChip(this.currentNotebook, step, slotIndex);
  }

  typeTape(step: NotebookStepId, index: number, value: number | null): void {
    this.currentNotebook = typeTape(this.currentNotebook, step, index, value);
  }

  setSign(step: NotebookStepId, sign: 1 | -1): void {
    this.currentNotebook = setSign(this.currentNotebook, step, sign);
  }

  setUnits(step: NotebookStepId, units: 'mil' | 'moa'): void {
    this.currentNotebook = setUnits(this.currentNotebook, step, units);
  }

  recordStep(step: NotebookStepId): void {
    this.currentNotebook = recordStep(this.currentNotebook, step);
  }

  softHint(step: NotebookStepId): CheckErrorType | null {
    return softHint(this.currentNotebook, step);
  }

  staleness(): Record<NotebookStepId, StaleReason | null> {
    return staleness(this.currentNotebook);
  }

  openReference(): void {
    this.currentNotebook = openReference(this.currentNotebook);
  }

  get group(): readonly Correction[] {
    return this.groupPoints;
  }

  get calls(): readonly Correction[] {
    return this.shotCalls;
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

  get isBoltAutomatic(): boolean {
    return this.def.trigger === 'tap';
  }

  get isBoltCycleDue(): boolean {
    return !this.firingLine.isFinished && !this.isMagazineChangeDue && !this.scope.bolt.canFire;
  }

  startTrigger(): boolean {
    return this.scope.startTrigger();
  }

  step(dtS: number, finger: Vector2 | null): boolean {
    const hasBroken = this.scope.step(dtS, finger);
    const trigger = this.scope.trigger;
    if (!hasBroken && trigger && finger === null && trigger.pressure <= 0) {
      this.scope.cancelTrigger();
    }
    return hasBroken;
  }

  dragBolt(deltaXPt: number, deltaYPt: number, nowS: number): BoltCycleResult {
    const result = this.scope.bolt.drag(deltaXPt * BOLT_SCREEN_X_MIRROR, deltaYPt, nowS);
    if (result.stepCompleted === 'down') {
      this.scope.knockAimAfterCycle();
    }
    return result;
  }

  progress(axis: TurretAxis): TurretProgress | null {
    const targetClicks = this.targetClicks(axis);
    return targetClicks === null ? null : turretProgress(this.dialTracking[axis].startClicks, this.turretClicks(axis), targetClicks);
  }

  turn(axis: TurretAxis, clicks: number): TurretMove {
    const move = axis === 'elevation' ? this.scope.turnElevation(clicks) : this.scope.turnWindageLeft(clicks);
    if ((this.progress(axis)?.overshootClicks ?? 0) > 0) {
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
    const shotCheck = this.shotCheck(timeS);
    const check = shotCheck ? summaryOf(shotCheck) : null;
    const dialUpMil = this.scope.elevation.clicks * this.currentNotebook.context.card.clickMil;
    const notebookAtShot = this.currentNotebook;
    const rangeEstimateM = this.currentNotebook.readings.reticleMil !== null ? this.currentNotebook.distanceM ?? undefined : undefined;
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
    const breakdown = this.breakdownOf(notebookAtShot, target, timeS, outcome, result);
    this.groupPoints.push(groupPoint(breakdown));
    this.shotCalls.push(outcome.hold);
    const flight = await this.flightOf(target, timeS, result);
    const isFirstShotAtTarget = !this.shotRecords.some(record => record.stageIndex === stageIndex && record.targetIndex === targetIndex);
    const diagnosis = diagnoseShot(outcome.hold, result.isHit);
    const record: ExerciseShotRecord = {
      stageIndex,
      targetIndex,
      distanceM: target.distanceM,
      isHit: result.isHit,
      isColdBore,
      impact: result.impact,
      diagnosis,
      isDialExactFirstTry: isFirstShotAtTarget && isDialExactFirstTry,
      isBreathHeld,
      mainCause: mainCauseOf(breakdown),
      windSpeedMps: windAt(this.scenario, timeS)[0].speedMps,
      ...(check ? { check } : {}),
      ...(rangeEstimateM !== undefined ? { rangeEstimateM } : {}),
    };
    this.shotRecords.push(record);
    const events = this.firingLine.recordShot(result.isHit);
    const warm = warmImpact(result.impact, result.coldBore);
    const clickMil = this.currentNotebook.context.card.clickMil;
    this.lastCall = outcome.hold;
    const review: ShotReview = {
      call: outcome.hold,
      impact: result.impact,
      warmImpact: warm,
      diagnosis,
      correction: events.includes('target-closed') ? null : secondShotCorrection(outcome.hold, warm, clickMil, diagnosis),
      isFirstShotAtTarget,
      check: isFirstShotAtTarget ? shotCheck : null,
      dopeNoteMil: dopeNoteElevationMil(dialUpMil, outcome.hold, warm, diagnosis),
      targetRadiusMil: targetRadiusMrad(target),
      distanceM: target.distanceM,
      cartridgeId: this.firingLine.cartridgeId,
      breakdown,
      flight,
      group: [...this.groupPoints],
    };
    const boltEvents = this.isBoltAutomatic ? this.scope.bolt.cycle() : [];
    if (events.includes('next-target') || events.includes('stage-done')) {
      this.followNewTarget(this.target !== target);
    }
    return { record, result, events, boltEvents, review };
  }

  changeMagazine(): BoltEvent[] {
    this.firingLine.changeMagazine();
    const events = this.scope.bolt.insertMagazine(this.firingLine.magazineLoaded);
    return this.isBoltAutomatic ? [...events, ...this.scope.bolt.cycle()] : events;
  }

  result(): ExerciseResult | null {
    if (!isExerciseTask(this.def) || !this.firingLine.isFinished) {
      return null;
    }
    return exerciseResult(this.def, {
      mode: this.def.notebookMode ?? 'auto',
      hasOpenedReference: this.currentNotebook.hasOpenedReference,
      shots: this.shotRecords,
      isRepeatAfterRecalc: this.isRepeatAfterRecalc,
    });
  }

  trueCorrection(timeS: number): Correction {
    return formulaCorrectionMil(this.currentNotebook, this.formulaTruth(this.currentNotebook, this.target, timeS));
  }

  private formulaTruth(notebook: Notebook, target: Target, timeS: number): FormulaInputs {
    const trueWinds = windAt(this.scenario, timeS).map(zone => ({ speedMps: zone.speedMps, clock: fractionalClock(zone.fromDeg) }));
    return {
      distanceM: target.distanceM,
      temperatureC: this.scenario.atmosphere.temperatureC,
      pressureHpa: this.scenario.atmosphere.pressureHpa,
      wind: trueWinds[0],
      flagCrosswindsMps: notebook.context.hasZones ? trueWinds.slice(1).map(signedCrosswindMps) : null,
    };
  }

  private breakdownOf(notebook: Notebook, target: Target, timeS: number, outcome: FireOutcome, result: ShotResult): MissBreakdown {
    const truth = this.formulaTruth(notebook, target, timeS);
    const playerWind: FormulaInputs = {
      ...truth,
      wind: notebook.readings.wind ?? { speedMps: 0, clock: truth.wind.clock },
      flagCrosswindsMps: notebook.readings.flagCrosswindsMps,
    };
    const planned = total(notebook);
    const clickMil = notebook.context.card.clickMil;
    return missBreakdown({
      ideal: result.ideal,
      formulaTruth: formulaCorrectionMil(notebook, truth),
      formulaPlayerWind: formulaCorrectionMil(notebook, playerWind),
      dial: outcome.dial,
      plannedHold: { upMrad: planned.holdUpMil, rightMrad: planned.holdRightMil },
      reticle: outcome.reticle,
      triggerSpread: outcome.triggerSpread,
      velocitySpread: result.velocitySpread,
      rifleGroup: result.group,
      coldBore: result.coldBore,
      sightOffset: result.sightOffset,
      hasKnockedSight: this.def.hasKnockedSight,
      clickMil,
    });
  }

  private async flightOf(target: Target, timeS: number, result: ShotResult): Promise<FlightPaths> {
    const points = await this.engine.trajectory(
      cartridgeById(this.firingLine.cartridgeId),
      this.scenario.atmosphere,
      windAt(this.scenario, timeS),
      result.actualMuzzleVelocityMps,
      target.distanceM / FLIGHT_SAMPLES,
    );
    return flightPaths(flightSamples(points, target.distanceM), result.impact);
  }

  private isDialExact(): boolean {
    return this.entered !== null && (['elevation', 'windage'] as const).every(axis => this.turretClicks(axis) === this.targetClicks(axis) && !this.dialTracking[axis].hasOvershot);
  }

  private shotCheck(timeS: number): ShotCheck | null {
    const truth: CheckTruth = {
      trueWindClock: clockFromDeg(windAt(this.scenario, timeS)[0].fromDeg),
      dialedElevationClicks: this.scope.elevation.clicks,
      dialedWindageLeftClicks: this.scope.windage.clicks,
    };
    const inputs = checkInputs(this.currentNotebook, truth);
    const isAuto = this.currentNotebook.mode === 'auto';
    if ((isAuto ? inputs.preparation.length : inputs.steps.length) === 0) {
      return null;
    }
    const result = isAuto ? checkPreparation(inputs.preparation) : checkManualSteps(inputs.steps, this.currentNotebook.context.card.clickMil);
    return { notebook: this.currentNotebook, truth, inputs, result };
  }

  private followNewTarget(isNewTarget: boolean): void {
    const card = this.cards.get(this.firingLine.cartridgeId)!;
    this.currentNotebook = changeContext(this.currentNotebook, isNewTarget ? { card, target: this.notebookTarget() } : { card });
    const next = this.total;
    if (this.entered && (next.elevation.targetClicks !== this.entered.elevation.targetClicks || next.windageLeft.targetClicks !== this.entered.windageLeft.targetClicks)) {
      this.entered = null;
    }
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
    const isDistanceKnown = this.def.targets?.distance.kind !== 'unknown';
    return { sizeM: this.target.diameterM, distanceM: isDistanceKnown ? this.target.distanceM : null };
  }

  private turretClicks(axis: TurretAxis): number {
    return axis === 'elevation' ? this.scope.elevation.clicks : this.scope.windage.clicks;
  }

  private targetClicks(axis: TurretAxis): number | null {
    if (!this.entered) {
      return null;
    }
    return axis === 'elevation' ? this.entered.elevation.targetClicks : this.entered.windageLeft.targetClicks;
  }
}

function fractionalClock(fromDeg: number): number {
  const hours = ((((360 - fromDeg) % 360) + 360) % 360) / DEG_PER_CLOCK_HOUR;
  return hours === 0 ? 12 : hours;
}

function summaryOf(check: ShotCheck): ShotCheckSummary {
  const kinds: CheckRowKind[] = check.notebook.mode === 'auto' ? check.inputs.preparation.map(row => row.row) : check.inputs.steps.map(step => step.step);
  return {
    verdict: check.result.verdict,
    rowVerdicts: Object.fromEntries(kinds.map((kind, index) => [kind, check.result.rows[index].status])),
    errorTypes: [...new Set(check.result.rows.flatMap(row => row.errorTypes))],
  };
}
