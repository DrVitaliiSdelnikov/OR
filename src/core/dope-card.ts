import { STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C, WIND_ZONE_LIMITS_M } from './content';
import { BallisticsEngine } from './engine';
import { roundToClicks } from './game-formulas';
import { Atmosphere, Cartridge, CartridgeId, TrajectoryPoint } from './types';

export interface DopeRow {
  distanceM: number;
  elevationMil: number;
  clicks: number;
  timeOfFlightS: number;
  windConstant: number;
  colderBy10CMil: number;
  pressureUp10HpaMil: number;
  zoneWeights: readonly number[];
}

export interface DopeCard {
  cartridgeId: CartridgeId;
  clickMil: number;
  rows: readonly DopeRow[];
}

const FIRST_ROW_M = 100;
const CALIBRATION_CROSSWIND_MPS = 1;
const CROSSWIND_FROM_LEFT_DEG = 90;
const ATMOSPHERE_STEP = 10;
const ELEVATION_DECIMALS = 10;
const TIME_DECIMALS = 100;
const ATMOSPHERE_DECIMALS = 100;
const WIND_CONSTANT_ROUNDING = 10;
const ZONE_WEIGHT_PARTS = 20;

const STANDARD_ATMOSPHERE: Atmosphere = {
  temperatureC: STANDARD_TEMPERATURE_C,
  pressureHpa: STANDARD_PRESSURE_HPA,
  relativeHumidity: STANDARD_RELATIVE_HUMIDITY,
};

export async function buildDopeCard(engine: BallisticsEngine, cartridge: Cartridge, clickMil: number): Promise<DopeCard> {
  const [standardPoints, crosswindPoints, colderPoints, higherPressurePoints] = await Promise.all([
    engine.trajectory(cartridge, STANDARD_ATMOSPHERE, null),
    engine.trajectory(cartridge, STANDARD_ATMOSPHERE, [
      { untilM: Infinity, speedMps: CALIBRATION_CROSSWIND_MPS, fromDeg: CROSSWIND_FROM_LEFT_DEG },
    ]),
    engine.trajectory(cartridge, { ...STANDARD_ATMOSPHERE, temperatureC: STANDARD_TEMPERATURE_C - ATMOSPHERE_STEP }, null),
    engine.trajectory(cartridge, { ...STANDARD_ATMOSPHERE, pressureHpa: STANDARD_PRESSURE_HPA + ATMOSPHERE_STEP }, null),
  ]);
  const singleZonePoints = await Promise.all(
    WIND_ZONE_LIMITS_M.map((_, windyZone) =>
      engine.trajectory(
        cartridge,
        STANDARD_ATMOSPHERE,
        WIND_ZONE_LIMITS_M.map((untilM, zoneIndex) => ({
          untilM,
          speedMps: zoneIndex === windyZone ? CALIBRATION_CROSSWIND_MPS : 0,
          fromDeg: CROSSWIND_FROM_LEFT_DEG,
        })),
      ),
    ),
  );
  const elevationAt = (points: readonly TrajectoryPoint[], distanceM: number): number => BallisticsEngine.required(points, distanceM).upMrad;
  const rows = standardPoints
    .filter(point => point.distanceM >= FIRST_ROW_M)
    .map(point => {
      const elevationMil = roundTo(elevationAt(standardPoints, point.distanceM), ELEVATION_DECIMALS);
      const driftPerMpsMil = Math.abs(BallisticsEngine.required(crosswindPoints, point.distanceM).rightMrad) / CALIBRATION_CROSSWIND_MPS;
      return {
        distanceM: point.distanceM,
        elevationMil,
        clicks: roundToClicks(elevationMil, clickMil),
        timeOfFlightS: roundTo(point.timeS, TIME_DECIMALS),
        windConstant: Math.round(point.distanceM / driftPerMpsMil / WIND_CONSTANT_ROUNDING) * WIND_CONSTANT_ROUNDING,
        colderBy10CMil: roundTo(elevationAt(colderPoints, point.distanceM) - elevationAt(standardPoints, point.distanceM), ATMOSPHERE_DECIMALS),
        pressureUp10HpaMil: roundTo(
          elevationAt(higherPressurePoints, point.distanceM) - elevationAt(standardPoints, point.distanceM),
          ATMOSPHERE_DECIMALS,
        ),
        zoneWeights: zoneWeightsAt(singleZonePoints, crosswindPoints, point.distanceM),
      };
    });
  return { cartridgeId: cartridge.id, clickMil, rows };
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
    colderBy10CMil: blend(lower.colderBy10CMil, upper.colderBy10CMil),
    pressureUp10HpaMil: blend(lower.pressureUp10HpaMil, upper.pressureUp10HpaMil),
    zoneWeights: lower.zoneWeights.map((weight, index) => blend(weight, upper.zoneWeights[index])),
  };
}

// Доля сноса от каждой зоны в шагах 0,05 методом наибольших остатков: сумма ровно 1, каждая доля — ближе всего к ядру.
function zoneWeightsAt(singleZonePoints: readonly TrajectoryPoint[][], fullWindPoints: readonly TrajectoryPoint[], distanceM: number): number[] {
  const totalDriftMil = BallisticsEngine.required(fullWindPoints, distanceM).rightMrad;
  const exactParts = singleZonePoints.map(points => (BallisticsEngine.required(points, distanceM).rightMrad / totalDriftMil) * ZONE_WEIGHT_PARTS);
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
