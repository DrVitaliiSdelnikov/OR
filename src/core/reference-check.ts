import { BallisticsEngine } from './engine';
import reference223 from './reference/223-77.json';
import reference308 from './reference/308-175.json';
import reference338 from './reference/338lm-300.json';
import reference65 from './reference/65cm-140.json';
import { Atmosphere, DragModel, Loadout, ShotGeometry, TwistDirection } from './types';

export interface ReferenceRow {
  distanceM: number;
  upMil: number;
  impactRightMil: number;
  timeS: number;
  spinDriftRightMil: number;
}

export interface ReferenceSet {
  id: string;
  atmosphere: Required<Atmosphere>;
  windZones: { speedMps: number; fromDeg: number }[];
  geometry: ShotGeometry;
  rows: ReferenceRow[];
}

export interface ReferenceTable {
  id: string;
  source: { library: string; version: string; generatedAt: string };
  cartridge: {
    name: string;
    massG: number;
    bulletDiameterIn: number;
    bulletLengthMm: number;
    dragModel: DragModel;
    ballisticCoefficient: number;
    muzzleVelocityMps: number;
  };
  rifle: { sightHeightCm: number; zeroM: number; twistInchesPerTurn: number; twistDirection: TwistDirection };
  sets: ReferenceSet[];
}

export interface ComparisonRow {
  distanceM: number;
  ourUpMil: number;
  referenceUpMil: number;
  upDifferenceMil: number;
  ourRightMil: number;
  referenceRightMil: number;
  rightDifferenceMil: number;
  timeDifferenceShare: number;
}

export interface ComparisonSummary {
  maxUpDifferenceMil: number;
  maxRightDifferenceMil: number;
  maxTimeDifferenceShare: number;
  isWithinTolerance: boolean;
}

export const REFERENCE_TOLERANCE = { verticalMil: 0.1, windMil: 0.05, timeShare: 0.01, timeShareOnIncline: 0.015 };

export const REFERENCE_TABLES: readonly ReferenceTable[] = [
  { id: '308-175', ...(reference308 as Omit<ReferenceTable, 'id'>) },
  { id: '65cm-140', ...(reference65 as Omit<ReferenceTable, 'id'>) },
  { id: '223-77', ...(reference223 as Omit<ReferenceTable, 'id'>) },
  { id: '338lm-300', ...(reference338 as Omit<ReferenceTable, 'id'>) },
];

function referenceLoadout(table: ReferenceTable): Loadout {
  return {
    rifle: { name: table.cartridge.name, groupSigmaMrad: 0, coldBoreShiftMil: { upMrad: 0, rightMrad: 0 }, ...table.rifle },
    cartridge: { id: 'B', blurb: '', muzzleVelocitySdMps: 0, ...table.cartridge },
  };
}

export async function comparedRows(engine: BallisticsEngine, table: ReferenceTable, set: ReferenceSet): Promise<ComparisonRow[]> {
  const windZones = set.windZones.map(zone => ({ untilM: Infinity, ...zone }));
  const points = await engine.trajectory(referenceLoadout(table), set.atmosphere, windZones, undefined, undefined, set.geometry);
  return set.rows.map(reference => {
    const required = BallisticsEngine.required(points, reference.distanceM);
    const ourRightMil = -required.rightMrad;
    return {
      distanceM: reference.distanceM,
      ourUpMil: required.upMrad,
      referenceUpMil: reference.upMil,
      upDifferenceMil: required.upMrad - reference.upMil,
      ourRightMil,
      referenceRightMil: reference.impactRightMil,
      rightDifferenceMil: ourRightMil - reference.impactRightMil,
      timeDifferenceShare: (required.timeS - reference.timeS) / reference.timeS,
    };
  });
}

export function comparisonSummary(rows: readonly ComparisonRow[], lookAngleDeg: number): ComparisonSummary {
  const largest = (pick: (row: ComparisonRow) => number) => Math.max(...rows.map(row => Math.abs(pick(row))));
  const maxUpDifferenceMil = largest(row => row.upDifferenceMil);
  const maxRightDifferenceMil = largest(row => row.rightDifferenceMil);
  const maxTimeDifferenceShare = largest(row => row.timeDifferenceShare);
  const timeShareLimit = lookAngleDeg === 0 ? REFERENCE_TOLERANCE.timeShare : REFERENCE_TOLERANCE.timeShareOnIncline;
  return {
    maxUpDifferenceMil,
    maxRightDifferenceMil,
    maxTimeDifferenceShare,
    isWithinTolerance:
      maxUpDifferenceMil <= REFERENCE_TOLERANCE.verticalMil && maxRightDifferenceMil <= REFERENCE_TOLERANCE.windMil && maxTimeDifferenceShare <= timeShareLimit,
  };
}
