import { FLAT_GEOMETRY, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C, WIND_ZONE_LIMITS_M } from './content';
import { BallisticsEngine } from './engine';
import { roundToClicks } from './game-formulas';
import { Atmosphere, Loadout, TrajectoryPoint } from './types';
import { fromInput, UnitSystem } from './units';

const FAHRENHEIT_PER_CELSIUS = 9 / 5;

export interface DopeRow {
  distanceM: number;
  elevationMil: number;
  clicks: number;
  timeOfFlightS: number;
  windConstant: number;
  colderStepMil: number;
  pressureStepMil: number;
  zoneWeights: readonly number[];
  spinDriftMil: number;
}

export interface DopeCard {
  cartridgeId: string;
  system: UnitSystem;
  cartridgeName: string;
  zeroM: number;
  clickMil: number;
  zeroAngleMil: number;
  rows: readonly DopeRow[];
}

const ROW_STEP_IN_SYSTEM = 100;
const ROW_COUNT = 10;
const DISTANCE_DECIMALS = 100;
const ATMOSPHERE_STEPS: Record<UnitSystem, { colderC: number; higherPressureHpa: number }> = {
  metric: { colderC: 10, higherPressureHpa: 10 },
  imperial: { colderC: 10 / FAHRENHEIT_PER_CELSIUS, higherPressureHpa: fromInput('pressure', 0.3, 'imperial') },
};
const CALIBRATION_CROSSWIND_MPS = 1;
const CROSSWIND_FROM_LEFT_DEG = 90;
const ELEVATION_DECIMALS = 10;
const TIME_DECIMALS = 100;
const ATMOSPHERE_DECIMALS = 100;
const WIND_CONSTANT_ROUNDING = 10;
const ZONE_WEIGHT_PARTS = 20;
const SPIN_DRIFT_DECIMALS = 100;
const ZERO_ANGLE_DECIMALS = 100;
const SPINNING: typeof FLAT_GEOMETRY = { ...FLAT_GEOMETRY, isSpinDriftOn: true };

const STANDARD_ATMOSPHERE: Atmosphere = {
  temperatureC: STANDARD_TEMPERATURE_C,
  pressureHpa: STANDARD_PRESSURE_HPA,
  relativeHumidity: STANDARD_RELATIVE_HUMIDITY,
};

export async function buildDopeCard(engine: BallisticsEngine, loadout: Loadout, clickMil: number, system: UnitSystem = 'metric'): Promise<DopeCard> {
  const rowStepM = fromInput('distance', ROW_STEP_IN_SYSTEM, system);
  const rangeM = rowStepM * ROW_COUNT;
  const steps = ATMOSPHERE_STEPS[system];
  const trajectory = (atmosphere: Atmosphere, windZones: Parameters<BallisticsEngine['trajectory']>[2], geometry = FLAT_GEOMETRY): Promise<TrajectoryPoint[]> =>
    engine.trajectory(loadout, atmosphere, windZones, undefined, rowStepM, geometry, rangeM);
  const [standardPoints, crosswindPoints, colderPoints, higherPressurePoints, spinningPoints, zeroAngleMil] = await Promise.all([
    trajectory(STANDARD_ATMOSPHERE, null),
    trajectory(STANDARD_ATMOSPHERE, [{ untilM: Infinity, speedMps: CALIBRATION_CROSSWIND_MPS, fromDeg: CROSSWIND_FROM_LEFT_DEG }]),
    trajectory({ ...STANDARD_ATMOSPHERE, temperatureC: STANDARD_TEMPERATURE_C - steps.colderC }, null),
    trajectory({ ...STANDARD_ATMOSPHERE, pressureHpa: STANDARD_PRESSURE_HPA + steps.higherPressureHpa }, null),
    trajectory(STANDARD_ATMOSPHERE, null, SPINNING),
    engine.zeroAngleMil(loadout),
  ]);
  const singleZonePoints = await Promise.all(
    WIND_ZONE_LIMITS_M.map((_, windyZone) =>
      trajectory(
        STANDARD_ATMOSPHERE,
        WIND_ZONE_LIMITS_M.map((untilM, zoneIndex) => ({
          untilM,
          speedMps: zoneIndex === windyZone ? CALIBRATION_CROSSWIND_MPS : 0,
          fromDeg: CROSSWIND_FROM_LEFT_DEG,
        })),
      ),
    ),
  );
  const rows = Array.from({ length: ROW_COUNT }, (_, index) => {
    const pointIndex = index + 1;
    const distanceM = roundTo(rowStepM * pointIndex, DISTANCE_DECIMALS);
    const upAt = (points: readonly TrajectoryPoint[]): number => -points[pointIndex].dropMrad;
    const rightAt = (points: readonly TrajectoryPoint[]): number => -points[pointIndex].windageMrad;
    const elevationMil = roundTo(upAt(standardPoints), ELEVATION_DECIMALS);
    const driftPerMpsMil = Math.abs(rightAt(crosswindPoints)) / CALIBRATION_CROSSWIND_MPS;
    return {
      distanceM,
      elevationMil,
      clicks: roundToClicks(elevationMil, clickMil),
      timeOfFlightS: roundTo(standardPoints[pointIndex].timeS, TIME_DECIMALS),
      windConstant: Math.round(distanceM / driftPerMpsMil / WIND_CONSTANT_ROUNDING) * WIND_CONSTANT_ROUNDING,
      colderStepMil: roundTo(upAt(colderPoints) - upAt(standardPoints), ATMOSPHERE_DECIMALS),
      pressureStepMil: roundTo(upAt(higherPressurePoints) - upAt(standardPoints), ATMOSPHERE_DECIMALS),
      zoneWeights: zoneWeightsAt(singleZonePoints, crosswindPoints, pointIndex),
      spinDriftMil: roundTo(rightAt(standardPoints) - rightAt(spinningPoints), SPIN_DRIFT_DECIMALS),
    };
  });
  return {
    cartridgeId: loadout.cartridge.id,
    cartridgeName: loadout.cartridge.name,
    zeroM: loadout.rifle.zeroM,
    system,
    clickMil,
    zeroAngleMil: roundTo(zeroAngleMil, ZERO_ANGLE_DECIMALS),
    rows,
  };
}

