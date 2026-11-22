import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, enterTotalOnTurrets, positionFromBriefing, seedProgress, useTestLanguage } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const SHOT_SETTLE_MS = 1200;
const CYRILLIC = /[Ѐ-ӿ]/;

async function seedEnglish(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, shots: [], settings: QUIET_SETTINGS });
  await useTestLanguage(page, 'en');
}

async function expectNoRussian(page: Page, testId: string): Promise<void> {
  const shown = await page.getByTestId(testId).innerText();
  expect(shown.match(CYRILLIC), shown).toBeNull();
}

test.describe('курс на английском (T6.3, этап 2)', () => {
  test('01 целиком на английском: брифинг, позиция, разбор, итог — без кириллицы', async ({ page }) => {
    test.slow();
    await seedEnglish(page);
    await page.goto('/course/01');
    await expect(page.getByTestId('briefing-card')).toBeVisible();
    await expectNoRussian(page, 'briefing-card');
    await positionFromBriefing(page, '01');
    await expect(page.getByTestId('fire')).toBeVisible();
    await enterTotalOnTurrets(page);
    await expect(page.locator('[data-test="drum-elevation"] [data-test="drum-counter"]')).toContainText('more cl.');
    const clicks = await clicksToTarget(page);
    await dialElevation(page, clicks);
    await centreReticle(page, clicks);
    for (let shot = 0; shot < 3; shot++) {
      await page.getByTestId('fire').click();
      await expect(page.getByTestId('review-sheet')).toBeVisible();
      if (shot === 0) {
        await expectNoRussian(page, 'review-sheet');
      }
      await page.getByTestId('review-next').click();
      await page.waitForTimeout(SHOT_SETTLE_MS);
    }
    await expect(page.getByTestId('result-sheet')).toBeVisible();
    await expect(page.getByTestId('result-opened')).toHaveText('Unlocked: 02 · Zero and cold bore');
    await expectNoRussian(page, 'result-sheet');
  });

  test('учебник на английском: главы и термины без кириллицы', async ({ page }) => {
    await seedEnglish(page);
    await page.goto('/textbook');
    await expect(page.getByTestId('textbook-chip-0')).toHaveText('Rifle');
    await expectNoRussian(page, 'textbook');
  });
});
