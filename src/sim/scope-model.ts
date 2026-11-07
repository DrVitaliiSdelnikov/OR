export const MRAD_PER_MOA = 0.29089;
export const MILS_PER_DRUM_TURN = 10;
export const EYEPIECE_RADIUS_PT = 138;
export const PT_PER_MIL_PER_MAGNIFICATION = 3.4;
export const DRUM_DRAG_PT_PER_CLICK = 9;

export type ScopeId = 'course-tree' | 'course-dot' | 'moa' | 'tree' | 'dot';
export type ScopeUnits = 'MIL' | 'MOA';
export type ReticleKind = 'tree' | 'mil-dot' | 'moa-grid';

export interface ScopeModel {
  id: ScopeId;
  name: string;
  reticle: ReticleKind;
  magnificationMin: number;
  magnificationMax: number;
  isFirstFocalPlane: boolean;
  units: ScopeUnits;
  clickMrad: number;
  elevationTravelMrad: number;
  windageTravelMrad: number;
}

export interface FreePlayScopeUnlocks {
  milDotScope: boolean;
  moaScope: boolean;
  longRangeScope: boolean;
  secondFocalPlaneScope: boolean;
}

const COURSE_BODY = {
  magnificationMin: 3,
  magnificationMax: 12,
  isFirstFocalPlane: true,
  units: 'MIL',
  clickMrad: 0.1,
  elevationTravelMrad: 20,
  windageTravelMrad: 6,
} as const;

export const SCOPES: readonly ScopeModel[] = [
  { id: 'course-tree', name: 'Курсовой 3–12× · Ёлка', reticle: 'tree', ...COURSE_BODY },
  { id: 'course-dot', name: 'Курсовой 3–12× · MIL-dot', reticle: 'mil-dot', ...COURSE_BODY },
  {
    id: 'moa',
    name: 'MOA 6–24×',
    reticle: 'moa-grid',
    magnificationMin: 6,
    magnificationMax: 24,
    isFirstFocalPlane: true,
    units: 'MOA',
    clickMrad: 0.25 * MRAD_PER_MOA,
    elevationTravelMrad: 70 * MRAD_PER_MOA,
    windageTravelMrad: 25 * MRAD_PER_MOA,
  },
  {
    id: 'tree',
    name: 'Дальний 5–25× · Ёлка',
    reticle: 'tree',
    magnificationMin: 5,
    magnificationMax: 25,
    isFirstFocalPlane: true,
    units: 'MIL',
    clickMrad: 0.1,
    elevationTravelMrad: 28,
    windageTravelMrad: 10,
  },
  {
    id: 'dot',
    name: 'Старый 3–12× · MIL-dot · 2-я плоскость',
    reticle: 'mil-dot',
    magnificationMin: 3,
    magnificationMax: 12,
    isFirstFocalPlane: false,
    units: 'MIL',
    clickMrad: 0.1,
    elevationTravelMrad: 17,
    windageTravelMrad: 6,
  },
];

const LEGACY_SCOPE_IDS: Readonly<Record<string, ScopeId>> = { fine: 'course-dot' };

export function scopeById(id: string): ScopeModel {
  const knownId = LEGACY_SCOPE_IDS[id] ?? id;
  return SCOPES.find(scope => scope.id === knownId) ?? SCOPES[0];
}

export function freePlayScopes(unlocks: FreePlayScopeUnlocks): ScopeModel[] {
  const isOpen: Record<ScopeId, boolean> = {
    'course-tree': true,
    'course-dot': unlocks.milDotScope,
    moa: unlocks.moaScope,
    tree: unlocks.longRangeScope,
    dot: unlocks.secondFocalPlaneScope,
  };
  return SCOPES.filter(scope => isOpen[scope.id]);
}

export function magnificationStep(scope: ScopeModel): number {
  return scope.magnificationMax > 20 ? 2 : 1;
}

export function defaultMagnification(scope: ScopeModel): number {
  return Math.round((scope.magnificationMin + scope.magnificationMax) / 2);
}

export function stepMagnification(scope: ScopeModel, magnification: number, direction: 1 | -1): number {
  const next = magnification + direction * magnificationStep(scope);
  return Math.min(scope.magnificationMax, Math.max(scope.magnificationMin, next));
}

export function ptPerMil(magnification: number): number {
  return PT_PER_MIL_PER_MAGNIFICATION * magnification;
}

export function fieldOfViewMil(magnification: number): number {
  return (2 * EYEPIECE_RADIUS_PT) / ptPerMil(magnification);
}

export function reticleSubtensionScale(scope: ScopeModel, magnification: number): number {
  return scope.isFirstFocalPlane ? 1 : scope.magnificationMax / magnification;
}

export function clickLimits(scope: ScopeModel): { elevation: number; windage: number } {
  return {
    elevation: Math.floor(scope.elevationTravelMrad / scope.clickMrad + 1e-6),
    windage: Math.floor(scope.windageTravelMrad / scope.clickMrad + 1e-6),
  };
}

export function mradToScopeUnits(scope: ScopeModel, mrad: number): number {
  return scope.units === 'MIL' ? mrad : mrad / MRAD_PER_MOA;
}

export function clicksFor(scope: ScopeModel, mrad: number): number {
  return Math.round(mrad / scope.clickMrad);
}

export function formatScopeValue(scope: ScopeModel, mrad: number): string {
  const value = mradToScopeUnits(scope, mrad);
  return scope.units === 'MIL' ? value.toFixed(1) : value.toFixed(2);
}

export function halfClickMrad(scope: ScopeModel): number {
  return scope.clickMrad / 2;
}

export type TurretStop = 'zero' | 'top' | 'side' | null;

export interface TurretMove {
  appliedClicks: number;
  stop: TurretStop;
}

export class Turret {
  private currentClicks = 0;

  constructor(
    readonly minClicks: number,
    readonly maxClicks: number,
    private readonly lowerStop: TurretStop,
    private readonly upperStop: TurretStop,
  ) {}

  static elevation(scope: ScopeModel): Turret {
    return new Turret(0, clickLimits(scope).elevation, 'zero', 'top');
  }

  static windage(scope: ScopeModel): Turret {
    const limit = clickLimits(scope).windage;
    return new Turret(-limit, limit, 'side', 'side');
  }

  get clicks(): number {
    return this.currentClicks;
  }

  get isAtZeroStop(): boolean {
    return this.lowerStop === 'zero' && this.currentClicks === this.minClicks;
  }

  turn(deltaClicks: number): TurretMove {
    const requested = this.currentClicks + deltaClicks;
    const clamped = Math.min(this.maxClicks, Math.max(this.minClicks, requested));
    const appliedClicks = clamped - this.currentClicks;
    this.currentClicks = clamped;
    if (requested > this.maxClicks) {
      return { appliedClicks, stop: this.upperStop };
    }
    if (requested < this.minClicks) {
      return { appliedClicks, stop: this.lowerStop };
    }
    return { appliedClicks, stop: null };
  }

  reset(): void {
    this.currentClicks = 0;
  }
}

export interface Holdover {
  dialedMrad: number;
  remainderMrad: number;
}

export function splitDialAndHold(scope: ScopeModel, turret: Turret, requiredMrad: number): Holdover {
  const dialedMrad = turret.clicks * scope.clickMrad;
  return { dialedMrad, remainderMrad: requiredMrad - dialedMrad };
}

export function isHoldoverSettled(scope: ScopeModel, remainderMrad: number): boolean {
  return Math.abs(remainderMrad) < halfClickMrad(scope);
}