export function dopeRowAt(card: DopeCard, distanceM: number): DopeRow {
  const exact = card.rows.find(row => row.distanceM === distanceM);
  if (exact) {
    return exact;
  }
  const upperIndex = card.rows.findIndex(row => row.distanceM > distanceM);
  if (upperIndex <= 0) {
    throw new RangeError(`distance ${distanceM} m is outside the DOPE card`);
  }
  const lower = card.rows[upperIndex - 1];
  const upper = card.rows[upperIndex];
  const share = (distanceM - lower.distanceM) / (upper.distanceM - lower.distanceM);
  const blend = (from: number, to: number): number => from + (to - from) * share;
  const elevationMil = blend(lower.elevationMil, upper.elevationMil);
  return {
    distanceM,
    elevationMil,
    clicks: roundToClicks(elevationMil, card.clickMil),
    timeOfFlightS: blend(lower.timeOfFlightS, upper.timeOfFlightS),
    windConstant: blend(lower.windConstant, upper.windConstant),
    colderStepMil: blend(lower.colderStepMil, upper.colderStepMil),
    pressureStepMil: blend(lower.pressureStepMil, upper.pressureStepMil),
    zoneWeights: lower.zoneWeights.map((weight, index) => blend(weight, upper.zoneWeights[index])),
    spinDriftMil: blend(lower.spinDriftMil, upper.spinDriftMil),
  };
}

// Доля сноса от каждой зоны в шагах 0,05 методом наибольших остатков: сумма ровно 1, каждая доля — ближе всего к ядру.
function zoneWeightsAt(singleZonePoints: readonly TrajectoryPoint[][], fullWindPoints: readonly TrajectoryPoint[], pointIndex: number): number[] {
  const totalDriftMil = -fullWindPoints[pointIndex].windageMrad;
  const exactParts = singleZonePoints.map(points => (-points[pointIndex].windageMrad / totalDriftMil) * ZONE_WEIGHT_PARTS);
  const parts = exactParts.map(Math.floor);
  const zonesByRemainder = exactParts.map((exact, zoneIndex) => ({ zoneIndex, remainder: exact - parts[zoneIndex] })).sort((a, b) => b.remainder - a.remainder);
  const missingParts = ZONE_WEIGHT_PARTS - parts.reduce((total, part) => total + part, 0);
  zonesByRemainder.slice(0, missingParts).forEach(({ zoneIndex }) => parts[zoneIndex]++);
  return parts.map(part => part / ZONE_WEIGHT_PARTS);
}

function roundTo(value: number, decimalsFactor: number): number {
  const rounded = Math.round(value * decimalsFactor) / decimalsFactor;
  return rounded === 0 ? 0 : rounded;
}
