import { CheckErrorType } from '../../core/calc-check';
import { decimal } from '../../i18n/format';
import { rangeLayout, STANDARD_PRESSURE_HPA, STANDARD_TEMPERATURE_C } from '../../core/content';
import { dopeRowAt } from '../../core/dope-card';
import { IMPERIAL_COLDER_STEP_F, IMPERIAL_PRESSURE_STEP_INHG, STANDARD_PRESSURE_INHG, STANDARD_TEMPERATURE_F } from '../../core/game-formulas';
import { UnitSystem } from '../../core/units';
import { modeMultiplier, NotebookMode } from '../../core/exercise-scoring';
import { text } from '../../i18n';
import { Chip, ChipKind, FLAG_ZONE_KINDS, geometryFactorsOn, Notebook, NotebookStepId, softHint, StaleReason, stepHasSide, stepSheet } from '../../sim/notebook';

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

export const STEP_FORMULAS: Record<NotebookStepId, string> = T.stepFormulas;
const IMPERIAL_STEP_FORMULAS: Partial<Record<NotebookStepId, string>> = T.stepFormulasImperial;
const UNITS = text.units;
const FLAG_CHIP_PREFIX = 'zone-';
const METRIC_COLUMN_STEP = 10;
const IMPERIAL_MILLING_TEXT = ' × 27,78 / ';
const METRIC_MILLING_TEXT = ' × 1000 / ';
const ATMOSPHERE_TEMPLATE: Record<UnitSystem, { standardTemperature: number; standardPressure: number; temperatureStep: number; pressureStep: number }> = {
  metric: { standardTemperature: STANDARD_TEMPERATURE_C, standardPressure: STANDARD_PRESSURE_HPA, temperatureStep: METRIC_COLUMN_STEP, pressureStep: METRIC_COLUMN_STEP },
  imperial: { standardTemperature: STANDARD_TEMPERATURE_F, standardPressure: STANDARD_PRESSURE_INHG, temperatureStep: IMPERIAL_COLDER_STEP_F, pressureStep: IMPERIAL_PRESSURE_STEP_INHG },
};
const PRESSURE_DIGITS: Record<UnitSystem, number> = { metric: 0, imperial: 2 };
const PRESSURE_STEP_DIGITS: Record<UnitSystem, number> = { metric: 0, imperial: 1 };

export function stepFormula(step: NotebookStepId, system: UnitSystem): string {
  return system === 'imperial' ? (IMPERIAL_STEP_FORMULAS[step] ?? STEP_FORMULAS[step]) : STEP_FORMULAS[step];
}
export const SLOT_LABELS: Record<ChipKind, string> = T.slotLabels;
const VERTICAL_STEPS: ReadonlySet<NotebookStepId> = new Set(['dope', 'atmosphere', 'angle', 'eotvos']);
const HINT_TEXTS: Record<CheckErrorType, string> = T.hints;
const STALE_TEXTS: Record<StaleReason, string> = T.stale;
export function tapeUnit(step: NotebookStepId, system: UnitSystem): string | undefined {
  if (step === 'distance') {
    return UNITS.unitLabel('distance', system);
  }
  return step === 'zones' ? UNITS.unitLabel('windSpeed', system) : undefined;
}

function missingTexts(system: UnitSystem): Partial<Record<ChipKind, string>> {
  return {
    ...T.missing,
    ...Object.fromEntries(FLAG_ZONE_KINDS.map((kind, index) => [kind, T.missingFlag({ distance: UNITS.valueText('distance', rangeLayout(system).flagDistancesM[index], system, 0) })])),
  };
}
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
  const geometryFactors = geometryFactorsOn(notebook.context);
  steps.push('dope');
  if (geometryFactors.angle) {
    steps.push('angle');
  }
  steps.push('atmosphere');
  if (hasZones) {
    steps.push('zones');
  }
  steps.push('wind');
  if (geometryFactors.spin) {
    steps.push('spin');
  }
  if (geometryFactors.coriolis) {
    steps.push('coriolis', 'eotvos');
  }
  if (target.movement) {
    steps.push('lead');
  }
  return steps;
}

