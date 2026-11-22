import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };

async function seed(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS });
}

test.describe('язык (T6.3, этап 1)', () => {
  test('настройки → English: после перезагрузки главный, вкладка и lang на английском, дроби с точкой; назад на русский', async ({ page }) => {
    await seed(page);
    await page.goto('/settings');
    await expect(page.getByTestId('language-ru')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('language-en')).toContainText('частично');
    await page.getByTestId('language-en').click();
    await expect(page.getByTestId('language-en')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('settings-group-language')).toContainText('Language');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.goto('/');
    await expect(page.getByTestId('tile-drills')).toContainText('Drills');
    await expect(page).toHaveTitle('Sniping Simulator');

    await page.goto('/model');
    await expect(page.getByTestId('model-comparison')).toContainText('elevation ≤ 0.1 MIL');

    await page.goto('/settings');
    await page.getByTestId('language-ru').click();
    await expect(page.getByTestId('settings-group-language')).toContainText('Язык');
    await page.goto('/');
    await expect(page).toHaveTitle('Симулятор снайпинга');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('английская система без выбора — русский, пока английский не полный', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await seed(page);
    await page.goto('/');
    await expect(page).toHaveTitle('Симулятор снайпинга');
    await expect(page.getByTestId('tile-drills')).toContainText('Дрилы');
    await context.close();
  });
});
