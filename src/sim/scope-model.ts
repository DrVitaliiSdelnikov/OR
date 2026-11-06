export const MRAD_PER_MOA = 0.29089;
export const MILS_PER_DRUM_TURN = 10;
export const EYEPIECE_RADIUS_PT = 138;
export const PT_PER_MIL_PER_MAGNIFICATION = 3.4;
export const DRUM_DRAG_PT_PER_CLICK = 9;

export type ScopeId = 'tree' | 'moa' | 'dot' | 'fine';
export type ScopeUnits = 'MIL' | 'MOA';

export interface ScopeModel {
  id: ScopeId;
  name: string;
  magnificationMin: number;
  magnificationMax: number;
  isFirstFocalPlane: boolean;
  units: ScopeUnits;
  clickMrad: number;
  elevationTravelMrad: number;
  windageTravelMrad: number;
}

export const SCOPES: readonly ScopeModel[] = [
  {
    id: 'tree',
    name: 'Ёлка 5–25×',
    magnificationMin: 5,
    magnificationMax: 25,
    isFirstFocalPlane: true,
    units: 'MIL',
    clickMrad: 0.1,
    elevationTravelMrad: 12,
    windageTravelMrad: 4,
  },
  {
    id: 'moa',
    name: 'MOA 6–24×',
    magnificationMin: 6,
    magnificationMax: 24,
    isFirstFocalPlane: true,
    units: 'MOA',
    clickMrad: 0.25 * MRAD_PER_MOA,
    elevationTravelMrad: 30 * MRAD_PER_MOA,
    windageTravelMrad: 12 * MRAD_PER_MOA,
  },
  {
    id: 'dot',
    name: 'Dot 3–12×',
    magnificationMin: 3,
    magnificationMax: 12,
    isFirstFocalPlane: false,
    units: 'MIL',
    clickMrad: 0.1,
    elevationTravelMrad: 6,
    windageTravelMrad: 2,
  },
  {
    id: 'fine',
    name: 'Fine 8–32×',
    magnificationMin: 8,
    magnificationMax: 32,
    isFirstFocalPlane: true,
    units: 'MIL',
    clickMrad: 0.1,
    elevationTravelMrad: 14,
    windageTravelMrad: 5,
  },
];

export function scopeById(id: ScopeId): ScopeModel {
  return SCOPES.find(scope => scope.id === id) ?? SCOPES[0];
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
    private readonly minClicks: number,
    private readonly maxClicks: number,
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
