import { roundToClicks } from './game-formulas';

export type CheckVerdict = 'exact' | 'close' | 'error';
export type CalcStepKind = 'distance' | 'dope' | 'atmosphere' | 'zones' | 'wind' | 'lead';
export type PreparationRowKind = 'reading-speed' | 'reading-direction' | 'factors' | 'turret-elevation' | 'turret-windage';
export type CheckErrorType = 'units' | 'substitution' | 'side' | 'rounding' | 'arithmetic' | 'lead' | 'reading' | 'factor' | 'turret';

export interface CalcStepInput {
  step: CalcStepKind;
  expectedInputs: readonly number[];
  playerInputs: readonly number[];
  expectedRawMil: number;
  playerMil: number;
  playerUnits: 'mil' | 'moa';
}

export interface PreparationRowInput {
  row: PreparationRowKind;
  clicksOff: number;
  isWrongSide: boolean;
}

export interface CheckedRow {
  status: CheckVerdict;
  errorTypes: readonly CheckErrorType[];
  clicksOff: number;
}

export interface CheckResult {
  verdict: CheckVerdict;
  rows: readonly CheckedRow[];
  mainError: { rowIndex: number; type: CheckErrorType } | null;
  otherErrorsCount: number;
  counts: Record<CheckVerdict, number>;
}

const CLOSE_CLICKS = 1;
const WHOLE_CLICK_EPSILON = 1e-9;
const VERDICT_SEVERITY: Record<CheckVerdict, number> = { exact: 0, close: 1, error: 2 };
const LEAD_RENAMED_TYPES: ReadonlySet<CheckErrorType> = new Set(['substitution', 'rounding', 'arithmetic']);
const PREPARATION_ERROR_TYPES: Record<PreparationRowKind, CheckErrorType> = {
  'reading-speed': 'reading',
  'reading-direction': 'reading',
  factors: 'factor',
  'turret-elevation': 'turret',
  'turret-windage': 'turret',
};

export function checkManualSteps(steps: readonly CalcStepInput[], clickMil: number): CheckResult {
  return summarize(steps.map(step => checkManualStep(step, clickMil)));
}

export function checkPreparation(rows: readonly PreparationRowInput[]): CheckResult {
  return summarize(
    rows.map(row => {
      if (row.isWrongSide) {
        return { status: 'error' as const, errorTypes: ['side' as const], clicksOff: row.clicksOff };
      }
      const status = statusByClicks(row.clicksOff);
      return { status, errorTypes: status === 'exact' ? [] : [PREPARATION_ERROR_TYPES[row.row]], clicksOff: row.clicksOff };
    }),
  );
}

function checkManualStep(step: CalcStepInput, clickMil: number): CheckedRow {
  const expectedClicks = roundToClicks(step.expectedRawMil, clickMil);
  const playerClicks = roundToClicks(step.playerMil, clickMil);
  const clicksOff = Math.abs(playerClicks - expectedClicks);
  const isWrongUnits = step.playerUnits !== 'mil';
  const isWrongSide = playerClicks !== 0 && expectedClicks !== 0 && Math.sign(playerClicks) !== Math.sign(expectedClicks);
  const hasWrongInputs = !isSameInputs(step.expectedInputs, step.playerInputs);

  if (!isWrongUnits && !isWrongSide && clicksOff === 0) {
    return { status: 'exact', errorTypes: [], clicksOff: 0 };
  }
  const errorTypes: CheckErrorType[] = [];
  if (isWrongUnits) {
    errorTypes.push('units');
  }
  if (hasWrongInputs) {
    errorTypes.push('substitution');
  }
  if (isWrongSide) {
    errorTypes.push('side');
  }
  if (!isWrongUnits && !hasWrongInputs && !isWrongSide) {
    errorTypes.push(isOtherNeighbourClick(step.expectedRawMil, playerClicks, clickMil) ? 'rounding' : 'arithmetic');
  }
  const status = isWrongUnits || isWrongSide ? 'error' : statusByClicks(clicksOff);
  return { status, errorTypes: step.step === 'lead' ? renamedForLead(errorTypes) : errorTypes, clicksOff };
}

function isOtherNeighbourClick(expectedRawMil: number, playerClicks: number, clickMil: number): boolean {
  const rawClicks = expectedRawMil / clickMil;
  if (Math.abs(rawClicks - Math.round(rawClicks)) < WHOLE_CLICK_EPSILON) {
    return false;
  }
  return playerClicks === Math.floor(rawClicks) || playerClicks === Math.ceil(rawClicks);
}

function renamedForLead(errorTypes: readonly CheckErrorType[]): CheckErrorType[] {
  const renamed = errorTypes.map(type => (LEAD_RENAMED_TYPES.has(type) ? 'lead' : type));
  return renamed.filter((type, index) => renamed.indexOf(type) === index);
}

function statusByClicks(clicksOff: number): CheckVerdict {
  if (clicksOff === 0) {
    return 'exact';
  }
  return clicksOff <= CLOSE_CLICKS ? 'close' : 'error';
}

function isSameInputs(expected: readonly number[], player: readonly number[]): boolean {
  return expected.length === player.length && expected.every((value, index) => value === player[index]);
}

function summarize(rows: readonly CheckedRow[]): CheckResult {
  const counts: Record<CheckVerdict, number> = { exact: 0, close: 0, error: 0 };
  let mainRowIndex = -1;
  rows.forEach((row, index) => {
    counts[row.status]++;
    if (row.status !== 'exact' && (mainRowIndex < 0 || VERDICT_SEVERITY[row.status] > VERDICT_SEVERITY[rows[mainRowIndex].status])) {
      mainRowIndex = index;
    }
  });
  const errorTypesTotal = rows.reduce((total, row) => total + row.errorTypes.length, 0);
  const verdict: CheckVerdict = counts.error > 0 ? 'error' : counts.close > 0 ? 'close' : 'exact';
  return {
    verdict,
    rows,
    mainError: mainRowIndex < 0 ? null : { rowIndex: mainRowIndex, type: rows[mainRowIndex].errorTypes[0] },
    otherErrorsCount: mainRowIndex < 0 ? 0 : errorTypesTotal - 1,
    counts,
  };
}
