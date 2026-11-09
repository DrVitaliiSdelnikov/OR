import { ExerciseId } from '../../sim/course';
import { NotebookStepId } from '../../sim/notebook';
import { TurretCorrection } from '../../sim/shot-review';
import { TurretProgress } from '../../sim/turret-target';
import { NotebookTab } from '../notebook/notebook.model';

export interface InstructorSnapshot {
  exerciseId: ExerciseId;
  sheetTab: NotebookTab | null;
  hasOpenedNotebook: boolean;
  isEntered: boolean;
  dopeMil: number | null;
  elevation: TurretProgress | null;
  windageTargetClicks: number | null;
  shotsFired: number;
  isReviewOpen: boolean;
  isResultOpen: boolean;
  isBoltCycleDue: boolean;
  lastCorrection: TurretCorrection | null;
  turnedSinceShot: TurretCorrection;
  aimOffMil: number;
  isStationMeasured: boolean;
  stationSpeedMps: number | null;
  windSpeedMps: number | null;
  reticleMil: number | null;
  measuredDistanceM: number | null;
  targetSizeM: number;
  recordedSteps: readonly NotebookStepId[];
  stageIndex: number;
  isMagazineChangeDue: boolean;
  cartridgeLetter: string;
  nextCartridgeLetter: string | null;
  isCallMarked: boolean;
  isDopeNoted: boolean;
  openCalcStep: NotebookStepId | null;
}
