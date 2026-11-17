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

const { ProgressStore } = await import('./progress.store');

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
    stored.set('or.progress.v1', JSON.stringify({ course: { isIntroCompleted: true, bestClasses: { '01': 2 } } }));
    const store = await reloaded();
    expect([store.profiles(), store.activeProfileId()]).toEqual([[builtInProfile()], BUILT_IN_PROFILE_ID]);
    expect(store.course().bestClasses).toEqual({ '01': 2 });
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
