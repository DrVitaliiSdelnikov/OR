import { DragModel, Loadout, TwistDirection } from '../core/types';
import { text } from '../i18n';
import { MRAD_PER_MOA, ReticleKind, ScopeModel, ScopeUnits } from './scope-model';

export type BcAtmosphere = 'asm' | 'icao';
export type ProfileField =
  | 'name'
  | 'muzzleVelocityMps'
  | 'muzzleVelocitySdMps'
  | 'ballisticCoefficient'
  | 'massG'
  | 'bulletDiameterIn'
  | 'bulletLengthMm'
  | 'zeroM'
  | 'sightHeightCm'
  | 'twistInchesPerTurn'
  | 'groupMoa'
  | 'coldBoreShiftMil'
  | 'clickValue'
  | 'magnification';

export interface RifleProfile {
  id: string;
  name: string;
  rifle: {
    sightHeightCm: number;
    zeroM: number;
    twistInchesPerTurn: number;
    twistDirection: TwistDirection;
    groupMoa: number;
    coldBoreShiftMil?: { upMil: number; rightMil: number };
  };
  cartridge: {
    muzzleVelocityMps: number;
    muzzleVelocitySdMps: number;
    dragModel: DragModel;
    ballisticCoefficient: number;
    bcAtmosphere: BcAtmosphere;
    massG: number;
    bulletDiameterIn: number;
    bulletLengthMm: number;
  };
  scope: {
    units: ScopeUnits;
    clickValue: number;
    isFirstFocalPlane: boolean;
    magnificationMin: number;
    magnificationMax: number;
    reticle: ReticleKind;
  };
}

export type ProfileIssue =
  | { field: ProfileField; kind: 'error'; limits?: readonly [number, number] }
  | { field: 'twistInchesPerTurn'; kind: 'warning'; stability: number };

export interface StoredProfiles {
  profiles: RifleProfile[];
  activeProfileId: string | null;
}

export type PresetCode = keyof typeof text.content.profilePresets;

export interface ProfilePreset {
  code: PresetCode;
  name: string;
  profile: Omit<RifleProfile, 'id' | 'name'>;
}

const ASM_AIR_DENSITY_LB_PER_FT3 = 0.0751;
const ICAO_AIR_DENSITY_LB_PER_FT3 = 0.0765;
export const BC_ASM_TO_ICAO = ASM_AIR_DENSITY_LB_PER_FT3 / ICAO_AIR_DENSITY_LB_PER_FT3;

const GROUP_SPREAD_PER_SIGMA = 3.08;
export const MIN_STABILITY = 1.4;
const MILLER_REFERENCE_FPS = 2800;
const GRAINS_PER_GRAM = 15.4323584;
const FEET_PER_METRE = 3.2808399;
const MM_PER_INCH = 25.4;
const NAME_MAX_LENGTH = 40;
const FREE_PROFILE_LIMIT = 1;
const ELEVATION_TRAVEL_MIL = 30;
const WINDAGE_TRAVEL_MIL = 10;

const LIMITS = {
  muzzleVelocityMps: [300, 1300],
  muzzleVelocitySdMps: [0, 30],
  massG: [1, 60],
  bulletDiameterIn: [0.17, 0.51],
  bulletLengthMm: [10, 60],
  zeroM: [25, 300],
  sightHeightCm: [2, 10],
  twistInchesPerTurn: [6, 16],
  groupMoa: [0.2, 5],
  coldBoreShiftMil: [-1, 1],
  magnification: [1, 40],
} as const satisfies Partial<Record<ProfileField, readonly [number, number]>>;
const BC_LIMITS: Record<DragModel, readonly [number, number]> = { G7: [0.1, 0.5], G1: [0.2, 1] };
const CLICK_VALUES: Record<ScopeUnits, readonly number[]> = { MIL: [0.05, 0.1, 0.2], MOA: [0.125, 0.25, 0.5] };

const PRESET_RIFLE = { sightHeightCm: 5, zeroM: 100, twistDirection: 'right', groupMoa: 0.75 } as const;
const PRESET_SCOPE: RifleProfile['scope'] = { units: 'MIL', clickValue: 0.1, isFirstFocalPlane: true, magnificationMin: 5, magnificationMax: 25, reticle: 'tree' };
const PRESET_SD_MPS = 5;

