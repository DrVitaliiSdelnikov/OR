import { expect, test } from '@playwright/test';
import { startFreePlay, unlockEverything } from './helpers';

test.describe('навигация без вкладок', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('ни на одном экране нет нижних вкладок', async ({ page }) => {
    for (const path of ['/', '/course', '/settings', '/journal', '/dope']) {
      await page.goto(path);
      await expect(page.locator('ion-tab-bar')).toHaveCount(0);
    }
    await startFreePlay(page);
    await expect(page.locator('ion-tab-bar')).toHaveCount(0);
  });

  test('с прицела можно вернуться в меню', async ({ page }) => {
    await page.goto('/scope');
    await page.getByTestId('scope-main').click();
    await expect(page.getByTestId('tile-course')).toBeVisible();
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

  test('на прицеле «ОГОНЬ» и «Дыхание» помещаются в окно', async ({ page }) => {
    await page.goto('/scope');
    await expect(page.getByTestId('fire')).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('breath')).toBeInViewport({ ratio: 1 });
  });

  test('экран прицела прокручивается колесом', async ({ page }) => {
    await page.goto('/scope');
    await expect(page.getByTestId('strip')).toBeVisible();
    const strip = (await page.getByTestId('strip').boundingBox())!;
    await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(() => page.locator('or-scope ion-content').evaluate(async content => (await (content as HTMLIonContentElement).getScrollElement()).scrollTop))
      .toBeGreaterThan(0);
  });
});
