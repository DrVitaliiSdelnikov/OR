import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILT_IN_PROFILE_ID, builtInProfile, profileFromPreset } from '../../sim/rifle-profile';

const stored = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: stored.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void stored.set(key, value),
    remove: async ({ key }: { key: string }) => void stored.delete(key),
  },
}));

const { migrateProgress, PROGRESS_STORAGE_KEY, PROGRESS_V1_STORAGE_KEY, ProgressStore } = await import('./progress.store');

async function reloaded(): Promise<InstanceType<typeof ProgressStore>> {
  await Promise.resolve();
  const store = new ProgressStore();
  await store.load();
  return store;
}

beforeEach(() => stored.clear());

describe('профили в хранилище (T1.5)', () => {
  it('сохранить → перезагрузить: профиль и активный на месте', async () => {
    const store = new ProgressStore();
    const profile = profileFromPreset('308-175', 'profile-1', 'Моя .308');
    store.saveProfile(profile);
    store.setActiveProfile(profile.id);
    const next = await reloaded();
    expect(next.profiles()).toEqual([builtInProfile(), profile]);
    expect(next.activeProfileId()).toBe('profile-1');
    expect(next.activeProfile()).toEqual(profile);
  });

  it('правка по id заменяет профиль, а не добавляет второй', async () => {
    const store = new ProgressStore();
    const profile = profileFromPreset('308-175', 'profile-1', 'Моя .308');
    store.saveProfile(profile);
    store.saveProfile({ ...profile, name: 'Другая' });
    expect(store.profiles().map(item => item.name)).toEqual(['своя-custom', 'Другая']);
  });

  it('удалить активный → активного нет; профиль без проверки не сохраняется', async () => {
    const store = new ProgressStore();
    const profile = profileFromPreset('6-105', 'profile-1', 'Шестёрка');
    store.saveProfile(profile);
    store.setActiveProfile(profile.id);
    store.removeProfile(profile.id);
    expect(store.activeProfileId()).toBeNull();
    expect(store.profiles()).toEqual([builtInProfile()]);
    expect(store.saveProfile({ ...profile, cartridge: { ...profile.cartridge, muzzleVelocityMps: 5000 } })).toBe(false);
    expect(store.profiles()).toEqual([builtInProfile()]);
    const next = await reloaded();
    expect([next.profiles(), next.activeProfileId()]).toEqual([[builtInProfile()], null]);
  });

  it('активным нельзя сделать неизвестный профиль', () => {
    const store = new ProgressStore();
    store.setActiveProfile('nope');
    expect(store.activeProfileId()).toBe(BUILT_IN_PROFILE_ID);
  });

  it('старое хранилище без профилей грузится: появляется «своя-custom» и становится активной', async () => {
    stored.set(PROGRESS_V1_STORAGE_KEY, JSON.stringify({ course: { isIntroCompleted: true, bestClasses: { '01': 2 } } }));
    const store = await reloaded();
    expect([store.profiles(), store.activeProfileId()]).toEqual([[builtInProfile()], BUILT_IN_PROFILE_ID]);
    expect(store.course().bestClasses).toEqual({ '01': 2 });
  });
});

