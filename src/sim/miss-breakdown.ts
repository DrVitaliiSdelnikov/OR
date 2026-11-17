import { roundToClicks } from '../core/game-formulas';
import { Correction } from '../core/types';
import { CHAIN_ORDER, ChainLink, ChainLinkKind } from './miss-chain';

export type ChainCauseKind = Exclude<ChainLinkKind, 'lead'> | 'lead-calc';
export type ExecutionCauseKind = 'hold' | 'lead' | 'trigger' | 'zero';
export type GreyCauseKind = 'formula' | 'rifle' | 'cold-bore';
export type CauseKind = ChainCauseKind | ExecutionCauseKind | GreyCauseKind;
export type MainCause = 'calc' | 'wind-under' | 'wind-over' | 'lead' | 'hold' | 'trigger' | 'zero';

export interface MissBreakdownInput {
  ideal: Correction;
  formulaTruth: Correction;
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
  chain: readonly ChainLink[];
}

export interface MissCause {
  kind: CauseKind;
  vector: Correction;
  clicks: number;
  isPlayerError: boolean;
  isShown: boolean;
  link: ChainLink | null;
}

export interface CauseAmount {
  kind: CauseKind;
  mil: number;
}

export interface MissBreakdown {
  causes: MissCause[];
  chain: readonly ChainLink[];
  main: CauseKind | null;
  mainCause: MainCause | null;
  isTriggerClean: boolean;
  clickMil: number;
}

const ZERO: Correction = { upMrad: 0, rightMrad: 0 };
const GROUP_CAUSES: readonly CauseKind[] = ['hold', 'trigger', 'rifle', 'zero'];
const ALWAYS_SHOWN: readonly CauseKind[] = ['hold', 'trigger'];
const HIDDEN_LINKS: readonly CauseKind[] = ['rounding'];
const CALC_CAUSES: readonly CauseKind[] = ['distance', 'dope', 'conditions', 'angle', 'earth', 'wind-calc', 'rounding', 'turret'];
const WIND_CAUSES: readonly CauseKind[] = ['wind-speed', 'wind-clock', 'zones'];
const LEAD_CAUSES: readonly CauseKind[] = ['lead-calc', 'lead'];
const JOURNAL_STEPS_PER_MIL = 100;
export const CAUSE_ORDER: readonly CauseKind[] = [...CHAIN_ORDER.map(causeKindOf), 'hold', 'lead', 'trigger', 'zero', 'formula', 'rifle', 'cold-bore'];

/**
 * Попадание = (барабан − ядро) + сетка + спуск + винтовка + холодный ствол + сбитый прицел (`resolveShot`).
 * «Барабан + план удержания − формула на правде» раскладывают звенья `missChain`; звено упреждения вырезано из лепестка `lead`,
 * поэтому сумма причин равна попаданию точно.
 */
export function missBreakdown(input: MissBreakdownInput): MissBreakdown {
  const leadLink = input.chain.find(link => link.kind === 'lead');
  const vectors: [CauseKind, Correction, boolean, ChainLink | null][] = [
    ...input.chain.map((link): [CauseKind, Correction, boolean, ChainLink | null] => [causeKindOf(link.kind), link.vector, !HIDDEN_LINKS.includes(link.kind), link]),
    ...holdAndLead(input, leadLink?.vector ?? ZERO).map(([kind, vector]): [CauseKind, Correction, boolean, ChainLink | null] => [kind, vector, true, null]),
    ['trigger', input.triggerSpread, true, null],
    ...(input.hasKnockedSight ? [['zero', plus(input.sightOffset, input.dial), true, null] as [CauseKind, Correction, boolean, ChainLink | null]] : []),
    ['formula', minus(input.formulaTruth, input.ideal), false, null],
    ['rifle', plus(input.velocitySpread, input.rifleGroup), false, null],
    ['cold-bore', input.coldBore, false, null],
  ];
  const causes = vectors.map(([kind, vector, isPlayerError, link]): MissCause => {
    const clicks = clicksOf(vector, input.clickMil);
    const isShown = !HIDDEN_LINKS.includes(kind) && (ALWAYS_SHOWN.includes(kind) || clicks > 0);
    return { kind, vector, clicks, isPlayerError, isShown, link };
  });
  const main = largest(causes.filter(cause => cause.isPlayerError && cause.clicks > 0).map(cause => [cause.kind, cause.clicks] as const));
  return {
    causes,
    chain: input.chain,
    main,
    mainCause: roughMainCause(causes, input),
    isTriggerClean: causes.find(cause => cause.kind === 'trigger')!.clicks === 0,
    clickMil: input.clickMil,
  };
}

