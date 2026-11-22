import { expect, Page, test } from '@playwright/test';
import { PROGRESS_KEY, seedProgress, useTestLanguage } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };

async function seedAsPlayer(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS });
  await useTestLanguage(page, null);
}

test.describe('только английский (В62)', () => {
  test('игрок видит английский: главный, вкладка, lang, дроби с точкой; в настройках выбора языка нет', async ({ page }) => {
    await seedAsPlayer(page);
    await page.goto('/');
    await expect(page.getByTestId('tile-drills')).toContainText('Drills');
    await expect(page).toHaveTitle('Sniping Simulator');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.goto('/model');
    await expect(page.getByTestId('model-comparison')).toContainText('elevation ≤ 0.1 MIL');

    await page.goto('/settings');
    await expect(page.getByTestId('settings-group-units')).toBeVisible();
    await expect(page.getByTestId('settings-group-language')).toHaveCount(0);
  });

  test('ни русская система, ни сохранённый раньше «Русский» язык не меняют', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'ru-RU' });
    const page = await context.newPage();
    await seedAsPlayer(page);
    await page.addInitScript(() => localStorage.setItem('or.language', 'ru'));
    await page.goto('/');
    await expect(page).toHaveTitle('Sniping Simulator');
    await expect(page.getByTestId('tile-drills')).toContainText('Drills');
    await context.close();
  });

  test('встроенная винтовка, сохранённая по-русски «своя-custom», показывается как «custom»', async ({ page }) => {
    await seedAsPlayer(page);
    await page.goto('/rifle');
    await expect(page.getByTestId('rifle-row-builtin-custom')).toBeVisible();
    await page.evaluate(key => {
      const stored = JSON.parse(localStorage.getItem(key)!);
      stored.profiles = stored.profiles.map((profile: { id: string; name: string }) => (profile.id === 'builtin-custom' ? { ...profile, name: 'своя-custom' } : profile));
      localStorage.setItem(key, JSON.stringify(stored));
    }, PROGRESS_KEY);
    await page.reload();
    await expect(page.getByTestId('rifle-row-builtin-custom').getByTestId('rifle-name')).toHaveText('custom');
  });
});
