import { expect, Locator, Page, test } from '@playwright/test';
import { unlockEverything } from './helpers';

const SAFARI_VISIBLE_HEIGHT = 664;

async function isOnTop(page: Page, target: Locator): Promise<boolean> {
  const box = (await target.boundingBox())!;
  return page.evaluate(
    ([x, y, testId]) => document.elementFromPoint(x, y)?.closest(`[data-test="${testId}"]`) !== null,
    [box.x + box.width / 2, box.y + box.height / 2, await target.getAttribute('data-test')] as const,
  );
}

test.describe('iPhone 14 в Safari: между панелями браузера 664 pt', () => {
  test.use({ viewport: { width: 390, height: SAFARI_VISIBLE_HEIGHT } });

  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('позиция влезает целиком: шапка и «ОГОНЬ» видны, страница не прокручивается', async ({ page }) => {
    await page.goto('/position/04');
    await expect(page.getByTestId('glass')).toBeVisible();
    const header = (await page.getByTestId('position-back').boundingBox())!;
    const fire = (await page.getByTestId('fire').boundingBox())!;
    expect(header.y).toBeGreaterThanOrEqual(0);
    expect(fire.y + fire.height).toBeLessThanOrEqual(SAFARI_VISIBLE_HEIGHT);
    expect(await page.locator('.position').evaluate(root => root.scrollHeight)).toBeLessThanOrEqual(SAFARI_VISIBLE_HEIGHT);
  });

  test('блокнот: шторке хватает высоты на вкладку — не меньше 360 pt', async ({ page }) => {
    await page.goto('/position/04');
    await page.getByTestId('tile-notebook').click();
    const sheet = (await page.locator('.notebook-sheet').boundingBox())!;
    expect(sheet.height).toBeGreaterThanOrEqual(360);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(SAFARI_VISIBLE_HEIGHT + 1);
  });

  test('переключатель под закреплённой кнопкой не рисуется поверх неё: лист 01 и свободная игра', async ({ page }) => {
    await page.goto('/course/01');
    await expect(page.getByTestId('briefing-instructor')).toBeAttached();
    expect(await isOnTop(page, page.getByTestId('to-position'))).toBe(true);
    await page.goto('/free');
    await expect(page.getByTestId('free-instructor')).toBeAttached();
    expect(await isOnTop(page, page.getByTestId('free-start'))).toBe(true);
  });
});
