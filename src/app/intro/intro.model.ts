import { targetRadiusMrad } from '../../core/content';
import { decimal } from '../../i18n/format';
import { ptPerMil, ScopeId, scopeById } from '../../sim/scope-model';

export type IntroStepId = 'rifle' | 'scope' | 'drum' | 'zoom' | 'reticles' | 'cartridges' | 'bolt';

export interface IntroPart {
  id: string;
  name: string;
  caption: string;
}

export interface IntroStep {
  id: IntroStepId;
  title: string;
  instruction: string;
  parts?: readonly IntroPart[];
}

export interface IntroProgress {
  seenParts: ReadonlySet<string>;
  dialledClicks: number;
  wasZoomedIn: boolean;
  wasZoomedOut: boolean;
  answerMil: number | null;
  isBoltCycled: boolean;
}

export const MIN_DIALLED_CLICKS = 5;

export const INTRO_SCENE = {
  scopeId: 'course-tree' as ScopeId,
  distanceM: 300,
  gongDiameterM: 0.5,
  startMagnification: 8,
};

const INTRO_SCOPE = scopeById(INTRO_SCENE.scopeId);

const MEASURE_GONG_SIZE_M = 0.5;
const MEASURE_DISTANCE_M = 500;
const MIL_PER_METRE_AT_KM = 1000;

export const MEASURE = {
  gongSizeM: MEASURE_GONG_SIZE_M,
  distanceM: MEASURE_DISTANCE_M,
  answerMil: (MEASURE_GONG_SIZE_M * MIL_PER_METRE_AT_KM) / MEASURE_DISTANCE_M,
  optionsMil: [0.5, 1, 2],
};

export const START_PROGRESS: IntroProgress = {
  seenParts: new Set(),
  dialledClicks: 0,
  wasZoomedIn: false,
  wasZoomedOut: false,
  answerMil: null,
  isBoltCycled: false,
};

export const INTRO_STEPS: readonly IntroStep[] = [
  {
    id: 'rifle',
    title: 'Винтовка',
    instruction: 'Это винтовка. Тапни по каждой части — узнаешь, зачем она',
    parts: [
      { id: 'barrel', name: 'Ствол', caption: 'Разгоняет пулю и задаёт ей направление. Холодный ствол бьёт чуть иначе, чем прогретый' },
      { id: 'bolt', name: 'Затвор', caption: 'Запирает патрон в стволе. После выстрела — вверх, назад, вперёд, вниз: гильза вылетает, новый патрон в стволе' },
      { id: 'magazine', name: 'Магазин', caption: 'Пять патронов. Пуст — меняешь магазин' },
      { id: 'trigger', name: 'Спуск', caption: 'Дави плавно до выстрела. Рывок уводит пулю' },
      { id: 'scope', name: 'Прицел', caption: 'Приближает цель и показывает, куда смотрит ствол, с поправкой барабанами' },
    ],
  },
  {
    id: 'scope',
    title: 'Прицел',
    instruction: 'Прицел в разрезе. Тапни по каждой части',
    parts: [
      { id: 'objective', name: 'Объектив', caption: 'Большое стекло спереди: собирает свет от цели' },
      { id: 'eyepiece', name: 'Окуляр', caption: 'Стекло у глаза: в нём ты видишь цель и сетку' },
      { id: 'elevation', name: 'Барабан ВЕРТ', caption: 'Поднимает и опускает точку попадания: один клик — 0,1 MIL' },
      { id: 'windage', name: 'Барабан ГОР', caption: 'Сдвигает точку попадания влево и вправо — поправка на ветер' },
      { id: 'zoom', name: 'Кольцо', caption: `Кольцо кратности: приближение от ${INTRO_SCOPE.magnificationMin}× до ${INTRO_SCOPE.magnificationMax}×` },
    ],
  },
  { id: 'drum', title: 'Барабан', instruction: `Накрути барабан ВЕРТ вверх на ${MIN_DIALLED_CLICKS} кликов — смотри, куда уходит точка попадания` },
  { id: 'zoom', title: 'Кратность', instruction: 'Покрути кратность вверх и вниз — гонг и метки сетки растут вместе' },
  {
    id: 'reticles',
    title: 'Сетки',
    instruction: `Тапни по меткам сеток. Потом ответь: гонг ${decimal(MEASURE_GONG_SIZE_M)} м на ${MEASURE_DISTANCE_M} м — сколько MIL он займёт?`,
  },
  { id: 'cartridges', title: 'Патроны', instruction: 'Три патрона: тяжелее и обтекаемее — меньше падает и меньше сносится ветром' },
  { id: 'bolt', title: 'Затвор', instruction: 'Передёрни затвор: тяни рукоять вверх, назад, вперёд, вниз' },
];

export function isStepDone(stepId: IntroStepId, progress: IntroProgress): boolean {
  switch (stepId) {
    case 'rifle':
    case 'scope':
      return INTRO_STEPS.find(step => step.id === stepId)!.parts!.every(part => progress.seenParts.has(partKey(stepId, part.id)));
    case 'drum':
      return progress.dialledClicks >= MIN_DIALLED_CLICKS;
    case 'zoom':
      return progress.wasZoomedIn && progress.wasZoomedOut;
    case 'reticles':
      return progress.answerMil === MEASURE.answerMil;
    case 'cartridges':
      return true;
    case 'bolt':
      return progress.isBoltCycled;
  }
}

export function partKey(stepId: IntroStepId, partId: string): string {
  return `${stepId}:${partId}`;
}

export function measureHint(answerMil: number | null): string | null {
  if (answerMil === null || answerMil === MEASURE.answerMil) {
    return null;
  }
  return 'Не так. Д = размер × 1000 / mil — отсюда mil = размер × 1000 / Д';
}

export function impactShiftPt(dialledClicks: number, magnification: number): number {
  return dialledClicks * scopeById(INTRO_SCENE.scopeId).clickMrad * ptPerMil(magnification);
}

export function gongRadiusPt(magnification: number): number {
  return targetRadiusMrad({ distanceM: INTRO_SCENE.distanceM, diameterM: INTRO_SCENE.gongDiameterM }) * ptPerMil(magnification);
}
