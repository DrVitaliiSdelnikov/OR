import { FLAT_GEOMETRY, STANDARD_PRESSURE_HPA, STANDARD_RELATIVE_HUMIDITY, STANDARD_TEMPERATURE_C } from '../core/content';
import { BallisticsEngine } from '../core/engine';
import { Atmosphere, TrajectoryPoint } from '../core/types';
import { fromInput, toDisplay, UnitSystem } from '../core/units';
import { loadoutOf, RifleProfile } from './rifle-profile';
import { MRAD_PER_MOA, ScopeUnits } from './scope-model';

export interface ProfileDopeRow {
  distance: number;
  elevation: number;
  clicks: number;
  windPerUnit: number;
  spinDriftRight: number;
  timeOfFlightS: number;
}

export interface ProfileDopeHeader {
  profileName: string;
  zero: number;
  temperature: number;
  pressure: number;
  scopeUnits: ScopeUnits;
  clickValue: number;
  zeroAngle: number;
  windUnit: 'mps' | 'mph';
}

export interface ProfileDopeCard {
  distanceUnit: UnitSystem;
  header: ProfileDopeHeader;
  rows: readonly ProfileDopeRow[];
}

const ROW_STEP = 50;
const ROW_COUNT: Record<UnitSystem, number> = { metric: 20, imperial: 22 };
const CALIBRATION_CROSSWIND_MPS = 1;
const CROSSWIND_FROM_LEFT_DEG = 90;
const METERS_PER_SECOND_PER_MPH = 0.44704;
const SCOPE_ROUNDING: Record<ScopeUnits, number> = { MIL: 0.1, MOA: 0.25 };
const TIME_DECIMALS = 100;
const ZERO_ANGLE_DECIMALS = 100;
const SPINNING = { ...FLAT_GEOMETRY, isSpinDriftOn: true };
const CARD_ATMOSPHERE: Atmosphere = {
  temperatureC: STANDARD_TEMPERATURE_C,
  pressureHpa: STANDARD_PRESSURE_HPA,
  relativeHumidity: STANDARD_RELATIVE_HUMIDITY,
};

export async function buildProfileDopeCard(engine: BallisticsEngine, profile: RifleProfile, system: UnitSystem): Promise<ProfileDopeCard> {
  const loadout = loadoutOf(profile);
  const { units, clickValue } = profile.scope;
  const rowCount = ROW_COUNT[system];
  const stepM = fromInput('distance', ROW_STEP, system);
  const trajectory = (windZones: Parameters<BallisticsEngine['trajectory']>[2], geometry = FLAT_GEOMETRY): Promise<TrajectoryPoint[]> =>
    engine.trajectory(loadout, CARD_ATMOSPHERE, windZones, loadout.cartridge.muzzleVelocityMps, stepM, geometry, rowCount * stepM);
  const [standardPoints, crosswindPoints, spinningPoints, zeroAngleMil] = await Promise.all([
    trajectory(null),
    trajectory([{ untilM: Infinity, speedMps: CALIBRATION_CROSSWIND_MPS, fromDeg: CROSSWIND_FROM_LEFT_DEG }]),
    trajectory(null, SPINNING),
    engine.zeroAngleMil(loadout),
  ]);
  const windUnitMps = system === 'imperial' ? METERS_PER_SECOND_PER_MPH : CALIBRATION_CROSSWIND_MPS;
  const toScope = (mil: number): number => (units === 'MOA' ? mil / MRAD_PER_MOA : mil);
  const rounded = (mil: number): number => roundTo(toScope(mil), SCOPE_ROUNDING[units]);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const standard = standardPoints[index + 1];
    const elevationMil = -standard.dropMrad;
    const driftPerMpsMil = Math.abs(crosswindPoints[index + 1].windageMrad - standard.windageMrad) / CALIBRATION_CROSSWIND_MPS;
    return {
      distance: ROW_STEP * (index + 1),
      elevation: rounded(elevationMil),
      clicks: withoutNegativeZero(Math.round(toScope(elevationMil) / clickValue)),
      windPerUnit: rounded(driftPerMpsMil * windUnitMps),
      spinDriftRight: rounded(spinningPoints[index + 1].windageMrad - standard.windageMrad),
      timeOfFlightS: roundTo(standard.timeS, 1 / TIME_DECIMALS),
    };
  });
  return {
    distanceUnit: system,
    header: {
      profileName: profile.name,
      zero: toDisplay('distance', profile.rifle.zeroM, system),
      temperature: toDisplay('temperature', CARD_ATMOSPHERE.temperatureC, system),
      pressure: toDisplay('pressure', CARD_ATMOSPHERE.pressureHpa, system),
      scopeUnits: units,
      clickValue,
      zeroAngle: roundTo(toScope(zeroAngleMil), 1 / ZERO_ANGLE_DECIMALS),
      windUnit: system === 'imperial' ? 'mph' : 'mps',
    },
    rows,
  };
}

function roundTo(value: number, step: number): number {
  return withoutNegativeZero(Number((Math.round(value / step) * step).toFixed(2)));
}

function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}
