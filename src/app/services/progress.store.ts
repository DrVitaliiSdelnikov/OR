import { computed, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { ExerciseClass } from '../../core/exercise-scoring';
import { CourseResults, ExerciseId } from '../../sim/course';
import { DEFAULT_FREE_PLAY, FreePlaySettings, knownFreePlay } from '../../sim/free-play';
import { withExerciseResult, withIntroCompleted } from '../home/home.model';
import { JournalSeries, withSeries } from '../journal/journal.model';
import { DopeNotes, withDopeNote } from '../review/review.model';
import { isProfileValid, knownProfiles, RifleProfile } from '../../sim/rifle-profile';
import { DEFAULT_SETTINGS, knownSettings, Settings } from '../settings/settings.model';

export const PROGRESS_STORAGE_KEY = 'or.progress.v1';

interface ProgressState {
  course: CourseResults;
  settings: Settings;
  series: JournalSeries[];
  dopeNotes: DopeNotes;
  freePlay: FreePlaySettings;
  profiles: RifleProfile[];
  activeProfileId: string | null;
}

const EMPTY_COURSE: CourseResults = { isIntroCompleted: false, bestClasses: {} };

@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly state = signal<ProgressState>({ course: EMPTY_COURSE, settings: DEFAULT_SETTINGS, series: [], dopeNotes: {}, freePlay: DEFAULT_FREE_PLAY, profiles: [], activeProfileId: null });

  readonly course = computed(() => this.state().course);
  readonly settings = computed(() => this.state().settings);
  readonly journal = computed(() => this.state().series);
  readonly dopeNotes = computed(() => this.state().dopeNotes);
  readonly freePlay = computed(() => this.state().freePlay);
  readonly profiles = computed(() => this.state().profiles);
  readonly activeProfileId = computed(() => this.state().activeProfileId);
  readonly activeProfile = computed(() => this.state().profiles.find(profile => profile.id === this.state().activeProfileId) ?? null);

  async load(): Promise<void> {
    const { value } = await Preferences.get({ key: PROGRESS_STORAGE_KEY });
    if (!value) {
      return;
    }
    try {
      const stored = JSON.parse(value) as Partial<ProgressState> & { settings?: Record<string, unknown>; profiles?: unknown; activeProfileId?: unknown };
      this.state.set({
        course: stored.course ?? EMPTY_COURSE,
        settings: knownSettings(stored.settings),
        series: Array.isArray(stored.series) ? stored.series : [],
        dopeNotes: stored.dopeNotes ?? {},
        freePlay: knownFreePlay(stored.freePlay),
        ...knownProfiles(stored),
      });
    } catch {
      await Preferences.remove({ key: PROGRESS_STORAGE_KEY });
    }
  }

  recordExerciseResult(exerciseId: ExerciseId, exerciseClass: ExerciseClass, total: number): void {
    this.update(state => ({ ...state, course: withExerciseResult(state.course, exerciseId, exerciseClass, total) }));
  }

  completeIntro(): void {
    this.update(state => ({ ...state, course: withIntroCompleted(state.course) }));
  }

  addDopeNote(cartridgeId: string, distanceM: number, elevationMil: number): void {
    this.update(state => ({ ...state, dopeNotes: withDopeNote(state.dopeNotes, cartridgeId, distanceM, elevationMil) }));
  }

  addSeries(series: JournalSeries): void {
    this.update(state => ({ ...state, series: withSeries(state.series, series) }));
  }

  updateFreePlay(patch: Partial<FreePlaySettings>): void {
    this.update(state => ({ ...state, freePlay: { ...state.freePlay, ...patch } }));
  }

  saveProfile(profile: RifleProfile): boolean {
    if (!isProfileValid(profile)) {
      return false;
    }
    this.update(state => {
      const isKnown = state.profiles.some(saved => saved.id === profile.id);
      const profiles = isKnown ? state.profiles.map(saved => (saved.id === profile.id ? profile : saved)) : [...state.profiles, profile];
      return { ...state, profiles };
    });
    return true;
  }

  removeProfile(profileId: string): void {
    this.update(state => ({
      ...state,
      profiles: state.profiles.filter(profile => profile.id !== profileId),
      activeProfileId: state.activeProfileId === profileId ? null : state.activeProfileId,
    }));
  }

  setActiveProfile(profileId: string | null): void {
    if (profileId !== null && !this.state().profiles.some(profile => profile.id === profileId)) {
      return;
    }
    this.update(state => ({ ...state, activeProfileId: profileId }));
  }

  updateSettings(patch: Partial<Settings>): void {
    this.update(state => ({ ...state, settings: { ...state.settings, ...patch } }));
  }

  resetProgress(): void {
    this.update(state => ({ ...state, course: EMPTY_COURSE, series: [], dopeNotes: {} }));
  }

  private update(change: (state: ProgressState) => ProgressState): void {
    this.state.update(change);
    void Preferences.set({ key: PROGRESS_STORAGE_KEY, value: JSON.stringify(this.state()) });
  }
}
