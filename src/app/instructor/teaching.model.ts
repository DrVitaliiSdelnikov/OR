import { ExerciseId, FIRST_FIRING_EXERCISE_ID } from '../../sim/course';
import { FactorContribution, NotebookFactor } from '../../sim/notebook';
import { BREATH_HOLD_CALM_S } from '../../sim/sway';
import { FLAG_DISTANCES_M } from '../../core/content';
import { FULL_MEASUREMENT_S } from '../../sim/notebook';
import { DialDirection, text } from '../../i18n';
import { contributionText, FACTOR_NAMES } from '../notebook/notebook.model';
import { InstructorSnapshot } from './instructor-snapshot';

export type TeachingKind = 'action' | 'explain';

export interface TeachingStep {
  id: string;
  kind: TeachingKind;
  anchor: (state: InstructorSnapshot) => string;
  text: (state: InstructorSnapshot) => string;
  isDue: (state: InstructorSnapshot) => boolean;
  isDone: (state: InstructorSnapshot) => boolean;
}

export interface TeachingView {
  id: string;
  kind: TeachingKind;
  anchor: string;
  text: string;
  number: number | null;
  count: number | null;
}

const GUARDED_EXERCISES: readonly ExerciseId[] = ['01', '02', '03'];
const ZEROING_GROUP_LAST_SHOT = 4;
const AIM_TOLERANCE_MIL = 0.3;
const WIND_EXERCISE: ExerciseId = '04';
const T = text.instructor;

const hasFired = (state: InstructorSnapshot): boolean => state.shotsFired > 0;
const isScreenFree = (state: InstructorSnapshot): boolean => state.sheetTab === null && !state.isReviewOpen;
const always = (): boolean => true;
const isSheetOpen = (state: InstructorSnapshot): boolean => state.sheetTab !== null;
const isWindWritten = (state: InstructorSnapshot): boolean => (state.windSpeedMps ?? 0) > 0;
const isRangeMeasured = (state: InstructorSnapshot): boolean => state.reticleMil !== null;
const isWindStepRecorded = (state: InstructorSnapshot): boolean => state.recordedSteps.includes('wind');
const isZonesStepRecorded = (state: InstructorSnapshot): boolean => state.recordedSteps.includes('zones');
const isLeadStepRecorded = (state: InstructorSnapshot): boolean => state.recordedSteps.includes('lead');
const isAnyFlagRead = (state: InstructorSnapshot): boolean => state.flagsRead > 0;
const isFirstReviewClosed = (state: InstructorSnapshot): boolean => state.shotsFired > 1 || (hasFired(state) && !state.isReviewOpen);

function fixed(text: string): () => string {
  return () => text;
}

function dialHint(isUp: boolean, remainingClicks: number, axis: 'vertical' | 'horizontal'): string {
  const verticalDirection: DialDirection = isUp ? 'up' : 'down';
  const horizontalDirection: DialDirection = isUp ? 'right' : 'left';
  return T.dial({ direction: axis === 'vertical' ? verticalDirection : horizontalDirection, clicks: Math.abs(remainingClicks) });
}

function zeroingAxis(state: InstructorSnapshot): 'elevation' | 'windage' {
  const correction = state.lastCorrection ?? { upClicks: 0, rightClicks: 0 };
  return Math.abs(correction.upClicks) >= Math.abs(correction.rightClicks) ? 'elevation' : 'windage';
}

function zeroingRemaining(state: InstructorSnapshot): number {
  const correction = state.lastCorrection ?? { upClicks: 0, rightClicks: 0 };
  return zeroingAxis(state) === 'elevation'
    ? correction.upClicks - state.turnedSinceShot.upClicks
    : correction.rightClicks - state.turnedSinceShot.rightClicks;
}

function hasZeroingCorrection(state: InstructorSnapshot): boolean {
  return state.lastCorrection !== null && (state.lastCorrection.upClicks !== 0 || state.lastCorrection.rightClicks !== 0);
}

