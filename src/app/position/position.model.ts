import { ExerciseDef, ExerciseResult } from '../../sim/course';
import { NotebookTotal } from '../../sim/notebook';
import { formatScopeValue, isHoldoverSettled, ScopeModel } from '../../sim/scope-model';
import { TurretProgress } from '../../sim/turret-target';

export type TurretAxis = 'elevation' | 'windage';

export interface CorrectionCell {
  label: 'ВЕРТ' | 'ГОР' | 'ДИСТ' | 'УДЕРЖ.';
  value: string;
  target: string | null;
  isOnTarget: boolean;
}

export interface DialClicks {
  elevation: number;
  windageLeft: number;
}

export interface EndCard {
  heading: string;
  points: string;
  share: string;
  isAdmitted: boolean;
}

export interface Playability {
  isPlayable: boolean;
  reason: string | null;
}

type PositionFeature = 'intro' | 'pressure-trigger' | 'notebook-input' | 'moving-targets';

// Что из позиции уже сделано; список растёт с A3.2 (спуск), A5 (блокнот), A7 (вводное), A9 (сцена) и уходит, когда играбельно всё.
const IMPLEMENTED_FEATURES: ReadonlySet<PositionFeature> = new Set<PositionFeature>();
const FEATURE_NAMES: Record<PositionFeature, string> = {
  intro: 'вводное',
  'pressure-trigger': 'спуск с давлением',
  'notebook-input': 'блокнот',
  'moving-targets': 'движущиеся цели',
};
const PERCENT = 100;

export function correctionCells(scope: ScopeModel, dial: DialClicks, total: NotebookTotal | null, distanceM: number): CorrectionCell[] {
  const hasTotal = total !== null && !total.isEmpty;
  const elevationMil = dial.elevation * scope.clickMrad;
  const rightMil = -dial.windageLeft * scope.clickMrad;
  const cells: CorrectionCell[] = [
    axisCell('ВЕРТ', verticalText(scope, elevationMil), hasTotal ? total.elevation.targetClicks : null, dial.elevation, clicks => verticalText(scope, clicks * scope.clickMrad)),
    axisCell('ГОР', horizontalText(scope, rightMil), hasTotal ? total.windageLeft.targetClicks : null, dial.windageLeft, clicks => horizontalText(scope, -clicks * scope.clickMrad)),
    { label: 'ДИСТ', value: `${distanceM} м`, target: null, isOnTarget: true },
  ];
  if (hasTotal && (!isHoldoverSettled(scope, total.holdUpMil) || !isHoldoverSettled(scope, total.holdRightMil))) {
    cells.push({ label: 'УДЕРЖ.', value: `${verticalText(scope, total.holdUpMil)} · ${horizontalText(scope, total.holdRightMil)}`, target: null, isOnTarget: true });
  }
  return cells;
}

export function drumCounter(axis: TurretAxis, progress: TurretProgress): string {
  if (progress.isOnTarget) {
    return '';
  }
  if (progress.overshootClicks > 0) {
    return `лишние ${progress.overshootClicks} кл.`;
  }
  const arrows: Record<TurretAxis, { up: string; down: string }> = { elevation: { up: '↑', down: '↓' }, windage: { up: '←', down: '→' } };
  const arrow = progress.direction === 'none' ? '' : ` ${arrows[axis][progress.direction]}`;
  return `ещё ${progress.remainingClicks} кл.${arrow}`;
}

export function endCard(result: ExerciseResult): EndCard {
  return {
    heading: result.isAdmitted ? `Класс ${result.exerciseClass}` : 'Не зачтено',
    points: `${result.total} очк.`,
    share: `${Math.round(result.hitShare * PERCENT)} %`,
    isAdmitted: result.isAdmitted,
  };
}

export function playability(def: ExerciseDef): Playability {
  const missing = requiredFeatures(def).filter(feature => !IMPLEMENTED_FEATURES.has(feature));
  return missing.length === 0 ? { isPlayable: true, reason: null } : { isPlayable: false, reason: `откроется позже: ${missing.map(feature => FEATURE_NAMES[feature]).join(', ')}` };
}

function requiredFeatures(def: ExerciseDef): PositionFeature[] {
  if (!def.targets) {
    return ['intro'];
  }
  const features: PositionFeature[] = [];
  if (def.trigger === 'pressure') {
    features.push('pressure-trigger');
  }
  if (def.conditions.windScale !== 0) {
    features.push('notebook-input');
  }
  if (def.hasPatrol) {
    features.push('moving-targets');
  }
  return features;
}

function axisCell(label: 'ВЕРТ' | 'ГОР', value: string, targetClicks: number | null, dialClicks: number, format: (clicks: number) => string): CorrectionCell {
  if (targetClicks === null) {
    return { label, value, target: '—', isOnTarget: false };
  }
  const isOnTarget = dialClicks === targetClicks;
  return { label, value, target: isOnTarget ? null : format(targetClicks), isOnTarget };
}

function verticalText(scope: ScopeModel, upMil: number): string {
  return `${upMil < 0 ? '↓' : '↑'} ${formatScopeValue(scope, Math.abs(upMil))}`;
}

function horizontalText(scope: ScopeModel, rightMil: number): string {
  const value = formatScopeValue(scope, Math.abs(rightMil));
  if (Number(value) === 0) {
    return value;
  }
  return rightMil < 0 ? `← ${value} L` : `→ ${value} R`;
}
