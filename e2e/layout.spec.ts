import { expect, test } from '@playwright/test';
import { unlockEverything } from './helpers';

test.describe('навигация без вкладок', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('ни на одном экране нет нижних вкладок', async ({ page }) => {
    for (const path of ['/', '/course', '/settings', '/journal', '/position/01']) {
      await page.goto(path);
      await expect(page.locator('ion-tab-bar')).toHaveCount(0);
    }
  });

  test('старой свободной игры нет: плитка «откроется позже», старые адреса ведут на главный', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('tile-free').click();
    await expect(page.getByTestId('later-message')).toBeVisible();
    for (const path of ['/weather', '/calc', '/calc/wind', '/dope', '/scope']) {
      await page.goto(path);
      await expect(page.getByTestId('tile-course')).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/');
    }
  });
});

test.describe('ноутбук 1280×720', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('приложение показано телефонной колонкой 430 px по центру', async ({ page }) => {
    await page.goto('/');
    const app = (await page.locator('ion-app').boundingBox())!;
    expect(app.width).toBeLessThanOrEqual(432);
    expect(app.x).toBeGreaterThan(400);
    await expect(page.getByTestId('tile-course')).toBeInViewport();
  });

  test('позиция прокручивается колесом до «ОГОНЬ» и «ДЕРЖАТЬ»', async ({ page }) => {
    await page.goto('/position/01');
    await expect(page.getByTestId('fire')).toBeVisible();
    const glass = (await page.getByTestId('glass').boundingBox())!;
    await page.mouse.move(glass.x + glass.width / 2, glass.y + 10);
    await page.mouse.wheel(0, 600);
    await expect(page.getByTestId('fire')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('hold')).toBeInViewport({ ratio: 1 });
  });
});
