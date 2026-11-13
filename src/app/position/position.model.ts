import { BOLT_STEP_TRAVEL_PT, BOLT_STEPS, BoltStep } from '../../sim/bolt';
import { text } from '../../i18n';
import { Vector2 } from '../../sim/noise';
import { NotebookTotal } from '../../sim/notebook';
import { formatScopeValue, isHoldoverSettled, ScopeModel } from '../../sim/scope-model';
import { BREATH_HOLD_MAX_S, BreathState } from '../../sim/sway';
import { movementClockAt, PatrolTarget } from '../../sim/patrol';
import { TurretProgress } from '../../sim/turret-target';
import { flagCrosswindText } from '../notebook/notebook.model';
import { FlagReading } from '../scene/scene.model';

export type TurretAxis = 'elevation' | 'windage';
export type CorrectionCellKey = TurretAxis | 'distance' | 'holdover';

export interface CorrectionCell {
  label: string;
  value: string;
  target: string | null;
  isOnTarget: boolean;
}

export interface DialClicks {
  elevation: number;
  windageLeft: number;
}

const PERCENT = 100;
const CROSSWISE_CLOCK = 3;
const HALF_TURN_CLOCK = 6;
const TAP_MAX_TRAVEL_PT = 10;
const TAP_MAX_DURATION_MS = 300;
const FINGER_TO_MARKER = 1.5;
const BOLT_TRACK_HOME: Vector2 = { x: 300, y: 110 };
const T = text.position;

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
    axisCell('elevation', verticalText(scope, elevationMil), hasTotal ? total.elevation.targetClicks : null, dial.elevation, clicks => verticalText(scope, clicks * scope.clickMrad)),
    axisCell('windage', horizontalText(scope, rightMil), hasTotal ? total.windageLeft.targetClicks : null, dial.windageLeft, clicks => horizontalText(scope, -clicks * scope.clickMrad)),
    { label: T.cells.labels.distance, value: distanceM === null ? '—' : T.cells.distance({ distanceM }), target: null, isOnTarget: true },
  ];
  const holdRightMil = hasTotal ? total.holdRightMil + total.leadMil : 0;
  if (hasTotal && (!isHoldoverSettled(scope, total.holdUpMil) || !isHoldoverSettled(scope, holdRightMil))) {
    cells.push({ label: T.cells.labels.holdover, value: `${verticalText(scope, total.holdUpMil)} · ${horizontalText(scope, holdRightMil)}`, target: null, isOnTarget: true });
  }
  return cells;
}

export function drumCounter(axis: TurretAxis, progress: TurretProgress): string {
  if (progress.isOnTarget) {
    return '';
  }
  if (progress.overshootClicks > 0) {
    return T.drum.overshoot({ clicks: progress.overshootClicks });
  }
  const arrows: Record<TurretAxis, { up: string; down: string }> = { elevation: { up: '↑', down: '↓' }, windage: { up: '←', down: '→' } };
  const arrow = progress.direction === 'none' ? '' : ` ${arrows[axis][progress.direction]}`;
  return T.drum.remaining({ clicks: progress.remainingClicks, arrow });
}

export function drumCounterText(axis: TurretAxis, progress: TurretProgress | null): string {
  return progress === null ? '' : drumCounter(axis, progress);
}

function axisCell(axis: TurretAxis, value: string, targetClicks: number | null, dialClicks: number, format: (clicks: number) => string): CorrectionCell {
  const label = T.cells.labels[axis];
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
  return { share: leftS / BREATH_HOLD_MAX_S, secondsText: T.breath.seconds({ seconds: leftS }), isCooldown: false };
}

export function boltSteps(current: BoltStep): BoltStepView[] {
  const currentIndex = BOLT_STEPS.indexOf(current);
  return BOLT_STEPS.map((step, index) => ({ label: T.bolt.steps[step], isCurrent: index === currentIndex, isDone: index < currentIndex }));
}

export function boltHeader(current: BoltStep): string {
  return T.bolt.header({ stepNumber: BOLT_STEPS.indexOf(current) + 1, stepCount: BOLT_STEPS.length });
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

export const NOTEBOOK_SHEET_MIN_HEIGHT_PT = 360;

export function notebookSheetTopPt(belowCrosshairPt: number, viewportHeightPt: number): number {
  return Math.min(belowCrosshairPt, viewportHeightPt - NOTEBOOK_SHEET_MIN_HEIGHT_PT);
}

export function isGlassTap(start: Vector2, end: Vector2, durationMs: number): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= TAP_MAX_TRAVEL_PT && durationMs <= TAP_MAX_DURATION_MS;
}

export function flagReadingText(flagDistanceM: number, reading: FlagReading): string {
  return T.flagReading({ flagDistanceM, angleDeg: reading.angleDeg, isAtLimit: reading.isAtLimit, crosswindText: flagCrosswindText(reading.crosswindMps) });
}

export function patrolLineText(patrol: PatrolTarget, walkedS: number): string {
  const clock = movementClockAt(patrol.path, walkedS);
  const isCrosswise = clock % CROSSWISE_CLOCK === 0;
  return T.patrolLine({ speedMps: patrol.path.speedMps, isCrosswise, headingArrow: headingArrow(clock), isAmbush: patrol.isAmbush });
}

function headingArrow(clock: number): string {
  const isMovingRight = clock > 0 && clock < HALF_TURN_CLOCK;
  if (clock % CROSSWISE_CLOCK === 0) {
    return isMovingRight ? '→' : '←';
  }
  const isComingCloser = clock > CROSSWISE_CLOCK && clock < CROSSWISE_CLOCK + HALF_TURN_CLOCK;
  if (isMovingRight) {
    return isComingCloser ? '↘' : '↗';
  }
  return isComingCloser ? '↙' : '↖';
}