function aimStep(text: string): TeachingStep {
  return {
    id: 'aim',
    kind: 'action',
    anchor: fixed('glass'),
    text: fixed(text),
    isDue: isScreenFree,
    isDone: state => state.aimOffMil <= AIM_TOLERANCE_MIL || hasFired(state),
  };
}

function notebookStep(text: string): TeachingStep {
  return {
    id: 'notebook',
    kind: 'action',
    anchor: fixed('tile-notebook'),
    text: fixed(text),
    isDue: isScreenFree,
    isDone: state => state.hasOpenedNotebook || state.isEntered || hasFired(state),
  };
}

const ENTER_STEP: TeachingStep = {
  id: 'enter',
  kind: 'action',
  anchor: fixed('enter-turrets'),
  text: fixed(T.enter),
  isDue: state => state.sheetTab === 'total',
  isDone: state => state.isEntered || hasFired(state),
};

const DRUM_STEP: TeachingStep = {
  id: 'drum',
  kind: 'action',
  anchor: fixed('drum-elevation'),
  text: state => dialHint(state.elevation?.direction !== 'down', state.elevation?.remainingClicks ?? 0, 'vertical'),
  isDue: state => state.isEntered && isScreenFree(state),
  isDone: state => state.elevation?.isOnTarget === true || hasFired(state),
};

const FIRST_CLICKS: readonly TeachingStep[] = [
  { id: 'scope', kind: 'explain', anchor: fixed('glass'), text: state => T.firstClicks.scope({ distanceM: state.targetDistanceM ?? 0 }), isDue: isScreenFree, isDone: hasFired },
  notebookStep(T.firstClicks.notebook),
  {
    id: 'dope',
    kind: 'explain',
    anchor: fixed('factor-dope'),
    text: state => T.firstClicks.dope({ dopeMil: state.dopeMil ?? 0 }),
    isDue: state => state.sheetTab === 'total',
    isDone: state => state.isEntered || hasFired(state),
  },
  ENTER_STEP,
  DRUM_STEP,
  {
    id: 'side-drum',
    kind: 'explain',
    anchor: fixed('drum-windage'),
    text: state => T.firstClicks.sideDrum({ windageClicks: state.windageTargetClicks ?? 0 }),
    isDue: state => state.isEntered && isScreenFree(state),
    isDone: state => (state.windageTargetClicks ?? 0) !== 0 || hasFired(state),
  },
  aimStep(T.firstClicks.aim),
  { id: 'fire', kind: 'action', anchor: fixed('fire-control'), text: fixed(T.firstClicks.fire), isDue: isScreenFree, isDone: hasFired },
  {
    id: 'review',
    kind: 'explain',
    anchor: fixed('review-next'),
    text: fixed(T.firstClicks.review),
    isDue: always,
    isDone: state => (hasFired(state) && !state.isReviewOpen) || state.shotsFired > 1,
  },
];

