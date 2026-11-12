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
const isSheetOpen = (state: InstructorSnapshot): boolean => state.sheetTab !== null;
const isWindWritten = (state: InstructorSnapshot): boolean => (state.windSpeedMps ?? 0) > 0;
const isRangeMeasured = (state: InstructorSnapshot): boolean => state.reticleMil !== null;
const isWindStepRecorded = (state: InstructorSnapshot): boolean => state.recordedSteps.includes('wind');
const isZonesStepRecorded = (state: InstructorSnapshot): boolean => state.recordedSteps.includes('zones');
const isLeadStepRecorded = (state: InstructorSnapshot): boolean => state.recordedSteps.includes('lead');
const isAnyFlagRead = (state: InstructorSnapshot): boolean => state.flagsRead > 0;
const isFirstReviewClosed = (state: InstructorSnapshot): boolean => state.shotsFired > 1 || (hasFired(state) && !state.isReviewOpen);

function metresText(metres: number): string {
  return String(metres).replace('.', ',');
}

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

const WIND_AND_STATION: readonly TeachingStep[] = [
  {
    id: 'wind',
    kind: 'action',
    anchor: fixed('wind-tile'),
    text: fixed('Ветер. Сначала замерь его станцией'),
    isDue: always,
    isDone: state => state.hasOpenedNotebook || state.isStationMeasured || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'station-tab',
    kind: 'action',
    anchor: fixed('tab-conditions'),
    text: fixed('Станция — во вкладке «Условия»'),
    isDue: isSheetOpen,
    isDone: state => state.sheetTab === 'conditions' || state.isStationMeasured || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'measure',
    kind: 'action',
    anchor: fixed('measure'),
    text: fixed('Держи «Замер» 3 с'),
    isDue: state => state.sheetTab === 'conditions',
    isDone: state => state.isStationMeasured || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'wind-tab',
    kind: 'action',
    anchor: fixed('tab-wind'),
    text: fixed('Скорость есть. Теперь «Ветер»'),
    isDue: isSheetOpen,
    isDone: state => state.sheetTab === 'wind' || isWindWritten(state) || hasFired(state),
  },
  {
    id: 'clock',
    kind: 'explain',
    anchor: fixed('wind-clock'),
    text: state => `Стрелка — откуда дует, по флажку у бруствера. Скорость — ${(state.stationSpeedMps ?? 0).toFixed(1)}, со станции`,
    isDue: state => state.sheetTab === 'wind',
    isDone: state => isWindWritten(state) || hasFired(state),
  },
];

const ZONE_FLAGS: readonly TeachingStep[] = [
  {
    id: 'flags',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed('Ветер по трассе разный. Флажки на 200, 400, 600 м — левее цели, веди прицел к ним'),
    isDue: always,
    isDone: state => isAnyFlagRead(state) || hasFired(state),
  },
  {
    id: 'flag-tap',
    kind: 'action',
    anchor: fixed('glass'),
    text: fixed('Тапни флажок — угол и скорость запишутся в блокнот'),
    isDue: always,
    isDone: state => isAnyFlagRead(state) || hasFired(state),
  },
  {
    id: 'weights',
    kind: 'explain',
    anchor: fixed('zone-weights'),
    text: fixed('Вес зоны — её доля в среднем ветре. Веса — из строки ДОПЕ на твоей дистанции'),
    isDue: state => state.sheetTab === 'wind',
    isDone: state => isZonesStepRecorded(state) || hasFired(state),
  },
  {
    id: 'zones-step',
    kind: 'explain',
    anchor: fixed('calc-formula'),
    text: fixed('Средний ветер — сумма: вес × V⊥ зоны. Станция — с вкладки «Ветер», флажки — из стекла'),
    isDue: state => state.openCalcStep === 'zones',
    isDone: state => isZonesStepRecorded(state) || hasFired(state),
  },
];

const PATROL: readonly TeachingStep[] = [
  {
    id: 'patrol',
    kind: 'explain',
    anchor: fixed('position-patrol'),
    text: fixed('Скорость и направление цели — здесь. Стрелка меняется на развороте'),
    isDue: always,
    isDone: hasFired,
  },
  {
    id: 'lead-step',
    kind: 'action',
    anchor: fixed('tile-notebook'),
    text: fixed('Посчитай упреждение: шаг «Упреждение» в блокноте'),
    isDue: isScreenFree,
    isDone: state => isLeadStepRecorded(state) || hasFired(state),
  },
  {
    id: 'hold-lead',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed('Упреждение держи сеткой впереди цели, барабан не трогай. Веди сетку за целью и стреляй'),
    isDue: state => state.isEntered && isScreenFree(state),
    isDone: hasFired,
  },
  {
    id: 'ambush',
    kind: 'explain',
    anchor: fixed('glass'),
    text: fixed('Засада: поставь сетку впереди на упреждение и жди, пока цель дойдёт'),
    isDue: state => state.isAmbushTarget && isScreenFree(state),
    isDone: () => false,
  },
];

