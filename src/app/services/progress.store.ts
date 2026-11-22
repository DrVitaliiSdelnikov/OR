import { computed, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BUILT_IN_PROFILE_NAMES, text } from '../../i18n';
import { ExerciseClass } from '../../core/exercise-scoring';
import { CourseResults, ExerciseId, ExerciseResult } from '../../sim/course';
import { DailyRecord, withDailyRecord } from '../../sim/daily';
import { knownDailyRecords } from '../daily/daily.model';
import { DrillRoundRecord, withDrillRound } from '../../sim/drill-round';
import { DEFAULT_FREE_PLAY, FreePlaySettings, knownFreePlay } from '../../sim/free-play';
import { withExamResult, withExerciseResult, withIntroCompleted } from '../home/home.model';
import { JournalSeries, withSeries } from '../journal/journal.model';
import { DopeNotes, withDopeNote } from '../review/review.model';
import { isProfileValid, knownProfiles, RifleProfile, withBuiltInProfile, withCurrentBuiltInName } from '../../sim/rifle-profile';
import { DEFAULT_SETTINGS, knownSettings, Settings } from '../settings/settings.model';
import { emptyLedger, knownLedger, replayedLedger, SkillLedger, withRatedRound, withRatedSeries } from './skill-ledger.model';

export const PROGRESS_STORAGE_KEY = 'or.progress.v2';
export const PROGRESS_V1_STORAGE_KEY = 'or.progress.v1';
const PROGRESS_VERSION = 2;

export interface ProgressState {
  course: CourseResults;
  settings: Settings;
  series: JournalSeries[];
  dopeNotes: DopeNotes;
  freePlay: FreePlaySettings;
  profiles: RifleProfile[];
  activeProfileId: string | null;
  seededProfileIds: string[];
  drillRounds: DrillRoundRecord[];
  skills: SkillLedger;
  daily: DailyRecord[];
}

type StoredProgress = Partial<Omit<ProgressState, 'skills' | 'daily'>> & { daily?: unknown; settings?: Record<string, unknown>; profiles?: unknown; activeProfileId?: unknown; seededProfileIds?: unknown; skills?: unknown };

const EMPTY_COURSE: CourseResults = { isIntroCompleted: false, bestClasses: {} };

@Injectable({ providedIn: 'root' })
export class ProgressStore {
  private readonly state = signal<ProgressState>({
    course: EMPTY_COURSE,
    settings: DEFAULT_SETTINGS,
    series: [],
    dopeNotes: {},
    freePlay: DEFAULT_FREE_PLAY,
    drillRounds: [],
    skills: emptyLedger(),
    daily: [],
    ...withBuiltInProfile({ profiles: [], activeProfileId: null }, []),
  });

  readonly course = computed(() => this.state().course);
  readonly settings = computed(() => this.state().settings);
  readonly journal = computed(() => this.state().series);
  readonly dopeNotes = computed(() => this.state().dopeNotes);
  readonly freePlay = computed(() => this.state().freePlay);
  readonly drillRounds = computed(() => this.state().drillRounds);
  readonly daily = computed(() => this.state().daily);
  readonly skills = computed(() => this.state().skills.ratings);
  readonly profiles = computed(() => this.state().profiles);
  readonly activeProfileId = computed(() => this.state().activeProfileId);
  readonly activeProfile = computed(() => this.state().profiles.find(profile => profile.id === this.state().activeProfileId) ?? null);

  async load(): Promise<void> {
    const { value } = await Preferences.get({ key: PROGRESS_STORAGE_KEY });
    if (value) {
      try {
        const stored = JSON.parse(value) as StoredProgress;
        this.state.set(knownProgress(stored));
        if (!knownLedger(stored.skills)) {
          this.save();
        }
      } catch {
        await Preferences.remove({ key: PROGRESS_STORAGE_KEY });
      }
      return;
    }
    const { value: v1 } = await Preferences.get({ key: PROGRESS_V1_STORAGE_KEY });
    if (!v1) {
      return;
    }
    try {
      this.state.set(migrateProgress(JSON.parse(v1) as StoredProgress));
      this.save();
    } catch {
      return;
    }
  }

  recordExerciseResult(exerciseId: ExerciseId, exerciseClass: ExerciseClass, total: number): void {
    this.update(state => ({ ...state, course: withExerciseResult(state.course, exerciseId, exerciseClass, total) }));
  }

  recordExamResult(result: Pick<ExerciseResult, 'hitShare' | 'exerciseClass' | 'total'>): void {
    this.update(state => ({ ...state, course: withExamResult(state.course, result) }));
  }

  completeIntro(): void {
    this.update(state => ({ ...state, course: withIntroCompleted(state.course) }));
  }

  addDopeNote(cartridgeId: string, distanceM: number, elevationMil: number): void {
    this.update(state => ({ ...state, dopeNotes: withDopeNote(state.dopeNotes, cartridgeId, distanceM, elevationMil) }));
  }

  addSeries(series: JournalSeries): void {
    this.update(state => {
      const journal = withSeries(state.series, series);
      return { ...state, series: journal, skills: withRatedSeries(state.skills, series, journal.map(saved => saved.id)) };
    });
  }

  addDrillRound(round: DrillRoundRecord): void {
    this.update(state => ({ ...state, drillRounds: withDrillRound(state.drillRounds, round), skills: withRatedRound(state.skills, round) }));
  }

  addDailyRecord(record: DailyRecord): void {
    this.update(state => ({ ...state, daily: withDailyRecord(state.daily, record) }));
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
    this.update(state => ({ ...state, course: EMPTY_COURSE, series: [], dopeNotes: {}, drillRounds: [], skills: emptyLedger(), daily: [] }));
  }

  private update(change: (state: ProgressState) => ProgressState): void {
    this.state.update(change);
    this.save();
  }

  private save(): void {
    void Preferences.set({ key: PROGRESS_STORAGE_KEY, value: JSON.stringify({ version: PROGRESS_VERSION, ...this.state() }) });
  }
}

export function migrateProgress(v1: StoredProgress): ProgressState {
  return knownProgress(v1);
}

function knownProgress(stored: StoredProgress): ProgressState {
  const series = Array.isArray(stored.series) ? stored.series : [];
  const drillRounds = Array.isArray(stored.drillRounds) ? stored.drillRounds : [];
  return {
    course: stored.course ?? EMPTY_COURSE,
    settings: knownSettings(stored.settings),
    series,
    dopeNotes: stored.dopeNotes ?? {},
    freePlay: knownFreePlay(stored.freePlay),
    drillRounds,
    skills: knownLedger(stored.skills) ?? replayedLedger(series, drillRounds),
    daily: knownDailyRecords(stored.daily),
    ...withLocalizedBuiltIn(withBuiltInProfile(knownProfiles(stored), knownSeededIds(stored.seededProfileIds))),
  };
}

function withLocalizedBuiltIn<T extends { profiles: RifleProfile[] }>(seeded: T): T {
  return { ...seeded, profiles: withCurrentBuiltInName(seeded.profiles, BUILT_IN_PROFILE_NAMES, text.content.builtInProfileName) };
}

function knownSeededIds(stored: unknown): string[] {
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
}
