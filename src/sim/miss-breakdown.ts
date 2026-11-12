import { roundToClicks } from '../core/game-formulas';
import { Correction } from '../core/types';

export type CauseKind = 'calc' | 'wind' | 'hold' | 'lead' | 'trigger' | 'zero' | 'formula' | 'rifle' | 'cold-bore';
export type WindVerdict = 'under' | 'over';
export type MainCause = Exclude<CauseKind, 'wind' | 'formula' | 'rifle' | 'cold-bore'> | 'wind-under' | 'wind-over';

export interface MissBreakdownInput {
  ideal: Correction;
  formulaTruth: Correction;
  formulaPlayerWind: Correction;
  dial: Correction;
  plannedHold: Correction;
  reticle: Correction;
  triggerSpread: Correction;
  velocitySpread: Correction;
  rifleGroup: Correction;
  coldBore: Correction;
  sightOffset: Correction;
  hasKnockedSight: boolean;
  clickMil: number;
  targetMotion?: Correction;
}

export interface MissCause {
  kind: CauseKind;
  vector: Correction;
  clicks: number;
  isPlayerError: boolean;
  isShown: boolean;
}

export interface MissBreakdown {
  causes: MissCause[];
  main: CauseKind | null;
  isTriggerClean: boolean;
  windVerdict: WindVerdict | null;
}

const ZERO: Correction = { upMrad: 0, rightMrad: 0 };
const GROUP_CAUSES: readonly CauseKind[] = ['hold', 'trigger', 'rifle', 'zero'];

/**
 * Попадание = (барабан − ядро) + сетка + спуск + винтовка + холодный ствол + сбитый прицел (`resolveShot`).
 * Разность «барабан − ядро» режется по цепочке ядро → Ф(правда) → Ф(ветер игрока) → план → барабан,
 * поэтому сумма лепестков равна попаданию точно.
 */
export function missBreakdown(input: MissBreakdownInput): MissBreakdown {
  const calcBase = input.hasKnockedSight ? ZERO : input.dial;
  const vectors: [CauseKind, Correction, boolean][] = [
    ['calc', minus(plus(calcBase, input.plannedHold), input.formulaPlayerWind), true],
    ['wind', minus(input.formulaPlayerWind, input.formulaTruth), true],
    ...holdAndLead(input),
    ['trigger', input.triggerSpread, true],
    ...(input.hasKnockedSight ? [['zero', plus(input.sightOffset, input.dial), true] as [CauseKind, Correction, boolean]] : []),
    ['formula', minus(input.formulaTruth, input.ideal), false],
    ['rifle', plus(input.velocitySpread, input.rifleGroup), false],
    ['cold-bore', input.coldBore, false],
  ];
  const causes = vectors.map(([kind, vector, isPlayerError]): MissCause => {
    const clicks = Math.abs(roundToClicks(Math.hypot(vector.upMrad, vector.rightMrad), input.clickMil));
    return { kind, vector, clicks, isPlayerError, isShown: isPlayerError || clicks > 0 };
  });
  const main = causes.filter(cause => cause.isPlayerError && cause.clicks > 0).reduce<MissCause | null>((largest, cause) => (largest && largest.clicks >= cause.clicks ? largest : cause), null);
  const trigger = causes.find(cause => cause.kind === 'trigger')!;
  const windCause = causes.find(cause => cause.kind === 'wind')!;
  return {
    causes,
    main: main?.kind ?? null,
    isTriggerClean: trigger.clicks === 0,
    windVerdict: windCause.clicks === 0 ? null : Math.abs(input.formulaPlayerWind.rightMrad) < Math.abs(input.formulaTruth.rightMrad) ? 'under' : 'over',
  };
}

// На движущейся цели вынос сетки по горизонтали сверх плана — это упреждение, а не дрожь удержания.
function holdAndLead(input: MissBreakdownInput): [CauseKind, Correction, boolean][] {
  const held = minus(input.reticle, input.plannedHold);
  if (!input.targetMotion) {
    return [['hold', held, true]];
  }
  return [
    ['hold', { upMrad: held.upMrad, rightMrad: 0 }, true],
    ['lead', { upMrad: -input.targetMotion.upMrad, rightMrad: held.rightMrad - input.targetMotion.rightMrad }, true],
  ];
}

export function mainCauseOf(breakdown: MissBreakdown): MainCause | null {
  if (breakdown.main === 'wind') {
    return breakdown.windVerdict === 'under' ? 'wind-under' : 'wind-over';
  }
  return breakdown.main as MainCause | null;
}

export function groupPoint(breakdown: MissBreakdown): Correction {
  return breakdown.causes.filter(cause => GROUP_CAUSES.includes(cause.kind)).reduce((sum, cause) => plus(sum, cause.vector), ZERO);
}

function plus(first: Correction, second: Correction): Correction {
  return { upMrad: first.upMrad + second.upMrad, rightMrad: first.rightMrad + second.rightMrad };
}

function minus(first: Correction, second: Correction): Correction {
  return { upMrad: first.upMrad - second.upMrad, rightMrad: first.rightMrad - second.rightMrad };
}
