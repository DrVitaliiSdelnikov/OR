import { text } from '../../i18n';
import { NotebookFactor } from '../../sim/notebook';
import { TurretProgress } from '../../sim/turret-target';
import { FACTOR_NAMES } from '../notebook/notebook.model';

export interface RadioLine {
  text: string;
  isImportant: boolean;
}

const T = text.radio.plate;

export const RADIO_CALLSIGN = T.callsign;
export const RADIO_EMPTY_CHAMBER: RadioLine = { text: T.emptyChamber, isImportant: true };

export function forgottenFactorRadio(factor: NotebookFactor): RadioLine {
  return { text: T.forgottenFactor({ factorName: FACTOR_NAMES[factor] }), isImportant: true };
}

export function offMarksRadio(elevation: TurretProgress | null, windage: TurretProgress | null): RadioLine | null {
  const isOffMark = [elevation, windage].some(progress => progress !== null && !progress.isOnTarget);
  return isOffMark ? { text: T.offMarks, isImportant: false } : null;
}
