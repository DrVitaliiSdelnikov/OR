import { expect, test } from '@playwright/test';
import { seedProgress } from './helpers';

const METRIKA_HOST = 'mc.yandex.ru';
const SETTLE_MS = 1500;

test.describe('Яндекс.Метрика (В63)', () => {
  test('на localhost счётчик не грузится: тесты и разработка не попадают в статистику', async ({ page }) => {
    const metrikaRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).hostname === METRIKA_HOST) {
        metrikaRequests.push(request.url());
      }
    });
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} } });
    await page.goto('/');
    await expect(page.getByTestId('tile-drills')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    expect(metrikaRequests).toEqual([]);
    expect(await page.evaluate(() => typeof (window as unknown as { ym?: unknown }).ym)).toBe('undefined');
  });
});
