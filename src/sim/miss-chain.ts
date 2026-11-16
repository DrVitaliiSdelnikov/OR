import { roundToClicks } from '../core/game-formulas';
import { Correction } from '../core/types';
import {
  angleShiftFromDopeMil,
  factorContributions,
  FormulaInputs,
  formulaProbe,
  movementDirection,
  Notebook,
  NotebookFactor,
  playerFactorMil,
  playerFlagCrosswindsMps,
  total,
} from './notebook';

export type ChainLinkKind =
  | 'distance'
  | 'dope'
  | 'conditions'
  | 'angle'
  | 'earth'
  | 'wind-speed'
  | 'wind-clock'
  | 'zones'
  | 'wind-calc'
  | 'lead'
  | 'rounding'
  | 'turret';

export type ChainQuantity = 'distance' | 'windSpeed' | 'clock' | 'crosswinds' | 'mil' | 'mil-vector';
export type ChainValue = number | readonly number[] | Correction | null;

export interface ChainLink {
  kind: ChainLinkKind;
  vector: Correction;
  clicks: number;
  quantity: ChainQuantity;
  player: ChainValue;
  truth: ChainValue;
}

export interface MissChainInput {
  notebook: Notebook;
  truth: FormulaInputs;
  dial: Correction;
  hasKnockedSight: boolean;
}

export const CHAIN_ORDER: readonly ChainLinkKind[] = ['distance', 'dope', 'conditions', 'angle', 'earth', 'wind-speed', 'wind-clock', 'zones', 'wind-calc', 'lead', 'rounding', 'turret'];

const ZERO: Correction = { upMrad: 0, rightMrad: 0 };
const UP_FACTORS: readonly NotebookFactor[] = ['dope', 'conditions', 'angle', 'eotvos'];
const RIGHT_FACTORS: readonly NotebookFactor[] = ['wind', 'spin', 'coriolis'];
const EARTH_FACTORS: readonly NotebookFactor[] = ['spin', 'coriolis', 'eotvos'];

interface ChainState {
  inputs: FormulaInputs;
  playerFactors: ReadonlySet<NotebookFactor>;
}

type StateStep = { kind: Exclude<ChainLinkKind, 'lead' | 'rounding' | 'turret'>; next: (state: ChainState) => ChainState };

/**
 * Формула игрока считается от правды, и в неё по одному подставляются его вводы и шаги в порядке `CHAIN_ORDER`;
 * разность соседних расчётов — вклад звена. Звенья (кроме упреждения) в сумме дают «накрутка + удержание − формула на правде»,
 * то есть прежние лепестки «расчёт» и «ветер» вместе.
 */
export function missChain(input: MissChainInput): ChainLink[] {
  const { notebook, truth } = input;
  const playerWind = notebook.readings.wind ?? { speedMps: 0, clock: truth.wind.clock };
  const playerInputs: FormulaInputs = {
    distanceM: notebook.distanceM ?? truth.distanceM,
    temperatureC: truth.temperatureC,
    pressureHpa: truth.pressureHpa,
    wind: playerWind,
    flagCrosswindsMps: playerFlagCrosswindsMps(notebook),
  };
  const withFactors = (...factors: NotebookFactor[]) => (state: ChainState): ChainState => ({ ...state, playerFactors: new Set([...state.playerFactors, ...factors]) });
  const withInputs = (change: Partial<FormulaInputs>) => (state: ChainState): ChainState => ({ ...state, inputs: { ...state.inputs, ...change } });
  const steps: StateStep[] = [
    { kind: 'distance', next: withInputs({ distanceM: playerInputs.distanceM }) },
    { kind: 'dope', next: withFactors('dope') },
    { kind: 'conditions', next: withFactors('conditions') },
    { kind: 'angle', next: withFactors('angle') },
    { kind: 'earth', next: withFactors(...EARTH_FACTORS) },
    { kind: 'wind-speed', next: state => withInputs({ wind: { ...state.inputs.wind, speedMps: playerWind.speedMps } })(state) },
    { kind: 'wind-clock', next: state => withInputs({ wind: { ...state.inputs.wind, clock: playerWind.clock } })(state) },
    { kind: 'zones', next: withInputs({ flagCrosswindsMps: playerInputs.flagCrosswindsMps }) },
    { kind: 'wind-calc', next: withFactors('wind') },
  ];

  let state: ChainState = { inputs: truth, playerFactors: new Set() };
  let previous = formulaAt(notebook, state);
  const links: ChainLink[] = [];
  for (const step of steps) {
    const nextState = step.next(state);
    const current = formulaAt(notebook, nextState);
    links.push(chainLink(notebook, step.kind, minus(current.correction, previous.correction), valuesOf(step.kind, notebook, state, previous, current, playerWind)));
    state = nextState;
    previous = current;
  }

  const planned = total(notebook);
  const clickMil = notebook.context.card.clickMil;
  const plannedHold: Correction = { upMrad: planned.holdUpMil, rightMrad: planned.holdRightMil };
  const rounded: Correction = { upMrad: planned.elevation.targetClicks * clickMil + plannedHold.upMrad, rightMrad: -planned.windageLeft.targetClicks * clickMil + plannedHold.rightMrad };
  const dialed = plus(input.hasKnockedSight ? ZERO : input.dial, plannedHold);
  links.push(leadLink(notebook));
  links.push(chainLink(notebook, 'rounding', minus(rounded, previous.correction), { quantity: 'mil-vector', player: rounded, truth: previous.correction }));
  links.push(chainLink(notebook, 'turret', minus(dialed, rounded), { quantity: 'mil-vector', player: dialed, truth: rounded }));
  return links;
}

