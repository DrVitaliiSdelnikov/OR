import { ExerciseId } from '../../sim/course';
import { FactorContribution, NotebookFactor } from '../../sim/notebook';
import { BREATH_HOLD_CALM_S } from '../../sim/sway';
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

const hasFired = (state: InstructorSnapshot): boolean => state.shotsFired > 0;
const isScreenFree = (state: InstructorSnapshot): boolean => state.sheetTab === null && !state.isReviewOpen;
const always = (): boolean => true;

function fixed(text: string): () => string {
  return () => text;
}

function dialHint(isUp: boolean, remainingClicks: number, axis: 'vertical' | 'horizontal'): string {
  const direction = axis === 'vertical' ? (isUp ? 'вверх' : 'вниз') : isUp ? 'вправо' : 'влево';
  return `Крути ${direction}: ещё ${Math.abs(remainingClicks)} кл.`;
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
  text: fixed('Внеси итог на барабаны'),
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
  { id: 'scope', kind: 'explain', anchor: fixed('glass'), text: fixed('Это прицел. Цель — гонг на 300 м'), isDue: isScreenFree, isDone: hasFired },
  notebookStep('Открой блокнот: там поправка'),
  {
    id: 'dope',
    kind: 'explain',
    anchor: fixed('factor-dope'),
    text: state => `ДОПЕ — падение пули: ↑ ${(state.dopeMil ?? 0).toFixed(1)} MIL`,
    isDue: state => state.sheetTab === 'total',
    isDone: state => state.isEntered || hasFired(state),
  },
  ENTER_STEP,
  DRUM_STEP,
  {
    id: 'side-drum',
    kind: 'explain',
    anchor: fixed('drum-windage'),
    text: fixed('Боковой — ветер. Сегодня штиль, 0'),
    isDue: state => state.isEntered && isScreenFree(state),
    isDone: state => (state.windageTargetClicks ?? 0) !== 0 || hasFired(state),
  },
  aimStep('Наведи перекрестие на гонг: тяни картинку'),
  { id: 'fire', kind: 'action', anchor: fixed('fire-control'), text: fixed('Огонь'), isDue: isScreenFree, isDone: hasFired },
  {
    id: 'review',
    kind: 'explain',
    anchor: fixed('review-next'),
    text: fixed('Разбор — после каждого выстрела. Прочитай и жми ДАЛЬШЕ'),
    isDue: always,
    isDone: state => (hasFired(state) && !state.isReviewOpen) || state.shotsFired > 1,
  },
];

const ZEROING: readonly TeachingStep[] = [
  { id: 'zero', kind: 'explain', anchor: fixed('glass'), text: fixed('Прицел сбит. Пристреляем на 100 м'), isDue: isScreenFree, isDone: hasFired },
  aimStep('Наведи перекрестие в центр мишени'),
  { id: 'cold', kind: 'action', anchor: fixed('fire-control'), text: fixed('Первый — холодный. Огонь'), isDue: isScreenFree, isDone: hasFired },
  {
    id: 'group',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed('Ещё три в одну точку — группа'),
    isDue: state => hasFired(state) && isScreenFree(state),
    isDone: state => state.shotsFired > 1,
  },
  {
    id: 'correction',
    kind: 'explain',
    anchor: fixed('review-correction'),
    text: fixed('Поправка в кликах — перенеси барабанами'),
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
    text: fixed('Барабан сдвинул картинку — наведи снова в центр'),
    isDue: state => state.shotsFired === ZEROING_GROUP_LAST_SHOT && isScreenFree(state),
    isDone: state => state.shotsFired > ZEROING_GROUP_LAST_SHOT || state.aimOffMil <= AIM_TOLERANCE_MIL,
  },
];

const BREATH_AND_TRIGGER: readonly TeachingStep[] = [
  {
    id: 'breath',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed(`Задержи дыхание — метка дрожит меньше. Окно ${BREATH_HOLD_CALM_S} с`),
    isDue: isScreenFree,
    isDone: hasFired,
  },
  notebookStep('Поправка — как в 01: открой блокнот'),
  ENTER_STEP,
  DRUM_STEP,
  aimStep('Наведи перекрестие на гонг: тяни картинку'),
  { id: 'press', kind: 'action', anchor: fixed('fire-control'), text: fixed('Держи ДЕРЖАТЬ, дави ОГОНЬ плавно'), isDue: isScreenFree, isDone: hasFired },
  {
    id: 'bolt',
    kind: 'action',
    anchor: fixed('bolt-track'),
    text: fixed('Затвор: вверх, назад, вперёд, вниз'),
    isDue: state => state.isBoltCycleDue && isScreenFree(state),
    isDone: state => state.shotsFired > 1 || (hasFired(state) && !state.isBoltCycleDue && !state.isReviewOpen),
  },
  {
    id: 'pulse',
    kind: 'explain',
    anchor: fixed('hold'),
    text: fixed('Пульс сбивает. Дыши между выстрелами'),
    isDue: state => hasFired(state) && isScreenFree(state),
    isDone: state => state.shotsFired > 1,
  },
];

const SCRIPTS: Partial<Record<ExerciseId, readonly TeachingStep[]>> = { '01': FIRST_CLICKS, '02': ZEROING, '03': BREATH_AND_TRIGGER };

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
    text: `Учти ${FACTOR_NAMES[factor].toUpperCase()}: ${contributionText(factor, contribution)}`,
    number: null,
    count: null,
  };
}
