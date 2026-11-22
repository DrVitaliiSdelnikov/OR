import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync('src/index.html', 'utf-8');

describe('Яндекс.Метрика в index.html (В63)', () => {
  it('счётчик 114506199 с вебвизором и картой кликов', () => {
    expect(indexHtml).toContain("ym(114506199, 'init'");
    expect(indexHtml).toContain('https://mc.yandex.ru/metrika/tag.js?id=114506199');
    expect(indexHtml).toMatch(/webvisor:\s*true/);
  });

  it('запускается только на боевых адресах: sniping.win и GitHub Pages', () => {
    expect(indexHtml).toContain("'sniping.win'");
    expect(indexHtml).toContain("'.github.io'");
  });
});