interface FormulaAt {
  correction: Correction;
  factorMil: Record<NotebookFactor, number>;
}

function formulaAt(notebook: Notebook, state: ChainState): FormulaAt {
  const probe = formulaProbe(notebook, state.inputs);
  const auto = factorContributions(probe);
  const isPlayer = (factor: NotebookFactor): boolean => state.playerFactors.has(factor);
  const dopeMil = isPlayer('dope') ? playerFactorMil(notebook, 'dope') : (auto.dope.mil ?? 0);
  const valueOf = (factor: NotebookFactor): number => {
    if (isPlayer(factor)) {
      return playerFactorMil(notebook, factor);
    }
    if (factor === 'dope') {
      return dopeMil;
    }
    if (factor === 'angle' && isPlayer('dope')) {
      return angleShiftFromDopeMil(probe, dopeMil) ?? 0;
    }
    return auto[factor].mil ?? 0;
  };
  const factorMil = Object.fromEntries([...UP_FACTORS, ...RIGHT_FACTORS, 'lead'].map(factor => [factor, valueOf(factor as NotebookFactor)])) as Record<NotebookFactor, number>;
  return {
    correction: {
      upMrad: UP_FACTORS.reduce((sum, factor) => sum + factorMil[factor], 0),
      rightMrad: RIGHT_FACTORS.reduce((sum, factor) => sum + factorMil[factor], 0),
    },
    factorMil,
  };
}

function valuesOf(
  kind: StateStep['kind'],
  notebook: Notebook,
  before: ChainState,
  previous: FormulaAt,
  current: FormulaAt,
  playerWind: { speedMps: number; clock: number },
): Pick<ChainLink, 'quantity' | 'player' | 'truth'> {
  switch (kind) {
    case 'distance':
      return { quantity: 'distance', player: notebook.distanceM ?? before.inputs.distanceM, truth: before.inputs.distanceM };
    case 'dope':
      return { quantity: 'mil', player: current.factorMil.dope, truth: previous.factorMil.dope };
    case 'conditions':
      return { quantity: 'mil', player: current.factorMil.conditions, truth: previous.factorMil.conditions };
    case 'angle':
      return { quantity: 'mil', player: current.factorMil.angle, truth: previous.factorMil.angle };
    case 'earth':
      return { quantity: 'mil-vector', player: earthOf(current), truth: earthOf(previous) };
    case 'wind-speed':
      return { quantity: 'windSpeed', player: playerWind.speedMps, truth: before.inputs.wind.speedMps };
    case 'wind-clock':
      return { quantity: 'clock', player: playerWind.clock, truth: before.inputs.wind.clock };
    case 'zones':
      return { quantity: 'crosswinds', player: playerFlagCrosswindsMps(notebook), truth: before.inputs.flagCrosswindsMps };
    case 'wind-calc':
      return { quantity: 'mil', player: current.factorMil.wind, truth: previous.factorMil.wind };
  }
}

function earthOf(formula: FormulaAt): Correction {
  return { upMrad: formula.factorMil.eotvos, rightMrad: formula.factorMil.spin + formula.factorMil.coriolis };
}

// Упреждение держат сеткой, а не барабаном: его ошибка расчёта вырезается из лепестка исполнения `lead`, а не из «расчёта».
function leadLink(notebook: Notebook): ChainLink {
  const movement = notebook.context.target.movement;
  if (!movement) {
    return chainLink(notebook, 'lead', ZERO, { quantity: 'mil', player: null, truth: null });
  }
  const playerLeadMil = playerFactorMil(notebook, 'lead');
  const trueLeadMil = factorContributions({ ...notebook, mode: 'auto' }).lead.mil ?? 0;
  return chainLink(notebook, 'lead', { upMrad: 0, rightMrad: movementDirection(movement.clock) * (playerLeadMil - trueLeadMil) }, { quantity: 'mil', player: playerLeadMil, truth: trueLeadMil });
}

function chainLink(notebook: Notebook, kind: ChainLinkKind, vector: Correction, values: Pick<ChainLink, 'quantity' | 'player' | 'truth'>): ChainLink {
  return { kind, vector, clicks: Math.abs(roundToClicks(Math.hypot(vector.upMrad, vector.rightMrad), notebook.context.card.clickMil)), ...values };
}

function plus(first: Correction, second: Correction): Correction {
  return { upMrad: first.upMrad + second.upMrad, rightMrad: first.rightMrad + second.rightMrad };
}

function minus(first: Correction, second: Correction): Correction {
  return { upMrad: first.upMrad - second.upMrad, rightMrad: first.rightMrad - second.rightMrad };
}
