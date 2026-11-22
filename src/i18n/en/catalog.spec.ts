import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Messages } from '../messages';
import { ru } from '../ru';
import { en, PENDING_EN_MODULES } from '.';

const EN_DIR = new URL('./', import.meta.url);
const CYRILLIC = /[Ѐ-ӿ]+/g;
const DOT_FRACTION = /\.toFixed\(\s*[1-9]/;
const UNIT_AFTER_PLACEHOLDER = /\$\{[^}]+\} ?(?:m|m\/s|°C|hPa|cm|yd|mph|°F)(?![a-z])/;

function shapeDifferences(russian: unknown, english: unknown, path: string): string[] {
  if (typeof russian === 'function' || typeof english === 'function') {
    return typeof russian === typeof english ? [] : [path];
  }
  if (Array.isArray(russian)) {
    return Array.isArray(english) && english.length === russian.length ? russian.flatMap((item, index) => shapeDifferences(item, english[index], `${path}[${index}]`)) : [path];
  }
  if (russian !== null && typeof russian === 'object') {
    if (english === null || typeof english !== 'object') {
      return [path];
    }
    const keys = new Set([...Object.keys(russian), ...Object.keys(english)]);
    return [...keys].flatMap(key => shapeDifferences((russian as Record<string, unknown>)[key], (english as Record<string, unknown>)[key], `${path}.${key}`));
  }
  return typeof russian === typeof english ? [] : [path];
}

const sourceFiles = readdirSync(EN_DIR).filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'));

describe('английский каталог (T6.3)', () => {
  it('та же форма, что у русского: ключи, функции, длины списков', () => {
    expect(shapeDifferences(ru, en, 'text')).toEqual([]);
  });

  it('пока не переведено ровно то, что в списке второго этапа', () => {
    const borrowed = (Object.keys(ru) as (keyof Messages)[]).filter(module => en[module] === ru[module]);
    expect(borrowed.sort()).toEqual([...PENDING_EN_MODULES].sort());
  });

  it('в файлах английского каталога нет кириллицы', () => {
    const found = sourceFiles.flatMap(name =>
      [...readFileSync(new URL(name, EN_DIR), 'utf-8').matchAll(CYRILLIC)].map(match => `${name}: ${match[0]}`),
    );
    expect(found).toEqual([]);
  });

  it('ссылки на термины ведут на английские карточки: related, термины упражнений, termLinks, песочницы, схемы; глава — из списка глав', () => {
    const cards = Object.values(en.textbook.terms({ rifleName: 'R', zero: '100 m', flags: '200, 400 m', flagsAnd: '200 and 400 m' }));
    const termNames = new Set(cards.map(card => card.term));
    const referenced = [
      ...cards.flatMap(card => card.related),
      ...Object.values(en.content.exerciseTerms).flat(),
      ...Object.values(en.textbook.termLinks).flatMap(links => Object.values(links)),
      ...Object.values(en.textbook.sandboxes).flatMap(sandbox => sandbox.terms),
      ...Object.values(en.textbook.schemeTerms).flat(),
    ];
    expect(cards).toHaveLength(Object.keys(ru.textbook.terms({ rifleName: 'R', zero: '', flags: '', flagsAnd: '' })).length);
    expect(referenced.filter(term => !termNames.has(term))).toEqual([]);
    expect(cards.filter(card => !en.textbook.chapters.includes(card.chapter)).map(card => card.term)).toEqual([]);
  });

  it('дата дня: ММ/ДД в английском, ДД.ММ в русском', () => {
    expect(en.daily.shortDate({ day: '25', month: '11' })).toBe('11/25');
    expect(ru.daily.shortDate({ day: '25', month: '11' })).toBe('25.11');
  });

  it('дроби и единицы — только через форматтеры', () => {
    const offending = sourceFiles.filter(name => {
      const source = readFileSync(new URL(name, EN_DIR), 'utf-8').split('\n').filter(line => !line.trimStart().startsWith('import'));
      return source.some(line => DOT_FRACTION.test(line) || UNIT_AFTER_PLACEHOLDER.test(line));
    });
    expect(offending).toEqual([]);
  });
});
