import { describe, expect, it } from 'vitest';
import { CalcStepInput, checkManualSteps, checkPreparation } from './calc-check';

const CLICK_MIL = 0.1;

function windStep(overrides: Partial<CalcStepInput>): CalcStepInput {
  return {
    step: 'wind',
    expectedInputs: [3.2, 300, 1610],
    playerInputs: [3.2, 300, 1610],
    expectedRawMil: -0.596,
    playerMil: -0.6,
    playerUnits: 'mil',
    ...overrides,
  };
}

const setADopeStep: CalcStepInput = {
  step: 'dope',
  expectedInputs: [300],
  playerInputs: [300],
  expectedRawMil: 1.6,
  playerMil: 1.6,
  playerUnits: 'mil',
};

const setAAtmosphereStep: CalcStepInput = {
  step: 'atmosphere',
  expectedInputs: [14, 1015],
  playerInputs: [14, 1015],
  expectedRawMil: 0.003,
  playerMil: 0,
  playerUnits: 'mil',
};

describe('checkManualSteps', () => {
  it('set А: every step right → exact, no errors', () => {
    const result = checkManualSteps([setADopeStep, setAAtmosphereStep, windStep({})], CLICK_MIL);
    expect(result.verdict).toBe('exact');
    expect(result.mainError).toBeNull();
    expect(result.otherErrorsCount).toBe(0);
    expect(result.counts).toEqual({ exact: 3, close: 0, error: 0 });
  });

  it('set Б: 0.652 written as 0.6 is close · rounding', () => {
    const result = checkManualSteps([windStep({ expectedInputs: [3.5, 300, 1610], playerInputs: [3.5, 300, 1610], expectedRawMil: -0.652, playerMil: -0.6 })], CLICK_MIL);
    expect(result.verdict).toBe('close');
    expect(result.rows[0].errorTypes).toEqual(['rounding']);
    expect(result.rows[0].clicksOff).toBe(1);
  });

  it('set В: full speed instead of the crosswind and the wrong side → error, main substitution, one more', () => {
    const result = checkManualSteps(
      [windStep({ expectedInputs: [1.6, 600, 1380], playerInputs: [3.2, 600, 1380], expectedRawMil: -0.696, playerMil: 1.4 })],
      CLICK_MIL,
    );
    expect(result.verdict).toBe('error');
    expect(result.rows[0].errorTypes).toEqual(['substitution', 'side']);
    expect(result.mainError).toEqual({ rowIndex: 0, type: 'substitution' });
    expect(result.otherErrorsCount).toBe(1);
    expect(result.rows[0].clicksOff).toBe(21);
  });

  it('swapped factors with the right answer are not an error', () => {
    const result = checkManualSteps([windStep({ playerInputs: [300, 3.2, 1610] })], CLICK_MIL);
    expect(result.rows[0]).toEqual({ status: 'exact', errorTypes: [], clicksOff: 0 });
  });

  it('a one-click substitution is only close', () => {
    const result = checkManualSteps([windStep({ playerInputs: [3.0, 300, 1610], playerMil: -0.5 })], CLICK_MIL);
    expect(result.rows[0].status).toBe('close');
    expect(result.rows[0].errorTypes).toEqual(['substitution']);
  });

  it('tells rounding from arithmetic around 0.596', () => {
    expect(checkManualSteps([windStep({ playerMil: -0.5 })], CLICK_MIL).rows[0]).toMatchObject({ status: 'close', errorTypes: ['rounding'] });
    expect(checkManualSteps([windStep({ playerMil: -0.7 })], CLICK_MIL).rows[0]).toMatchObject({ status: 'close', errorTypes: ['arithmetic'] });
    expect(checkManualSteps([windStep({ playerMil: -0.4 })], CLICK_MIL).rows[0]).toMatchObject({ status: 'error', errorTypes: ['arithmetic'] });
  });

  it('an answer in MOA is an error even when the number matches', () => {
    const result = checkManualSteps([windStep({ playerUnits: 'moa' })], CLICK_MIL);
    expect(result.rows[0]).toMatchObject({ status: 'error', errorTypes: ['units'] });
  });

  it('set Д: a wrong lead is called a lead error', () => {
    const result = checkManualSteps(
      [{ step: 'lead', expectedInputs: [1.2, 0.6, 400], playerInputs: [1.2, 0.6, 400], expectedRawMil: 1.8, playerMil: 1.2, playerUnits: 'mil' }],
      CLICK_MIL,
    );
    expect(result.rows[0]).toMatchObject({ status: 'error', errorTypes: ['lead'] });
  });

  it('the main error is the heaviest one, then the first by order', () => {
    const closeFirst = checkManualSteps([windStep({ playerMil: -0.5 }), setADopeStep, windStep({ playerMil: -0.3 })], CLICK_MIL);
    expect(closeFirst.mainError).toEqual({ rowIndex: 2, type: 'arithmetic' });
    expect(closeFirst.otherErrorsCount).toBe(1);
    const twoErrors = checkManualSteps([windStep({ playerMil: -0.3 }), windStep({ playerMil: -0.2 })], CLICK_MIL);
    expect(twoErrors.mainError).toEqual({ rowIndex: 0, type: 'arithmetic' });
  });

  it('zero against zero is right, zero against a correction is not the side', () => {
    expect(checkManualSteps([{ ...setAAtmosphereStep, expectedRawMil: 0, playerMil: 0 }], CLICK_MIL).verdict).toBe('exact');
    expect(checkManualSteps([windStep({ expectedRawMil: 0.3, playerMil: 0 })], CLICK_MIL).rows[0]).toMatchObject({ status: 'error', errorTypes: ['arithmetic'] });
  });

  it('an empty calculation is exact', () => {
    expect(checkManualSteps([], CLICK_MIL)).toMatchObject({ verdict: 'exact', mainError: null, otherErrorsCount: 0 });
  });
});

describe('checkPreparation', () => {
  it('set Г: speed 4 clicks and missed conditions 3 clicks → error, main reading, one more', () => {
    const result = checkPreparation([
      { row: 'reading-speed', clicksOff: 4, isWrongSide: false },
      { row: 'reading-direction', clicksOff: 0, isWrongSide: false },
      { row: 'factors', clicksOff: 3, isWrongSide: false },
      { row: 'turret-elevation', clicksOff: 0, isWrongSide: false },
      { row: 'turret-windage', clicksOff: 0, isWrongSide: false },
    ]);
    expect(result.verdict).toBe('error');
    expect(result.mainError).toEqual({ rowIndex: 0, type: 'reading' });
    expect(result.otherErrorsCount).toBe(1);
    expect(result.rows[2].errorTypes).toEqual(['factor']);
    expect(result.counts).toEqual({ exact: 3, close: 0, error: 2 });
  });

  it('one click off on a turret is close · turret', () => {
    const result = checkPreparation([{ row: 'turret-windage', clicksOff: 1, isWrongSide: false }]);
    expect(result.rows[0]).toMatchObject({ status: 'close', errorTypes: ['turret'] });
  });

  it('a turret turned the wrong way is an error · side', () => {
    const result = checkPreparation([{ row: 'turret-windage', clicksOff: 1, isWrongSide: true }]);
    expect(result.rows[0]).toMatchObject({ status: 'error', errorTypes: ['side'] });
  });
});