const MILLING: readonly TeachingStep[] = [
  {
    ...notebookStep('Открой блокнот: дистанция неизвестна'),
    isDone: state => state.hasOpenedNotebook || isRangeMeasured(state) || hasFired(state),
  },
  {
    id: 'distance-tab',
    kind: 'action',
    anchor: fixed('tab-distance'),
    text: fixed('Меряй гонг сеткой — вкладка «Дистанция»'),
    isDue: isSheetOpen,
    isDone: state => state.sheetTab === 'distance' || isRangeMeasured(state) || hasFired(state),
  },
  {
    id: 'milling',
    kind: 'action',
    anchor: fixed('milling'),
    text: state => `Гонг ${metresText(state.targetSizeM)} м. Коснись верхнего и нижнего края, затем «Посчитать»`,
    isDue: state => state.sheetTab === 'distance',
    isDone: state => isRangeMeasured(state) || hasFired(state),
  },
  {
    id: 'result',
    kind: 'explain',
    anchor: fixed('milling-result'),
    text: state => `Д = ${metresText(state.targetSizeM)} × 1000 / ${(state.reticleMil ?? 0).toFixed(2)} = ${Math.round(state.measuredDistanceM ?? 0)} м`,
    isDue: state => state.sheetTab === 'distance',
    isDone: hasFired,
  },
];

const MANUAL_EASY: readonly TeachingStep[] = [
  { ...notebookStep('Теперь считаешь сам. Открой блокнот'), isDone: state => state.hasOpenedNotebook || isWindStepRecorded(state) || hasFired(state) },
  {
    id: 'wind-first',
    kind: 'explain',
    anchor: fixed('tab-wind'),
    text: fixed('Сначала ветер — как в 04: станция и часы'),
    isDue: isSheetOpen,
    isDone: state => isWindWritten(state) || isWindStepRecorded(state) || hasFired(state),
  },
  {
    id: 'sam',
    kind: 'action',
    anchor: fixed('wind-step-link'),
    text: fixed('Ветер записан. Теперь посчитай его сам'),
    isDue: state => isWindWritten(state) && state.sheetTab === 'wind',
    isDone: state => state.openCalcStep === 'wind' || isWindStepRecorded(state) || hasFired(state),
  },
  { id: 'chips', kind: 'explain', anchor: fixed('calc-formula'), text: fixed('Тапни слот формулы и положи чип: V⊥, потом D'), isDue: always, isDone: state => isWindStepRecorded(state) || hasFired(state) },
  { id: 'tape', kind: 'explain', anchor: fixed('calc-tape'), text: fixed('Набери по формуле V⊥ × D ÷ K и запиши шаг'), isDue: always, isDone: state => isWindStepRecorded(state) || hasFired(state) },
];

const CARTRIDGE_CHANGE: readonly TeachingStep[] = [
  {
    id: 'magazine',
    kind: 'action',
    anchor: fixed('change-magazine'),
    text: state => `Магазин пуст. Дальше — патрон ${state.nextCartridgeLetter ?? ''}`,
    isDue: state => state.isMagazineChangeDue,
    isDone: state => state.stageIndex > 0,
  },
  {
    id: 'card',
    kind: 'explain',
    anchor: fixed('tile-dope'),
    text: state => `У патрона ${state.cartridgeLetter} своя карточка ДОПЕ — пересчитай`,
    isDue: isScreenFree,
    isDone: state => state.stageIndex > 1,
  },
];

const MANUAL_HARD: readonly TeachingStep[] = [
  { id: 'traps', kind: 'explain', anchor: fixed('manual-mode'), text: fixed('Сложный: среди чипов — ловушки, константа — в слоте'), isDue: isSheetOpen, isDone: hasFired },
  {
    id: 'call',
    kind: 'action',
    anchor: fixed('call-pick'),
    text: fixed('Где была сетка при выстреле? Отметь сам'),
    isDue: state => state.isReviewOpen,
    isDone: state => state.isCallMarked || isFirstReviewClosed(state),
  },
  {
    id: 'dope-note',
    kind: 'explain',
    anchor: fixed('review-dope'),
    text: fixed('Поправка по второму — запиши карандашом в ДОПЕ'),
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
    text: `Учти ${FACTOR_NAMES[factor].toUpperCase()}: ${contributionText(factor, contribution)}`,
    number: null,
    count: null,
  };
}
