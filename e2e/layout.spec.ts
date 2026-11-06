import { expect, test } from '@playwright/test';
import { startShootTask, unlockEverything } from './helpers';

test.describe('навигация: панель вкладок видна на экранах хаба', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('метеостанция и настройки открываются с панелью вкладок', async ({ page }) => {
    await startShootTask(page, 's-zero');
    await expect(page.getByTestId('tab-calc')).toBeVisible();
    await page.goto('/tabs/hub/settings');
    await expect(page.getByTestId('tab-log')).toBeVisible();
  });

  test('с прицела можно вернуться на хаб', async ({ page }) => {
    await page.goto('/scope');
    await page.getByTestId('scope-hub').click();
    await expect(page).toHaveURL(/tabs\/hub$/);
  });
});

test.describe('ноутбук 1280×720', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('приложение показано телефонной колонкой 430 px по центру', async ({ page }) => {
    await page.goto('/tabs/hub');
    const app = (await page.locator('ion-app').boundingBox())!;
    expect(app.width).toBeLessThanOrEqual(432);
    expect(app.x).toBeGreaterThan(400);
    await expect(page.getByTestId('tab-hub')).toBeInViewport();
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
