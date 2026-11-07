import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { cartridgeById, MAX_TRAJECTORY_M, STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C, TARGETS } from '../../core/content';
import { BallisticsEngine } from '../../core/engine';
import { isTransonic } from '../../core/field';
import { daySeed } from '../../core/rng';
import { createScenario, degFromClock, gaugeWindAt, GaugeReading, Scenario } from '../../core/scenario';
import { Atmosphere, CartridgeId, RequiredCorrection, TrajectoryPoint } from '../../core/types';
import { ScopeId, scopeById } from '../../sim/scope-model';
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

// Старый поток свободной стрельбы до A7: один патрон, курсовой прицел, гонг 500 м, ветер по зонам.
export const FREE_PLAY_TITLE = 'Свободная стрельба';
const FREE_PLAY_CARTRIDGE_ID: CartridgeId = 'B';
const FREE_PLAY_SCOPE_ID: ScopeId = 'course-tree';
const FREE_PLAY_TARGET_INDEX = 1;
export const FREE_PLAY_RESTING_BPM = 65;
const SEEDS_PER_DAY = 10;

export const DISTANCE_STEP_M = 25;
export const MIN_DISTANCE_M = 100;
export const MAX_DISTANCE_M = MAX_TRAJECTORY_M;
const DEFAULT_RELATIVE_HUMIDITY = 0.5;

@Injectable({ providedIn: 'root' })
export class GameSession {
  readonly engine = new BallisticsEngine();
  private readonly startedAtMs = signal(Date.now());
  private freeSeedOffset = 0;

  readonly scenario = signal<Scenario>(freePlayScenario(daySeed(new Date()) * SEEDS_PER_DAY));
  readonly gaugeSnapshot = signal<GaugeSnapshot | null>(null);
  readonly windInput = signal<WindInput>({ speedMps: 0, clockHours: 9 });
  readonly distanceM = signal(TARGETS[FREE_PLAY_TARGET_INDEX].distanceM);
  readonly targetIndex = signal(FREE_PLAY_TARGET_INDEX);
  readonly scopeId = signal<ScopeId>(FREE_PLAY_SCOPE_ID);
  readonly shots = signal<ShotRecord[]>([]);
  readonly solution = signal<Solution | null>(null);

  readonly cartridge = computed(() => cartridgeById(FREE_PLAY_CARTRIDGE_ID));
  readonly target = computed(() => TARGETS[this.targetIndex()]);
  readonly scope = computed(() => scopeById(this.scopeId()));

  readonly playerAtmosphere = computed<Atmosphere>(() => {
    const snapshot = this.gaugeSnapshot();
    if (!snapshot) {
      return { temperatureC: STANDARD_TEMPERATURE_C, pressureHpa: STANDARD_PRESSURE_HPA, relativeHumidity: DEFAULT_RELATIVE_HUMIDITY };
    }
    return { temperatureC: snapshot.temperatureC, pressureHpa: snapshot.pressureHpa, relativeHumidity: snapshot.relativeHumidity };
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

  startFreePlay(): void {
    this.scenario.set(freePlayScenario(daySeed(new Date()) * SEEDS_PER_DAY + this.freeSeedOffset++));
    this.targetIndex.set(FREE_PLAY_TARGET_INDEX);
    this.scopeId.set(FREE_PLAY_SCOPE_ID);
    this.distanceM.set(TARGETS[FREE_PLAY_TARGET_INDEX].distanceM);
    this.gaugeSnapshot.set(null);
    this.windInput.set({ speedMps: 0, clockHours: 9 });
    this.shots.set([]);
    this.startedAtMs.set(Date.now());
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
    this.shots.update(shots => [...shots, shot]);
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

function freePlayScenario(seed: number): Scenario {
  return createScenario(seed, { windScale: 1, isWindUniform: false });
}
