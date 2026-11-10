import { describe, expect, it } from 'vitest';
import { targetRadiusMrad } from '../../core/content';
import { rangeByMilling } from '../../core/game-formulas';
import { courseProgress, exerciseById } from '../../sim/course';
import { ptPerMil, scopeById } from '../../sim/scope-model';
import { withIntroCompleted } from '../home/home.model';
import { playability } from '../position/position.model';
import { openedTerms } from '../textbook/textbook.model';
import {
  gongRadiusPt,
  impactShiftPt,
  INTRO_SCENE,
  INTRO_STEPS,
  isStepDone,
  MEASURE,
  measureHint,
  MIN_DIALLED_CLICKS,
  partKey,
  START_PROGRESS,
} from './intro.model';

describe('шаги вводного 00 (U1)', () => {
  it('семь шагов по брифу 13; у винтовки и прицела — по пять частей с подписями', () => {
    expect(INTRO_STEPS.map(step => step.id)).toEqual(['rifle', 'scope', 'drum', 'zoom', 'reticles', 'cartridges', 'bolt']);
    for (const step of INTRO_STEPS.slice(0, 2)) {
      expect(step.parts, step.id).toHaveLength(5);
      expect(step.parts!.every(part => part.name.length > 0 && part.caption.length > 0), step.id).toBe(true);
    }
    expect(INTRO_STEPS.every(step => step.instruction.length > 0)).toBe(true);
  });
});

describe('шаг готов (U2)', () => {
  const rifleParts = INTRO_STEPS[0].parts!.map(part => partKey('rifle', part.id));

  it('винтовка и прицел — когда открыты все части шага', () => {
    expect(isStepDone('rifle', { ...START_PROGRESS, seenParts: new Set(rifleParts.slice(0, 4)) })).toBe(false);
    expect(isStepDone('rifle', { ...START_PROGRESS, seenParts: new Set(rifleParts) })).toBe(true);
    expect(isStepDone('scope', { ...START_PROGRESS, seenParts: new Set(rifleParts) })).toBe(false);
  });

  it('барабан — от 5 кликов вверх; кратность — когда была и выше, и ниже начальной', () => {
    expect(isStepDone('drum', { ...START_PROGRESS, dialledClicks: MIN_DIALLED_CLICKS - 1 })).toBe(false);
    expect(isStepDone('drum', { ...START_PROGRESS, dialledClicks: MIN_DIALLED_CLICKS })).toBe(true);
    expect(isStepDone('zoom', { ...START_PROGRESS, wasZoomedIn: true })).toBe(false);
    expect(isStepDone('zoom', { ...START_PROGRESS, wasZoomedIn: true, wasZoomedOut: true })).toBe(true);
  });

  it('сетки — только верный ответ; патроны — сразу; затвор — после цикла', () => {
    expect(isStepDone('reticles', { ...START_PROGRESS, answerMil: 2 })).toBe(false);
    expect(isStepDone('reticles', { ...START_PROGRESS, answerMil: MEASURE.answerMil })).toBe(true);
    expect(isStepDone('cartridges', START_PROGRESS)).toBe(true);
    expect(isStepDone('bolt', START_PROGRESS)).toBe(false);
    expect(isStepDone('bolt', { ...START_PROGRESS, isBoltCycled: true })).toBe(true);
  });
});

describe('замер гонга на шаге 5 (U3)', () => {
  it('ответ — тот, при котором формула тысячной даёт 500 м для гонга 0,5 м; варианты 0,5 / 1 / 2', () => {
    expect(MEASURE.answerMil).toBe(1);
    expect(rangeByMilling(MEASURE.gongSizeM, MEASURE.answerMil)).toBe(MEASURE.distanceM);
    expect(MEASURE.optionsMil).toEqual([0.5, 1, 2]);
  });

  it('неверный ответ — подсказка с формулой; верный и пустой — без подсказки', () => {
    expect(measureHint(2)).toContain('Д = размер × 1000 / mil');
    expect(measureHint(MEASURE.answerMil)).toBeNull();
    expect(measureHint(null)).toBeNull();
  });
});

describe('стекло (U4)', () => {
  it('N кликов поднимают точку попадания на N × цену клика × pt на MIL', () => {
    const scope = scopeById(INTRO_SCENE.scopeId);
    expect(impactShiftPt(5, 8)).toBeCloseTo(5 * scope.clickMrad * ptPerMil(8), 9);
  });

  it('на 12× гонг в 4 раза крупнее, чем на 3×', () => {
    expect(gongRadiusPt(12) / gongRadiusPt(3)).toBeCloseTo(4, 9);
    expect(gongRadiusPt(8)).toBeCloseTo(targetRadiusMrad({ distanceM: INTRO_SCENE.distanceM, diameterM: INTRO_SCENE.gongDiameterM }) * ptPerMil(8), 9);
  });
});

describe('после вводного (U5)', () => {
  it('00 играбельно; после «ГОТОВ» открыт 01 и пять терминов 00', () => {
    expect(playability(exerciseById('00')!).isPlayable).toBe(true);
    const before = { isIntroCompleted: false, bestClasses: {} };
    const after = withIntroCompleted(before);
    expect(courseProgress(before, false).unlockedIds).not.toContain('01');
    expect(courseProgress(after, false).unlockedIds).toContain('01');
    expect([...openedTerms(after, false)].sort()).toEqual([...exerciseById('00')!.terms].sort());
  });
});
