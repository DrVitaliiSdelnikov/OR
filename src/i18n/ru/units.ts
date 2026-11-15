import { Quantity, toDisplay, UnitSystem } from '../../core/units';
import { decimal, plural, PluralForms } from '../format';

const YARD_FORMS: PluralForms = ['ярд', 'ярда', 'ярдов'];
const INCH_FORMS: PluralForms = ['дюйм', 'дюйма', 'дюймов'];
const GRAIN_FORMS: PluralForms = ['гран', 'грана', 'гранов'];
const INCH_OF_MERCURY_FORMS: PluralForms = ['дюйм рт. ст.', 'дюйма рт. ст.', 'дюймов рт. ст.'];

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
};

const FRACTION_FORM = 1;

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
  quantityText: (quantity: Quantity, baseValue: number, system: UnitSystem): string => {
    const displayValue = toDisplay(quantity, baseValue, system);
    return `${decimal(displayValue)} ${unitNameFor(UNIT_NAMES[quantity][system], displayValue)}`;
  },
};