function causeKindOf(kind: ChainLinkKind): ChainCauseKind {
  return kind === 'lead' ? 'lead-calc' : kind;
}

// На движущейся цели вынос сетки по горизонтали сверх плана — это упреждение, а не дрожь удержания.
function holdAndLead(input: MissBreakdownInput, leadCalc: Correction): [ExecutionCauseKind, Correction][] {
  const held = minus(input.reticle, input.plannedHold);
  if (!input.targetMotion) {
    return [['hold', held]];
  }
  return [
    ['hold', { upMrad: held.upMrad, rightMrad: 0 }],
    ['lead', minus({ upMrad: -input.targetMotion.upMrad, rightMrad: held.rightMrad - input.targetMotion.rightMrad }, leadCalc)],
  ];
}

// Итог упражнения и журнал пока держат прежние грубые категории; величины звеньев туда придут в T2.3.
function roughMainCause(causes: readonly MissCause[], input: MissBreakdownInput): MainCause | null {
  const sumOf = (kinds: readonly CauseKind[]): Correction => causes.filter(cause => kinds.includes(cause.kind)).reduce((sum, cause) => plus(sum, cause.vector), ZERO);
  const wind = sumOf(WIND_CAUSES);
  const isWindUnder = Math.abs(input.formulaTruth.rightMrad + wind.rightMrad) < Math.abs(input.formulaTruth.rightMrad);
  const rough: [MainCause, Correction][] = [
    ['calc', sumOf(CALC_CAUSES)],
    [isWindUnder ? 'wind-under' : 'wind-over', wind],
    ['hold', sumOf(['hold'])],
    ['lead', sumOf(LEAD_CAUSES)],
    ['trigger', sumOf(['trigger'])],
    ['zero', sumOf(['zero'])],
  ];
  return largest(rough.map(([kind, vector]) => [kind, clicksOf(vector, input.clickMil)] as const).filter(([, clicks]) => clicks > 0));
}

function largest<Kind>(candidates: readonly (readonly [Kind, number])[]): Kind | null {
  return candidates.reduce<readonly [Kind, number] | null>((best, candidate) => (best && best[1] >= candidate[1] ? best : candidate), null)?.[0] ?? null;
}

export function mainCauseOf(breakdown: MissBreakdown): MainCause | null {
  return breakdown.mainCause;
}

export function journalCauses(breakdown: MissBreakdown): CauseAmount[] {
  return breakdown.causes
    .filter(cause => cause.isPlayerError)
    .map(cause => ({ kind: cause.kind, mil: Math.round(Math.hypot(cause.vector.upMrad, cause.vector.rightMrad) * JOURNAL_STEPS_PER_MIL) / JOURNAL_STEPS_PER_MIL }))
    .filter(cause => cause.mil > 0);
}

export function mainOfAmounts(causes: readonly CauseAmount[], clickMil: number): CauseKind | null {
  return largest(causes.map(cause => [cause.kind, Math.abs(roundToClicks(cause.mil, clickMil))] as const).filter(([, clicks]) => clicks > 0));
}

export function groupPoint(breakdown: MissBreakdown): Correction {
  return breakdown.causes.filter(cause => GROUP_CAUSES.includes(cause.kind)).reduce((sum, cause) => plus(sum, cause.vector), ZERO);
}

function clicksOf(vector: Correction, clickMil: number): number {
  return Math.abs(roundToClicks(Math.hypot(vector.upMrad, vector.rightMrad), clickMil));
}

function plus(first: Correction, second: Correction): Correction {
  return { upMrad: first.upMrad + second.upMrad, rightMrad: first.rightMrad + second.rightMrad };
}

function minus(first: Correction, second: Correction): Correction {
  return { upMrad: first.upMrad - second.upMrad, rightMrad: first.rightMrad - second.rightMrad };
}
