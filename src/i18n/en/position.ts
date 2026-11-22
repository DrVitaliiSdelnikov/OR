import type { ExerciseId } from '../../sim/course';
import type { BoltStep } from '../../sim/bolt';
import type { TurretStop } from '../../sim/scope-model';
import type { BreathState } from '../../sim/sway';
import type { CorrectionCellKey } from '../../app/position/position.model';
import { decimal } from '../format';

export const position = {
  cells: {
    labels: { elevation: 'ELEV', windage: 'WIND', distance: 'DIST', holdover: 'HOLD' } satisfies Record<CorrectionCellKey, string>,
    distance: (p: { distance: string }) => p.distance,
  },
  drum: {
    overshoot: (p: { clicks: number }) => `${p.clicks} cl. too far`,
    remaining: (p: { clicks: number; arrow: string }) => `${p.clicks} more cl.${p.arrow}`,
    elevationLabel: 'Elevation turret',
    windageLabel: 'Wind turret',
    clicksUnit: 'cl',
  },
  breath: {
    seconds: (p: { seconds: number }) => `${decimal(p.seconds, 1)} s`,
  },
  bolt: {
    steps: { up: '1 ↑', back: '2 ← BACK', forward: '3 → FORWARD', down: '4 ↓' } satisfies Record<BoltStep, string>,
    header: (p: { stepNumber: number; stepCount: number }) => `Bolt · step ${p.stepNumber} of ${p.stepCount}`,
    trackLabel: 'Bolt: up, back, forward, down',
    fireWaiting: 'Fire · waiting for the bolt',
  },
  flagReading: (p: { flagDistance: string; angleDeg: number; isAtLimit: boolean; crosswindText: string }) =>
    `${p.flagDistance} · ${p.angleDeg}° · ${p.isAtLimit ? '≥ ' : ''}${p.crosswindText}`,
  patrolLine: (p: { speed: string; isCrosswise: boolean; headingArrow: string; isAmbush: boolean }) =>
    `${p.speed} · ${p.isCrosswise ? 'crosswise' : 'oblique'} ${p.headingArrow}${p.isAmbush ? ' · ambush' : ''}`,
  fireControl: {
    fire: 'Fire',
  },
  page: {
    sandboxTitle: 'Try it on the scope',
    holdLabels: { free: 'Hold', holding: 'Holding', cooldown: 'Exhale' } satisfies Record<BreathState, string>,
    exerciseTitle: (p: { exerciseId: ExerciseId; title: string }) => `Ex. ${p.exerciseId} · ${p.title}`,
    subtitle: (p: { distance: string | null; targetNumber: number; targetCount: number }) =>
      `line · ${p.distance === null ? 'distance unknown' : p.distance} · target ${p.targetNumber} / ${p.targetCount}`,
    windSpeed: (p: { speed: string }) => p.speed,
    calm: 'calm',
    dopeEmpty: 'DOPE · —',
    dope: (p: { distance: string; elevationMil: number }) => `DOPE · ${p.distance} ↑ ${decimal(p.elevationMil, 1)}`,
    stopBadges: { zero: 'ZERO STOP', top: 'TOP STOP', side: 'STOP' } satisfies Record<NonNullable<TurretStop>, string>,
    back: 'Back',
    notFilled: 'not filled in',
    unavailable: 'This exercise is not available yet',
    triggerZone: 'TRIGGER ZONE',
    zoomOut: 'Decrease magnification',
    zoomIn: 'Increase magnification',
    notebook: 'Notebook',
    notEntered: 'total not entered',
    changeMagazine: 'Change magazine',
    leaveQuestion: 'Leave the firing line? The exercise will not count',
    leaveDailyQuestion: 'Leave the firing line? The daily task will not count',
    stay: 'Stay',
    leave: 'Leave',
  },
};
