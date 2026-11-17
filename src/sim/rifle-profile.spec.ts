import { describe, expect, it } from 'vitest';
import { buildDopeCard } from '../core/dope-card';
import { BallisticsEngine } from '../core/engine';
import { REFERENCE_LOADOUTS } from '../core/reference/reference-loadouts';
import { BC_ASM_TO_ICAO, BUILT_IN_PROFILE_ID, builtInProfile, canAddProfile, isProfileValid, knownProfiles, loadoutOf, millerStability, PROFILE_PRESETS, profileFromPreset, ProfileIssue, RifleProfile, scopeOf, validateProfile, withBuiltInProfile } from './rifle-profile';

const MRAD_PER_MOA = 0.29089;
const GROUP_SPREAD_PER_SIGMA = 3.08;

function base(): RifleProfile {
  return profileFromPreset('308-175', 'profile-test', 'Моя .308');
}

function withRifle(fields: Partial<RifleProfile['rifle']>): RifleProfile {
  const profile = base();
  return { ...profile, rifle: { ...profile.rifle, ...fields } };
}

function withCartridge(fields: Partial<RifleProfile['cartridge']>): RifleProfile {
  const profile = base();
  return { ...profile, cartridge: { ...profile.cartridge, ...fields } };
}

function withScope(fields: Partial<RifleProfile['scope']>): RifleProfile {
  const profile = base();
  return { ...profile, scope: { ...profile.scope, ...fields } };
}

function errorFields(profile: RifleProfile): string[] {
  return validateProfile(profile)
    .filter(issue => issue.kind === 'error')
    .map(issue => issue.field);
}

function issueOf(profile: RifleProfile, field: string): ProfileIssue | undefined {
  return validateProfile(profile).find(issue => issue.field === field);
}

describe('проверка профиля: границы полей', () => {
  const cases: [string, (value: number) => RifleProfile, number, number, number, number][] = [
    ['muzzleVelocityMps', value => withCartridge({ muzzleVelocityMps: value }), 300, 1300, 299, 1301],
    ['muzzleVelocitySdMps', value => withCartridge({ muzzleVelocitySdMps: value }), 0, 30, -0.1, 30.1],
    ['massG', value => withCartridge({ massG: value }), 1, 60, 0.9, 60.1],
    ['bulletDiameterIn', value => withCartridge({ bulletDiameterIn: value, bulletLengthMm: 20 }), 0.17, 0.51, 0.16, 0.52],
    ['bulletLengthMm', value => withCartridge({ bulletLengthMm: value, bulletDiameterIn: 0.2 }), 10, 60, 9.9, 60.1],
    ['zeroM', value => withRifle({ zeroM: value }), 25, 300, 24, 301],
    ['sightHeightCm', value => withRifle({ sightHeightCm: value }), 2, 10, 1.9, 10.1],
    ['twistInchesPerTurn', value => withRifle({ twistInchesPerTurn: value }), 6, 16, 5.9, 16.1],
    ['groupMoa', value => withRifle({ groupMoa: value }), 0.2, 5, 0.19, 5.1],
  ];

  it.each(cases)('%s: на границах — без ошибки, за ними — ошибка с пределами', (field, make, low, high, below, above) => {
    expect(errorFields(make(low)), `${field} = ${low}`).not.toContain(field);
    expect(errorFields(make(high)), `${field} = ${high}`).not.toContain(field);
    expect(issueOf(make(below), field)).toEqual({ field, kind: 'error', limits: [low, high] });
    expect(issueOf(make(above), field)).toEqual({ field, kind: 'error', limits: [low, high] });
  });

  it('BC: у G7 0,1–0,5, у G1 0,2–1,0', () => {
    expect(errorFields(withCartridge({ dragModel: 'G7', ballisticCoefficient: 0.5 }))).toEqual([]);
    expect(issueOf(withCartridge({ dragModel: 'G7', ballisticCoefficient: 0.51 }), 'ballisticCoefficient')).toEqual({ field: 'ballisticCoefficient', kind: 'error', limits: [0.1, 0.5] });
    expect(errorFields(withCartridge({ dragModel: 'G1', ballisticCoefficient: 0.9 }))).toEqual([]);
    expect(issueOf(withCartridge({ dragModel: 'G1', ballisticCoefficient: 0.19 }), 'ballisticCoefficient')).toEqual({ field: 'ballisticCoefficient', kind: 'error', limits: [0.2, 1] });
  });

  it('пуля короче калибра — ошибка длины', () => {
    expect(errorFields(withCartridge({ bulletDiameterIn: 0.5, bulletLengthMm: 12 }))).toContain('bulletLengthMm');
    expect(errorFields(withCartridge({ bulletDiameterIn: 0.5, bulletLengthMm: 13 }))).not.toContain('bulletLengthMm');
  });

  it('имя: 1–40 символов после обрезки пробелов', () => {
    expect(errorFields({ ...base(), name: '   ' })).toContain('name');
    expect(errorFields({ ...base(), name: 'а'.repeat(41) })).toContain('name');
    expect(errorFields({ ...base(), name: ` ${'а'.repeat(40)} ` })).not.toContain('name');
  });

  it('цена клика — из ряда единиц прицела; кратность 1–40, мин ≤ макс', () => {
    expect(errorFields(withScope({ units: 'MIL', clickValue: 0.05 }))).toEqual([]);
    expect(errorFields(withScope({ units: 'MIL', clickValue: 0.25 }))).toContain('clickValue');
    expect(errorFields(withScope({ units: 'MOA', clickValue: 0.125 }))).toEqual([]);
    expect(errorFields(withScope({ units: 'MOA', clickValue: 0.1 }))).toContain('clickValue');
    expect(errorFields(withScope({ magnificationMin: 12, magnificationMax: 10 }))).toContain('magnification');
    expect(errorFields(withScope({ magnificationMin: 1, magnificationMax: 40 }))).toEqual([]);
    expect(errorFields(withScope({ magnificationMin: 0.9, magnificationMax: 10 }))).toContain('magnification');
    expect(errorFields(withScope({ magnificationMin: 5, magnificationMax: 41 }))).toContain('magnification');
  });

  it('холодный выстрел: не задан — без ошибки; до 1 MIL по модулю — без ошибки; 1,1 — ошибка', () => {
    expect(base().rifle.coldBoreShiftMil).toBeUndefined();
    expect(errorFields(withRifle({ coldBoreShiftMil: { upMil: -1, rightMil: 1 } }))).toEqual([]);
    expect(issueOf(withRifle({ coldBoreShiftMil: { upMil: 1.1, rightMil: 0 } }), 'coldBoreShiftMil')).toEqual({ field: 'coldBoreShiftMil', kind: 'error', limits: [-1, 1] });
    expect(errorFields(withRifle({ coldBoreShiftMil: { upMil: 0, rightMil: -1.1 } }))).toContain('coldBoreShiftMil');
  });
});

