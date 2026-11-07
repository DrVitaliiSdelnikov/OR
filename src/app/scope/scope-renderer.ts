import { flagAngleDeg } from '../../core/content';
import { Correction } from '../../core/types';
import { Vector2 } from '../../sim/noise';
import { EYEPIECE_RADIUS_PT, MRAD_PER_MOA, ScopeModel } from '../../sim/scope-model';

export interface FlagView {
  distanceM: number;
  lateralWindMps: number;
}

export interface SceneFrame {
  scope: ScopeModel;
  ptPerMil: number;
  reticleScale: number;
  targetOffsetPt: Vector2;
  targetRadiusMil: number;
  marks: Correction[];
  flags: FlagView[];
  timeS: number;
}

const FLAG_SIDE_OFFSET_M = 2.5;
const FLAG_DROP_MIL: Record<number, number> = { 200: 6, 400: 3, 600: 1.5 };
const DEVICE_PIXEL_RATIO = 2;
export const GLASS_SIZE_PT = EYEPIECE_RADIUS_PT * 2;

export class ScopeRenderer {
  private readonly context: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.width = GLASS_SIZE_PT * DEVICE_PIXEL_RATIO;
    canvas.height = GLASS_SIZE_PT * DEVICE_PIXEL_RATIO;
    this.context = canvas.getContext('2d')!;
  }

  draw(frame: SceneFrame): void {
    const context = this.context;
    const center = EYEPIECE_RADIUS_PT;
    context.setTransform(DEVICE_PIXEL_RATIO, 0, 0, DEVICE_PIXEL_RATIO, 0, 0);
    context.clearRect(0, 0, GLASS_SIZE_PT, GLASS_SIZE_PT);
    context.save();
    context.beginPath();
    context.arc(center, center, EYEPIECE_RADIUS_PT, 0, Math.PI * 2);
    context.clip();

    const targetX = center + frame.targetOffsetPt.x;
    const targetY = center + frame.targetOffsetPt.y;
    this.drawScene(frame, targetX, targetY);
    this.drawTarget(frame, targetX, targetY);
    this.drawFlags(frame, targetX, targetY);
    this.drawMarks(frame, targetX, targetY);
    this.drawReticle(frame, center);
    this.drawVignette(center);
    context.restore();
  }

  private drawScene(frame: SceneFrame, targetX: number, targetY: number): void {
    const context = this.context;
    const horizonY = targetY - 2.2 * frame.ptPerMil;
    const sky = context.createLinearGradient(0, horizonY - 200, 0, horizonY);
    sky.addColorStop(0, '#8fa3b0');
    sky.addColorStop(1, '#dfe5dc');
    context.fillStyle = sky;
    context.fillRect(0, 0, GLASS_SIZE_PT, GLASS_SIZE_PT);
    context.fillStyle = '#7e8f64';
    context.fillRect(0, horizonY, GLASS_SIZE_PT, GLASS_SIZE_PT);
    context.fillStyle = '#5f7347';
    context.fillRect(0, targetY + 0.8 * frame.ptPerMil, GLASS_SIZE_PT, GLASS_SIZE_PT);
    context.fillStyle = '#8a6f4e';
    const bermHalfWidth = 6 * frame.ptPerMil;
    context.beginPath();
    context.ellipse(targetX, targetY + frame.ptPerMil, bermHalfWidth, 2.4 * frame.ptPerMil, 0, Math.PI, 0);
    context.fill();
    const shimmerShift = Math.sin(frame.timeS * 2.4) * 1.1;
    context.fillStyle = 'rgba(255,255,255,0.05)';
    for (let band = 0; band < 6; band++) {
      context.fillRect(shimmerShift * (band % 2 ? 1 : -1), horizonY + band * 6, GLASS_SIZE_PT, 2);
    }
  }

  private drawTarget(frame: SceneFrame, targetX: number, targetY: number): void {
    const context = this.context;
    const radiusPt = frame.targetRadiusMil * frame.ptPerMil;
    context.strokeStyle = '#2a2d31';
    context.lineWidth = Math.max(1, radiusPt * 0.15);
    context.beginPath();
    context.moveTo(targetX - radiusPt * 0.4, targetY);
    context.lineTo(targetX - radiusPt * 0.7, targetY + radiusPt * 2.2);
    context.moveTo(targetX + radiusPt * 0.4, targetY);
    context.lineTo(targetX + radiusPt * 0.7, targetY + radiusPt * 2.2);
    context.stroke();
    const steel = context.createRadialGradient(targetX - radiusPt * 0.3, targetY - radiusPt * 0.3, radiusPt * 0.1, targetX, targetY, radiusPt);
    steel.addColorStop(0, '#9aa1a8');
    steel.addColorStop(1, '#4d5258');
    context.fillStyle = steel;
    context.beginPath();
    context.arc(targetX, targetY, radiusPt, 0, Math.PI * 2);
    context.fill();
  }

  private drawFlags(frame: SceneFrame, targetX: number, targetY: number): void {
    const context = this.context;
    for (const flag of frame.flags) {
      const sideMil = (FLAG_SIDE_OFFSET_M / flag.distanceM) * 1000;
      const poleX = targetX - sideMil * frame.ptPerMil;
      const poleBottomY = targetY + (FLAG_DROP_MIL[flag.distanceM] ?? 2) * frame.ptPerMil;
      const poleHeightPt = (2.5 / flag.distanceM) * 1000 * frame.ptPerMil;
      const poleTopY = poleBottomY - poleHeightPt;
      context.strokeStyle = '#3a3a3a';
      context.lineWidth = Math.max(1, poleHeightPt * 0.03);
      context.beginPath();
      context.moveTo(poleX, poleBottomY);
      context.lineTo(poleX, poleTopY);
      context.stroke();
      const angle = (flagAngleDeg(flag.lateralWindMps) * Math.PI) / 180;
      const side = flag.lateralWindMps >= 0 ? 1 : -1;
      const lengthPt = poleHeightPt * 0.45;
      context.fillStyle = '#e0482f';
      context.beginPath();
      context.moveTo(poleX, poleTopY);
      context.lineTo(poleX + side * Math.sin(angle) * lengthPt, poleTopY + Math.cos(angle) * lengthPt);
      context.lineTo(poleX, poleTopY + lengthPt * 0.3);
      context.closePath();
      context.fill();
    }
  }

  private drawMarks(frame: SceneFrame, targetX: number, targetY: number): void {
    const context = this.context;
    for (const mark of frame.marks) {
      context.strokeStyle = '#ffe08a';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(targetX + mark.rightMrad * frame.ptPerMil, targetY - mark.upMrad * frame.ptPerMil, 3, 0, Math.PI * 2);
      context.stroke();
    }
  }

  private drawReticle(frame: SceneFrame, center: number): void {
    const context = this.context;
    const unitPt = frame.ptPerMil * frame.reticleScale;
    context.strokeStyle = '#14160f';
    context.fillStyle = '#14160f';
    context.lineWidth = 1;
    context.font = '600 9px "Roboto Mono", monospace';
    context.textAlign = 'center';
    context.beginPath();
    context.moveTo(0, center);
    context.lineTo(GLASS_SIZE_PT, center);
    context.moveTo(center, 0);
    context.lineTo(center, GLASS_SIZE_PT);
    context.stroke();
    const tick = (alongPt: number, isHorizontal: boolean, halfLengthPt: number): void => {
      context.beginPath();
      if (isHorizontal) {
        context.moveTo(center + alongPt, center - halfLengthPt);
        context.lineTo(center + alongPt, center + halfLengthPt);
      } else {
        context.moveTo(center - halfLengthPt, center + alongPt);
        context.lineTo(center + halfLengthPt, center + alongPt);
      }
      context.stroke();
    };
    switch (frame.scope.reticle) {
      case 'tree':
        for (let mil = 1; mil <= 14; mil++) {
          for (const sign of [-1, 1]) {
            tick(sign * mil * unitPt, true, 5);
            tick(sign * (mil - 0.5) * unitPt, true, 2.5);
            if (sign > 0 || mil <= 6) {
              tick(sign * mil * unitPt, false, 5);
            }
          }
          if (mil % 2 === 0) {
            context.fillText(String(mil), center + mil * unitPt, center - 8);
          }
        }
        for (let row = 1; row <= 10; row++) {
          const halfWidth = Math.min(1 + row * 0.55, 8);
          for (let column = -halfWidth; column <= halfWidth + 1e-9; column += 0.5) {
            context.fillRect(center + column * unitPt - 0.6, center + row * unitPt - 0.6, 1.2, 1.2);
          }
        }
        break;
      case 'moa-grid': {
        const moaPt = unitPt * MRAD_PER_MOA;
        for (let moa = 1; moa <= 40; moa++) {
          for (const sign of [-1, 1]) {
            const isMajor = moa % 5 === 0;
            tick(sign * moa * moaPt, true, isMajor ? 5 : 2.5);
            tick(sign * moa * moaPt, false, isMajor ? 5 : 2.5);
          }
          if (moa % 10 === 0) {
            context.fillText(String(moa), center + moa * moaPt, center - 8);
          }
        }
        break;
      }
      case 'mil-dot':
        context.lineWidth = 4;
        for (const sign of [-1, 1]) {
          context.beginPath();
          context.moveTo(center + sign * 4.2 * unitPt, center);
          context.lineTo(center + sign * GLASS_SIZE_PT, center);
          context.moveTo(center, center + sign * 4.2 * unitPt);
          context.lineTo(center, center + sign * GLASS_SIZE_PT);
          context.stroke();
        }
        context.lineWidth = 1;
        for (let mil = 1; mil <= 4; mil++) {
          for (const sign of [-1, 1]) {
            for (const [x, y] of [
              [sign * mil, 0],
              [0, sign * mil],
            ]) {
              context.beginPath();
              context.arc(center + x * unitPt, center + y * unitPt, Math.max(1, 0.1 * unitPt), 0, Math.PI * 2);
              context.fill();
            }
          }
        }
        break;
    }
    context.beginPath();
    context.arc(center, center, 1.3, 0, Math.PI * 2);
    context.fill();
  }

  private drawVignette(center: number): void {
    const vignette = this.context.createRadialGradient(center, center, EYEPIECE_RADIUS_PT * 0.6, center, center, EYEPIECE_RADIUS_PT);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    this.context.fillStyle = vignette;
    this.context.fillRect(0, 0, GLASS_SIZE_PT, GLASS_SIZE_PT);
  }
}
