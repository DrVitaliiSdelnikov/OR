import { NotebookFactor } from '../../sim/notebook';
import { TurretProgress } from '../../sim/turret-target';
import { FACTOR_NAMES } from '../notebook/notebook.model';

export interface RadioLine {
  text: string;
  isImportant: boolean;
}

export const RADIO_CALLSIGN = 'Старший';
export const RADIO_EMPTY_CHAMBER: RadioLine = { text: 'дошли патрон затвором', isImportant: true };

export function forgottenFactorRadio(factor: NotebookFactor): RadioLine {
  return { text: `стой. Учти ${FACTOR_NAMES[factor].toUpperCase()}`, isImportant: true };
}

export function offMarksRadio(elevation: TurretProgress | null, windage: TurretProgress | null): RadioLine | null {
  const isOffMark = [elevation, windage].some(progress => progress !== null && !progress.isOnTarget);
  return isOffMark ? { text: 'барабаны не на метках', isImportant: false } : null;
}
