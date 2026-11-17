import { describe, expect, it } from 'vitest';
import { builtInProfile, profileFromPreset, RifleProfile } from '../../sim/rifle-profile';
import { fieldMessages, formOf, isDirty, isSaveAllowed, profileOf, RifleForm, stabilityMessage } from './rifle-form.model';

const own308 = profileFromPreset('308-175', 'profile-1', 'Моя .308');

function edited(form: RifleForm, fields: Partial<RifleForm>): RifleForm {
  return { ...form, ...fields };
}

describe('форма профиля в единицах игрока', () => {
  it('метрика: скорость м/с, масса г, длина мм, высота прицела мм, ноль м', () => {
    const form = formOf(own308, 'metric');
    expect(form).toMatchObject({ name: 'Моя .308', muzzleVelocity: 792, bulletMass: 11.3, bulletLength: 31.5, sightHeight: 50, zero: 100, twistInches: 10, groupMoa: 0.75 });
  });

  it('имперская: фут/с, граны, дюймы, ярды', () => {
    const form = formOf(own308, 'imperial');
    expect(form).toMatchObject({ muzzleVelocity: 2600, bulletMass: 175, bulletLength: 1.24, sightHeight: 1.97, zero: 109 });
  });

  it('форма → профиль → форма без потерь (метрика и имперская)', () => {
    for (const system of ['metric', 'imperial'] as const) {
      const form = formOf(own308, system);
      expect(formOf(profileOf(form, own308, system), system), system).toEqual(form);
    }
  });

  it('сохранить без правок — профиль тот же до последнего знака (792,48 м/с не становится 792)', () => {
    for (const system of ['metric', 'imperial'] as const) {
      expect(profileOf(formOf(own308, system), own308, system), system).toEqual(own308);
    }
    expect(own308.cartridge.muzzleVelocityMps).toBe(792.48);
  });

  it('очистили оба поля холодного выстрела у профиля, где он был, — смещение снято', () => {
    const withColdBore: RifleProfile = { ...own308, rifle: { ...own308.rifle, coldBoreShiftMil: { upMil: 0.2, rightMil: 0.1 } } };
    const cleared = profileOf(edited(formOf(withColdBore, 'metric'), { coldBoreUp: null, coldBoreRight: null }), withColdBore, 'metric');
    expect(cleared.rifle.coldBoreShiftMil).toBeUndefined();
  });

  it('введённые числа переводятся в единицы хранения', () => {
    const profile = profileOf(edited(formOf(own308, 'imperial'), { muzzleVelocity: 2700, bulletMass: 168, zero: 100, sightHeight: 2 }), own308, 'imperial');
    expect(profile.cartridge.muzzleVelocityMps).toBeCloseTo(2700 * 0.3048, 9);
    expect(profile.cartridge.massG).toBeCloseTo(168 * 0.06479891, 9);
    expect(profile.rifle.zeroM).toBeCloseTo(91.44, 9);
    expect(profile.rifle.sightHeightCm).toBeCloseTo(5.08, 9);
  });

  it('холодный выстрел — в единицах прицела: пусто → не задан; MOA → MIL при хранении', () => {
    expect(formOf(own308, 'metric').coldBoreUp).toBeNull();
    const moaProfile: RifleProfile = { ...own308, scope: { ...own308.scope, units: 'MOA', clickValue: 0.25 }, rifle: { ...own308.rifle, coldBoreShiftMil: { upMil: 0.29089, rightMil: 0 } } };
    expect(formOf(moaProfile, 'metric').coldBoreUp).toBe(1);
    const stored = profileOf(edited(formOf(moaProfile, 'metric'), { coldBoreUp: 2, coldBoreRight: null }), moaProfile, 'metric');
    expect(stored.rifle.coldBoreShiftMil!.upMil).toBeCloseTo(2 * 0.29089, 9);
    expect(stored.rifle.coldBoreShiftMil!.rightMil).toBe(0);
    expect(profileOf(edited(formOf(own308, 'metric'), { coldBoreUp: null, coldBoreRight: null }), own308, 'metric').rifle.coldBoreShiftMil).toBeUndefined();
  });
});

