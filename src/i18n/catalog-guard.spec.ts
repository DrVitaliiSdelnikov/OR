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

const PENDING_FILES: ReadonlySet<string> = new Set([
  'src/app/app.ts',
  'src/app/course/course-trail.model.ts',
  'src/app/course/course-trail.page.ts',
  'src/app/course/exercise-sheet.page.ts',
  'src/app/free/free-play.model.ts',
  'src/app/free/free-play.page.ts',
  'src/app/home/home.model.ts',
  'src/app/home/home.page.ts',
  'src/app/instructor/radio.model.ts',
  'src/app/instructor/teaching-overlay.component.ts',
  'src/app/intro/intro.model.ts',
  'src/app/intro/intro.page.ts',
  'src/app/intro/part-scheme.component.ts',
  'src/app/journal/journal.model.ts',
  'src/app/journal/journal.page.ts',
  'src/app/notebook/calc-sheet.component.ts',
  'src/app/notebook/calc-sheet.model.ts',
  'src/app/notebook/chip-tray.component.ts',
  'src/app/notebook/conditions-tab.component.ts',
  'src/app/notebook/distance-tab.component.ts',
  'src/app/notebook/dope-tab.component.ts',
  'src/app/notebook/formulas-sheet.component.ts',
  'src/app/notebook/keypad.component.ts',
  'src/app/notebook/notebook-sheet.component.ts',
  'src/app/notebook/notebook.model.ts',
  'src/app/notebook/speed-wheel.component.ts',
  'src/app/notebook/total-tab.component.ts',
  'src/app/notebook/wind-clock.component.ts',
  'src/app/notebook/wind-tab.component.ts',
  'src/app/position/bolt-track.component.ts',
  'src/app/position/fire-control.component.ts',
  'src/app/position/position.model.ts',
  'src/app/position/position.page.html',
  'src/app/position/position.page.ts',
  'src/app/position/turret-drum.component.ts',
  'src/app/result/result-sheet.component.ts',
  'src/app/review/causes.component.ts',
  'src/app/review/check-sheet.component.ts',
  'src/app/review/flight-view.component.ts',
  'src/app/review/review-sheet.component.ts',
  'src/app/review/target-scheme.component.ts',
  'src/app/settings/settings.model.ts',
  'src/app/settings/settings.page.ts',
  'src/app/textbook/sandbox.model.ts',
  'src/app/textbook/schemes/cartridges-scheme.component.ts',
  'src/app/textbook/schemes/focal-plane-scheme.component.ts',
  'src/app/textbook/schemes/reticle-scheme.component.ts',
  'src/app/textbook/schemes/scheme.model.ts',
  'src/app/textbook/schemes/term-scheme.component.ts',
  'src/app/textbook/schemes/trajectory-scheme.component.ts',
  'src/app/textbook/schemes/wind-clock-scheme.component.ts',
  'src/app/textbook/schemes/zones-scheme.component.ts',
  'src/app/textbook/term-links.ts',
  'src/app/textbook/term-sheet.component.ts',
  'src/app/textbook/terms.ts',
  'src/app/textbook/textbook.model.ts',
  'src/app/textbook/textbook.page.ts',
  'src/sim/course.ts',
]);

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
  it('русский текст есть только в каталоге и в ещё не перенесённых файлах', () => {
    const withText = files.filter(path => !PENDING_FILES.has(path) && CYRILLIC.test(withoutComments(readFileSync(path, 'utf-8'))));
    expect(withText).toEqual([]);
  });

  it('в перенесённых файлах русского текста не осталось — их пора вычеркнуть из PENDING_FILES', () => {
    const migrated = [...PENDING_FILES].filter(path => !CYRILLIC.test(withoutComments(readFileSync(path, 'utf-8'))));
    expect(migrated).toEqual([]);
  });

  it('запятую в дробях ставит только format.ts', () => {
    const manual = files.filter(path => MANUAL_DECIMAL_COMMA.test(readFileSync(path, 'utf-8')));
    expect(manual).toEqual([]);
  });
});
