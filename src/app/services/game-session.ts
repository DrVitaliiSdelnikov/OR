import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { cartridgeById, MAX_TRAJECTORY_M, STANDARD_PRESSURE_HPA, TARGETS } from '../../core/content';
import { BallisticsEngine } from '../../core/engine';
import { isTransonic } from '../../core/field';
import { daySeed } from '../../core/rng';
import { degFromClock, gaugeWindAt, GaugeReading, Scenario } from '../../core/scenario';
import { Atmosphere, RequiredCorrection, TrajectoryPoint } from '../../core/types';
import { scopeById } from '../../sim/scope-model';
import { FREE_TASK, scenarioForTask, ShootTask, TASKS, UNIFORM_WIND_MAX_LEVEL } from '../../sim/tasks';
import { ShotRecord } from './progress.store';

export interface GaugeSnapshot extends GaugeReading {
  takenAtIso: string;
}

export interface WindInput {
  speedMps: number;
  clockHours: number;
}

export interface Solution {
  distanceM: number;
  required: RequiredCorrection;
  points: TrajectoryPoint[];
  isTransonic: boolean;
  windageMradPerMps: number;
}

const WIND_FROM_LEFT_DEG = 90;

export const DISTANCE_STEP_M = 25;
export const MIN_DISTANCE_M = 100;
export const MAX_DISTANCE_M = MAX_TRAJECTORY_M;
const DEFAULT_RELATIVE_HUMIDITY = 0.5;

@Injectable({ providedIn: 'root' })
export class GameSession {
  readonly engine = new BallisticsEngine();
  private readonly startedAtMs = signal(Date.now());
  private freeSeedOffset = 0;

  readonly task = signal<ShootTask>(FREE_TASK);
  readonly scenario = signal<Scenario>(scenarioForTask(FREE_TASK, daySeed(new Date())));
  readonly gaugeSnapshot = signal<GaugeSnapshot | null>(null);
  readonly windInput = signal<WindInput>({ speedMps: 0, clockHours: 9 });
  readonly distanceM = signal(TARGETS[FREE_TASK.targetIndex].distanceM);
  readonly targetIndex = signal(FREE_TASK.targetIndex);
  readonly scopeId = signal(FREE_TASK.scopeId);
  readonly taskShots = signal<ShotRecord[]>([]);
  readonly solution = signal<Solution | null>(null);

  readonly cartridge = computed(() => cartridgeById(this.task().cartridgeId));
  readonly target = computed(() => TARGETS[this.targetIndex()]);
  readonly scope = computed(() => scopeById(this.scopeId()));
  readonly isFreeMode = computed(() => this.task().kind === 'free');
  readonly arePressureAndHumidityLocked = computed(() => this.task().level <= UNIFORM_WIND_MAX_LEVEL);
  /** @deprecated патроны, цели и конец упражнения — `sim/firing-line` (`FiringLine`); удалить в A3. */
  readonly shotsLeft = computed(() => this.task().shots - this.taskShots().length);
  readonly taskScore = computed(() => this.taskShots().reduce((sum, shot) => sum + shot.points, 0));

  readonly playerAtmosphere = computed<Atmosphere>(() => {
    const snapshot = this.gaugeSnapshot();
    const temperatureC = snapshot?.temperatureC ?? 15;
    if (!snapshot || this.arePressureAndHumidityLocked()) {
      return { temperatureC, pressureHpa: STANDARD_PRESSURE_HPA, relativeHumidity: DEFAULT_RELATIVE_HUMIDITY };
    }
    return { temperatureC, pressureHpa: snapshot.pressureHpa, relativeHumidity: snapshot.relativeHumidity };
  });

  private solveRequest = 0;

  constructor() {
    effect(() => {
      const request = {
        cartridge: this.cartridge(),
        atmosphere: this.playerAtmosphere(),
        wind: this.windInput(),
        distanceM: this.distanceM(),
      };
      untracked(() => void this.solve(request.cartridge, request.atmosphere, request.wind, request.distanceM));
    });
  }

  startTask(task: ShootTask): void {
    const seed = task.kind === 'free' ? daySeed(new Date()) * 10 + this.freeSeedOffset++ : task.seed;
    this.task.set(task);
    this.scenario.set(scenarioForTask(task, seed));
    this.targetIndex.set(task.targetIndex);
    this.scopeId.set(task.scopeId);
    this.distanceM.set(TARGETS[task.targetIndex].distanceM);
    this.gaugeSnapshot.set(null);
    this.windInput.set({ speedMps: 0, clockHours: 9 });
    this.taskShots.set([]);
    this.startedAtMs.set(Date.now());
  }

  startFirstOpenTask(passedIds: ReadonlySet<string>): void {
    const next = TASKS.find(task => task.kind === 'shoot' && !passedIds.has(task.id));
    this.startTask((next as ShootTask | undefined) ?? FREE_TASK);
  }

  scenarioTimeS(nowMs = Date.now()): number {
    return this.scenario().startTimeS + (nowMs - this.startedAtMs()) / 1000;
  }

  takeGaugeReading(noiseMps = 0): GaugeSnapshot {
    const scenario = this.scenario();
    const wind = gaugeWindAt(scenario, this.scenarioTimeS(), noiseMps);
    const snapshot: GaugeSnapshot = {
      ...scenario.gauge,
      windSpeedMps: Math.round(wind.speedMps * 10) / 10,
      windClock: wind.clock,
      takenAtIso: new Date().toISOString(),
    };
    this.gaugeSnapshot.set(snapshot);
    this.windInput.set({ speedMps: snapshot.windSpeedMps, clockHours: snapshot.windClock });
    return snapshot;
  }

  changeDistance(deltaM: number): void {
    this.distanceM.update(current => Math.min(MAX_DISTANCE_M, Math.max(MIN_DISTANCE_M, current + deltaM)));
  }

  selectTarget(index: number): void {
    this.targetIndex.set(index);
    this.distanceM.set(TARGETS[index].distanceM);
  }

  addShot(shot: ShotRecord): void {
    this.taskShots.update(shots => [...shots, shot]);
  }

  private async solve(cartridge: ReturnType<typeof cartridgeById>, atmosphere: Atmosphere, wind: WindInput, distanceM: number): Promise<void> {
    const request = ++this.solveRequest;
    const [points, unitWindPoints] = await Promise.all([
      this.engine.trajectory(cartridge, atmosphere, [{ untilM: Infinity, speedMps: wind.speedMps, fromDeg: degFromClock(wind.clockHours) }]),
      this.engine.trajectory(cartridge, atmosphere, [{ untilM: Infinity, speedMps: 1, fromDeg: WIND_FROM_LEFT_DEG }]),
    ]);
    if (request !== this.solveRequest) {
      return;
    }
    const required = BallisticsEngine.interpolated(points, distanceM);
    this.solution.set({
      distanceM,
      required,
      points,
      isTransonic: isTransonic(required.velocityMps, atmosphere.temperatureC),
      windageMradPerMps: Math.abs(BallisticsEngine.interpolated(unitWindPoints, distanceM).rightMrad),
    });
  }
}
