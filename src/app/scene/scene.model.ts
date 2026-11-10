import { flagAngleDeg } from '../../core/content';
import { Correction } from '../../core/types';
import { Vector2 } from '../../sim/noise';
import { AimLimits } from '../../sim/scope-session';
import { fieldOfViewMil } from '../../sim/scope-model';

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BermLayout {
  y: number;
  topY: number;
  tileWidth: number;
  tileHeight: number;
  tileXs: number[];
}

// Measured by tools/scene/prepare.py on the photos in public/scene.
export const PHOTO = {
  sky: { width: 2064, height: 297 },
  berm: { width: 1792, height: 447, topPx: 8, basePx: 386 },
  ground: { width: 1792, height: 355, bermPx: 112 },
  gong: { width: 695, height: 901, plateDiameterPx: 389, plateCentrePx: { x: 350, y: 322 }, standBottomPx: 899 },
  grass: { width: 1915, height: 544 },
} as const;

export const HIT_MARK_COUNT = 5;
const BERM_HEIGHT_M = 2;
const HIT_MARK_M = 0.08;
const SKY_DRIFT_SHARE = 0.25;
const SKY_WIDTH_GLASSES = 5;
const EYE_HEIGHT_M = 0.5;
const SKY_ABOVE_BERM_MIL = 6;
const HOLD_RESERVE_MIL = 6;
const SIDE_LIMIT_MIL = 20;
const GRASS_TOPS_BELOW_HORIZON_MIL = 6;
const GRASS_IMAGE_HEIGHT_MIL = 18;
const GRASS_LEAN_PT_PER_MPS = 1.6;
const GRASS_GUST_SHARE = 0.35;
const GRASS_GUST_RATE = 1.7;
const FLAG_ATTACHED_EDGE_M = 0.6;
const FLAG_FLUTTER_DEG = 3;
const FLAG_FLUTTER_FULL_MPS = 3;
const FLAG_FLUTTER_RATE_PER_MPS = 0.6;

// Measured by tools/scene/prepare.py flags; the attach point is the cloth's top corner at the pole.
export const FLAG_PHOTOS = [
  { stateDeg: 25, width: 306, height: 397, attachPx: { x: 0, y: 4 }, attachedEdgePx: 344 },
  { stateDeg: 45, width: 261, height: 334, attachPx: { x: 0, y: 4 }, attachedEdgePx: 268 },
  { stateDeg: 65, width: 414, height: 325, attachPx: { x: 0, y: 4 }, attachedEdgePx: 198 },
  { stateDeg: 80, width: 406, height: 261, attachPx: { x: 0, y: 4 }, attachedEdgePx: 240 },
] as const;

export interface FlagSprite {
  photoIndex: number;
  liftDeg: number;
  ptPerPx: number;
  side: 1 | -1;
}

function milsAt(metres: number, distanceM: number): number {
  return (metres / distanceM) * 1000;
}

export function gongFrame(target: Vector2, targetRadiusMil: number, ptPerMil: number): Frame {
  const ptPerPx = (2 * targetRadiusMil * ptPerMil) / PHOTO.gong.plateDiameterPx;
  return {
    x: target.x - PHOTO.gong.plateCentrePx.x * ptPerPx,
    y: target.y - PHOTO.gong.plateCentrePx.y * ptPerPx,
    width: PHOTO.gong.width * ptPerPx,
    height: PHOTO.gong.height * ptPerPx,
  };
}

export function groundLineY(target: Vector2, targetRadiusMil: number, ptPerMil: number): number {
  const ptPerPx = (2 * targetRadiusMil * ptPerMil) / PHOTO.gong.plateDiameterPx;
  return target.y + (PHOTO.gong.standBottomPx - PHOTO.gong.plateCentrePx.y) * ptPerPx;
}

function bermPtPerPx(distanceM: number, ptPerMil: number, bermPx: number): number {
  return (milsAt(BERM_HEIGHT_M, distanceM) * ptPerMil) / bermPx;
}

export function tileXs(centreX: number, tileWidth: number, glassPt: number): number[] {
  const centredX = centreX - tileWidth / 2;
  const firstX = centredX - Math.ceil(centredX / tileWidth) * tileWidth;
  const xs: number[] = [];
  for (let x = firstX; x < glassPt; x += tileWidth) {
    xs.push(x);
  }
  return xs;
}

export function bermLayout(targetX: number, groundY: number, distanceM: number, ptPerMil: number, glassPt: number): BermLayout {
  const ptPerPx = bermPtPerPx(distanceM, ptPerMil, PHOTO.berm.basePx - PHOTO.berm.topPx);
  const tileWidth = PHOTO.berm.width * ptPerPx;
  const y = groundY - PHOTO.berm.basePx * ptPerPx;
  return { y, topY: y + PHOTO.berm.topPx * ptPerPx, tileWidth, tileHeight: PHOTO.berm.height * ptPerPx, tileXs: tileXs(targetX, tileWidth, glassPt) };
}

