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

const files = sourceFiles(SOURCE_ROOT).filter(path => !path.startsWith(CATALOG_ROOT));

describe('каталог текстов', () => {
  it('русский текст есть только в каталоге', () => {
    const withText = files.filter(path => CYRILLIC.test(withoutComments(readFileSync(path, 'utf-8'))));
    expect(withText).toEqual([]);
  });

  it('запятую в дробях ставит только format.ts', () => {
    const manual = files.filter(path => MANUAL_DECIMAL_COMMA.test(readFileSync(path, 'utf-8')));
    expect(manual).toEqual([]);
  });
});