const ZEROING: readonly TeachingStep[] = [
  { id: 'zero', kind: 'explain', anchor: fixed('glass'), text: state => T.zeroing.zero({ distanceM: state.targetDistanceM ?? 0 }), isDue: isScreenFree, isDone: hasFired },
  aimStep(T.zeroing.aim),
  { id: 'cold', kind: 'action', anchor: fixed('fire-control'), text: fixed(T.zeroing.cold), isDue: isScreenFree, isDone: hasFired },
  {
    id: 'group',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed(T.zeroing.group),
    isDue: state => hasFired(state) && isScreenFree(state),
    isDone: state => state.shotsFired > 1,
  },
  {
    id: 'correction',
    kind: 'explain',
    anchor: fixed('review-correction'),
    text: fixed(T.zeroing.correction),
    isDue: state => state.isReviewOpen && state.shotsFired === ZEROING_GROUP_LAST_SHOT,
    isDone: state => state.shotsFired > ZEROING_GROUP_LAST_SHOT || (state.shotsFired === ZEROING_GROUP_LAST_SHOT && !hasZeroingCorrection(state)),
  },
  {
    id: 'dial',
    kind: 'action',
    anchor: state => (zeroingAxis(state) === 'elevation' ? 'drum-elevation' : 'drum-windage'),
    text: state => dialHint(zeroingRemaining(state) > 0, zeroingRemaining(state), zeroingAxis(state) === 'elevation' ? 'vertical' : 'horizontal'),
    isDue: state => state.shotsFired === ZEROING_GROUP_LAST_SHOT && isScreenFree(state),
    isDone: state => state.shotsFired > ZEROING_GROUP_LAST_SHOT || (state.shotsFired === ZEROING_GROUP_LAST_SHOT && zeroingRemaining(state) === 0),
  },
  {
    id: 'reaim',
    kind: 'action',
    anchor: fixed('glass'),
    text: fixed(T.zeroing.reaim),
    isDue: state => state.shotsFired === ZEROING_GROUP_LAST_SHOT && isScreenFree(state),
    isDone: state => state.shotsFired > ZEROING_GROUP_LAST_SHOT || state.aimOffMil <= AIM_TOLERANCE_MIL,
  },
];

const BREATH_AND_TRIGGER: readonly TeachingStep[] = [
  {
    id: 'breath',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed(T.breathAndTrigger.breath({ calmS: BREATH_HOLD_CALM_S })),
    isDue: isScreenFree,
    isDone: hasFired,
  },
  notebookStep(T.breathAndTrigger.notebook({ exerciseId: FIRST_FIRING_EXERCISE_ID })),
  ENTER_STEP,
  DRUM_STEP,
  aimStep(T.breathAndTrigger.aim),
  { id: 'press', kind: 'action', anchor: fixed('fire-control'), text: fixed(T.breathAndTrigger.press), isDue: isScreenFree, isDone: hasFired },
  {
    id: 'bolt',
    kind: 'action',
    anchor: fixed('bolt-track'),
    text: fixed(T.breathAndTrigger.bolt),
    isDue: state => state.isBoltCycleDue && isScreenFree(state),
    isDone: state => state.shotsFired > 1 || (hasFired(state) && !state.isBoltCycleDue && !state.isReviewOpen),
  },
  {
    id: 'pulse',
    kind: 'explain',
    anchor: fixed('hold'),
    text: fixed(T.breathAndTrigger.pulse),
    isDue: state => hasFired(state) && isScreenFree(state),
    isDone: state => state.shotsFired > 1,
  },
];

const WIND_AND_STATION: readonly TeachingStep[] = [
  {
    id: 'wind',
    kind: 'action',
    anchor: fixed('wind-tile'),
    text: fixed(T.windAndStation.wind),
    isDue: always,
    isDone: state => state.hasOpenedNotebook || state.isStationMeasured || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'station-tab',
    kind: 'action',
    anchor: fixed('tab-conditions'),
    text: fixed(T.windAndStation.stationTab),
    isDue: isSheetOpen,
    isDone: state => state.sheetTab === 'conditions' || state.isStationMeasured || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'measure',
    kind: 'action',
    anchor: fixed('measure'),
    text: fixed(T.windAndStation.measure({ seconds: FULL_MEASUREMENT_S })),
    isDue: state => state.sheetTab === 'conditions',
    isDone: state => state.isStationMeasured || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'wind-tab',
    kind: 'action',
    anchor: fixed('tab-wind'),
    text: fixed(T.windAndStation.windTab),
    isDue: isSheetOpen,
    isDone: state => state.sheetTab === 'wind' || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'clock',
    kind: 'explain',
    anchor: fixed('wind-clock'),
    text: state => T.windAndStation.clock({ speedMps: state.stationSpeedMps ?? 0 }),
    isDue: state => state.sheetTab === 'wind',
    isDone: state => isWindWritten(state) || hasFired(state),
  },
];

