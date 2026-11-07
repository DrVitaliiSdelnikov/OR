export interface PatrolPath {
  speedMps: number;
  movementClock: number;
  startOffsetM: number;
  halfWidthM: number;
}

const MIL_PER_RADIAN_SCALE = 1000;
const RADIANS_PER_CLOCK_HOUR = Math.PI / 6;
const STANDING_SPEED_EPSILON_MPS = 1e-9;

export function lateralVelocityMps(speedMps: number, movementClock: number): number {
  return speedMps * Math.sin(movementClock * RADIANS_PER_CLOCK_HOUR);
}

export function targetMotionMil(lateralVelocityMps: number, timeOfFlightS: number, distanceM: number): number {
  if (distanceM === 0) {
    return 0;
  }
  return ((lateralVelocityMps * timeOfFlightS) / distanceM) * MIL_PER_RADIAN_SCALE;
}

export function patrolPositionM(path: PatrolPath, timeS: number): number {
  const startM = clampToPatrol(path);
  const lap = patrolLap(path, timeS);
  if (lap === null) {
    return startM;
  }
  const { halfWidthM } = path;
  return lap.isWalkingRight ? -halfWidthM + lap.distanceM : 3 * halfWidthM - lap.distanceM;
}

export function patrolVelocityMps(path: PatrolPath, timeS: number): number {
  const lap = patrolLap(path, timeS);
  if (lap === null) {
    return 0;
  }
  const speedMps = Math.abs(lateralVelocityMps(path.speedMps, path.movementClock));
  return lap.isWalkingRight ? speedMps : -speedMps;
}

// Ход туда-обратно развёрнут в отрезок [0, 4h): первая половина — путь от левого края вправо, вторая — обратно.
function patrolLap(path: PatrolPath, timeS: number): { distanceM: number; isWalkingRight: boolean } | null {
  const lateralMps = lateralVelocityMps(path.speedMps, path.movementClock);
  if (path.halfWidthM === 0 || Math.abs(lateralMps) < STANDING_SPEED_EPSILON_MPS) {
    return null;
  }
  const halfWidthM = path.halfWidthM;
  const lapM = 4 * halfWidthM;
  const startM = clampToPatrol(path);
  const startOnLapM = lateralMps > 0 ? startM + halfWidthM : 3 * halfWidthM - startM;
  const distanceM = (startOnLapM + Math.abs(lateralMps) * timeS) % lapM;
  return { distanceM, isWalkingRight: distanceM < 2 * halfWidthM };
}

function clampToPatrol(path: PatrolPath): number {
  return Math.max(-path.halfWidthM, Math.min(path.halfWidthM, path.startOffsetM));
}