function preset(code: PresetCode, twistInchesPerTurn: number, cartridge: Omit<RifleProfile['cartridge'], 'muzzleVelocitySdMps' | 'dragModel'>): ProfilePreset {
  return {
    code,
    name: text.content.profilePresets[code],
    profile: {
      rifle: { ...PRESET_RIFLE, twistInchesPerTurn },
      cartridge: { ...cartridge, muzzleVelocitySdMps: PRESET_SD_MPS, dragModel: 'G7' },
      scope: PRESET_SCOPE,
    },
  };
}

export const PROFILE_PRESETS: readonly ProfilePreset[] = [
  preset('223-77', 8, { muzzleVelocityMps: 838.2, ballisticCoefficient: 0.19, bcAtmosphere: 'icao', massG: 4.989516, bulletDiameterIn: 0.224, bulletLengthMm: 25.273 }),
  preset('65-140', 8, { muzzleVelocityMps: 826.008, ballisticCoefficient: 0.326, bcAtmosphere: 'icao', massG: 9.071847, bulletDiameterIn: 0.264, bulletLengthMm: 34.6964 }),
  preset('308-175', 10, { muzzleVelocityMps: 792.48, ballisticCoefficient: 0.243, bcAtmosphere: 'icao', massG: 11.339809, bulletDiameterIn: 0.308, bulletLengthMm: 31.496 }),
  preset('338-300', 10, { muzzleVelocityMps: 838.2, ballisticCoefficient: 0.383, bcAtmosphere: 'icao', massG: 19.439673, bulletDiameterIn: 0.338, bulletLengthMm: 43.18 }),
  preset('6-105', 8, { muzzleVelocityMps: 899.16, ballisticCoefficient: 0.275, bcAtmosphere: 'asm', massG: 6.80389, bulletDiameterIn: 0.243, bulletLengthMm: 30.48 }),
  preset('300-215', 10, { muzzleVelocityMps: 868.68, ballisticCoefficient: 0.354, bcAtmosphere: 'asm', massG: 13.93177, bulletDiameterIn: 0.308, bulletLengthMm: 39.37 }),
];

export function profileFromPreset(code: string, id: string, name: string): RifleProfile {
  const template = PROFILE_PRESETS.find(candidate => candidate.code === code);
  if (!template) {
    throw new RangeError(`unknown preset ${code}`);
  }
  return structuredClone({ ...template.profile, id, name });
}

export function millerStability(massG: number, bulletDiameterIn: number, bulletLengthMm: number, twistInchesPerTurn: number, muzzleVelocityMps: number): number {
  const twistCalibers = twistInchesPerTurn / bulletDiameterIn;
  const lengthCalibers = bulletLengthMm / MM_PER_INCH / bulletDiameterIn;
  const velocityFps = muzzleVelocityMps * FEET_PER_METRE;
  return (
    ((30 * massG * GRAINS_PER_GRAM) / (twistCalibers ** 2 * bulletDiameterIn ** 3 * lengthCalibers * (1 + lengthCalibers ** 2))) *
    Math.cbrt(velocityFps / MILLER_REFERENCE_FPS)
  );
}

export function validateProfile(profile: RifleProfile): ProfileIssue[] {
  const { rifle, cartridge, scope } = profile;
  const issues: ProfileIssue[] = [];
  const outside = (value: number, [low, high]: readonly [number, number]): boolean => !(value >= low && value <= high);
  const checkRange = (field: keyof typeof LIMITS, value: number): void => {
    if (outside(value, LIMITS[field])) {
      issues.push({ field, kind: 'error', limits: LIMITS[field] });
    }
  };
  const trimmedName = profile.name.trim();
  if (trimmedName.length === 0 || trimmedName.length > NAME_MAX_LENGTH) {
    issues.push({ field: 'name', kind: 'error' });
  }
  checkRange('muzzleVelocityMps', cartridge.muzzleVelocityMps);
  checkRange('muzzleVelocitySdMps', cartridge.muzzleVelocitySdMps);
  if (outside(cartridge.ballisticCoefficient, BC_LIMITS[cartridge.dragModel])) {
    issues.push({ field: 'ballisticCoefficient', kind: 'error', limits: BC_LIMITS[cartridge.dragModel] });
  }
  checkRange('massG', cartridge.massG);
  checkRange('bulletDiameterIn', cartridge.bulletDiameterIn);
  if (outside(cartridge.bulletLengthMm, LIMITS.bulletLengthMm) || cartridge.bulletLengthMm < cartridge.bulletDiameterIn * MM_PER_INCH) {
    issues.push({ field: 'bulletLengthMm', kind: 'error', limits: LIMITS.bulletLengthMm });
  }
  checkRange('zeroM', rifle.zeroM);
  checkRange('sightHeightCm', rifle.sightHeightCm);
  checkRange('twistInchesPerTurn', rifle.twistInchesPerTurn);
  checkRange('groupMoa', rifle.groupMoa);
  if (rifle.coldBoreShiftMil && [rifle.coldBoreShiftMil.upMil, rifle.coldBoreShiftMil.rightMil].some(value => outside(value, LIMITS.coldBoreShiftMil))) {
    issues.push({ field: 'coldBoreShiftMil', kind: 'error', limits: LIMITS.coldBoreShiftMil });
  }
  if (!CLICK_VALUES[scope.units]?.includes(scope.clickValue)) {
    issues.push({ field: 'clickValue', kind: 'error' });
  }
  if (outside(scope.magnificationMin, LIMITS.magnification) || outside(scope.magnificationMax, LIMITS.magnification) || scope.magnificationMin > scope.magnificationMax) {
    issues.push({ field: 'magnification', kind: 'error', limits: LIMITS.magnification });
  }
  if (issues.length === 0) {
    const stability = millerStability(cartridge.massG, cartridge.bulletDiameterIn, cartridge.bulletLengthMm, rifle.twistInchesPerTurn, cartridge.muzzleVelocityMps);
    if (stability < MIN_STABILITY) {
      issues.push({ field: 'twistInchesPerTurn', kind: 'warning', stability });
    }
  }
  return issues;
}