describe('устойчивость пули (Миллер)', () => {
  it('эталоны T1.3: .223 77 — 1,74; .308 175 — 2,40; 6,5 мм 140 — 1,71; .338 300 — 2,00', () => {
    const expected: Record<string, number> = { '223-77': 1.74, '308-175': 2.4, '65cm-140': 1.71, '338lm-300': 2 };
    for (const { id, loadout } of REFERENCE_LOADOUTS) {
      const { cartridge, rifle } = loadout;
      expect(millerStability(cartridge.massG, cartridge.bulletDiameterIn, cartridge.bulletLengthMm, rifle.twistInchesPerTurn, cartridge.muzzleVelocityMps), id).toBeCloseTo(expected[id], 2);
    }
  });

  it('.223 77 гр в 1:12 — предупреждение, но сохранить можно', () => {
    const slowTwist = { ...profileFromPreset('223-77', 'profile-test', '.223'), rifle: { ...profileFromPreset('223-77', 'x', 'x').rifle, twistInchesPerTurn: 12 } };
    const issues = validateProfile(slowTwist);
    expect(issues).toEqual([{ field: 'twistInchesPerTurn', kind: 'warning', stability: expect.closeTo(0.77, 2) }]);
  });
});

describe('профиль → снаряжение и прицел', () => {
  it('BC по ASM переводится в ICAO (× 0,982), по ICAO — как есть', () => {
    expect(BC_ASM_TO_ICAO).toBeCloseTo(0.0751 / 0.0765, 6);
    expect(loadoutOf(withCartridge({ ballisticCoefficient: 0.3, bcAtmosphere: 'asm' })).cartridge.ballisticCoefficient).toBeCloseTo(0.3 * BC_ASM_TO_ICAO, 9);
    expect(loadoutOf(withCartridge({ ballisticCoefficient: 0.3, bcAtmosphere: 'icao' })).cartridge.ballisticCoefficient).toBe(0.3);
  });

  it('кучность 1 MOA → σ 0,094 mrad; холодный выстрел не задан → 0, задан → в MIL ядра; id патрона — id профиля', () => {
    const loadout = loadoutOf(withRifle({ groupMoa: 1 }));
    expect(loadout.rifle.groupSigmaMrad).toBeCloseTo(MRAD_PER_MOA / GROUP_SPREAD_PER_SIGMA, 9);
    expect(loadout.rifle.groupSigmaMrad).toBeCloseTo(0.094, 3);
    expect(loadout.rifle.coldBoreShiftMil).toEqual({ upMrad: 0, rightMrad: 0 });
    expect(loadoutOf(withRifle({ coldBoreShiftMil: { upMil: 0.2, rightMil: -0.1 } })).rifle.coldBoreShiftMil).toEqual({ upMrad: 0.2, rightMrad: -0.1 });
    expect(loadout.cartridge.id).toBe('profile-test');
    expect(loadout.rifle.name).toBe('Моя .308');
  });

  it('прицел: MOA ¼ → 0,0727 mrad, MIL 0,1 → 0,1; вторая плоскость; id — профиля', () => {
    const moa = scopeOf(withScope({ units: 'MOA', clickValue: 0.25, isFirstFocalPlane: false }));
    expect(moa.clickMrad).toBeCloseTo(0.25 * MRAD_PER_MOA, 9);
    expect(moa.units).toBe('MOA');
    expect(moa.isFirstFocalPlane).toBe(false);
    expect(moa.id).toBe('profile-test');
    expect(moa.name).toBe('Моя .308');
    expect(scopeOf(withScope({ units: 'MIL', clickValue: 0.1 })).clickMrad).toBe(0.1);
  });

  it('ход барабанов прицела профиля хватает на ДОПЕ до 1000 м самого медленного пресета', async () => {
    const slowest = profileFromPreset('223-77', 'p', 'p');
    const card = await buildDopeCard(new BallisticsEngine(), loadoutOf(slowest), 0.1);
    const farRow = card.rows.find(row => row.distanceM === 1000)!;
    expect(scopeOf(slowest).elevationTravelMrad).toBeGreaterThan(farRow.elevationMil);
  });
});

