import { CheckErrorType } from '../../core/calc-check';
import { dopeRowAt } from '../../core/dope-card';
import { modeMultiplier, NotebookMode } from '../../core/exercise-scoring';
import { Chip, ChipKind, Notebook, NotebookStepId, softHint, StaleReason, stepSheet } from '../../sim/notebook';

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

export const STEP_TITLES: Record<NotebookStepId, string> = {
  distance: 'Дистанция',
  dope: 'ДОПЕ',
  atmosphere: 'Атмосфера',
  zones: 'Ветер по зонам',
  wind: 'Ветер',
  lead: 'Упреждение',
};
export const TAPE_UNITS: Partial<Record<NotebookStepId, string>> = { distance: 'м', zones: 'м/с' };

export const STEP_FORMULAS: Record<NotebookStepId, string> = {
  distance: 'Д = размер × 1000 / MIL',
  dope: 'ВЕРТ по строке карточки',
  atmosphere: 'ΔВЕРТ = (15 − T) / 10 × холоднее + (P − 1013) / 10 × давление',
  zones: 'V⊥ср = Σ доля × V⊥ зоны',
  wind: 'W = V⊥ × D / K',
  lead: 'L = V⊥ цели × t / D × 1000',
};
export const SLOT_LABELS: Record<ChipKind, string> = {
  'target-size': 'размер',
  'reticle-mil': 'MIL',
  distance: 'D',
  'neighbor-distance': 'D',
  temperature: 'T',
  pressure: 'P',
  humidity: 'RH',
  speed: 'V',
  crosswind: 'V⊥',
  'colder-column': 'холоднее',
  'pressure-column': 'давление',
  'wind-constant': 'K',
  'zone-station': 'станция',
  'zone-200': '200',
  'zone-400': '400',
  'zone-600': '600',
  'target-crosswind': 'V⊥ цели',
  'target-speed': 'V цели',
  'time-of-flight': 't',
  'neighbor-time': 't',
};
const VERTICAL_STEPS: ReadonlySet<NotebookStepId> = new Set(['dope', 'atmosphere']);
const HINT_TEXTS: Record<CheckErrorType, string> = {
  substitution: 'проверь, то ли число в слоте',
  arithmetic: 'проверь умножение и деление',
  rounding: 'проверь округление до клика',
  side: 'проверь сторону',
  units: 'проверь единицы',
  lead: 'проверь упреждение',
  reading: 'проверь показания',
  factor: 'проверь, что учтено',
  turret: 'проверь барабан',
};
const STALE_TEXTS: Record<StaleReason, string> = {
  cartridge: 'устарело · патрон сменён',
  distance: 'устарело · новая дистанция',
  conditions: 'устарело · новый замер',
  wind: 'устарело · ветер изменён',
};
const MISSING_TEXTS: Partial<Record<ChipKind, string>> = {
  'reticle-mil': 'сначала отметь гонг на вкладке «Дистанция»',
  distance: 'сначала шаг «Дистанция»',
  temperature: 'сначала сделай замер на вкладке «Условия»',
  pressure: 'сначала сделай замер на вкладке «Условия»',
  crosswind: 'сначала введи ветер на вкладке «Ветер»',
  'zone-station': 'сначала введи ветер на вкладке «Ветер»',
  'zone-200': 'сначала тапни флажок 200 м в стекле',
  'zone-400': 'сначала тапни флажок 400 м в стекле',
  'zone-600': 'сначала тапни флажок 600 м в стекле',
};
const MODE_NAMES: Record<NotebookMode, string> = { auto: 'АВТО', 'manual-easy': 'САМ · ЛЁГКИЙ', 'manual-hard': 'САМ · СЛОЖНЫЙ' };
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
      return { ...base, state: 'empty' as const, valueText: '', note: 'не записано' };
    }
    const hint = softHint(notebook, step);
    return { ...base, state: 'recorded' as const, valueText: stepValueText(step, state.tape[state.tape.length - 1]!, state.sign), note: hint ? `записано · ${HINT_TEXTS[hint]}` : 'записано' };
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
  const rowText = distanceM === null ? '' : ` строка ${Math.round(distanceM)} м`;
  switch (chip.kind) {
    case 'distance':
      return { value: `${Math.round(chip.value)} м`, source: 'D' };
    case 'neighbor-distance':
      return { value: `${Math.round(chip.value)} м`, source: 'D соседней цели' };
    case 'target-size':
      return { value: `${chip.value} м`, source: 'размер цели' };
    case 'reticle-mil':
      return { value: chip.value.toFixed(2), source: 'MIL на сетке' };
    case 'temperature':
      return { value: `${chip.value} C`, source: 'T станция' };
    case 'pressure':
      return { value: `${chip.value} гПа`, source: 'P станция' };
    case 'humidity':
      return { value: `${Math.round(chip.value * PERCENT)} %`, source: 'влажность станция' };
    case 'speed':
      return { value: chip.value.toFixed(1), source: 'V ветер' };
    case 'crosswind':
      return { value: chip.value.toFixed(1), source: 'V⊥ после часов' };
    case 'colder-column':
      return { value: chip.value.toFixed(2), source: `холоднее на 10 °C${rowText}` };
    case 'pressure-column':
      return { value: chip.value.toFixed(2), source: `давление +10 гПа${rowText}` };
    case 'wind-constant':
      return { value: String(chip.value), source: `K${rowText}` };
    case 'zone-station':
      return { value: chip.value.toFixed(1), source: 'V⊥ станция' };
    case 'zone-200':
    case 'zone-400':
    case 'zone-600':
      return { value: chip.value.toFixed(1), source: chip.isBehindBerm ? `флажок ${chip.kind.slice(5)} м за валом` : `V⊥ флажок ${chip.kind.slice(5)} м` };
    case 'target-crosswind':
      return { value: chip.value.toFixed(1), source: 'V⊥ цели' };
    case 'target-speed':
      return { value: chip.value.toFixed(1), source: 'V цели' };
    case 'time-of-flight':
      return { value: `${chip.value.toFixed(2)} с`, source: `t${rowText}` };
    case 'neighbor-time':
      return { value: `${chip.value.toFixed(2)} с`, source: 't соседней строки' };
  }
}

