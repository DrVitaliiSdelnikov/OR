import { lateralVelocityMps, PatrolPath, patrolPositionM, patrolVelocityMps } from '../core/moving-target';
import { mulberry32 } from '../core/rng';

export interface PatrolTarget {
  path: PatrolPath;
  isAmbush: boolean;
}

type Heading = 'crosswise' | 'oblique';

export const PATROL_SPEEDS_MPS = [0.4, 0.6, 1.1, 1.7] as const;

const [SLOW_PATROL, FAST_PATROL, SLOW_WALK, FAST_WALK] = PATROL_SPEEDS_MPS;
const PATROL_LADDER: readonly { speedMps: number; heading: Heading; isAmbush: boolean }[] = [
  { speedMps: SLOW_PATROL, heading: 'crosswise', isAmbush: false },
  { speedMps: FAST_PATROL, heading: 'crosswise', isAmbush: false },
  { speedMps: SLOW_WALK, heading: 'crosswise', isAmbush: false },
  { speedMps: SLOW_WALK, heading: 'oblique', isAmbush: false },
  { speedMps: FAST_WALK, heading: 'oblique', isAmbush: false },
  { speedMps: FAST_PATROL, heading: 'crosswise', isAmbush: true },
  { speedMps: SLOW_WALK, heading: 'crosswise', isAmbush: true },
  { speedMps: SLOW_WALK, heading: 'oblique', isAmbush: true },
  { speedMps: FAST_WALK, heading: 'crosswise', isAmbush: true },
  { speedMps: FAST_WALK, heading: 'oblique', isAmbush: true },
];
const CLOCKS_BY_HEADING: Record<Heading, readonly number[]> = { crosswise: [3, 9], oblique: [1.5, 4.5, 7.5, 10.5] };
const WALK_EACH_WAY_S = 8;
const MIL_PER_RADIAN_SCALE = 1000;
const CLOCK_HOURS_PER_TURN = 12;

export function patrolPlan(seed: number): PatrolTarget[] {
  const random = mulberry32(seed);
  return PATROL_LADDER.map(({ speedMps, heading, isAmbush }) => {
    const clocks = CLOCKS_BY_HEADING[heading];
    const movementClock = clocks[Math.floor(random() * clocks.length)];
    const halfWidthM = speedMps * WALK_EACH_WAY_S;
    const startOffsetM = lateralVelocityMps(speedMps, movementClock) > 0 ? -halfWidthM : halfWidthM;
    return { path: { speedMps, movementClock, startOffsetM, halfWidthM }, isAmbush };
  });
}

export function targetOffsetMil(path: PatrolPath, distanceM: number, timeS: number): number {
  return (patrolPositionM(path, timeS) / distanceM) * MIL_PER_RADIAN_SCALE;
}

export function movementClockAt(path: PatrolPath, timeS: number): number {
  const isWalkingBack = Math.sign(patrolVelocityMps(path, timeS)) !== Math.sign(lateralVelocityMps(path.speedMps, path.movementClock));
  return isWalkingBack ? CLOCK_HOURS_PER_TURN - path.movementClock : path.movementClock;
}

export function movingShotOptions(path: PatrolPath, timeS: number): { targetLateralVelocityMps: number } {
  return { targetLateralVelocityMps: patrolVelocityMps(path, timeS) };
}