const ZONE_FLAGS: readonly TeachingStep[] = [
  {
    id: 'flags',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed(T.zoneFlags.flags({ distancesM: FLAG_DISTANCES_M })),
    isDue: always,
    isDone: state => isAnyFlagRead(state) || hasFired(state),
  },
  {
    id: 'flag-tap',
    kind: 'action',
    anchor: fixed('glass'),
    text: fixed(T.zoneFlags.flagTap),
    isDue: always,
    isDone: state => isAnyFlagRead(state) || hasFired(state),
  },
  {
    id: 'weights',
    kind: 'explain',
    anchor: fixed('zone-weights'),
    text: fixed(T.zoneFlags.weights),
    isDue: state => state.sheetTab === 'wind',
    isDone: state => isZonesStepRecorded(state) || hasFired(state),
  },
  {
    id: 'zones-step',
    kind: 'explain',
    anchor: fixed('calc-formula'),
    text: fixed(T.zoneFlags.zonesStep),
    isDue: state => state.openCalcStep === 'zones',
    isDone: state => isZonesStepRecorded(state) || hasFired(state),
  },
];

const PATROL: readonly TeachingStep[] = [
  {
    id: 'patrol',
    kind: 'explain',
    anchor: fixed('position-patrol'),
    text: fixed(T.patrol.patrol),
    isDue: always,
    isDone: hasFired,
  },
  {
    id: 'lead-step',
    kind: 'action',
    anchor: fixed('tile-notebook'),
    text: fixed(T.patrol.leadStep),
    isDue: isScreenFree,
    isDone: state => isLeadStepRecorded(state) || hasFired(state),
  },
  {
    id: 'hold-lead',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed(T.patrol.holdLead),
    isDue: state => state.isEntered && isScreenFree(state),
    isDone: hasFired,
  },
  {
    id: 'ambush',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed(T.patrol.ambush),
    isDue: state => state.isAmbushTarget && isScreenFree(state),
    isDone: () => false,
  },
];

const MILLING: readonly TeachingStep[] = [
  {
    ...notebookStep(T.milling.notebook),
    isDone: state => state.hasOpenedNotebook || isRangeMeasured(state) || hasFired(state),
  },
  {
    id: 'distance-tab',
    kind: 'action',
    anchor: fixed('tab-distance'),
    text: fixed(T.milling.distanceTab),
    isDue: isSheetOpen,
    isDone: state => state.sheetTab === 'distance' || isRangeMeasured(state) || hasFired(state),
  },
  {
    id: 'milling',
    kind: 'action',
    anchor: fixed('milling'),
    text: state => T.milling.milling({ sizeM: state.targetSizeM }),
    isDue: state => state.sheetTab === 'distance',
    isDone: state => isRangeMeasured(state) || hasFired(state),
  },
  {
    id: 'result',
    kind: 'explain',
    anchor: fixed('milling-result'),
    text: state => T.milling.result({ sizeM: state.targetSizeM, reticleMil: state.reticleMil ?? 0, distanceM: state.measuredDistanceM ?? 0 }),
    isDue: state => state.sheetTab === 'distance',
    isDone: hasFired,
  },
];

