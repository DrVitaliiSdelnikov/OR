import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profileFromPreset } from '../../sim/rifle-profile';

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
    expect(next.profiles()).toEqual([profile]);
    expect(next.activeProfileId()).toBe('profile-1');
    expect(next.activeProfile()).toEqual(profile);
  });

  it('правка по id заменяет профиль, а не добавляет второй', async () => {
    const store = new ProgressStore();
    const profile = profileFromPreset('308-175', 'profile-1', 'Моя .308');
    store.saveProfile(profile);
    store.saveProfile({ ...profile, name: 'Другая' });
    expect(store.profiles().map(item => item.name)).toEqual(['Другая']);
  });

  it('удалить активный → активного нет; профиль без проверки не сохраняется', async () => {
    const store = new ProgressStore();
    const profile = profileFromPreset('6-105', 'profile-1', 'Шестёрка');
    store.saveProfile(profile);
    store.setActiveProfile(profile.id);
    store.removeProfile(profile.id);
    expect(store.activeProfileId()).toBeNull();
    expect(store.profiles()).toEqual([]);
    expect(store.saveProfile({ ...profile, cartridge: { ...profile.cartridge, muzzleVelocityMps: 5000 } })).toBe(false);
    expect(store.profiles()).toEqual([]);
    const next = await reloaded();
    expect([next.profiles(), next.activeProfileId()]).toEqual([[], null]);
  });

  it('активным нельзя сделать неизвестный профиль', () => {
    const store = new ProgressStore();
    store.setActiveProfile('nope');
    expect(store.activeProfileId()).toBeNull();
  });

  it('старое хранилище без профилей грузится: профилей нет, активный — учебная винтовка', async () => {
    stored.set('or.progress.v1', JSON.stringify({ course: { isIntroCompleted: true, bestClasses: { '01': 2 } } }));
    const store = await reloaded();
    expect([store.profiles(), store.activeProfileId(), store.activeProfile()]).toEqual([[], null, null]);
    expect(store.course().bestClasses).toEqual({ '01': 2 });
  });
});
