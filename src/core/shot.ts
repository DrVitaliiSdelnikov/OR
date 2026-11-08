import { RIFLE, targetRadiusMrad } from './content';
import { BallisticsEngine } from './engine';
import { targetMotionMil } from './moving-target';
import { gaussian, mulberry32 } from './rng';
import { Scenario, windAt } from './scenario';
import { Cartridge, Correction, Target } from './types';

export interface ShotOptions {
  timeS?: number;
  hold?: Correction;
  isColdBore?: boolean;
  sightOffset?: Correction;
  targetLateralVelocityMps?: number;
}

export interface ShotResult {
  isHit: boolean;
  impact: Correction;
  missMrad: number;
  radiusMrad: number;
  timeOfFlightS: number;
  ideal: Correction;
  dial: Correction;
  decision: Correction;
  velocitySpread: Correction;
  group: Correction;
  hold: Correction;
  coldBore: Correction;
  sightOffset: Correction;
  targetMotion: Correction;
  windShift: Correction;
  atmosphereUpMrad: number;
  windRightMrad: number;
  windUpMrad: number;
  actualMuzzleVelocityMps: number;
  hitProbability: number;
  decisionProbability: number;
  optimumProbability: number;
  luck: number;
  fireTimeS: number;
}

const MONTE_CARLO_SAMPLES = 3000;
const NO_OFFSET: Correction = { upMrad: 0, rightMrad: 0 };

const round2 = (value: number): number => Math.round(value * 100) / 100;
const roundCorrection = (correction: Correction): Correction => ({
  upMrad: round2(correction.upMrad),
  rightMrad: round2(correction.rightMrad),
});
const subtract = (minuend: Correction, subtrahend: Correction): Correction => ({
  upMrad: minuend.upMrad - subtrahend.upMrad,
  rightMrad: minuend.rightMrad - subtrahend.rightMrad,
});

