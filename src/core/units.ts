export type UnitSystem = 'metric' | 'imperial';

export const UNIT_SYSTEMS: readonly UnitSystem[] = ['metric', 'imperial'];

export type Quantity =
  | 'distance'
  | 'targetSize'
  | 'muzzleVelocity'
  | 'windSpeed'
  | 'bulletMass'
  | 'bulletLength'
  | 'sightHeight'
  | 'temperature'
  | 'pressure';

export const QUANTITIES: readonly Quantity[] = [
  'distance',
  'targetSize',
  'muzzleVelocity',
  'windSpeed',
  'bulletMass',
  'bulletLength',
  'sightHeight',
  'temperature',
  'pressure',
];

const METERS_PER_YARD = 0.9144;
const METERS_PER_FOOT = 0.3048;
const MILLIMETERS_PER_INCH = 25.4;
const METERS_PER_INCH = MILLIMETERS_PER_INCH / 1000;
const METERS_PER_SECOND_PER_MPH = 0.44704;
const GRAMS_PER_GRAIN = 0.06479891;
const HECTOPASCALS_PER_INCH_OF_MERCURY = 33.8639;
const FAHRENHEIT_PER_CELSIUS = 9 / 5;
const FAHRENHEIT_AT_ZERO_CELSIUS = 32;

interface DisplayUnit {
  baseUnitsPerDisplayUnit: number;
  displayAtBaseZero: number;
  step: number;
}

const metricUnit = (step: number): DisplayUnit => ({ baseUnitsPerDisplayUnit: 1, displayAtBaseZero: 0, step });

const DISPLAY_UNITS: Record<Quantity, Record<UnitSystem, DisplayUnit>> = {
  distance: { metric: metricUnit(1), imperial: { baseUnitsPerDisplayUnit: METERS_PER_YARD, displayAtBaseZero: 0, step: 1 } },
  targetSize: { metric: metricUnit(0.05), imperial: { baseUnitsPerDisplayUnit: METERS_PER_INCH, displayAtBaseZero: 0, step: 1 } },
  muzzleVelocity: { metric: metricUnit(1), imperial: { baseUnitsPerDisplayUnit: METERS_PER_FOOT, displayAtBaseZero: 0, step: 1 } },
  windSpeed: { metric: metricUnit(0.1), imperial: { baseUnitsPerDisplayUnit: METERS_PER_SECOND_PER_MPH, displayAtBaseZero: 0, step: 0.1 } },
  bulletMass: { metric: metricUnit(0.1), imperial: { baseUnitsPerDisplayUnit: GRAMS_PER_GRAIN, displayAtBaseZero: 0, step: 1 } },
  bulletLength: { metric: metricUnit(0.1), imperial: { baseUnitsPerDisplayUnit: MILLIMETERS_PER_INCH, displayAtBaseZero: 0, step: 0.001 } },
  sightHeight: { metric: metricUnit(1), imperial: { baseUnitsPerDisplayUnit: MILLIMETERS_PER_INCH, displayAtBaseZero: 0, step: 0.01 } },
  temperature: {
    metric: metricUnit(1),
    imperial: { baseUnitsPerDisplayUnit: 1 / FAHRENHEIT_PER_CELSIUS, displayAtBaseZero: FAHRENHEIT_AT_ZERO_CELSIUS, step: 1 },
  },
  pressure: { metric: metricUnit(1), imperial: { baseUnitsPerDisplayUnit: HECTOPASCALS_PER_INCH_OF_MERCURY, displayAtBaseZero: 0, step: 0.01 } },
};

export function toDisplay(quantity: Quantity, baseValue: number, system: UnitSystem): number {
  const unit = DISPLAY_UNITS[quantity][system];
  const exact = baseValue / unit.baseUnitsPerDisplayUnit + unit.displayAtBaseZero;
  const rounded = Number((Math.round(exact / unit.step) * unit.step).toFixed(displayDigits(quantity, system)));
  return rounded === 0 ? 0 : rounded;
}

export function fromInput(quantity: Quantity, value: number, system: UnitSystem): number {
  const unit = DISPLAY_UNITS[quantity][system];
  return (value - unit.displayAtBaseZero) * unit.baseUnitsPerDisplayUnit;
}

export function displayStep(quantity: Quantity, system: UnitSystem): number {
  return DISPLAY_UNITS[quantity][system].step;
}

export function displayDigits(quantity: Quantity, system: UnitSystem): number {
  const [, fraction = ''] = String(displayStep(quantity, system)).split('.');
  return fraction.length;
}
