import { expect, test } from '@playwright/test';
import { seedProgress, unlockEverything } from './helpers';

const DEVICE_BG = 'rgb(12, 14, 10)';
const DEVICE_TEXT = 'rgb(228, 231, 220)';
const MIN_TOUCH_PX = 44;

test.describe('прибор: токены и одна тема', () => {
  test('фон и текст — цвета прибора', async ({ page }) => {
    await unlockEverything(page);
    await page.goto('/');
    await expect(page.locator('body')).toHaveCSS('background-color', DEVICE_BG);
    await expect(page.locator('body')).toHaveCSS('color', DEVICE_TEXT);
  });

  test('шрифты загружены локально, без CDN', async ({ page }) => {
    const fontUrls: string[] = [];
    page.on('request', request => {
      if (request.resourceType() === 'font') {
        fontUrls.push(request.url());
      }
    });
    await unlockEverything(page);
    await page.goto('/');
    const loadedFamilies = await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('500 13px "Roboto Mono"'),
        document.fonts.load('700 22px "Roboto Condensed"'),
        document.fonts.load('400 15px "Roboto"'),
      ]);
      return [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family.replace(/["']/g, ''));
    });
    expect(new Set(loadedFamilies)).toEqual(new Set(['Roboto', 'Roboto Condensed', 'Roboto Mono']));
    expect(fontUrls.length).toBeGreaterThan(0);
    expect(fontUrls.filter(url => !url.startsWith('http://localhost'))).toEqual([]);
  });

  test('выбора темы нет, старая тема B из хранилища ничего не меняет', async ({ page }) => {
    await seedProgress(page, {
      results: {},
      shots: [],
      settings: { theme: 'day', isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true },
    });
    await page.goto('/settings');
    await expect(page.getByTestId('theme-day')).toHaveCount(0);
    await expect(page.getByTestId('theme-field')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
    await expect(page.locator('body')).toHaveCSS('background-color', DEVICE_BG);
  });

  test('на настройках все кнопки, переключатели и «назад» не ниже 44', async ({ page }) => {
    await unlockEverything(page);
    await page.goto('/settings');
    await page.getByTestId('reset-progress').waitFor();
    const heights = await page.locator('[data-test="settings"] :is(button, ion-toggle, a, input)').evaluateAll(elements =>
      elements.filter(element => (element as HTMLElement).offsetParent !== null).map(element => element.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(10);
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});
