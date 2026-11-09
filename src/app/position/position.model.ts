import { BOLT_STEP_TRAVEL_PT, BOLT_STEPS, BoltStep } from '../../sim/bolt';
import { PositionTask } from '../../sim/course';
import { Vector2 } from '../../sim/noise';
import { NotebookTotal } from '../../sim/notebook';
import { formatScopeValue, isHoldoverSettled, ScopeModel } from '../../sim/scope-model';
import { BREATH_HOLD_MAX_S, BreathState } from '../../sim/sway';
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

export interface Playability {
  isPlayable: boolean;
  reason: string | null;
}

type PositionFeature = 'intro' | 'pressure-trigger' | 'notebook-input' | 'manual-calc' | 'zone-flags' | 'moving-targets';

// Что из позиции уже сделано; список растёт с A7 (вводное), A9 (сцена) и уходит, когда играбельно всё.
const IMPLEMENTED_FEATURES: ReadonlySet<PositionFeature> = new Set<PositionFeature>(['pressure-trigger', 'notebook-input', 'manual-calc']);
const FEATURE_NAMES: Record<PositionFeature, string> = {
  intro: 'вводное',
  'pressure-trigger': 'спуск с давлением',
  'notebook-input': 'блокнот',
  'manual-calc': 'расчёт САМ',
  'zone-flags': 'флажки по трассе',
  'moving-targets': 'движущиеся цели',
};
const PERCENT = 100;
const FINGER_TO_MARKER = 1.5;
const BOLT_TRACK_HOME: Vector2 = { x: 300, y: 110 };
const BOLT_STEP_LABELS: Record<BoltStep, string> = { up: '1 ↑', back: '2 ← НАЗАД', forward: '3 → ВПЕРЁД', down: '4 ↓' };

export interface BreathRing {
  share: number;
  secondsText: string;
  isCooldown: boolean;
}

export interface BoltStepView {
  label: string;
  isCurrent: boolean;
  isDone: boolean;
}

export function correctionCells(scope: ScopeModel, dial: DialClicks, total: NotebookTotal | null, distanceM: number | null): CorrectionCell[] {
  const hasTotal = total !== null && !total.isEmpty;
  const elevationMil = dial.elevation * scope.clickMrad;
  const rightMil = -dial.windageLeft * scope.clickMrad;
  const cells: CorrectionCell[] = [
    axisCell('ВЕРТ', verticalText(scope, elevationMil), hasTotal ? total.elevation.targetClicks : null, dial.elevation, clicks => verticalText(scope, clicks * scope.clickMrad)),
    axisCell('ГОР', horizontalText(scope, rightMil), hasTotal ? total.windageLeft.targetClicks : null, dial.windageLeft, clicks => horizontalText(scope, -clicks * scope.clickMrad)),
    { label: 'ДИСТ', value: distanceM === null ? '—' : `${distanceM} м`, target: null, isOnTarget: true },
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

export function drumCounterText(axis: TurretAxis, progress: TurretProgress | null): string {
  return progress === null ? '' : drumCounter(axis, progress);
}

export function playability(def: PositionTask): Playability {
  const missing = requiredFeatures(def).filter(feature => !IMPLEMENTED_FEATURES.has(feature));
  return missing.length === 0 ? { isPlayable: true, reason: null } : { isPlayable: false, reason: `откроется позже: ${missing.map(feature => FEATURE_NAMES[feature]).join(', ')}` };
}

function requiredFeatures(def: PositionTask): PositionFeature[] {
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
  if (def.notebookMode === 'manual-easy' || def.notebookMode === 'manual-hard') {
    features.push('manual-calc');
  }
  if (def.conditions.isWindUniform === false) {
    features.push('zone-flags');
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

export function pressureText(pressure: number): string {
  return `${Math.round(pressure * PERCENT)} %`;
}

export function markerTarget(fingerOffsetPt: Vector2): Vector2 {
  return { x: fingerOffsetPt.x * FINGER_TO_MARKER, y: fingerOffsetPt.y * FINGER_TO_MARKER };
}

export function breathRing(state: BreathState, heldS: number): BreathRing {
  if (state === 'cooldown') {
    return { share: 0, secondsText: '', isCooldown: true };
  }
  if (state === 'free') {
    return { share: 0, secondsText: '', isCooldown: false };
  }
  const leftS = Math.max(0, BREATH_HOLD_MAX_S - heldS);
  return { share: leftS / BREATH_HOLD_MAX_S, secondsText: `${leftS.toFixed(1)} с`, isCooldown: false };
}

export function boltSteps(current: BoltStep): BoltStepView[] {
  const currentIndex = BOLT_STEPS.indexOf(current);
  return BOLT_STEPS.map((step, index) => ({ label: BOLT_STEP_LABELS[step], isCurrent: index === currentIndex, isDone: index < currentIndex }));
}

export function boltHeader(current: BoltStep): string {
  return `Затвор · шаг ${BOLT_STEPS.indexOf(current) + 1} из ${BOLT_STEPS.length}`;
}

// Г-дорожка в единицах хода затвора: от дома вверх, назад (на экране — влево), вперёд и вниз домой.
export function boltHandlePosition(step: BoltStep, progress: number): Vector2 {
  const raisedY = BOLT_TRACK_HOME.y - BOLT_STEP_TRAVEL_PT.up;
  const backX = BOLT_TRACK_HOME.x - BOLT_STEP_TRAVEL_PT.back;
  switch (step) {
    case 'up':
      return { x: BOLT_TRACK_HOME.x, y: BOLT_TRACK_HOME.y - BOLT_STEP_TRAVEL_PT.up * progress };
    case 'back':
      return { x: BOLT_TRACK_HOME.x - BOLT_STEP_TRAVEL_PT.back * progress, y: raisedY };
    case 'forward':
      return { x: backX + BOLT_STEP_TRAVEL_PT.forward * progress, y: raisedY };
    case 'down':
      return { x: BOLT_TRACK_HOME.x, y: raisedY + BOLT_STEP_TRAVEL_PT.down * progress };
  }
}
