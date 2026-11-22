import { inSystem, Quantity, toDisplay, UnitSystem } from '../../core/units';
import { andList, decimal, signed } from '../format';

const UNIT_NAMES: Record<Quantity, Record<UnitSystem, string>> = {
  distance: { metric: 'm', imperial: 'yd' },
  targetSize: { metric: 'm', imperial: 'in' },
  muzzleVelocity: { metric: 'm/s', imperial: 'fps' },
  windSpeed: { metric: 'm/s', imperial: 'mph' },
  bulletMass: { metric: 'g', imperial: 'gr' },
  bulletLength: { metric: 'mm', imperial: 'in' },
  sightHeight: { metric: 'mm', imperial: 'in' },
  temperature: { metric: '°C', imperial: '°F' },
  pressure: { metric: 'hPa', imperial: 'inHg' },
  altitude: { metric: 'm', imperial: 'ft' },
  impactOffset: { metric: 'cm', imperial: 'in' },
};

const DECIMAL_BASE = 10;

function roundedTo(value: number, digits: number): number {
  const scale = DECIMAL_BASE ** digits;
  const rounded = Math.round(value * scale) / scale;
  return rounded === 0 ? 0 : rounded;
}

export const units = {
  unitLabel: (quantity: Quantity, system: UnitSystem): string => UNIT_NAMES[quantity][system],
  valueText: (quantity: Quantity, baseValue: number, system: UnitSystem, digits: number): string => {
    const value = roundedTo(inSystem(quantity, baseValue, system), digits);
    const number = quantity === 'temperature' ? signed(value, Math.max(digits, 0)) : decimal(value, Math.max(digits, 0));
    return `${number} ${UNIT_NAMES[quantity][system]}`;
  },
  unitName: (quantity: Quantity, system: UnitSystem, _displayValue: number): string => UNIT_NAMES[quantity][system],
  displayText: (quantity: Quantity, displayValue: number, system: UnitSystem, digits: number): string =>
    `${decimal(roundedTo(displayValue, digits), Math.max(digits, 0))} ${UNIT_NAMES[quantity][system]}`,
  numberText: (quantity: Quantity, baseValue: number, system: UnitSystem, digits: number): string =>
    decimal(roundedTo(inSystem(quantity, baseValue, system), digits), Math.max(digits, 0)),
  rangeText: (quantity: Quantity, [lowBase, highBase]: readonly [number, number], system: UnitSystem): string => {
    const low = toDisplay(quantity, lowBase, system);
    const high = toDisplay(quantity, highBase, system);
    const unit = UNIT_NAMES[quantity][system];
    if (quantity === 'temperature') {
      return low === high ? `${signed(low)} ${unit}` : `${signed(low)}…${decimal(high)} ${unit}`;
    }
    return low === high ? `${decimal(low)} ${unit}` : `${decimal(low)}–${decimal(high)} ${unit}`;
  },
  listText: (quantity: Quantity, baseValues: readonly number[], system: UnitSystem, isAndList = false): string => {
    const numbers = baseValues.map(baseValue => decimal(toDisplay(quantity, baseValue, system)));
    return `${isAndList ? andList(numbers) : numbers.join(', ')} ${UNIT_NAMES[quantity][system]}`;
  },
  quantityText: (quantity: Quantity, baseValue: number, system: UnitSystem): string =>
    `${decimal(toDisplay(quantity, baseValue, system))} ${UNIT_NAMES[quantity][system]}`,
};
