import { DragModel, TwistDirection } from '../../core/types';
import { fromInput, Quantity, toDisplay, UnitSystem } from '../../core/units';
import { text } from '../../i18n';
import { decimal } from '../../i18n/format';
import { BcAtmosphere, EstimatedField, isProfileValid, MIN_STABILITY, ProfileField, RifleProfile, validateProfile } from '../../sim/rifle-profile';
import { MRAD_PER_MOA, ReticleKind, ScopeUnits } from '../../sim/scope-model';

export interface RifleForm {
  name: string;
  zero: number;
  sightHeight: number;
  twistInches: number;
  twistDirection: TwistDirection;
  groupMoa: number;
  muzzleVelocity: number;
  dragModel: DragModel;
  ballisticCoefficient: number;
  bulletMass: number;
  caliberInches: number;
  bulletLength: number;
  scopeUnits: ScopeUnits;
  clickValue: number;
  isFirstFocalPlane: boolean;
  magnificationMin: number;
  magnificationMax: number;
  reticle: ReticleKind;
  muzzleVelocitySd: number;
  bcAtmosphere: BcAtmosphere;
  coldBoreUp: number | null;
  coldBoreRight: number | null;
}

export type FormField = keyof RifleForm;
export type FieldMessages = Partial<Record<FormField, string>>;

interface MeasuredField {
  quantity: Quantity;
  read: (profile: RifleProfile) => number;
  baseScale: number;
}

const T = text.rifle;
const ESTIMATE_FORM_FIELDS: Record<EstimatedField, FormField> = { muzzleVelocityMps: 'muzzleVelocity', muzzleVelocitySdMps: 'muzzleVelocitySd', groupMoa: 'groupMoa' };
const MM_PER_CM = 10;
const COLD_BORE_DIGITS = 2;

const MEASURED: Record<'zero' | 'sightHeight' | 'muzzleVelocity' | 'muzzleVelocitySd' | 'bulletMass' | 'bulletLength', MeasuredField> = {
  zero: { quantity: 'distance', read: profile => profile.rifle.zeroM, baseScale: 1 },
  sightHeight: { quantity: 'sightHeight', read: profile => profile.rifle.sightHeightCm, baseScale: MM_PER_CM },
  muzzleVelocity: { quantity: 'muzzleVelocity', read: profile => profile.cartridge.muzzleVelocityMps, baseScale: 1 },
  muzzleVelocitySd: { quantity: 'muzzleVelocity', read: profile => profile.cartridge.muzzleVelocitySdMps, baseScale: 1 },
  bulletMass: { quantity: 'bulletMass', read: profile => profile.cartridge.massG, baseScale: 1 },
  bulletLength: { quantity: 'bulletLength', read: profile => profile.cartridge.bulletLengthMm, baseScale: 1 },
};
type MeasuredKey = keyof typeof MEASURED;

const ISSUE_FIELDS: Record<ProfileField, { field: FormField; measured?: MeasuredKey; unit?: string }> = {
  name: { field: 'name' },
  muzzleVelocityMps: { field: 'muzzleVelocity', measured: 'muzzleVelocity' },
  muzzleVelocitySdMps: { field: 'muzzleVelocitySd', measured: 'muzzleVelocitySd' },
  ballisticCoefficient: { field: 'ballisticCoefficient', unit: '' },
  massG: { field: 'bulletMass', measured: 'bulletMass' },
  bulletDiameterIn: { field: 'caliberInches', unit: '″' },
  bulletLengthMm: { field: 'bulletLength', measured: 'bulletLength' },
  zeroM: { field: 'zero', measured: 'zero' },
  sightHeightCm: { field: 'sightHeight', measured: 'sightHeight' },
  twistInchesPerTurn: { field: 'twistInches', unit: '″' },
  groupMoa: { field: 'groupMoa', unit: ' MOA' },
  coldBoreShiftMil: { field: 'coldBoreUp' },
  clickValue: { field: 'clickValue' },
  magnification: { field: 'magnificationMin', unit: '×' },
};

function displayed(key: MeasuredKey, baseValue: number, system: UnitSystem): number {
  const measured = MEASURED[key];
  return toDisplay(measured.quantity, baseValue * measured.baseScale, system);
}

function stored(key: MeasuredKey, displayValue: number, system: UnitSystem): number {
  const measured = MEASURED[key];
  return fromInput(measured.quantity, displayValue, system) / measured.baseScale;
}

function milToScope(mil: number, units: ScopeUnits): number {
  return Number((units === 'MOA' ? mil / MRAD_PER_MOA : mil).toFixed(COLD_BORE_DIGITS));
}

function scopeToMil(value: number, units: ScopeUnits): number {
  return units === 'MOA' ? value * MRAD_PER_MOA : value;
}

export function formOf(profile: RifleProfile, system: UnitSystem): RifleForm {
  const { rifle, cartridge, scope } = profile;
  const measured = (key: MeasuredKey): number => displayed(key, MEASURED[key].read(profile), system);
  return {
    name: profile.name,
    zero: measured('zero'),
    sightHeight: measured('sightHeight'),
    twistInches: rifle.twistInchesPerTurn,
    twistDirection: rifle.twistDirection,
    groupMoa: rifle.groupMoa,
    muzzleVelocity: measured('muzzleVelocity'),
    dragModel: cartridge.dragModel,
    ballisticCoefficient: cartridge.ballisticCoefficient,
    bulletMass: measured('bulletMass'),
    caliberInches: cartridge.bulletDiameterIn,
    bulletLength: measured('bulletLength'),
    scopeUnits: scope.units,
    clickValue: scope.clickValue,
    isFirstFocalPlane: scope.isFirstFocalPlane,
    magnificationMin: scope.magnificationMin,
    magnificationMax: scope.magnificationMax,
    reticle: scope.reticle,
    muzzleVelocitySd: measured('muzzleVelocitySd'),
    bcAtmosphere: cartridge.bcAtmosphere,
    coldBoreUp: rifle.coldBoreShiftMil ? milToScope(rifle.coldBoreShiftMil.upMil, scope.units) : null,
    coldBoreRight: rifle.coldBoreShiftMil ? milToScope(rifle.coldBoreShiftMil.rightMil, scope.units) : null,
  };
}

