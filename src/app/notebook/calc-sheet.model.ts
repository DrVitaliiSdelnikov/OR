import { CheckErrorType } from '../../core/calc-check';
import { FLAG_DISTANCES_M } from '../../core/content';
import { dopeRowAt } from '../../core/dope-card';
import { modeMultiplier, NotebookMode } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { Chip, ChipKind, FLAG_ZONE_KINDS, Notebook, NotebookStepId, softHint, StaleReason, stepSheet } from '../../sim/notebook';

export type FormulaToken = { kind: 'text'; text: string } | { kind: 'slot'; index: number; label: string; placedText: string | null };
export type HubRowState = 'empty' | 'recorded' | 'stale';
export type DraftKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

export interface HubRow {
  step: NotebookStepId;
  number: number;
  title: string;
  formula: string;
  state: HubRowState;
  valueText: string;
  note: string;
}

export interface SideOption {
  label: string;
  sign: 1 | -1;
}

type TemplatePart = string | { slot: ChipKind } | { constant: ChipKind } | { weight: number };

const T = text.notebook.calc;

export const STEP_TITLES: Record<NotebookStepId, string> = T.stepTitles;
export const TAPE_UNITS: Partial<Record<NotebookStepId, string>> = T.tapeUnits;

export const STEP_FORMULAS: Record<NotebookStepId, string> = T.stepFormulas;
export const SLOT_LABELS: Record<ChipKind, string> = T.slotLabels;
const VERTICAL_STEPS: ReadonlySet<NotebookStepId> = new Set(['dope', 'atmosphere']);
const HINT_TEXTS: Record<CheckErrorType, string> = T.hints;
const STALE_TEXTS: Record<StaleReason, string> = T.stale;
const MISSING_TEXTS: Partial<Record<ChipKind, string>> = {
  ...T.missing,
  ...Object.fromEntries(FLAG_ZONE_KINDS.map((kind, index) => [kind, T.missingFlag({ distanceM: FLAG_DISTANCES_M[index] })])),
};
const MODE_NAMES: Record<NotebookMode, string> = T.modeNames;
const MAX_DRAFT_LENGTH = 6;
const MAX_DRAFT_DECIMALS = 3;
const PERCENT = 100;

export function hubSteps(notebook: Notebook): NotebookStepId[] {
  const { target, hasZones } = notebook.context;
  const steps: NotebookStepId[] = [];
  if (target.distanceM === null) {
    steps.push('distance');
  }
  steps.push('dope', 'atmosphere');
  if (hasZones) {
    steps.push('zones');
  }
  steps.push('wind');
  if (target.movement) {
    steps.push('lead');
  }
  return steps;
}

export function hubRows(notebook: Notebook): HubRow[] {
  return hubSteps(notebook).map((step, index) => {
    const state = notebook.steps[step];
    const base = { step, number: index + 1, title: STEP_TITLES[step], formula: STEP_FORMULAS[step] };
    if (state.staleReason) {
      return { ...base, state: 'stale' as const, valueText: '', note: STALE_TEXTS[state.staleReason] };
    }
    if (!state.isRecorded) {
      return { ...base, state: 'empty' as const, valueText: '', note: T.notRecorded };
    }
    const hint = softHint(notebook, step);
    return { ...base, state: 'recorded' as const, valueText: stepValueText(step, state.tape[state.tape.length - 1]!, state.sign), note: hint ? T.recordedWithHint({ hint: HINT_TEXTS[hint] }) : T.recorded };
  });
}

