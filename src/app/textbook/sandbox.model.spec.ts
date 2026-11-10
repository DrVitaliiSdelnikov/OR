import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FREE_PLAY } from '../../sim/free-play';
import { SANDBOXES, sandboxOf, sandboxSettings, sandboxTeaching } from './sandbox.model';
import { TERM_CARDS } from './terms';

const POSITION_MARKUP = ['../position/position.page.html', '../position/fire-control.component.ts'].map(path =>
  readFileSync(new URL(path, import.meta.url), 'utf-8'),
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|html)$/.test(path) && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('песочница «Попробовать на прицеле» (U7)', () => {
  it('термины песочниц — из учебника, и каждый — только в одной песочнице', () => {
    const terms = SANDBOXES.flatMap(sandbox => sandbox.terms);
    const known = new Set(TERM_CARDS.map(card => card.term));
    expect(terms.filter(term => !known.has(term))).toEqual([]);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it('якорь подсказки стоит на экране позиции; из новых — только «zoom» у колеса кратности', () => {
    for (const sandbox of SANDBOXES) {
      expect(POSITION_MARKUP.some(markup => markup.includes(`data-hint="${sandbox.hint.anchor}"`)), sandbox.hint.anchor).toBe(true);
    }
    expect(POSITION_MARKUP[0]).toMatch(/data-test="zoom-ring"[^>]*data-hint="zoom"|data-hint="zoom"[^>]*data-test="zoom-ring"/);
  });

  it('«клик» — 300 м, штиль, барабан ВЕРТ; «ZERO STOP» — 100 м', () => {
    const click = sandboxOf('клик')!;
    expect(sandboxSettings(click)).toEqual({ ...DEFAULT_FREE_PLAY, distanceM: 300, wind: 'calm', notebookMode: 'auto', isInstructorNear: false });
    expect(click.hint.anchor).toBe('drum-elevation');
    expect(sandboxOf('барабан')).toBe(click);
    expect(sandboxSettings(sandboxOf('ZERO STOP')!).distanceM).toBe(100);
  });

  it('всегда АВТО и без инструктора рядом; миллинг — на неизвестной дистанции', () => {
    for (const sandbox of SANDBOXES) {
      const settings = sandboxSettings(sandbox);
      expect(settings.notebookMode).toBe('auto');
      expect(settings.isInstructorNear).toBe(false);
    }
    expect(sandboxSettings(sandboxOf('миллинг')!).isDistanceUnknown).toBe(true);
  });

  it('без песочницы: то, что на прицеле не показать, и движущиеся цели', () => {
    for (const term of ['энергия', 'плотность воздуха', 'упреждение', 'засада', 'неизвестный термин']) {
      expect(sandboxOf(term), term).toBeNull();
    }
  });

  it('подсказка — одно объяснение с «Понял»; после него — ничего', () => {
    const sandbox = sandboxOf('кратность')!;
    const view = sandboxTeaching(sandbox, false)!;
    expect(view.kind).toBe('explain');
    expect(view.anchor).toBe('zoom');
    expect(view.text.length).toBeGreaterThan(0);
    expect(sandboxTeaching(sandbox, true)).toBeNull();
  });

  it('песочница не пишет серию и не трогает настройки свободной игры: на позиции запись идёт мимо неё', () => {
    const page = readFileSync(new URL('../position/position.page.ts', import.meta.url), 'utf-8');
    const saveSeries = page.slice(page.indexOf('private saveSeries'));
    expect(saveSeries.slice(0, saveSeries.indexOf('journalSeries'))).toContain('this.sandbox()');
    const writers = sourceFiles(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
      .filter(path => readFileSync(path, 'utf-8').includes('updateFreePlay('))
      .map(path => path.replace(/\\/g, '/').split('/app/')[1]);
    expect(writers.every(path => path.startsWith('free/') || path.startsWith('services/'))).toBe(true);
  });
});