export function tapeLabels(notebook: Notebook, step: NotebookStepId): string[] {
  const clickText = `до клика ${notebook.context.card.clickMil} =`;
  switch (step) {
    case 'distance':
      return ['Д ='];
    case 'dope':
      return ['ВЕРТ ='];
    case 'atmosphere':
      return ['ΔВЕРТ ='];
    case 'zones':
      return ['V⊥ср ='];
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
      { label: 'Ветер слева', sign: 1 },
      { label: 'Ветер справа', sign: -1 },
    ];
  }
  if (VERTICAL_STEPS.has(step)) {
    return [
      { label: '↑ Вверх', sign: 1 },
      { label: '↓ Вниз', sign: -1 },
    ];
  }
  return [
    { label: '← Влево', sign: -1 },
    { label: 'Вправо →', sign: 1 },
  ];
}

export function missingInput(notebook: Notebook, step: NotebookStepId): string | null {
  const sheet = stepSheet(notebook, step);
  const available = new Set(sheet.chips.map(chip => chip.kind));
  const missing = sheet.slots.find(slot => !available.has(slot.chipKind));
  return missing ? (MISSING_TEXTS[missing.chipKind] ?? 'нет данных для шага') : null;
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
    return sign > 0 ? 'слева' : 'справа';
  }
  return sign < 0 ? '←' : '→';
}

function template(notebook: Notebook, step: NotebookStepId): TemplatePart[] {
  switch (step) {
    case 'distance':
      return ['Д = ', { slot: 'target-size' }, ' × 1000 / ', { slot: 'reticle-mil' }];
    case 'dope':
      return ['ВЕРТ = строка карточки на ', { slot: 'distance' }];
    case 'atmosphere':
      return ['ΔВЕРТ = (15 − ', { slot: 'temperature' }, ') / 10 × ', { constant: 'colder-column' }, ' + (', { slot: 'pressure' }, ' − 1013) / 10 × ', { constant: 'pressure-column' }];
    case 'zones': {
      const weights = notebook.distanceM === null ? [0, 0, 0, 0] : dopeRowAt(notebook.context.card, notebook.distanceM).zoneWeights;
      const zones: ChipKind[] = ['zone-station', 'zone-200', 'zone-400', 'zone-600'];
      return ['V⊥ср = ', ...zones.flatMap((zone, index) => [...(index > 0 ? [' + '] : []), { weight: weights[index] }, ' × ', { slot: zone }])];
    }
    case 'wind':
      return ['W = ', { slot: 'crosswind' }, ' × ', { slot: 'distance' }, ' / ', { constant: 'wind-constant' }];
    case 'lead':
      return ['L = ', { slot: 'target-crosswind' }, ' × ', { slot: 'time-of-flight' }, ' / ', { slot: 'distance' }, ' × 1000'];
  }
}