export function formulaTokens(notebook: Notebook, step: NotebookStepId): FormulaToken[] {
  const sheet = stepSheet(notebook, step);
  const placedValues = new Map(sheet.chips.map(chip => [chip.kind, chip]));
  const slotIndexOf = (kind: ChipKind): number => sheet.slots.findIndex(slot => slot.chipKind === kind);
  const slotToken = (kind: ChipKind): FormulaToken => {
    const index = slotIndexOf(kind);
    const placed = sheet.slots[index]?.placed ?? null;
    const placedChip = placed ? placedValues.get(placed) : undefined;
    return { kind: 'slot', index, label: SLOT_LABELS[kind], placedText: placedChip ? chipText(placedChip, notebook.distanceM).value : null };
  };
  return template(notebook, step).map(part => {
    if (typeof part === 'string') {
      return { kind: 'text', text: part };
    }
    if ('weight' in part) {
      return { kind: 'text', text: part.weight.toFixed(2) };
    }
    if ('slot' in part) {
      return slotToken(part.slot);
    }
    const printed = sheet.printedConstants.find(chip => chip.kind === part.constant);
    return printed ? { kind: 'text', text: chipText(printed, notebook.distanceM).value } : slotToken(part.constant);
  });
}

export function chipText(chip: Chip, distanceM: number | null): { value: string; source: string } {
  const rowText = distanceM === null ? '' : T.chipRow({ distanceM: Math.round(distanceM) });
  const sources = T.chipSources;
  switch (chip.kind) {
    case 'distance':
      return { value: T.meters({ distanceM: Math.round(chip.value) }), source: 'D' };
    case 'neighbor-distance':
      return { value: T.meters({ distanceM: Math.round(chip.value) }), source: sources.neighborDistance };
    case 'target-size':
      return { value: T.meters({ distanceM: chip.value }), source: sources.targetSize };
    case 'reticle-mil':
      return { value: chip.value.toFixed(2), source: sources.reticleMil };
    case 'temperature':
      return { value: `${chip.value} C`, source: sources.temperature };
    case 'pressure':
      return { value: T.pressure({ pressureHpa: chip.value }), source: sources.pressure };
    case 'humidity':
      return { value: `${Math.round(chip.value * PERCENT)} %`, source: sources.humidity };
    case 'speed':
      return { value: chip.value.toFixed(1), source: sources.speed };
    case 'crosswind':
      return { value: chip.value.toFixed(1), source: sources.crosswind };
    case 'colder-column':
      return { value: chip.value.toFixed(2), source: T.colderColumnSource({ row: rowText }) };
    case 'pressure-column':
      return { value: chip.value.toFixed(2), source: T.pressureColumnSource({ row: rowText }) };
    case 'wind-constant':
      return { value: String(chip.value), source: `K${rowText}` };
    case 'zone-station':
      return { value: chip.value.toFixed(1), source: sources.zoneStation };
    case 'zone-200':
    case 'zone-400':
    case 'zone-600': {
      const distanceText = chip.kind.slice(5);
      return { value: chip.value.toFixed(1), source: chip.isBehindBerm ? T.flagBehindBermSource({ distanceText }) : T.flagSource({ distanceText }) };
    }
    case 'target-crosswind':
      return { value: chip.value.toFixed(1), source: sources.targetCrosswind };
    case 'target-speed':
      return { value: chip.value.toFixed(1), source: sources.targetSpeed };
    case 'time-of-flight':
      return { value: T.seconds({ seconds: chip.value }), source: `t${rowText}` };
    case 'neighbor-time':
      return { value: T.seconds({ seconds: chip.value }), source: sources.neighborTime };
  }
}

export function tapeLabels(notebook: Notebook, step: NotebookStepId): string[] {
  const clickText = T.roundToClick({ clickMil: notebook.context.card.clickMil });
  switch (step) {
    case 'distance':
      return [T.tapeDistance];
    case 'dope':
      return [T.tapeDope];
    case 'atmosphere':
      return [T.tapeAtmosphere];
    case 'zones':
      return [T.tapeZones];
    case 'wind': {
      const constant = stepSheet(notebook, step).printedConstants.find(chip => chip.kind === 'wind-constant');
      return ['V⊥ × D =', `÷ ${constant ? constant.value : 'K'} =`, clickText];
    }
    case 'lead':
      return ['V⊥ × t =', '÷ D × 1000 =', clickText];
  }
}

