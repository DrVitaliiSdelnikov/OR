import { inSystem, Quantity, toDisplay, UnitSystem } from '../../core/units';
import { andList, decimal, plural, PluralForms, signed } from '../format';

const YARD_FORMS: PluralForms = ['ярд', 'ярда', 'ярдов'];
const INCH_FORMS: PluralForms = ['дюйм', 'дюйма', 'дюймов'];
const GRAIN_FORMS: PluralForms = ['гран', 'грана', 'гранов'];
const INCH_OF_MERCURY_FORMS: PluralForms = ['дюйм рт. ст.', 'дюйма рт. ст.', 'дюймов рт. ст.'];
const FOOT_FORMS: PluralForms = ['фут', 'фута', 'футов'];

type UnitName = string | PluralForms;

const UNIT_NAMES: Record<Quantity, Record<UnitSystem, UnitName>> = {
  distance: { metric: 'м', imperial: YARD_FORMS },
  targetSize: { metric: 'м', imperial: INCH_FORMS },
  muzzleVelocity: { metric: 'м/с', imperial: 'фут/с' },
  windSpeed: { metric: 'м/с', imperial: 'миль/ч' },
  bulletMass: { metric: 'г', imperial: GRAIN_FORMS },
  bulletLength: { metric: 'мм', imperial: INCH_FORMS },
  sightHeight: { metric: 'мм', imperial: INCH_FORMS },
  temperature: { metric: '°C', imperial: '°F' },
  pressure: { metric: 'гПа', imperial: INCH_OF_MERCURY_FORMS },
  altitude: { metric: 'м', imperial: FOOT_FORMS },
  impactOffset: { metric: 'см', imperial: INCH_FORMS },
};

const FRACTION_FORM = 1;
const DECIMAL_BASE = 10;

function roundedTo(value: number, digits: number): number {
  const scale = DECIMAL_BASE ** digits;
  const rounded = Math.round(value * scale) / scale;
  return rounded === 0 ? 0 : rounded;
}

function unitNameFor(name: UnitName, displayValue: number): string {
  if (typeof name === 'string') {
    return name;
  }
  return Number.isInteger(displayValue) ? plural(displayValue, name) : name[FRACTION_FORM];
}

export const units = {
  unitLabel: (quantity: Quantity, system: UnitSystem): string => {
    const name = UNIT_NAMES[quantity][system];
    return typeof name === 'string' ? name : name[0];
  },
  valueText: (quantity: Quantity, baseValue: number, system: UnitSystem, digits: number): string => {
    const value = roundedTo(inSystem(quantity, baseValue, system), digits);
    const number = quantity === 'temperature' ? signed(value, Math.max(digits, 0)) : decimal(value, Math.max(digits, 0));
    return `${number} ${unitNameFor(UNIT_NAMES[quantity][system], value)}`;
  },
  unitName: (quantity: Quantity, system: UnitSystem, displayValue: number): string => unitNameFor(UNIT_NAMES[quantity][system], displayValue),
  displayText: (quantity: Quantity, displayValue: number, system: UnitSystem, digits: number): string => {
    const value = roundedTo(displayValue, digits);
    return `${decimal(value, Math.max(digits, 0))} ${unitNameFor(UNIT_NAMES[quantity][system], value)}`;
  },
  numberText: (quantity: Quantity, baseValue: number, system: UnitSystem, digits: number): string =>
    decimal(roundedTo(inSystem(quantity, baseValue, system), digits), Math.max(digits, 0)),
  rangeText: (quantity: Quantity, [lowBase, highBase]: readonly [number, number], system: UnitSystem): string => {
    const low = toDisplay(quantity, lowBase, system);
    const high = toDisplay(quantity, highBase, system);
    const unit = unitNameFor(UNIT_NAMES[quantity][system], high);
    if (quantity === 'temperature') {
      return low === high ? `${signed(low)} ${unit}` : `${signed(low)}…${decimal(high)} ${unit}`;
    }
    return low === high ? `${decimal(low)} ${unit}` : `${decimal(low)}–${decimal(high)} ${unit}`;
  },
  listText: (quantity: Quantity, baseValues: readonly number[], system: UnitSystem, isAndList = false): string => {
    const displayValues = baseValues.map(baseValue => toDisplay(quantity, baseValue, system));
    const numbers = displayValues.map(value => decimal(value));
    return `${isAndList ? andList(numbers) : numbers.join(', ')} ${unitNameFor(UNIT_NAMES[quantity][system], displayValues[displayValues.length - 1])}`;
  },
  quantityText: (quantity: Quantity, baseValue: number, system: UnitSystem): string => {
    const displayValue = toDisplay(quantity, baseValue, system);
    return `${decimal(displayValue)} ${unitNameFor(UNIT_NAMES[quantity][system], displayValue)}`;
  },
};
