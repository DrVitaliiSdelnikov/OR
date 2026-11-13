import { targetRadiusMrad } from '../../core/content';
import { text } from '../../i18n';
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

const STEPS = text.intro.steps;
const RIFLE_PARTS = STEPS.rifle.parts;
const SCOPE_PARTS = STEPS.scope.parts;

export const INTRO_STEPS: readonly IntroStep[] = [
  {
    id: 'rifle',
    title: STEPS.rifle.title,
    instruction: STEPS.rifle.instruction,
    parts: [
      { id: 'barrel', ...RIFLE_PARTS.barrel },
      { id: 'bolt', ...RIFLE_PARTS.bolt },
      { id: 'magazine', ...RIFLE_PARTS.magazine },
      { id: 'trigger', ...RIFLE_PARTS.trigger },
      { id: 'scope', ...RIFLE_PARTS.scope },
    ],
  },
  {
    id: 'scope',
    title: STEPS.scope.title,
    instruction: STEPS.scope.instruction,
    parts: [
      { id: 'objective', ...SCOPE_PARTS.objective },
      { id: 'eyepiece', ...SCOPE_PARTS.eyepiece },
      { id: 'elevation', ...SCOPE_PARTS.elevation },
      { id: 'windage', ...SCOPE_PARTS.windage },
      {
        id: 'zoom',
        name: SCOPE_PARTS.zoom.name,
        caption: SCOPE_PARTS.zoom.caption({ magnificationMin: INTRO_SCOPE.magnificationMin, magnificationMax: INTRO_SCOPE.magnificationMax }),
      },
    ],
  },
  { id: 'drum', title: STEPS.drum.title, instruction: STEPS.drum.instruction({ clicks: MIN_DIALLED_CLICKS }) },
  { id: 'zoom', title: STEPS.zoom.title, instruction: STEPS.zoom.instruction },
  {
    id: 'reticles',
    title: STEPS.reticles.title,
    instruction: STEPS.reticles.instruction({ gongSizeM: MEASURE_GONG_SIZE_M, distanceM: MEASURE_DISTANCE_M }),
  },
  { id: 'cartridges', title: STEPS.cartridges.title, instruction: STEPS.cartridges.instruction },
  { id: 'bolt', title: STEPS.bolt.title, instruction: STEPS.bolt.instruction },
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
  return text.intro.measureHint;
}

export function impactShiftPt(dialledClicks: number, magnification: number): number {
  return dialledClicks * scopeById(INTRO_SCENE.scopeId).clickMrad * ptPerMil(magnification);
}

export function gongRadiusPt(magnification: number): number {
  return targetRadiusMrad({ distanceM: INTRO_SCENE.distanceM, diameterM: INTRO_SCENE.gongDiameterM }) * ptPerMil(magnification);
}