export function profileOf(form: RifleForm, base: RifleProfile, system: UnitSystem): RifleProfile {
  const before = formOf(base, system);
  const measured = (key: MeasuredKey): number => (form[key] === before[key] ? MEASURED[key].read(base) : stored(key, form[key], system));
  const isColdBoreSet = form.coldBoreUp !== null || form.coldBoreRight !== null;
  const isColdBoreKept = form.coldBoreUp === before.coldBoreUp && form.coldBoreRight === before.coldBoreRight && form.scopeUnits === before.scopeUnits;
  const coldBoreShiftMil = isColdBoreKept
    ? base.rifle.coldBoreShiftMil
    : isColdBoreSet
      ? { upMil: scopeToMil(form.coldBoreUp ?? 0, form.scopeUnits), rightMil: scopeToMil(form.coldBoreRight ?? 0, form.scopeUnits) }
      : undefined;
  const estimates = (base.estimates ?? []).filter(field => form[ESTIMATE_FORM_FIELDS[field]] === before[ESTIMATE_FORM_FIELDS[field]]);
  return {
    id: base.id,
    name: form.name,
    ...(estimates.length > 0 ? { estimates } : {}),
    rifle: {
      sightHeightCm: measured('sightHeight'),
      zeroM: measured('zero'),
      twistInchesPerTurn: form.twistInches,
      twistDirection: form.twistDirection,
      groupMoa: form.groupMoa,
      ...(coldBoreShiftMil ? { coldBoreShiftMil } : {}),
    },
    cartridge: {
      muzzleVelocityMps: measured('muzzleVelocity'),
      muzzleVelocitySdMps: measured('muzzleVelocitySd'),
      dragModel: form.dragModel,
      ballisticCoefficient: form.ballisticCoefficient,
      bcAtmosphere: form.bcAtmosphere,
      massG: measured('bulletMass'),
      bulletDiameterIn: form.caliberInches,
      bulletLengthMm: measured('bulletLength'),
    },
    scope: {
      units: form.scopeUnits,
      clickValue: form.clickValue,
      isFirstFocalPlane: form.isFirstFocalPlane,
      magnificationMin: form.magnificationMin,
      magnificationMax: form.magnificationMax,
      reticle: form.reticle,
    },
  };
}

export function fieldMessages(profile: RifleProfile, system: UnitSystem): FieldMessages {
  const messages: FieldMessages = {};
  for (const issue of validateProfile(profile)) {
    if (issue.kind !== 'error') {
      continue;
    }
    if (issue.field === 'magnification') {
      Object.assign(messages, magnificationMessage(profile, issue.limits!));
      continue;
    }
    const target = ISSUE_FIELDS[issue.field];
    messages[target.field] = issueText(issue.field, issue.limits, profile, system);
  }
  for (const field of profile.estimates ?? []) {
    messages[ESTIMATE_FORM_FIELDS[field]] ??= T.messages.estimate;
  }
  return messages;
}

function issueText(field: ProfileField, limits: readonly [number, number] | undefined, profile: RifleProfile, system: UnitSystem): string {
  if (field === 'name') {
    return T.messages.name;
  }
  if (!limits) {
    return T.messages.clickValue;
  }
  const target = ISSUE_FIELDS[field];
  const [low, high] = limits;
  if (target.measured) {
    const quantity = MEASURED[target.measured].quantity;
    const scale = MEASURED[target.measured].baseScale;
    const range = T.messages.range({ low: decimal(displayed(target.measured, low, system)), high: text.units.quantityText(quantity, high * scale, system), unit: '' });
    return field === 'bulletLengthMm' ? range + T.messages.bulletLengthSuffix : range;
  }
  if (field === 'coldBoreShiftMil') {
    const units = profile.scope.units;
    return T.messages.range({ low: decimal(milToScope(low, units)), high: decimal(milToScope(high, units)), unit: ` ${units}` });
  }
  return T.messages.range({ low: decimal(low), high: decimal(high), unit: target.unit ?? '' });
}

function magnificationMessage(profile: RifleProfile, [low, high]: readonly [number, number]): FieldMessages {
  const { magnificationMin, magnificationMax } = profile.scope;
  const range = T.messages.range({ low: decimal(low), high: decimal(high), unit: '×' });
  if (!(magnificationMin >= low && magnificationMin <= high)) {
    return { magnificationMin: range };
  }
  if (!(magnificationMax >= low && magnificationMax <= high)) {
    return { magnificationMax: range };
  }
  return { magnificationMax: T.messages.magnificationOrder({ range }) };
}

export function stabilityMessage(profile: RifleProfile): string | null {
  const warning = validateProfile(profile).find(issue => issue.kind === 'warning');
  return warning && 'stability' in warning ? T.messages.stability({ stability: warning.stability, minimum: MIN_STABILITY }) : null;
}

export function isSaveAllowed(profile: RifleProfile): boolean {
  return isProfileValid(profile);
}

export function isDirty(form: RifleForm, saved: RifleProfile, system: UnitSystem): boolean {
  const before = formOf(saved, system);
  return (Object.keys(before) as FormField[]).some(field => before[field] !== form[field]);
}
