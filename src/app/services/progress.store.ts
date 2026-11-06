import { computed, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { starsFor } from '../../core/score';
import { Correction, MissCause } from '../../core/types';

export const PROGRESS_STORAGE_KEY = 'or.progress.v1';

export type ThemeName = 'field' | 'day';

export interface TaskResult {
  score: number;
  maxScore: number;
  stars: 0 | 1 | 2 | 3;
}

export interface Settings {
  theme: ThemeName;
  isSoundOn: boolean;
  isHapticsOn: boolean;
  isTriggerZoneLarger: boolean;
  isMarkerDriftOff: boolean;
  isEverythingUnlocked: boolean;
}

export interface ShotRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  shotNumber: number;
  firedAtIso: string;
  distanceM: number;
  scopeId: string;
  isHit: boolean;
  points: number;
  missMrad: number;
  radiusMrad: number;
  impact: Correction;
  dial: Correction;
  ideal: Correction;
  hold: Correction;
  triggerQuality: number;
  hitProbability: number;
  luck: number;
  cause: MissCause;
  verdict: string;
  timeOfFlightS: number;
}

interface ProgressState {
  results: Record<string, TaskResult>;
  settings: Settings;
  shots: ShotRecord[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'field',
  isSoundOn: true,
  isHapticsOn: true,
  isTriggerZoneLarger: false,
  isMarkerDriftOff: false,
  isEverythingUnlocked: false,
};

const SHOT_LOG_LIMIT = 200;

@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly state = signal<ProgressState>({ results: {}, settings: DEFAULT_SETTINGS, shots: [] });

  readonly results = computed(() => this.state().results);
  readonly settings = computed(() => this.state().settings);
  readonly shots = computed(() => this.state().shots);
  readonly lastShot = computed(() => this.state().shots[0] ?? null);
  readonly passedTaskIds = computed(
    () => new Set(Object.entries(this.state().results).filter(([, result]) => result.stars >= 1).map(([taskId]) => taskId)),
  );

  async load(): Promise<void> {
    const { value } = await Preferences.get({ key: PROGRESS_STORAGE_KEY });
    if (!value) {
      return;
    }
    try {
      const stored = JSON.parse(value) as Partial<ProgressState>;
      this.state.set({
        results: stored.results ?? {},
        settings: { ...DEFAULT_SETTINGS, ...stored.settings },
        shots: stored.shots ?? [],
      });
    } catch {
      await Preferences.remove({ key: PROGRESS_STORAGE_KEY });
    }
  }

  recordTaskResult(taskId: string, score: number, maxScore: number): TaskResult {
    const result: TaskResult = { score, maxScore, stars: starsFor(score, maxScore) };
    const previous = this.state().results[taskId];
    if (!previous || score >= previous.score) {
      this.update(state => ({ ...state, results: { ...state.results, [taskId]: result } }));
    }
    return result;
  }

  recordShot(shot: ShotRecord): void {
    this.update(state => ({ ...state, shots: [shot, ...state.shots].slice(0, SHOT_LOG_LIMIT) }));
  }

  shotById(id: string): ShotRecord | undefined {
    return this.state().shots.find(shot => shot.id === id);
  }

  updateSettings(patch: Partial<Settings>): void {
    this.update(state => ({ ...state, settings: { ...state.settings, ...patch } }));
  }

  resetProgress(): void {
    this.update(state => ({ ...state, results: {}, shots: [] }));
  }

  private update(change: (state: ProgressState) => ProgressState): void {
    this.state.update(change);
    void Preferences.set({ key: PROGRESS_STORAGE_KEY, value: JSON.stringify(this.state()) });
  }
}