const MANUAL_EASY: readonly TeachingStep[] = [
  { ...notebookStep(T.manualEasy.notebook), isDone: state => state.hasOpenedNotebook || isWindStepRecorded(state) || hasFired(state) },
  {
    id: 'wind-first',
    kind: 'explain',
    anchor: fixed('tab-wind'),
    text: fixed(T.manualEasy.windFirst({ exerciseId: WIND_EXERCISE })),
    isDue: isSheetOpen,
    isDone: state => isWindWritten(state) || isWindStepRecorded(state) || hasFired(state),
  },
  {
    id: 'sam',
    kind: 'action',
    anchor: fixed('wind-step-link'),
    text: fixed(T.manualEasy.sam),
    isDue: state => isWindWritten(state) && state.sheetTab === 'wind',
    isDone: state => state.openCalcStep === 'wind' || isWindStepRecorded(state) || hasFired(state),
  },
  { id: 'chips', kind: 'explain', anchor: fixed('calc-formula'), text: fixed(T.manualEasy.chips), isDue: always, isDone: state => isWindStepRecorded(state) || hasFired(state) },
  { id: 'tape', kind: 'explain', anchor: fixed('calc-tape'), text: fixed(T.manualEasy.tape), isDue: always, isDone: state => isWindStepRecorded(state) || hasFired(state) },
];

const CARTRIDGE_CHANGE: readonly TeachingStep[] = [
  {
    id: 'magazine',
    kind: 'action',
    anchor: fixed('change-magazine'),
    text: state => T.cartridgeChange.magazine({ cartridgeLetter: state.nextCartridgeLetter ?? '' }),
    isDue: state => state.isMagazineChangeDue,
    isDone: state => state.stageIndex > 0,
  },
  {
    id: 'card',
    kind: 'explain',
    anchor: fixed('tile-dope'),
    text: state => T.cartridgeChange.card({ cartridgeLetter: state.cartridgeLetter }),
    isDue: isScreenFree,
    isDone: state => state.stageIndex > 1,
  },
];

const MANUAL_HARD: readonly TeachingStep[] = [
  { id: 'traps', kind: 'explain', anchor: fixed('manual-mode'), text: fixed(T.manualHard.traps), isDue: isSheetOpen, isDone: hasFired },
  {
    id: 'call',
    kind: 'action',
    anchor: fixed('call-pick'),
    text: fixed(T.manualHard.call),
    isDue: state => state.isReviewOpen,
    isDone: state => state.isCallMarked || isFirstReviewClosed(state),
  },
  {
    id: 'dope-note',
    kind: 'explain',
    anchor: fixed('review-dope'),
    text: fixed(T.manualHard.dopeNote),
    isDue: state => state.isReviewOpen,
    isDone: state => state.isDopeNoted || isFirstReviewClosed(state),
  },
];

const SCRIPTS: Partial<Record<ExerciseId, readonly TeachingStep[]>> = {
  '01': FIRST_CLICKS,
  '02': ZEROING,
  '03': BREATH_AND_TRIGGER,
  '04': WIND_AND_STATION,
  '05': MILLING,
  '06': MANUAL_EASY,
  '08': CARTRIDGE_CHANGE,
  '09': ZONE_FLAGS,
  '10': MANUAL_HARD,
  '11': PATROL,
};

export function teachingScript(exerciseId: ExerciseId): readonly TeachingStep[] | null {
  return SCRIPTS[exerciseId] ?? null;
}

export function nextTeaching(script: readonly TeachingStep[], acknowledgedIds: ReadonlySet<string>, state: InstructorSnapshot): TeachingView | null {
  if (state.isResultOpen) {
    return null;
  }
  for (const [index, step] of script.entries()) {
    if (step.isDone(state) || acknowledgedIds.has(step.id)) {
      continue;
    }
    if (!step.isDue(state)) {
      return null;
    }
    return { id: step.id, kind: step.kind, anchor: step.anchor(state), text: step.text(state), number: index + 1, count: script.length };
  }
  return null;
}

export function isFactorGuarded(exerciseId: ExerciseId): boolean {
  return GUARDED_EXERCISES.includes(exerciseId);
}

export function forgottenFactorTeaching(factor: NotebookFactor, contribution: FactorContribution): TeachingView {
  return {
    id: `forgotten-${factor}`,
    kind: 'action',
    anchor: `toggle-${factor}`,
    text: T.forgottenFactor({ factorName: FACTOR_NAMES[factor], contribution: contributionText(factor, contribution) }),
    number: null,
    count: null,
  };
}
