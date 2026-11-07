import { roundToClicks } from '../core/game-formulas';
import { Turret } from './scope-model';

export type TurnDirection = 'up' | 'down' | 'none';

export interface TurretTarget {
  targetClicks: number;
  holdMil: number;
}

export interface TurretProgress {
  remainingClicks: number;
  direction: TurnDirection;
  isOnTarget: boolean;
  overshootClicks: number;
}

export function turretTarget(turret: Turret, targetMil: number, clickMil: number): TurretTarget {
  const wantedClicks = roundToClicks(targetMil, clickMil);
  const targetClicks = Math.min(turret.maxClicks, Math.max(turret.minClicks, wantedClicks));
  return { targetClicks, holdMil: targetMil - targetClicks * clickMil };
}

export function turretProgress(startClicks: number, currentClicks: number, targetClicks: number): TurretProgress {
  const clicksToTarget = targetClicks - currentClicks;
  const startSide = Math.sign(targetClicks - startClicks);
  const isPastTarget = Math.sign(clicksToTarget) === -startSide;
  return {
    remainingClicks: Math.abs(clicksToTarget),
    direction: clicksToTarget > 0 ? 'up' : clicksToTarget < 0 ? 'down' : 'none',
    isOnTarget: clicksToTarget === 0,
    overshootClicks: isPastTarget ? Math.abs(clicksToTarget) : 0,
  };
}