describe('пресеты', () => {
  it('6 пресетов, все проходят проверку без ошибок и предупреждений', () => {
    expect(PROFILE_PRESETS.map(preset => preset.code)).toEqual(['223-77', '65-140', '308-175', '338-300', '6-105', '300-215']);
    for (const preset of PROFILE_PRESETS) {
      expect(validateProfile(profileFromPreset(preset.code, 'p', preset.name)), preset.code).toEqual([]);
    }
  });

  it('4 эталона T1.3 дают те же числа ядра, что REFERENCE_LOADOUTS', () => {
    const codes: Record<string, string> = { '223-77': '223-77', '65cm-140': '65-140', '308-175': '308-175', '338lm-300': '338-300' };
    for (const { id, loadout } of REFERENCE_LOADOUTS) {
      const fromPreset = loadoutOf(profileFromPreset(codes[id], 'p', 'p'));
      const physics = (value: typeof loadout) => ({
        cartridge: { ...value.cartridge, id: '', name: '', blurb: '', muzzleVelocitySdMps: 0 },
        rifle: { sightHeightCm: value.rifle.sightHeightCm, zeroM: value.rifle.zeroM, twistInchesPerTurn: value.rifle.twistInchesPerTurn, twistDirection: value.rifle.twistDirection },
      });
      expect(physics(fromPreset), id).toEqual(physics(loadout));
    }
  });

  it('пресет — шаблон: копия получает свой id и имя, пресет не меняется', () => {
    const copy = profileFromPreset('6-105', 'profile-1', 'Моя шестёрка');
    expect([copy.id, copy.name]).toEqual(['profile-1', 'Моя шестёрка']);
    copy.rifle.zeroM = 200;
    expect(profileFromPreset('6-105', 'profile-2', 'x').rifle.zeroM).toBe(100);
  });

  it('профили на границах диапазонов строят ДОПЕ до 1000 м без ошибки ядра', async () => {
    const engine = new BallisticsEngine();
    const extremes: RifleProfile[] = [
      withCartridge({ muzzleVelocityMps: 300, dragModel: 'G7', ballisticCoefficient: 0.1 }),
      withCartridge({ muzzleVelocityMps: 1300, dragModel: 'G1', ballisticCoefficient: 1 }),
      { ...withRifle({ zeroM: 25, sightHeightCm: 10, twistInchesPerTurn: 6, twistDirection: 'left' }) },
      withRifle({ zeroM: 300, sightHeightCm: 2, twistInchesPerTurn: 16 }),
      withCartridge({ massG: 60, bulletDiameterIn: 0.51, bulletLengthMm: 60 }),
      withCartridge({ massG: 1, bulletDiameterIn: 0.17, bulletLengthMm: 10 }),
    ];
    for (const profile of extremes) {
      const card = await buildDopeCard(engine, loadoutOf(profile), 0.1);
      expect(card.rows.at(-1)!.distanceM).toBe(1000);
      expect(card.rows.every(row => Number.isFinite(row.elevationMil))).toBe(true);
    }
  });
});