describe('хранилище v2 (T2.3)', () => {
  const V1_SNAPSHOT = {
    course: { isIntroCompleted: true, bestClasses: { '01': 1, '04': 2 }, bestTotals: { '04': 25 } },
    settings: { unitSystem: 'imperial' },
    series: [1, 2, 3].map(index => ({
      id: `s${index}`,
      startedAtIso: '2026-11-09T14:05:00.000Z',
      kind: 'exercise',
      exerciseId: '04',
      title: 'Флажок на бруствере',
      mode: 'auto',
      cartridgeIds: ['B'],
      exerciseClass: 2,
      total: 25,
      isInterrupted: false,
      shots: [{ distanceM: 300, isHit: false, isFirstAtTarget: true, mainCause: 'wind-under', errorTypes: ['side'], windSpeedMps: 2.2, mode: 'auto' }],
    })),
    dopeNotes: { B: [{ distanceM: 300, elevationMil: 1.4 }] },
    freePlay: { distanceM: 800 },
    profiles: [profileFromPreset('308-175', 'profile-1', 'Моя .308')],
    activeProfileId: 'profile-1',
    seededProfileIds: [BUILT_IN_PROFILE_ID],
  };

  it('migrateProgress: снимок v1 переносится без потерь, выстрелы — без величин', () => {
    const migrated = migrateProgress(V1_SNAPSHOT);
    expect(migrated.course).toEqual(V1_SNAPSHOT.course);
    expect(migrated.settings.unitSystem).toBe('imperial');
    expect(migrated.series).toEqual(V1_SNAPSHOT.series);
    expect('causes' in migrated.series[0].shots[0]).toBe(false);
    expect(migrated.dopeNotes).toEqual(V1_SNAPSHOT.dopeNotes);
    expect(migrated.freePlay.distanceM).toBe(800);
    expect([migrated.profiles, migrated.activeProfileId]).toEqual([V1_SNAPSHOT.profiles, 'profile-1']);
  });

  it('есть только v1 → загружается, сразу пишется v2 с версией, v1 не тронут', async () => {
    const v1 = JSON.stringify(V1_SNAPSHOT);
    stored.set(PROGRESS_V1_STORAGE_KEY, v1);
    const store = await reloaded();
    expect(store.journal().map(series => series.id)).toEqual(['s1', 's2', 's3']);
    expect(store.course().bestClasses).toEqual({ '01': 1, '04': 2 });
    const v2 = JSON.parse(stored.get(PROGRESS_STORAGE_KEY)!);
    expect([v2.version, v2.series.length]).toEqual([2, 3]);
    expect(stored.get(PROGRESS_V1_STORAGE_KEY)).toBe(v1);
  });

  it('есть v2 → читается v2, v1 не читается; запись и сброс — только в v2', async () => {
    stored.set(PROGRESS_V1_STORAGE_KEY, JSON.stringify(V1_SNAPSHOT));
    stored.set(PROGRESS_STORAGE_KEY, JSON.stringify({ version: 2, course: { isIntroCompleted: true, bestClasses: { '02': 3 } } }));
    const store = await reloaded();
    expect(store.course().bestClasses).toEqual({ '02': 3 });
    store.resetProgress();
    expect(JSON.parse(stored.get(PROGRESS_V1_STORAGE_KEY)!).series.length).toBe(3);
    expect(JSON.parse(stored.get(PROGRESS_STORAGE_KEY)!).course.bestClasses).toEqual({});
  });

  it('битый v2 удаляется, v1 остаётся', async () => {
    stored.set(PROGRESS_V1_STORAGE_KEY, JSON.stringify(V1_SNAPSHOT));
    stored.set(PROGRESS_STORAGE_KEY, '{broken');
    await reloaded();
    expect(stored.has(PROGRESS_STORAGE_KEY)).toBe(false);
    expect(stored.has(PROGRESS_V1_STORAGE_KEY)).toBe(true);
  });
});

describe('встроенная винтовка «своя-custom» в хранилище (17.11)', () => {
  it('новый игрок: «своя-custom» есть сразу и активна', () => {
    const store = new ProgressStore();
    expect(store.profiles()).toEqual([builtInProfile()]);
    expect(store.activeProfile()).toEqual(builtInProfile());
  });

  it('удалил — после перезагрузки не возвращается; правки сохраняются', async () => {
    const store = new ProgressStore();
    store.saveProfile({ ...builtInProfile(), cartridge: { ...builtInProfile().cartridge, muzzleVelocityMps: 790 } });
    expect((await reloaded()).profiles()[0].cartridge.muzzleVelocityMps).toBe(790);
    store.removeProfile(BUILT_IN_PROFILE_ID);
    const next = await reloaded();
    expect(next.profiles()).toEqual([]);
    expect(next.activeProfileId()).toBeNull();
  });
});
