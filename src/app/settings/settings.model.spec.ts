import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DRUM_SENSITIVITIES, knownSettings } from './settings.model';

describe('настройки при загрузке (U1)', () => {
  it('ничего не сохранено — значения по умолчанию', () => {
    expect(knownSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.volume).toBe(1);
    expect(DEFAULT_SETTINGS.drumPtPerClick).toBe(12);
  });

  it('старое «звук выкл» — громкость 0, «вкл» — 1; новая громкость важнее старого флага', () => {
    expect(knownSettings({ isSoundOn: false }).volume).toBe(0);
    expect(knownSettings({ isSoundOn: true }).volume).toBe(1);
    expect(knownSettings({ isSoundOn: false, volume: 0.6 }).volume).toBe(0.6);
  });

  it('громкость — 0…1 шагом 0,1: лишнее обрезается и округляется', () => {
    expect(knownSettings({ volume: 0.64 }).volume).toBe(0.6);
    expect(knownSettings({ volume: 1.7 }).volume).toBe(1);
    expect(knownSettings({ volume: -0.2 }).volume).toBe(0);
    expect(knownSettings({ volume: 'громко' }).volume).toBe(1);
  });

  it('чувствительность барабанов — только 8, 12 или 16 pt', () => {
    expect(DRUM_SENSITIVITIES.map(item => item.ptPerClick)).toEqual([16, 12, 8]);
    expect(knownSettings({ drumPtPerClick: 8 }).drumPtPerClick).toBe(8);
    expect(knownSettings({ drumPtPerClick: 10 }).drumPtPerClick).toBe(12);
  });

  it('флаги берутся, только если это булевы; чужие поля отброшены', () => {
    const settings = knownSettings({ isLeftHanded: true, isTapTrigger: 'да', isTextLarge: true, isSoundOn: true, theme: 'day' });
    expect(settings.isLeftHanded).toBe(true);
    expect(settings.isTapTrigger).toBe(false);
    expect(settings.isTextLarge).toBe(true);
    expect(Object.keys(settings).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });
});