export function hubRows(notebook: Notebook): HubRow[] {
  return hubSteps(notebook).map((step, index) => {
    const state = notebook.steps[step];
    const base = { step, number: index + 1, title: STEP_TITLES[step], formula: stepFormula(step, notebook.context.card.system) };
    if (state.staleReason) {
      return { ...base, state: 'stale' as const, valueText: '', note: STALE_TEXTS[state.staleReason] };
    }
    if (!state.isRecorded) {
      return { ...base, state: 'empty' as const, valueText: '', note: T.notRecorded };
    }
    const hint = softHint(notebook, step);
    return { ...base, state: 'recorded' as const, valueText: stepValueText(step, state.tape[state.tape.length - 1]!, state.sign, notebook.context.card.system), note: hint ? T.recordedWithHint({ hint: HINT_TEXTS[hint] }) : T.recorded };
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
    return { kind: 'slot', index, label: SLOT_LABELS[kind], placedText: placedChip ? chipText(placedChip, notebook.distanceM, notebook.context.card.system).value : null };
  };
  return template(notebook, step).map(part => {
    if (typeof part === 'string') {
      return { kind: 'text', text: part };
    }
    if ('weight' in part) {
      return { kind: 'text', text: decimal(part.weight, 2) };
    }
    if ('slot' in part) {
      return slotToken(part.slot);
    }
    const printed = sheet.printedConstants.find(chip => chip.kind === part.constant);
    return printed ? { kind: 'text', text: chipText(printed, notebook.distanceM, notebook.context.card.system).value } : slotToken(part.constant);
  });
}

function windConstantText(windConstant: number): string {
  return String(Math.round(windConstant));
}

export function chipText(chip: Chip, distanceM: number | null, system: UnitSystem = 'metric'): { value: string; source: string } {
  const rowText = distanceM === null ? '' : T.chipRow({ distance: UNITS.valueText('distance', distanceM, system, 0) });
  const steps = ATMOSPHERE_TEMPLATE[system];
  const sources = T.chipSources;
  switch (chip.kind) {
    case 'distance':
      return { value: UNITS.displayText('distance', chip.value, system, 0), source: 'D' };
    case 'neighbor-distance':
      return { value: UNITS.displayText('distance', chip.value, system, 0), source: sources.neighborDistance };
    case 'target-size':
      return { value: targetSizeText(chip.value, system), source: sources.targetSize };
    case 'reticle-mil':
      return { value: decimal(chip.value, 2), source: sources.reticleMil };
    case 'temperature':
      return { value: `${decimal(chip.value)} ${UNITS.unitLabel('temperature', system)}`, source: sources.temperature };
    case 'pressure':
      return { value: UNITS.displayText('pressure', chip.value, system, PRESSURE_DIGITS[system]), source: sources.pressure };
    case 'humidity':
      return { value: `${Math.round(chip.value * PERCENT)} %`, source: sources.humidity };
    case 'speed':
      return { value: decimal(chip.value, 1), source: sources.speed };
    case 'crosswind':
      return { value: decimal(chip.value, 1), source: sources.crosswind };
    case 'colder-column':
      return { value: decimal(chip.value, 2), source: T.colderColumnSource({ step: UNITS.displayText('temperature', steps.temperatureStep, system, 0), row: rowText }) };
    case 'pressure-column':
      return { value: decimal(chip.value, 2), source: T.pressureColumnSource({ step: UNITS.displayText('pressure', steps.pressureStep, system, PRESSURE_STEP_DIGITS[system]), row: rowText }) };
    case 'wind-constant':
      return { value: windConstantText(chip.value), source: `K${rowText}` };
    case 'zone-station':
      return { value: decimal(chip.value, 1), source: sources.zoneStation };
    case 'zone-200':
    case 'zone-400':
    case 'zone-600': {
      const distance = UNITS.displayText('distance', Number(chip.kind.slice(FLAG_CHIP_PREFIX.length)), system, 0);
      return { value: decimal(chip.value, 1), source: chip.isBehindBerm ? T.flagBehindBermSource({ distance }) : T.flagSource({ distance }) };
    }
    case 'target-crosswind':
      return { value: decimal(chip.value, 1), source: sources.targetCrosswind };
    case 'target-speed':
      return { value: decimal(chip.value, 1), source: sources.targetSpeed };
    case 'time-of-flight':
      return { value: T.seconds({ seconds: chip.value }), source: `t${rowText}` };
    case 'neighbor-time':
      return { value: T.seconds({ seconds: chip.value }), source: sources.neighborTime };
    case 'dope-elevation':
      return { value: decimal(chip.value, 1), source: T.dopeElevationSource({ row: rowText }) };
    case 'zero-angle':
      return { value: decimal(chip.value, 2), source: T.zeroAngleSource };
    case 'spin-drift':
      return { value: decimal(chip.value, 2), source: T.spinDriftSource({ row: rowText }) };
    case 'earth-rotation':
      return { value: decimal(chip.value, 4), source: T.earthRotationSource };
    case 'cos-angle':
      return { value: decimal(chip.value, 2), source: T.angleSource({ lookAngleDeg: chip.degrees ?? 0 }) };
    case 'sin-latitude':
    case 'cos-latitude':
      return { value: decimal(chip.value, 2), source: T.latitudeSource({ latitudeDeg: chip.degrees ?? 0 }) };
    case 'sin-azimuth':
      return { value: decimal(chip.value, 2), source: T.azimuthSource({ azimuthDeg: chip.degrees ?? 0 }) };
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
      return ['V⊥ × D =', `÷ ${constant ? windConstantText(constant.value) : 'K'} =`, clickText];
    }
    case 'lead':
      return notebook.context.card.system === 'imperial' ? ['V⊥ × t =', '× 488,9 ÷ D =', clickText] : ['V⊥ × t =', '÷ D × 1000 =', clickText];
    case 'angle':
      return [...T.tapeAngle];
    case 'spin':
      return [T.tapeSpin];
    case 'coriolis':
      return [T.tapeCoriolis];
    case 'eotvos':
      return [T.tapeEotvos];
  }
}

