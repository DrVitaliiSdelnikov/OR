import { computed, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { ExerciseClass } from '../../core/exercise-scoring';
import { Correction, MissCause } from '../../core/types';
import { CourseResults, ExerciseId } from '../../sim/course';
import { withExerciseResult, withIntroCompleted } from '../home/home.model';

export const PROGRESS_STORAGE_KEY = 'or.progress.v1';

export interface Settings {
  isSoundOn: boolean;
  isHapticsOn: boolean;
  isTriggerZoneLarger: boolean;
  isMarkerDriftOff: boolean;
  isEverythingUnlocked: boolean;
}

export interface ShotRecord {
  id: string;
  taskTitle: string;
  shotNumber: number;
  firedAtIso: string;
  distanceM: number;
  scopeId: string;
  isHit: boolean;
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
  course: CourseResults;
  settings: Settings;
  shots: ShotRecord[];
}

export const DEFAULT_SETTINGS: Settings = {
  isSoundOn: true,
  isHapticsOn: true,
  isTriggerZoneLarger: false,
  isMarkerDriftOff: false,
  isEverythingUnlocked: false,
};

const SHOT_LOG_LIMIT = 200;
const EMPTY_COURSE: CourseResults = { isIntroCompleted: false, bestClasses: {} };

@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly state = signal<ProgressState>({ course: EMPTY_COURSE, settings: DEFAULT_SETTINGS, shots: [] });

  readonly course = computed(() => this.state().course);
  readonly settings = computed(() => this.state().settings);
  readonly shots = computed(() => this.state().shots);
  readonly lastShot = computed(() => this.state().shots[0] ?? null);

  async load(): Promise<void> {
    const { value } = await Preferences.get({ key: PROGRESS_STORAGE_KEY });
    if (!value) {
      return;
    }
    try {
      const stored = JSON.parse(value) as Partial<ProgressState>;
      this.state.set({
        course: stored.course ?? EMPTY_COURSE,
        settings: knownSettings(stored.settings),
        shots: stored.shots ?? [],
      });
    } catch {
      await Preferences.remove({ key: PROGRESS_STORAGE_KEY });
    }
  }

  recordExerciseResult(exerciseId: ExerciseId, exerciseClass: ExerciseClass): void {
    this.update(state => ({ ...state, course: withExerciseResult(state.course, exerciseId, exerciseClass) }));
  }

  completeIntro(): void {
    this.update(state => ({ ...state, course: withIntroCompleted(state.course) }));
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
    this.update(state => ({ ...state, course: EMPTY_COURSE, shots: [] }));
  }

  private update(change: (state: ProgressState) => ProgressState): void {
    this.state.update(change);
    void Preferences.set({ key: PROGRESS_STORAGE_KEY, value: JSON.stringify(this.state()) });
  }
}

function knownSettings(stored: Partial<Settings> | undefined): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (typeof stored?.[key] === 'boolean') {
      settings[key] = stored[key];
    }
  }
  return settings;
}
