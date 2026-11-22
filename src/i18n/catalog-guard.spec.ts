import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = 'src';
const CATALOG_ROOT = 'src/i18n/';
const SOURCE_FILE = /\.(ts|html)$/;
const SPEC_FILE = /\.spec\.ts$/;
const CYRILLIC = /[Ѐ-ӿ]/;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:'"`])\/\/.*$/gm;
const MANUAL_DECIMAL_COMMA = /replace\(\s*'\.'\s*,\s*','\s*\)/;
const DOT_FRACTION = /\.toFixed\(\s*[1-9]/;
const CATALOG_FILE = /^src\/i18n\/ru\/(?!.*\.spec\.ts$).*\.ts$/;
const STATIC_SHELL_FILES = ['src/index.html'];
const UNIT_AFTER_PLACEHOLDER = /\$\{[^}]+\} ?(?:м|м\/с|°C|гПа|см)(?![а-яёa-z])/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return SOURCE_FILE.test(entry.name) && !SPEC_FILE.test(entry.name) ? [relative('.', path).replaceAll('\\', '/')] : [];
  });
}

function withoutComments(source: string): string {
  return source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '$1');
}

const files = sourceFiles(SOURCE_ROOT).filter(path => !path.startsWith(CATALOG_ROOT) && !STATIC_SHELL_FILES.includes(path));

describe('каталог текстов', () => {
  it('русский текст есть только в каталоге', () => {
    const withText = files.filter(path => CYRILLIC.test(withoutComments(readFileSync(path, 'utf-8'))));
    expect(withText).toEqual([]);
  });

  it('запятую в дробях ставит только format.ts', () => {
    const manual = files.filter(path => MANUAL_DECIMAL_COMMA.test(readFileSync(path, 'utf-8')));
    expect(manual).toEqual([]);
  });

  it('каталог выводит дроби только через format.ts — с запятой', () => {
    const catalog = sourceFiles(CATALOG_ROOT).filter(path => CATALOG_FILE.test(path));
    const withDot = catalog.filter(path => DOT_FRACTION.test(readFileSync(path, 'utf-8')));
    expect(catalog.length).toBeGreaterThan(0);
    expect(withDot).toEqual([]);
  });

  it('единицы в каталоге — только через форматтеры: после подстановки нет «м», «м/с», «°C», «гПа», «см» (T1.8c)', () => {
    const catalog = sourceFiles(CATALOG_ROOT).filter(path => CATALOG_FILE.test(path));
    const withUnit = catalog.flatMap(path =>
      readFileSync(path, 'utf-8')
        .split('\n')
        .map((line, index) => ({ line, at: `${path}:${index + 1}` }))
        .filter(({ line }) => UNIT_AFTER_PLACEHOLDER.test(line))
        .map(({ at }) => at),
    );
    expect(withUnit).toEqual([]);
  });
});

const TEXTS_DIR = new URL('./ru/', import.meta.url);
const MILITARY_WORDS = /[а-яё]*(снайпер|курсант|инструктор|аттестац|звани)[а-яё]*/giu;
const COURSE_NAME_UNTIL_P16A = 'Снайперская подготовка';

function militaryWordsIn(sourceText: string): string[] {
  return [...sourceText.replaceAll(COURSE_NAME_UNTIL_P16A, '').matchAll(MILITARY_WORDS)].map(match => match[0]);
}

describe('спортивная лексика (T4.4, В44)', () => {
  it('в текстах нет военных слов, кроме названия курса до П16а', () => {
    const found = readdirSync(TEXTS_DIR)
      .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
      .flatMap(name => militaryWordsIn(readFileSync(new URL(name, TEXTS_DIR), 'utf-8')).map(word => `${name}: ${word}`));
    expect(found).toEqual([]);
  });

  it('сторож ловит слово в любом регистре и пропускает только название курса', () => {
    expect(militaryWordsIn('Учебник курсанта · СНАЙПЕР · с инструктором · аттестация · Звание')).toEqual(['курсанта', 'СНАЙПЕР', 'инструктором', 'аттестация', 'Звание']);
    expect(militaryWordsIn('Снайперская подготовка · тренер · стрелок')).toEqual([]);
  });
});