export function sideOptions(step: NotebookStepId): SideOption[] {
  if (!stepHasSide(step)) {
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
  return missing ? (missingTexts(notebook.context.card.system)[missing.chipKind] ?? T.missingData) : null;
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
  return `${MODE_NAMES[mode]} ×${decimal(modeMultiplier(mode, false))}`;
}

function stepValueText(step: NotebookStepId, value: number, sign: 1 | -1 | null, system: UnitSystem): string {
  if (step === 'distance') {
    return `${decimal(value)} ${UNITS.unitName('distance', system, value)}`;
  }
  const arrow = value === 0 || sign === null ? '' : `${sideArrow(step, sign)} `;
  return `${arrow}${decimal(value)}${step === 'zones' ? ` ${UNITS.unitLabel('windSpeed', system)}` : ''}`;
}

function targetSizeText(value: number, system: UnitSystem): string {
  return system === 'metric' ? `${decimal(value)} ${UNITS.unitLabel('targetSize', system)}` : UNITS.displayText('targetSize', value, system, 1);
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
  const system = notebook.context.card.system;
  const atmosphere = ATMOSPHERE_TEMPLATE[system];
  switch (step) {
    case 'distance':
      return [T.templateDistance, { slot: 'target-size' }, system === 'imperial' ? IMPERIAL_MILLING_TEXT : METRIC_MILLING_TEXT, { slot: 'reticle-mil' }];
    case 'dope':
      return [T.templateDope, { slot: 'distance' }];
    case 'atmosphere':
      return [
        T.templateAtmosphere({ standardTemperature: decimal(atmosphere.standardTemperature) }),
        { slot: 'temperature' },
        `) / ${decimal(atmosphere.temperatureStep)} × `,
        { constant: 'colder-column' },
        ' + (',
        { slot: 'pressure' },
        ` − ${decimal(atmosphere.standardPressure)}) / ${decimal(atmosphere.pressureStep)} × `,
        { constant: 'pressure-column' },
      ];
    case 'zones': {
      const weights = notebook.distanceM === null ? [0, 0, 0, 0] : dopeRowAt(notebook.context.card, notebook.distanceM).zoneWeights;
      const zones: ChipKind[] = ['zone-station', 'zone-200', 'zone-400', 'zone-600'];
      return [T.templateZones, ...zones.flatMap((zone, index) => [...(index > 0 ? [' + '] : []), { weight: weights[index] }, ' × ', { slot: zone }])];
    }
    case 'wind':
      return ['W = ', { slot: 'crosswind' }, ' × ', { slot: 'distance' }, ' / ', { constant: 'wind-constant' }];
    case 'lead':
      return system === 'imperial'
        ? ['L = 488,9 × ', { slot: 'target-crosswind' }, ' × ', { slot: 'time-of-flight' }, ' / ', { slot: 'distance' }]
        : ['L = ', { slot: 'target-crosswind' }, ' × ', { slot: 'time-of-flight' }, ' / ', { slot: 'distance' }, ' × 1000'];
    case 'angle':
      return [T.templateAngle, { slot: 'dope-elevation' }, ' + ', { slot: 'zero-angle' }, ') × ', { slot: 'cos-angle' }, ' − Z'];
    case 'spin':
      return [T.templateSpin, { slot: 'spin-drift' }];
    case 'coriolis':
      return [T.templateCoriolis, { constant: 'earth-rotation' }, ' × ', { slot: 'time-of-flight' }, ' × ', { slot: 'sin-latitude' }];
    case 'eotvos':
      return [T.templateEotvos, { constant: 'earth-rotation' }, ' × ', { slot: 'time-of-flight' }, ' × ', { slot: 'cos-latitude' }, ' × ', { slot: 'sin-azimuth' }];
  }
}