describe('сообщения проверки', () => {
  it('ошибка скорости — пределы в единицах игрока', () => {
    const tooFast = (system: 'metric' | 'imperial', value: number) => fieldMessages(profileOf(edited(formOf(own308, system), { muzzleVelocity: value }), own308, system), system);
    expect(tooFast('metric', 1400).muzzleVelocity).toBe('300–1300 м/с');
    expect(tooFast('imperial', 4600).muzzleVelocity).toBe('984–4265 фут/с');
  });

  it('ошибки без единиц системы: BC, шаг нарезов, кучность; имя; длина короче калибра', () => {
    const messages = fieldMessages(
      profileOf(edited(formOf(own308, 'metric'), { name: ' ', ballisticCoefficient: 0.6, twistInches: 20, groupMoa: 6, bulletLength: 5 }), own308, 'metric'),
      'metric',
    );
    expect(messages).toMatchObject({
      name: 'от 1 до 40 знаков',
      ballisticCoefficient: '0,1–0,5',
      twistInches: '6–16″',
      groupMoa: '0,2–5 MOA',
      bulletLength: '10–60 мм, не короче калибра',
    });
  });

  it('кратность: «до» вне пределов — ошибка под «до»; «от» больше «до» — объяснение под «до»; «от» вне пределов — под «от»', () => {
    const scope = (magnificationMin: number, magnificationMax: number) =>
      fieldMessages(profileOf(edited(formOf(own308, 'metric'), { magnificationMin, magnificationMax }), own308, 'metric'), 'metric');
    expect(scope(5, 45)).toEqual({ magnificationMax: '1–40×' });
    expect(scope(12, 10)).toEqual({ magnificationMax: 'не меньше «от», 1–40×' });
    expect(scope(0, 10)).toEqual({ magnificationMin: '1–40×' });
  });

  it('верный профиль — без сообщений, «Сохранить» доступна; с ошибкой — нет', () => {
    expect(fieldMessages(own308, 'metric')).toEqual({});
    expect(isSaveAllowed(own308)).toBe(true);
    expect(isSaveAllowed(profileOf(edited(formOf(own308, 'metric'), { muzzleVelocity: 1400 }), own308, 'metric'))).toBe(false);
  });

  it('предупреждение устойчивости: Sg с числом; сохранить можно', () => {
    const slow = profileOf(edited(formOf(profileFromPreset('223-77', 'p', 'p'), 'metric'), { twistInches: 12 }), profileFromPreset('223-77', 'p', 'p'), 'metric');
    expect(stabilityMessage(slow)).toBe('Пуля может быть неустойчива: Sg 0,77 < 1,4. Проверь шаг нарезов');
    expect(isSaveAllowed(slow)).toBe(true);
    expect(stabilityMessage(own308)).toBeNull();
  });
});

describe('несохранённые правки', () => {
  it('без правок — не грязная; правка числа или имени — грязная', () => {
    const form = formOf(own308, 'metric');
    expect(isDirty(form, own308, 'metric')).toBe(false);
    expect(isDirty(edited(form, { name: 'Другая' }), own308, 'metric')).toBe(true);
    expect(isDirty(edited(form, { zero: 200 }), own308, 'metric')).toBe(true);
  });
});

describe('оценки во встроенной винтовке (17.11)', () => {
  const custom = builtInProfile();

  it('у скорости, разброса и кучности — «оценка — замени замером»', () => {
    const messages = fieldMessages(custom, 'metric');
    expect(messages.muzzleVelocity).toBe('оценка — замени замером');
    expect(messages.muzzleVelocitySd).toBe('оценка — замени замером');
    expect(messages.groupMoa).toBe('оценка — замени замером');
    expect(messages.zero).toBeUndefined();
    expect(fieldMessages(own308, 'metric').muzzleVelocity).toBeUndefined();
  });

  it('вписал свою скорость — пометка у скорости снята, у остальных осталась; оценка — не ошибка, сохранять можно', () => {
    const form = formOf(custom, 'metric');
    const saved = profileOf(edited(form, { muzzleVelocity: 790 }), custom, 'metric');
    expect(saved.cartridge.muzzleVelocityMps).toBe(790);
    expect(saved.estimates).toEqual(['muzzleVelocitySdMps', 'groupMoa']);
    expect(fieldMessages(saved, 'metric').muzzleVelocity).toBeUndefined();
    expect(isSaveAllowed(custom)).toBe(true);
    const untouched = profileOf(form, custom, 'metric');
    expect(untouched.estimates).toEqual(custom.estimates);
  });
});