export async function resolveShot(
  engine: BallisticsEngine,
  scenario: Scenario,
  cartridge: Cartridge,
  target: Target,
  dial: Correction,
  shotIndex: number,
  options: ShotOptions = {},
): Promise<ShotResult> {
  const fireTimeS = options.timeS ?? scenario.startTimeS;
  const hold = options.hold ?? NO_OFFSET;
  const coldBore = options.isColdBore ? RIFLE.coldBoreShiftMil : NO_OFFSET;
  const sightOffset = options.sightOffset ?? NO_OFFSET;
  const windAtShot = windAt(scenario, fireTimeS);
  const random = mulberry32(scenario.seed * 7919 + shotIndex * 104729 + target.distanceM);
  const velocityDeviationMps = gaussian(random) * cartridge.muzzleVelocitySdMps;
  const actualMuzzleVelocityMps = cartridge.muzzleVelocityMps + velocityDeviationMps;
  const groupRightMrad = gaussian(random) * RIFLE.groupSigmaMrad;
  const groupUpMrad = gaussian(random) * RIFLE.groupSigmaMrad;

  const sampleStepM = target.distanceM;
  const [nominal, actual, vacuumLike, atmosphereOnly, fasterBullet, meanWind] = await Promise.all([
    engine.trajectory(cartridge, scenario.atmosphere, windAtShot, cartridge.muzzleVelocityMps, sampleStepM),
    engine.trajectory(cartridge, scenario.atmosphere, windAtShot, actualMuzzleVelocityMps, sampleStepM),
    engine.trajectory(cartridge, null, null, cartridge.muzzleVelocityMps, sampleStepM),
    engine.trajectory(cartridge, scenario.atmosphere, null, cartridge.muzzleVelocityMps, sampleStepM),
    engine.trajectory(cartridge, scenario.atmosphere, windAtShot, cartridge.muzzleVelocityMps + cartridge.muzzleVelocitySdMps, sampleStepM),
    engine.trajectory(cartridge, scenario.atmosphere, scenario.zones, cartridge.muzzleVelocityMps, sampleStepM),
  ]);
  const distanceM = target.distanceM;
  const ideal = BallisticsEngine.required(nominal, distanceM);
  const actualRequired = BallisticsEngine.required(actual, distanceM);
  const standardRequired = BallisticsEngine.required(vacuumLike, distanceM);
  const atmosphereRequired = BallisticsEngine.required(atmosphereOnly, distanceM);
  const fasterRequired = BallisticsEngine.required(fasterBullet, distanceM);
  const meanWindRequired = BallisticsEngine.required(meanWind, distanceM);

  const velocitySpread = subtract(ideal, actualRequired);
  const targetMotion: Correction = {
    upMrad: 0,
    rightMrad: targetMotionMil(options.targetLateralVelocityMps ?? 0, actualRequired.timeS, target.distanceM),
  };
  const decision = subtract(dial, ideal);
  const group: Correction = { upMrad: groupUpMrad, rightMrad: groupRightMrad };
  const impact: Correction = {
    upMrad: decision.upMrad + velocitySpread.upMrad + group.upMrad + hold.upMrad + coldBore.upMrad + sightOffset.upMrad,
    rightMrad: decision.rightMrad + velocitySpread.rightMrad + group.rightMrad + hold.rightMrad + coldBore.rightMrad + sightOffset.rightMrad - targetMotion.rightMrad,
  };
  const missMrad = Math.hypot(impact.upMrad, impact.rightMrad);
  const radiusMrad = targetRadiusMrad(target);
  const isHit = missMrad <= radiusMrad;

  const upPerVelocityMps = (ideal.upMrad - fasterRequired.upMrad) / cartridge.muzzleVelocitySdMps;
  const rightPerVelocityMps = (ideal.rightMrad - fasterRequired.rightMrad) / cartridge.muzzleVelocitySdMps;
  const probabilityFrom = (offset: Correction): number => {
    const sampleRandom = mulberry32(scenario.seed * 31 + shotIndex * 17 + distanceM);
    let hits = 0;
    for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
      const velocitySample = gaussian(sampleRandom) * cartridge.muzzleVelocitySdMps;
      const upSample = offset.upMrad + upPerVelocityMps * velocitySample + gaussian(sampleRandom) * RIFLE.groupSigmaMrad;
      const rightSample = offset.rightMrad + rightPerVelocityMps * velocitySample + gaussian(sampleRandom) * RIFLE.groupSigmaMrad;
      if (Math.hypot(upSample, rightSample) <= radiusMrad) {
        hits++;
      }
    }
    return hits / MONTE_CARLO_SAMPLES;
  };
  const optimumProbability = probabilityFrom(NO_OFFSET);
  const decisionProbability = probabilityFrom(decision);
  const hitProbability = probabilityFrom({
    upMrad: decision.upMrad + hold.upMrad + coldBore.upMrad + sightOffset.upMrad,
    rightMrad: decision.rightMrad + hold.rightMrad + coldBore.rightMrad + sightOffset.rightMrad - targetMotion.rightMrad,
  });

  const windShift = subtract(ideal, meanWindRequired);
  const atmosphereUpMrad = atmosphereRequired.upMrad - standardRequired.upMrad;
  const windUpMrad = ideal.upMrad - atmosphereRequired.upMrad;
  const windRightMrad = ideal.rightMrad - atmosphereRequired.rightMrad;

  return {
    isHit,
    impact: roundCorrection(impact),
    missMrad: round2(missMrad),
    radiusMrad: round2(radiusMrad),
    timeOfFlightS: actualRequired.timeS,
    ideal: roundCorrection(ideal),
    dial,
    decision: roundCorrection(decision),
    velocitySpread: roundCorrection(velocitySpread),
    group: roundCorrection(group),
    hold: roundCorrection(hold),
    coldBore,
    sightOffset,
    targetMotion: roundCorrection(targetMotion),
    windShift: roundCorrection(windShift),
    atmosphereUpMrad: round2(atmosphereUpMrad),
    windRightMrad: round2(windRightMrad),
    windUpMrad: round2(windUpMrad),
    actualMuzzleVelocityMps: Math.round(actualMuzzleVelocityMps),
    hitProbability,
    decisionProbability,
    optimumProbability,
    luck: (isHit ? 1 : 0) - hitProbability,
    fireTimeS,
  };
}
