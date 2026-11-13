const MINUS = '−';
const DECIMAL_SEPARATOR = ',';
const NON_ZERO_DIGIT = /[1-9]/;

export type PluralForms = readonly [one: string, few: string, many: string];

export function decimal(value: number, digits?: number): string {
  const unsigned = digits === undefined ? String(Math.abs(value)) : Math.abs(value).toFixed(digits);
  const sign = value < 0 && NON_ZERO_DIGIT.test(unsigned) ? MINUS : '';
  return sign + unsigned.replace('.', DECIMAL_SEPARATOR);
}

export function signed(value: number, digits?: number): string {
  const text = decimal(value, digits);
  return value > 0 && NON_ZERO_DIGIT.test(text) ? `+${text}` : text;
}

export function percent(share: number): string {
  return `${Math.round(share * 100)} %`;
}

export function plural(count: number, forms: PluralForms): string {
  const lastTwo = Math.abs(count) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 14) {
    return forms[2];
  }
  if (last === 1) {
    return forms[0];
  }
  return last >= 2 && last <= 4 ? forms[1] : forms[2];
}

export function andList(values: readonly (number | string)[]): string {
  return values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')} и ${values[values.length - 1]}`;
}
