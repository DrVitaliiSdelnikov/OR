import { CheckErrorType } from '../../core/calc-check';
import { CauseKind, MainCause } from '../../sim/miss-breakdown';
import { TERM_CARDS } from './terms';

export interface TermSegment {
  text: string;
  term: string | null;
}

export const CHECK_ERROR_TERMS: Record<CheckErrorType, string> = {
  side: 'правило часов',
  substitution: 'САМ',
  arithmetic: 'САМ',
  factor: 'САМ',
  reading: 'метеостанция',
  lead: 'упреждение',
  rounding: 'клик',
  units: 'MOA',
  turret: 'барабан',
};

export const CAUSE_TERMS: Record<CauseKind, string> = {
  calc: 'САМ',
  wind: 'ветер',
  hold: 'дыхание',
  lead: 'упреждение',
  trigger: 'спуск',
  zero: 'ноль',
  'cold-bore': 'холодный выстрел',
  formula: 'константа ветра',
  rifle: 'группа',
};

export const MAIN_CAUSE_TERMS: Record<MainCause, string> = {
  calc: 'САМ',
  'wind-under': 'ветер',
  'wind-over': 'ветер',
  hold: 'дыхание',
  lead: 'упреждение',
  trigger: 'спуск',
  zero: 'ноль',
};

const UNIT_TERMS: readonly string[] = ['MIL', 'MOA'];
const ENDS_WITH_NUMBER = /\d\s*$/;
const WORD_EDGE_BEFORE = '(?<![\\p{L}\\p{N}])';
const WORD_EDGE_AFTER = '(?![\\p{L}\\p{N}])';

interface TermForm {
  form: string;
  term: string;
  isCaseStrict: boolean;
}

const TERM_FORMS: readonly TermForm[] = TERM_CARDS.flatMap(card => [card.term, ...(card.forms ?? [])].map(form => ({ form, term: card.term, isCaseStrict: form === form.toUpperCase() })));

const TERM_PATTERN = new RegExp(
  `${WORD_EDGE_BEFORE}(${TERM_FORMS.map(item => escapeRegExp(item.form)).join('|')})${WORD_EDGE_AFTER}`,
  'giu',
);

export function termSegments(text: string, opened: ReadonlySet<string>): TermSegment[] {
  const segments: TermSegment[] = [];
  const linked = new Set<string>();
  let plainStart = 0;
  for (const match of text.matchAll(TERM_PATTERN)) {
    const found = formOf(match[0]);
    const isUnitAfterNumber = found !== undefined && UNIT_TERMS.includes(found.term) && ENDS_WITH_NUMBER.test(text.slice(0, match.index));
    if (!found || isUnitAfterNumber || !opened.has(found.term) || linked.has(found.term)) {
      continue;
    }
    linked.add(found.term);
    if (match.index > plainStart) {
      segments.push({ text: text.slice(plainStart, match.index), term: null });
    }
    segments.push({ text: match[0], term: found.term });
    plainStart = match.index + match[0].length;
  }
  if (plainStart < text.length) {
    segments.push({ text: text.slice(plainStart), term: null });
  }
  return segments;
}

function formOf(matched: string): TermForm | undefined {
  return TERM_FORMS.find(item => (item.isCaseStrict ? item.form === matched : item.form.toLowerCase() === matched.toLowerCase()));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
