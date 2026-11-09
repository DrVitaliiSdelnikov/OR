import { RIFLE } from '../core/content';
import { BallisticsEngine } from '../core/engine';
import { Correction, TrajectoryPoint } from '../core/types';

export interface FlightSample {
  distanceM: number;
  required: Correction;
}

export interface FlightPoint {
  distanceM: number;
  heightCm: number;
  sideCm: number;
}

export interface FlightPaths {
  bullet: FlightPoint[];
  centre: FlightPoint[];
}

const CM_PER_MIL_PER_M = 0.1;

export function flightSamples(points: readonly TrajectoryPoint[], distanceM: number): FlightSample[] {
  const before = points.filter(point => point.distanceM > 0 && point.distanceM < distanceM).map(point => ({ distanceM: point.distanceM, required: requiredOf(point) }));
  const end = BallisticsEngine.interpolated(points, distanceM);
  return [...before, { distanceM, required: { upMrad: end.upMrad, rightMrad: end.rightMrad } }];
}

/**
 * Пуля над линией прицела в точке r = (угол ствола − нужная поправка в r) × r. Угол ствола выбирается так,
 * чтобы линия кончилась в точке `impact` на дистанции цели; пунктир — то же с концом в центре.
 */
export function flightPaths(samples: readonly FlightSample[], impact: Correction): FlightPaths {
  const end = samples[samples.length - 1].required;
  const muzzle: FlightPoint = { distanceM: 0, heightCm: -RIFLE.sightHeightCm, sideCm: 0 };
  const pathTo = (endPoint: Correction): FlightPoint[] => [
    muzzle,
    ...samples.map(sample => ({
      distanceM: sample.distanceM,
      heightCm: (endPoint.upMrad + end.upMrad - sample.required.upMrad) * sample.distanceM * CM_PER_MIL_PER_M,
      sideCm: (endPoint.rightMrad + end.rightMrad - sample.required.rightMrad) * sample.distanceM * CM_PER_MIL_PER_M,
    })),
  ];
  return { bullet: pathTo(impact), centre: pathTo({ upMrad: 0, rightMrad: 0 }) };
}

function requiredOf(point: TrajectoryPoint): Correction {
  return { upMrad: -point.dropMrad, rightMrad: -point.windageMrad };
}
