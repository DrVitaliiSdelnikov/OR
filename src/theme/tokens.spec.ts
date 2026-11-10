import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const TOKENS_DOC = readFileSync(new URL('../../docs/design/TOKENS.md', import.meta.url), 'utf-8');
const TOKENS_SCSS = readFileSync(new URL('./_tokens.scss', import.meta.url), 'utf-8');
const STYLES_SCSS = readFileSync(new URL('../styles.scss', import.meta.url), 'utf-8');
const LARGE_TEXT_SCALE = 1.15;

const MIN_TEXT_CONTRAST = 4.5;
const MIN_LARGE_CONTRAST = 3;
const MIN_FONT_PT = 13;

function documentedColors(): Map<string, string> {
  const colors = new Map<string, string>();
  for (const match of TOKENS_DOC.matchAll(/^\| `((?:device|paper)\.[a-z0-9-]+)` \| (#[0-9A-Fa-f]{6}) \|/gm)) {
    colors.set(match[1], match[2].toLowerCase());
  }
  return colors;
}

function documentedFontSizes(): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const match of TOKENS_DOC.matchAll(/^\| `(type\.[a-z]+)` \| (\d+) \|/gm)) {
    sizes.set(match[1], Number(match[2]));
  }
  return sizes;
}

function cssVariable(token: string): string {
  return `--${token.replace('.', '-')}`;
}

function scssValue(variable: string): string | null {
  const match = TOKENS_SCSS.match(new RegExp(`${variable}:\\s*([^;]+);`));
  return match ? match[1].trim().toLowerCase() : null;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foregroundToken: string, backgroundToken: string): number {
  const foreground = relativeLuminance(scssValue(cssVariable(foregroundToken))!);
  const background = relativeLuminance(scssValue(cssVariable(backgroundToken))!);
  const [lighter, darker] = foreground > background ? [foreground, background] : [background, foreground];
  return (lighter + 0.05) / (darker + 0.05);
}

describe('tokens match TOKENS.md', () => {
  it('every documented colour is defined with the documented value', () => {
    const colors = documentedColors();
    expect(colors.size).toBe(24);
    for (const [token, hex] of colors) {
      expect(scssValue(cssVariable(token)), token).toBe(hex);
    }
  });

  it('every documented font size is defined in pt as px', () => {
    const sizes = documentedFontSizes();
    expect(sizes.size).toBe(7);
    for (const [token, pt] of sizes) {
      expect(scssValue(cssVariable(token)), token).toBe(`${pt}px`);
    }
  });

  it('no font size is below 13', () => {
    for (const match of TOKENS_SCSS.matchAll(/--type-[a-z]+:\s*(\d+)px/g)) {
      expect(Number(match[1])).toBeGreaterThanOrEqual(MIN_FONT_PT);
    }
  });
});

describe('contrast promised by TOKENS.md (WCAG)', () => {
  const textPairs: [string, string][] = [
    ['device.text', 'device.bg-2'],
    ['device.text-muted', 'device.surface'],
    ['device.accent', 'device.surface'],
    ['device.on-accent', 'device.accent'],
    ['device.ok', 'device.surface'],
    ['device.error-text', 'device.surface'],
    ['paper.ink', 'paper.bg'],
    ['paper.graphite', 'paper.bg'],
    ['paper.red-pencil', 'paper.bg'],
    ['paper.stamp-gold', 'paper.bg'],
    ['paper.stamp-green', 'paper.bg'],
  ];

  it.each(textPairs)('%s on %s is at least 4.5:1', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each([
    ['device.error', 'device.surface'],
    ['paper.stamp-silver', 'paper.bg'],
    ['paper.stamp-bronze', 'paper.bg'],
  ])('%s on %s is for large marks only: below 4.5:1 but at least 3:1', (foreground, background) => {
    const ratio = contrast(foreground, background);
    expect(ratio).toBeGreaterThanOrEqual(MIN_LARGE_CONTRAST);
    expect(ratio).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});

describe('крупный текст (U4)', () => {
  const largeBlock = TOKENS_SCSS.slice(TOKENS_SCSS.indexOf(":root[data-text='large']"));
  const sizeIn = (css: string, token: string): number | null => {
    const match = css.match(new RegExp(`--type-${token}:\\s*(\\d+)px`));
    return match ? Number(match[1]) : null;
  };

  it('подписи, текст, значения и заголовки — в 1,15 раза крупнее, с округлением', () => {
    for (const token of ['label', 'body', 'value', 'title']) {
      expect(sizeIn(largeBlock, token), token).toBe(Math.round(sizeIn(TOKENS_SCSS, token)! * LARGE_TEXT_SCALE));
    }
  });

  it('крупные числа прибора и нижняя граница не растут', () => {
    for (const token of ['min', 'big', 'hero']) {
      expect(sizeIn(largeBlock, token), token).toBeNull();
    }
  });
});

describe('старые стили удалены (U6)', () => {
  it('нет --hub-* и старых глобальных классов', () => {
    expect(STYLES_SCSS).not.toMatch(/legacy-aliases|--hub-/);
    for (const oldClass of ['.screen', '.card', '.button', '.top-bar', '.chip']) {
      expect(STYLES_SCSS.includes(`\n${oldClass} {`), oldClass).toBe(false);
    }
  });
});
