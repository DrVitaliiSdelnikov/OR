import { ChipKind, Notebook, NotebookStepId, StepSheet } from './notebook';
import { PencilMark } from './pencil-marks';

export interface NotebookEditor {
  readonly notebook: Notebook;
  stepSheet(step: NotebookStepId): StepSheet;
  pencilMarks(): readonly PencilMark[];
  placeChip(step: NotebookStepId, chipKind: ChipKind, slotIndex?: number): void;
  removeChip(step: NotebookStepId, slotIndex: number): void;
  typeTape(step: NotebookStepId, index: number, value: number | null): void;
  setSign(step: NotebookStepId, sign: 1 | -1): void;
  setUnits(step: NotebookStepId, units: 'mil' | 'moa'): void;
  recordStep(step: NotebookStepId): void;
}
