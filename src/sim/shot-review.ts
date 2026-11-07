import { RIFLE } from '../core/content';
import { roundToClicks } from '../core/game-formulas';
import { Correction } from '../core/types';

export type ShotDiagnosis = 'clean' | 'data' | 'execution';
export type GroupShape = 'scattered' | 'vertical-string' | 'horizontal-string' | 'low-right' | 'offset' | 'tight';

export interface TurretCorrection {
  upClicks: number;
  rightClicks: number;
}

export interface GroupAnalysis {
  center: Correction;
  spreadMil: { up: number; right: number };
  shape: GroupShape;
}

const CALL_TOLERANCE_MIL = 0.2;
const DISTANCE_EPSILON_MIL = 1e-9;
const MIN_GROUP_SHOTS = 3;
const SCATTERED_SPREADS = 4;
const STRING_SPREADS = 2;
const STRING_AXIS_RATIO = 2;
const OFFSET_MIL = 0.2;
const ORIGIN: Correction = { upMrad: 0, rightMrad: 0 };

export function isCallAccurate(playerCall: Correction, actualCall: Correction): boolean {
  return distanceMil(playerCall, actualCall) <= CALL_TOLERANCE_MIL + DISTANCE_EPSILON_MIL;
}

/**
 * `call` — точка сетки в момент выстрела относительно центра цели (`FireOutcome.hold`),
 * `impact` — попадание (`ShotResult.impact`); оба в MIL, вверх и вправо — плюс.
 * Сетка ушла с цели дальше допуска — виновато выполнение, иначе данные (FM 23-10 гл. 3).
 */
export function diagnoseShot(call: Correction, isHit: boolean): ShotDiagnosis {
  if (distanceMil(call, ORIGIN) > CALL_TOLERANCE_MIL + DISTANCE_EPSILON_MIL) {
    return 'execution';
  }
  return isHit ? 'clean' : 'data';
}

export function secondShotCorrection(call: Correction, impact: Correction, clickMil: number, diagnosis: ShotDiagnosis): TurretCorrection {
  if (diagnosis === 'execution') {
    return { upClicks: 0, rightClicks: 0 };
  }
  return {
    upClicks: roundToClicks(call.upMrad - impact.upMrad, clickMil),
    rightClicks: roundToClicks(call.rightMrad - impact.rightMrad, clickMil),
  };
}

export function dopeNoteElevationMil(dialUpMil: number, call: Correction, impact: Correction, diagnosis: ShotDiagnosis): number | null {
  if (diagnosis === 'execution') {
    return null;
  }
  return dialUpMil + (call.upMrad - impact.upMrad);
}

export function analyseGroup(impacts: readonly Correction[]): GroupAnalysis | null {
  if (impacts.length < MIN_GROUP_SHOTS) {
    return null;
  }
  const center: Correction = { upMrad: mean(impacts.map(impact => impact.upMrad)), rightMrad: mean(impacts.map(impact => impact.rightMrad)) };
  const spreadMil = {
    up: standardDeviation(impacts.map(impact => impact.upMrad)),
    right: standardDeviation(impacts.map(impact => impact.rightMrad)),
  };
  return { center, spreadMil, shape: groupShape(center, spreadMil) };
}

function groupShape(center: Correction, spreadMil: { up: number; right: number }): GroupShape {
  const rifleSpreadMil = RIFLE.groupSigmaMrad;
  if (Math.max(spreadMil.up, spreadMil.right) > SCATTERED_SPREADS * rifleSpreadMil) {
    return 'scattered';
  }
  if (spreadMil.up >= STRING_AXIS_RATIO * spreadMil.right && spreadMil.up > STRING_SPREADS * rifleSpreadMil) {
    return 'vertical-string';
  }
  if (spreadMil.right >= STRING_AXIS_RATIO * spreadMil.up && spreadMil.right > STRING_SPREADS * rifleSpreadMil) {
    return 'horizontal-string';
  }
  if (center.upMrad < -OFFSET_MIL && center.rightMrad > OFFSET_MIL) {
    return 'low-right';
  }
  return distanceMil(center, ORIGIN) > OFFSET_MIL ? 'offset' : 'tight';
}

function distanceMil(from: Correction, to: Correction): number {
  return Math.hypot(from.upMrad - to.upMrad, from.rightMrad - to.rightMrad);
}

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
}
