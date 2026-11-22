const MINUS = '−';
import type { Language } from './language';

interface NumberFormat {
  decimalSeparator: string;
  percentSuffix: string;
  lastListSeparator: string;
  pluralIndex: (count: number) => 0 | 1 | 2;
}

const RUSSIAN_PLURAL_INDEX = (count: number): 0 | 1 | 2 => {
  const lastTwo = Math.abs(count) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 14) {
    return 2;
  }
  if (last === 1) {
    return 0;
  }
  return last >= 2 && last <= 4 ? 1 : 2;
};

const NUMBER_FORMATS: Record<Language, NumberFormat> = {
  ru: { decimalSeparator: ',', percentSuffix: ' %', lastListSeparator: ' и ', pluralIndex: RUSSIAN_PLURAL_INDEX },
  en: { decimalSeparator: '.', percentSuffix: '%', lastListSeparator: ' and ', pluralIndex: count => (Math.abs(count) === 1 ? 0 : 2) },
};

let numberFormat = NUMBER_FORMATS.ru;

export function useNumberFormat(language: Language): void {
  numberFormat = NUMBER_FORMATS[language];
}
const NON_ZERO_DIGIT = /[1-9]/;

export type PluralForms = readonly [one: string, few: string, many: string];

export function decimal(value: number, digits?: number): string {
  const unsigned = digits === undefined ? String(Math.abs(value)) : Math.abs(value).toFixed(digits);
  const sign = value < 0 && NON_ZERO_DIGIT.test(unsigned) ? MINUS : '';
  return sign + unsigned.replace('.', numberFormat.decimalSeparator);
}

export function lowerFirst(phrase: string): string {
  return phrase.charAt(0).toLocaleLowerCase('ru') + phrase.slice(1);
}

export function signed(value: number, digits?: number): string {
  const text = decimal(value, digits);
  return value > 0 && NON_ZERO_DIGIT.test(text) ? `+${text}` : text;
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}${numberFormat.percentSuffix}`;
}

export function plural(count: number, forms: PluralForms): string {
  return forms[numberFormat.pluralIndex(count)];
}

export function andList(values: readonly (number | string)[]): string {
  return values.length < 2 ? values.join('') : `${values.slice(0, -1).join(', ')}${numberFormat.lastListSeparator}${values[values.length - 1]}`;
}

export function typedDecimal(draft: string): string {
  return draft.replace(/[.,]/, numberFormat.decimalSeparator);
}