export function sideOptions(step: NotebookStepId): SideOption[] {
  if (step === 'distance') {
    return [];
  }
  if (step === 'zones') {
    return [
      { label: T.sides.windLeft, sign: 1 },
      { label: T.sides.windRight, sign: -1 },
    ];
  }
  if (VERTICAL_STEPS.has(step)) {
    return [
      { label: T.sides.up, sign: 1 },
      { label: T.sides.down, sign: -1 },
    ];
  }
  return [
    { label: T.sides.left, sign: -1 },
    { label: T.sides.right, sign: 1 },
  ];
}

export function missingInput(notebook: Notebook, step: NotebookStepId): string | null {
  const sheet = stepSheet(notebook, step);
  const available = new Set(sheet.chips.map(chip => chip.kind));
  const missing = sheet.slots.find(slot => !available.has(slot.chipKind));
  return missing ? (MISSING_TEXTS[missing.chipKind] ?? T.missingData) : null;
}

export function editDraft(draft: string, key: DraftKey): string {
  if (key === 'back') {
    return draft.slice(0, -1);
  }
  if (draft.length >= MAX_DRAFT_LENGTH) {
    return draft;
  }
  if (key === '.') {
    return draft.includes('.') ? draft : `${draft === '' ? '0' : draft}.`;
  }
  const dotIndex = draft.indexOf('.');
  if (dotIndex >= 0 && draft.length - dotIndex > MAX_DRAFT_DECIMALS) {
    return draft;
  }
  return draft === '0' ? key : draft + key;
}

export function modeBadge(mode: NotebookMode): string {
  return `${MODE_NAMES[mode]} ×${modeMultiplier(mode, false)}`;
}

function stepValueText(step: NotebookStepId, value: number, sign: 1 | -1 | null): string {
  const unit = TAPE_UNITS[step];
  if (step === 'distance') {
    return `${value} ${unit}`;
  }
  const arrow = value === 0 || sign === null ? '' : `${sideArrow(step, sign)} `;
  return `${arrow}${value}${unit ? ` ${unit}` : ''}`;
}

function sideArrow(step: NotebookStepId, sign: 1 | -1): string {
  if (VERTICAL_STEPS.has(step)) {
    return sign > 0 ? '↑' : '↓';
  }
  if (step === 'zones') {
    return sign > 0 ? T.windFromLeft : T.windFromRight;
  }
  return sign < 0 ? '←' : '→';
}

function template(notebook: Notebook, step: NotebookStepId): TemplatePart[] {
  switch (step) {
    case 'distance':
      return [T.templateDistance, { slot: 'target-size' }, ' × 1000 / ', { slot: 'reticle-mil' }];
    case 'dope':
      return [T.templateDope, { slot: 'distance' }];
    case 'atmosphere':
      return [T.templateAtmosphere,{ slot: 'temperature' }, ') / 10 × ', { constant: 'colder-column' }, ' + (', { slot: 'pressure' }, ' − 1013) / 10 × ', { constant: 'pressure-column' }];
    case 'zones': {
      const weights = notebook.distanceM === null ? [0, 0, 0, 0] : dopeRowAt(notebook.context.card, notebook.distanceM).zoneWeights;
      const zones: ChipKind[] = ['zone-station', 'zone-200', 'zone-400', 'zone-600'];
      return [T.templateZones, ...zones.flatMap((zone, index) => [...(index > 0 ? [' + '] : []), { weight: weights[index] }, ' × ', { slot: zone }])];
    }
    case 'wind':
      return ['W = ', { slot: 'crosswind' }, ' × ', { slot: 'distance' }, ' / ', { constant: 'wind-constant' }];
    case 'lead':
      return ['L = ', { slot: 'target-crosswind' }, ' × ', { slot: 'time-of-flight' }, ' / ', { slot: 'distance' }, ' × 1000'];
  }
}