describe('хранение и лимит', () => {
  it('без Pro — один свой профиль; с Pro — сколько угодно', () => {
    expect(canAddProfile([], false)).toBe(true);
    expect(canAddProfile([base()], false)).toBe(false);
    expect(canAddProfile([base(), base()], true)).toBe(true);
  });

  it('knownProfiles: битый профиль отброшен, активный без профиля → null, верные сохранены', () => {
    const good = base();
    const broken = { ...withCartridge({ muzzleVelocityMps: 5000 }), id: 'profile-broken' };
    const notAProfile = { id: 'x', name: 'x' };
    expect(knownProfiles({ profiles: [good, broken, notAProfile], activeProfileId: 'profile-broken' })).toEqual({ profiles: [good], activeProfileId: null });
    expect(knownProfiles({ profiles: [good], activeProfileId: good.id })).toEqual({ profiles: [good], activeProfileId: good.id });
    expect(knownProfiles({ profiles: 'oops', activeProfileId: 7 })).toEqual({ profiles: [], activeProfileId: null });
    expect(knownProfiles(undefined)).toEqual({ profiles: [], activeProfileId: null });
  });
});

describe('встроенная винтовка «своя-custom» (LWRC M6IC, 17.11)', () => {
  const custom = builtInProfile();

  it('данные пользователя: .223, ствол 1:7, прицел 4,5 см, ноль 50 м, Sako 69 гр SMK, G7 0,152, Strike Eagle 1–8× MOA ½', () => {
    expect(custom.id).toBe(BUILT_IN_PROFILE_ID);
    expect(custom.name).toBe('своя-custom');
    expect(custom.rifle).toMatchObject({ sightHeightCm: 4.5, zeroM: 50, twistInchesPerTurn: 7, twistDirection: 'right' });
    expect(custom.cartridge).toMatchObject({ dragModel: 'G7', ballisticCoefficient: 0.152, bcAtmosphere: 'icao', bulletDiameterIn: 0.224 });
    expect(custom.cartridge.massG).toBeCloseTo(69 * 0.06479891, 6);
    expect(custom.scope).toEqual({ units: 'MOA', clickValue: 0.5, isFirstFocalPlane: false, magnificationMin: 1, magnificationMax: 8, reticle: 'moa-grid' });
    expect(isProfileValid(custom)).toBe(true);
  });

  it('скорость 808 м/с, разброс и кучность — оценки: помечены, пока их не заменят', () => {
    expect(custom.cartridge.muzzleVelocityMps).toBe(808);
    expect(custom.estimates).toEqual(['muzzleVelocityMps', 'muzzleVelocitySdMps', 'groupMoa']);
  });

  it('появляется один раз: новый игрок и игрок со своими профилями получают её; удалённая не возвращается', () => {
    expect(withBuiltInProfile({ profiles: [], activeProfileId: null }, [])).toEqual({ profiles: [custom], activeProfileId: BUILT_IN_PROFILE_ID, seededProfileIds: [BUILT_IN_PROFILE_ID] });
    const own = profileFromPreset('308-175', 'profile-1', 'Моя .308');
    expect(withBuiltInProfile({ profiles: [own], activeProfileId: own.id }, [])).toEqual({ profiles: [custom, own], activeProfileId: own.id, seededProfileIds: [BUILT_IN_PROFILE_ID] });
    expect(withBuiltInProfile({ profiles: [own], activeProfileId: null }, [BUILT_IN_PROFILE_ID])).toEqual({ profiles: [own], activeProfileId: null, seededProfileIds: [BUILT_IN_PROFILE_ID] });
  });

  it('не занимает бесплатное место: с ней можно добавить одну свою', () => {
    const own = profileFromPreset('308-175', 'profile-1', 'Моя .308');
    expect(canAddProfile([custom], false)).toBe(true);
    expect(canAddProfile([custom, own], false)).toBe(false);
  });

  it('хранится и читается обратно вместе с пометками оценок', () => {
    expect(knownProfiles({ profiles: [custom], activeProfileId: custom.id })).toEqual({ profiles: [custom], activeProfileId: custom.id });
  });
});
