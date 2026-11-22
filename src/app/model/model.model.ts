import { ComparisonRow, ComparisonSummary, REFERENCE_TABLES, REFERENCE_TOLERANCE, ReferenceSet, ReferenceTable } from '../../core/reference-check';
import { displayDigits, UnitSystem } from '../../core/units';
import { text } from '../../i18n';
import { decimal, signed } from '../../i18n/format';
import { FormulaTexts } from '../../i18n/ru/model';

export interface ModelChip {
  id: string;
  label: string;
  isSelected: boolean;
}

export interface ComparisonTableRow {
  distance: string;
  ourUp: string;
  referenceUp: string;
  upDifference: string;
  rightDifference: string;
  timeDifference: string;
}

export interface ComparisonTableView {
  distanceHeader: string;
  rows: ComparisonTableRow[];
}

const MIL_DIGITS = 2;
const PERCENT_DIGITS = 2;
const PERCENT_PER_SHARE = 100;
const STANDARD_ZERO_TEMPERATURE_C = 15;
const STANDARD_ZERO_PRESSURE_HPA = 1013.25;
const COMPARED_RANGE_M: readonly [number, number] = [100, 1000];
const WIND_FORMULA_RANGE_M: readonly [number, number] = [100, 1000];
const WIND_FORMULA_MAX_SPEED_MPS = 12;
const ATMOSPHERE_FORMULA_NEAR_M = 700;
const ATMOSPHERE_FORMULA_FAR_M: readonly [number, number] = [800, 1000];
const ANGLE_FORMULA_NEAR_M = 800;
const ANGLE_FORMULA_FAR_M = 1000;
const LEAD_FORMULA_RANGE_M: readonly [number, number] = [300, 500];

const T = text.model;
const U = text.units;

export function referenceChips(selectedTableId: string): ModelChip[] {
  return REFERENCE_TABLES.map(table => ({ id: table.id, label: T.cartridges[table.id], isSelected: table.id === selectedTableId }));
}

function setLabel(set: ReferenceSet, system: UnitSystem): string {
  switch (set.id) {
    case 'altitude-1500-wind-3':
      return T.sets[set.id]({
        altitude: U.valueText('altitude', set.atmosphere.altitudeM, system, 0),
        wind: U.quantityText('windSpeed', set.windZones[0].speedMps, system),
      });
    case 'uphill-15-coriolis-55n-east':
      return T.sets[set.id]({ angleDeg: set.geometry.lookAngleDeg, latitudeDeg: set.geometry.coriolis?.latitudeDeg ?? 0 });
    default:
      return T.sets['sea-level-calm']();
  }
}

export function setChips(table: ReferenceTable, selectedSetId: string, system: UnitSystem): ModelChip[] {
  return table.sets.map(set => ({ id: set.id, label: setLabel(set, system), isSelected: set.id === selectedSetId }));
}

export function sourceLine(table: ReferenceTable): string {
  const [year, month, day] = table.source.generatedAt.split('-');
  return T.source({ library: table.source.library, version: table.source.version, date: `${day}.${month}.${year}` });
}

function percentText(share: number): string {
  return decimal(share * PERCENT_PER_SHARE);
}

export function toleranceLine(system: UnitSystem): string {
  return T.tolerance({
    range: U.rangeText('distance', COMPARED_RANGE_M, system),
    vertical: decimal(REFERENCE_TOLERANCE.verticalMil),
    wind: decimal(REFERENCE_TOLERANCE.windMil),
    time: `${percentText(REFERENCE_TOLERANCE.timeShare)} %`,
    timeOnIncline: `${percentText(REFERENCE_TOLERANCE.timeShareOnIncline)} %`,
  });
}

export function comparisonTableView(rows: readonly ComparisonRow[], system: UnitSystem): ComparisonTableView {
  return {
    distanceHeader: T.distanceHeader({ unit: U.unitLabel('distance', system) }),
    rows: rows.map(row => ({
      distance: U.numberText('distance', row.distanceM, system, 0),
      ourUp: decimal(row.ourUpMil, MIL_DIGITS),
      referenceUp: decimal(row.referenceUpMil, MIL_DIGITS),
      upDifference: signed(row.upDifferenceMil, MIL_DIGITS),
      rightDifference: signed(row.rightDifferenceMil, MIL_DIGITS),
      timeDifference: T.timeDifference({ value: signed(row.timeDifferenceShare * PERCENT_PER_SHARE, PERCENT_DIGITS) }),
    })),
  };
}

export function summaryLine(summary: ComparisonSummary): string {
  return T.summary({
    up: decimal(summary.maxUpDifferenceMil, MIL_DIGITS),
    right: decimal(summary.maxRightDifferenceMil, MIL_DIGITS),
    time: decimal(summary.maxTimeDifferenceShare * PERCENT_PER_SHARE, PERCENT_DIGITS),
    verdict: summary.isWithinTolerance ? T.within : T.outside,
  });
}

export function formulaRows(system: UnitSystem): FormulaTexts[] {
  return T.formulas(system, {
    windRange: U.rangeText('distance', WIND_FORMULA_RANGE_M, system),
    windSpeed: U.quantityText('windSpeed', WIND_FORMULA_MAX_SPEED_MPS, system),
    atmosphereNear: U.quantityText('distance', ATMOSPHERE_FORMULA_NEAR_M, system),
    atmosphereFar: U.rangeText('distance', ATMOSPHERE_FORMULA_FAR_M, system),
    angleNear: U.quantityText('distance', ANGLE_FORMULA_NEAR_M, system),
    angleFar: U.quantityText('distance', ANGLE_FORMULA_FAR_M, system),
    leadRange: U.rangeText('distance', LEAD_FORMULA_RANGE_M, system),
  });
}

export function assumptionLines(system: UnitSystem): string[] {
  return T.assumptions({
    zeroTemperature: U.valueText('temperature', STANDARD_ZERO_TEMPERATURE_C, system, 0),
    zeroPressure: U.valueText('pressure', STANDARD_ZERO_PRESSURE_HPA, system, displayDigits('pressure', system)),
  });
}
