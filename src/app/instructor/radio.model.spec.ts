import { describe, expect, it } from 'vitest';
import { forgottenFactorRadio, offMarksRadio, RADIO_EMPTY_CHAMBER } from './radio.model';

const onMark = { remainingClicks: 0, direction: 'none' as const, isOnTarget: true, overshootClicks: 0 };
const offMark = { remainingClicks: 3, direction: 'up' as const, isOnTarget: false, overshootClicks: 0 };

describe('radio lines', () => {
  it('an empty chamber is important', () => {
    expect(RADIO_EMPTY_CHAMBER).toEqual({ text: 'дошли патрон затвором', isImportant: true });
  });

  it('a forgotten factor is important and names the factor', () => {
    expect(forgottenFactorRadio('conditions')).toEqual({ text: 'стой. Учти УСЛОВИЯ', isImportant: true });
    expect(forgottenFactorRadio('dope').text).toBe('стой. Учти ДОПЕ');
  });

  it('drums off their marks at the shot: a plain line; on the marks or nothing entered — silence', () => {
    expect(offMarksRadio(offMark, onMark)).toEqual({ text: 'барабаны не на метках', isImportant: false });
    expect(offMarksRadio(onMark, offMark)).not.toBeNull();
    expect(offMarksRadio(onMark, onMark)).toBeNull();
    expect(offMarksRadio(null, null)).toBeNull();
  });
});
