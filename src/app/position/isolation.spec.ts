import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const GUARDED_DIRS = [new URL('./', import.meta.url), new URL('../notebook/', import.meta.url), new URL('../review/', import.meta.url), new URL('../result/', import.meta.url), new URL('../instructor/', import.meta.url)];
const FORBIDDEN_IMPORTS = ['/scope/', 'game-session', '/debrief/', 'core/score', 'sim/tasks', 'explainMiss'];
const FORBIDDEN_STYLES = ['--hub-', 'var(--font-sans)', 'class="button', 'class="chip', 'class="card'];

function sourceFiles(): { name: string; text: string }[] {
  return GUARDED_DIRS.flatMap(dir =>
    readdirSync(dir)
      .filter(name => /\.(ts|html|scss)$/.test(name) && !name.endsWith('.spec.ts'))
      .map(name => ({ name, text: readFileSync(new URL(name, dir), 'utf-8') })),
  );
}

describe('the position and the notebook do not lean on the old free-play screens', () => {
  it('imports nothing from the old scope, GameSession, the old debrief, score or tasks', () => {
    for (const { name, text } of sourceFiles()) {
      const imports = text.split('\n').filter(line => line.startsWith('import '));
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(imports.filter(line => line.includes(forbidden)), `${name} imports ${forbidden}`).toEqual([]);
      }
    }
  });

  it('uses only the tokens, not the legacy --hub-* variables or the old global classes', () => {
    for (const { name, text } of sourceFiles()) {
      for (const forbidden of FORBIDDEN_STYLES) {
        expect(text.includes(forbidden), `${name} uses ${forbidden}`).toBe(false);
      }
    }
  });

  it('sees the position and notebook files', () => {
    expect(sourceFiles().map(file => file.name)).toEqual(expect.arrayContaining(['position.page.ts', 'position-session.ts', 'position.model.ts', 'notebook.model.ts', 'notebook-sheet.component.ts', 'result.model.ts', 'result-sheet.component.ts', 'teaching.model.ts']));
  });

  it('the instructor knows no screens: it reads a snapshot, not a page', () => {
    const instructorFiles = sourceFiles().filter(file => /^(teaching|radio|instructor|teaching-overlay|radio-plate)/.test(file.name));
    for (const { name, text } of instructorFiles) {
      const imports = text.split('\n').filter(line => line.startsWith('import '));
      expect(imports.filter(line => line.includes('.page') || line.includes('position-session')), name).toEqual([]);
    }
  });
});
