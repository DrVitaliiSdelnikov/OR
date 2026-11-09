import { describe, expect, it } from 'vitest';
import { CheckErrorType } from '../../core/calc-check';
import { CauseKind, MainCause } from '../../sim/miss-breakdown';
import { CAUSE_TERMS, CHECK_ERROR_TERMS, MAIN_CAUSE_TERMS, termSegments } from './term-links';
import { TERM_CARDS } from './terms';

const ALL_TERMS: ReadonlySet<string> = new Set(TERM_CARDS.map(card => card.term));
const CARD_TERMS = TERM_CARDS.map(card => card.term);

function linkedTerms(text: string, opened: ReadonlySet<string> = ALL_TERMS): (string | null)[] {
  return termSegments(text, opened).map(segment => segment.term);
}

describe('термины в тексте', () => {
  it('находит термины по формам и склеивает текст без потерь', () => {
    const text = 'Поправка в кликах — перенеси барабанами и наведи снова';
    const segments = termSegments(text, ALL_TERMS);
    expect(segments.map(segment => segment.text).join('')).toBe(text);
    expect(segments.filter(segment => segment.term)).toEqual([
      { text: 'кликах', term: 'клик' },
      { text: 'барабанами', term: 'барабан' },
    ]);
  });

  it('«строка ДОПЕ» не режется на «ДОПЕ»', () => {
    expect(linkedTerms('Возьми строку ДОПЕ на 450 м').filter(Boolean)).toEqual(['строка ДОПЕ']);
  });

  it('только первое вхождение; закрытый термин — текст', () => {
    expect(linkedTerms('ветер, ещё ветер').filter(Boolean)).toEqual(['ветер']);
    expect(linkedTerms('Ещё три в одну точку — группа', new Set(['ветер'])).filter(Boolean)).toEqual([]);
  });

  it('только целые слова, без учёта регистра у строчных; заглавные — строго', () => {
    expect(linkedTerms('Ветер. Сначала замерь его станцией').filter(Boolean)).toEqual(['ветер', 'метеостанция']);
    expect(linkedTerms('ветерок и подветренный, импульс').filter(Boolean)).toEqual([]);
    expect(linkedTerms('посчитай сам').filter(Boolean)).toEqual([]);
    expect(linkedTerms('режим САМ').filter(Boolean)).toEqual(['САМ']);
  });

  it('MIL и MOA после числа — единицы, не ссылки; словом — ссылки', () => {
    expect(linkedTerms('ДОПЕ — падение пули: ↑ 1.6 MIL').filter(Boolean)).toEqual(['ДОПЕ']);
    expect(linkedTerms('узнаешь: клик · MIL · MOA').filter(Boolean)).toEqual(['клик', 'MIL', 'MOA']);
  });

  it('формы не повторяются у двух терминов', () => {
    const owners = new Map<string, string>();
    for (const card of TERM_CARDS) {
      for (const form of [card.term, ...(card.forms ?? [])]) {
        const key = form.toLowerCase();
        expect(owners.get(key) ?? card.term, form).toBe(card.term);
        owners.set(key, card.term);
      }
    }
  });

  it('каждая форма находит свою карточку', () => {
    for (const card of TERM_CARDS) {
      for (const form of [card.term, ...(card.forms ?? [])]) {
        expect(linkedTerms(`— ${form} —`).filter(Boolean), form).toEqual([card.term]);
      }
    }
  });
});

describe('таблицы подписей', () => {
  it('у каждого типа ошибки расчёта — существующий термин', () => {
    const types: CheckErrorType[] = ['units', 'substitution', 'side', 'rounding', 'arithmetic', 'lead', 'reading', 'factor', 'turret'];
    types.forEach(type => expect(CARD_TERMS, type).toContain(CHECK_ERROR_TERMS[type]));
    expect(CHECK_ERROR_TERMS.side).toBe('правило часов');
    expect(CHECK_ERROR_TERMS.rounding).toBe('клик');
  });

  it('у каждого лепестка и главной причины — существующий термин', () => {
    const kinds: CauseKind[] = ['calc', 'wind', 'hold', 'trigger', 'zero', 'formula', 'rifle', 'cold-bore'];
    kinds.forEach(kind => expect(CARD_TERMS, kind).toContain(CAUSE_TERMS[kind]));
    const causes: MainCause[] = ['calc', 'wind-under', 'wind-over', 'hold', 'trigger', 'zero'];
    causes.forEach(cause => expect(CARD_TERMS, cause).toContain(MAIN_CAUSE_TERMS[cause]));
    expect(CAUSE_TERMS['cold-bore']).toBe('холодный выстрел');
    expect(MAIN_CAUSE_TERMS['wind-over']).toBe('ветер');
  });
});
