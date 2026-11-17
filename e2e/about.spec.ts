import { expect, test } from '@playwright/test';
import packageJson from '../package.json' with { type: 'json' };
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };

test.describe('«О приложении»', () => {
  test('указатель внизу главного экрана, не в меню → 9 пунктов, «В планах», версия → назад на главную', async ({ page }) => {
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS });
    await page.goto('/');
    const link = page.getByTestId('open-about');
    await expect(link).toHaveText(/О приложении/i);
    await expect(page.locator('nav.menu').getByTestId('open-about')).toHaveCount(0);
    const continueBox = (await page.getByTestId('continue-card').boundingBox())!;
    expect((await link.boundingBox())!.y).toBeGreaterThan(continueBox.y + continueBox.height);

    await link.click();
    await page.waitForURL('**/about');
    await expect(page.getByTestId('about-point')).toHaveCount(9);
    await expect(page.getByTestId('about-point').first()).toContainText('Настоящая баллистика');
    await expect(page.getByTestId('about-plan').first()).toBeVisible();
    await expect(page.getByTestId('about-licenses')).toContainText('bclibc');
    await expect(page.getByTestId('about-version')).toHaveText(`версия ${packageJson.version}`);

    await page.getByTestId('about-back').click();
    await expect(page.getByTestId('open-about')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('открыл по адресу, без истории → «назад» ведёт на главную', async ({ page }) => {
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS });
    await page.goto('/about');
    await page.getByTestId('about-back').click();
    await expect(page.getByTestId('open-about')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });
});