export function groundFrame(targetX: number, groundY: number, distanceM: number, ptPerMil: number): Frame {
  const ptPerPx = bermPtPerPx(distanceM, ptPerMil, PHOTO.ground.bermPx);
  const width = PHOTO.ground.width * ptPerPx;
  return { x: targetX - width / 2, y: groundY, width, height: PHOTO.ground.height * ptPerPx };
}

export function skyFrame(targetX: number, bermTopY: number, glassPt: number): Frame {
  const ptPerPx = Math.max((glassPt * SKY_WIDTH_GLASSES) / PHOTO.sky.width, bermTopY / PHOTO.sky.height);
  const width = PHOTO.sky.width * ptPerPx;
  const height = PHOTO.sky.height * ptPerPx;
  const centre = glassPt / 2;
  return { x: centre + (targetX - centre) * SKY_DRIFT_SHARE - width / 2, y: Math.min(0, bermTopY - height), width, height };
}

export function hitMarkFrame(target: Vector2, impact: Correction, targetRadiusMil: number, distanceM: number, ptPerMil: number): Frame | null {
  if (Math.hypot(impact.upMrad, impact.rightMrad) > targetRadiusMil) {
    return null;
  }
  const size = milsAt(HIT_MARK_M, distanceM) * ptPerMil;
  return { x: target.x + impact.rightMrad * ptPerMil - size / 2, y: target.y - impact.upMrad * ptPerMil - size / 2, width: size, height: size };
}

export function horizonY(groundY: number, distanceM: number, ptPerMil: number): number {
  return groundY - milsAt(EYE_HEIGHT_M, distanceM) * ptPerMil;
}

export function flagFootY(horizon: number, flagDistanceM: number, ptPerMil: number): number {
  return horizon + milsAt(EYE_HEIGHT_M, flagDistanceM) * ptPerMil;
}

export function isFlagBeforeBerm(flagDistanceM: number, targetDistanceM: number): boolean {
  return flagDistanceM < targetDistanceM;
}

export function grassFrame(targetX: number, groundY: number, distanceM: number, ptPerMil: number, swayPt: number): Frame {
  const height = GRASS_IMAGE_HEIGHT_MIL * ptPerMil;
  const width = height * (PHOTO.grass.width / PHOTO.grass.height);
  return { x: targetX + swayPt - width / 2, y: horizonY(groundY, distanceM, ptPerMil) + GRASS_TOPS_BELOW_HORIZON_MIL * ptPerMil, width, height };
}

export function grassSwayPt(lateralWindMps: number, timeS: number): number {
  return lateralWindMps * GRASS_LEAN_PT_PER_MPS * (1 + GRASS_GUST_SHARE * Math.sin(timeS * GRASS_GUST_RATE));
}

export function aimLimitsMil(distanceM: number, targetRadiusMil: number, magnification: number): AimLimits {
  const plateDiameterMil = 2 * targetRadiusMil;
  const groundUnderTargetMil = ((PHOTO.gong.standBottomPx - PHOTO.gong.plateCentrePx.y) / PHOTO.gong.plateDiameterPx) * plateDiameterMil;
  const bermMil = milsAt(BERM_HEIGHT_M, distanceM);
  const groundPhotoMil = (PHOTO.ground.height / PHOTO.ground.bermPx) * bermMil;
  const viewHalfMil = fieldOfViewMil(magnification) / 2;
  const groundBottomMil = -groundUnderTargetMil - groundPhotoMil;
  const skyTopMil = -groundUnderTargetMil + bermMil + SKY_ABOVE_BERM_MIL;
  return {
    minX: -SIDE_LIMIT_MIL,
    maxX: SIDE_LIMIT_MIL,
    minY: Math.min(groundBottomMil + viewHalfMil, -HOLD_RESERVE_MIL),
    maxY: Math.max(skyTopMil - viewHalfMil, HOLD_RESERVE_MIL),
  };
}

export function flagSprite(lateralWindMps: number, flagDistanceM: number, ptPerMil: number, timeS: number): FlagSprite {
  const angleDeg = flagAngleDeg(lateralWindMps);
  const photoIndex = FLAG_PHOTOS.reduce((best, photo, index) => (Math.abs(photo.stateDeg - angleDeg) < Math.abs(FLAG_PHOTOS[best].stateDeg - angleDeg) ? index : best), 0);
  const windMps = Math.abs(lateralWindMps);
  const flutterDeg = FLAG_FLUTTER_DEG * Math.min(1, windMps / FLAG_FLUTTER_FULL_MPS) * Math.sin(timeS * (1 + windMps * FLAG_FLUTTER_RATE_PER_MPS));
  return {
    photoIndex,
    liftDeg: angleDeg - FLAG_PHOTOS[photoIndex].stateDeg + flutterDeg,
    ptPerPx: (milsAt(FLAG_ATTACHED_EDGE_M, flagDistanceM) * ptPerMil) / FLAG_PHOTOS[photoIndex].attachedEdgePx,
    side: lateralWindMps >= 0 ? 1 : -1,
  };
}