export function isProfileValid(profile: RifleProfile): boolean {
  return validateProfile(profile).every(issue => issue.kind !== 'error');
}

export function loadoutOf(profile: RifleProfile): Loadout {
  const { rifle, cartridge } = profile;
  return {
    rifle: {
      name: profile.name,
      sightHeightCm: rifle.sightHeightCm,
      zeroM: rifle.zeroM,
      groupSigmaMrad: (rifle.groupMoa * MRAD_PER_MOA) / GROUP_SPREAD_PER_SIGMA,
      coldBoreShiftMil: { upMrad: rifle.coldBoreShiftMil?.upMil ?? 0, rightMrad: rifle.coldBoreShiftMil?.rightMil ?? 0 },
      twistInchesPerTurn: rifle.twistInchesPerTurn,
      twistDirection: rifle.twistDirection,
    },
    cartridge: {
      id: profile.id,
      name: profile.name,
      blurb: '',
      massG: cartridge.massG,
      bulletDiameterIn: cartridge.bulletDiameterIn,
      bulletLengthMm: cartridge.bulletLengthMm,
      dragModel: cartridge.dragModel,
      ballisticCoefficient: cartridge.bcAtmosphere === 'asm' ? cartridge.ballisticCoefficient * BC_ASM_TO_ICAO : cartridge.ballisticCoefficient,
      muzzleVelocityMps: cartridge.muzzleVelocityMps,
      muzzleVelocitySdMps: cartridge.muzzleVelocitySdMps,
    },
  };
}

export function scopeOf(profile: RifleProfile): ScopeModel {
  const { scope } = profile;
  return {
    id: profile.id,
    name: profile.name,
    reticle: scope.reticle,
    magnificationMin: scope.magnificationMin,
    magnificationMax: scope.magnificationMax,
    isFirstFocalPlane: scope.isFirstFocalPlane,
    units: scope.units,
    clickMrad: scope.units === 'MOA' ? scope.clickValue * MRAD_PER_MOA : scope.clickValue,
    elevationTravelMrad: ELEVATION_TRAVEL_MIL,
    windageTravelMrad: WINDAGE_TRAVEL_MIL,
  };
}

export function canAddProfile(profiles: readonly RifleProfile[], isProUnlocked: boolean): boolean {
  return isProUnlocked || profiles.length < FREE_PROFILE_LIMIT;
}

export function knownProfiles(stored: { profiles?: unknown; activeProfileId?: unknown } | undefined): StoredProfiles {
  const candidates = Array.isArray(stored?.profiles) ? stored.profiles : [];
  const profiles = candidates.filter(isStoredProfile);
  const activeProfileId = typeof stored?.activeProfileId === 'string' && profiles.some(profile => profile.id === stored.activeProfileId) ? stored.activeProfileId : null;
  return { profiles, activeProfileId };
}

function isStoredProfile(candidate: unknown): candidate is RifleProfile {
  const profile = candidate as RifleProfile;
  if (typeof profile?.id !== 'string' || typeof profile.name !== 'string' || !profile.rifle || !profile.cartridge || !profile.scope) {
    return false;
  }
  try {
    return isProfileValid(profile);
  } catch {
    return false;
  }
}
