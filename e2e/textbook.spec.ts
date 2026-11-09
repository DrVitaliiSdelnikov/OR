import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, enterTotalOnTurrets, positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const SHOT_SETTLE_MS = 1200;

async function seed(page: Page, bestClasses: Record<string, number> = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, settings: QUIET_SETTINGS });
}

test.describe('учебник курсанта (A7.3)', () => {
  test('главная → «03 · Учебник курсанта»: счётчик, главы, закрытая плитка с подписью', async ({ page }) => {
    await seed(page, { '01': 2 });
    await page.goto('/');
    await page.getByTestId('tile-textbook').click();
    await page.waitForURL('**/textbook');
    await expect(page.getByTestId('textbook-counter')).toHaveText('11 / 47 терминов');
    await expect(page.locator('[data-test^="textbook-chapter-"]')).toHaveCount(12);
    await expect(page.getByTestId('textbook-term')).toHaveCount(11);
    const milling = page.getByTestId('textbook-term-locked').filter({ hasText: 'миллинг' });
    await expect(milling).toContainText('откроется в упр. 05');
    await page.getByTestId('textbook-chip-7').click();
    await expect(page.getByTestId('textbook-chapter-7')).toBeInViewport();
  });

  test('тап по термину — шторка: фраза, формула с переменными, пример; сосед открывает свою карточку', async ({ page }) => {
    await seed(page, { '01': 2 });
    await page.goto('/textbook');
    await page.getByTestId('textbook-term').filter({ hasText: /^клик$/ }).click();
    await expect(page.getByTestId('term-title')).toHaveText('клик');
    await expect(page.getByTestId('term-phrase')).toContainText('0,1 MIL');
    await expect(page.getByTestId('term-formula')).toContainText('N = П / Ц');
    await expect(page.getByTestId('term-variable')).toHaveCount(3);
    await expect(page.getByTestId('term-example')).toContainText('6\u00a0кл.');
    await expect(page.getByTestId('term-where').first()).toHaveText('впервые — упр. 01 · Первые щелчки');
    await page.getByTestId('term-related').filter({ hasText: 'MIL' }).click();
    await expect(page.getByTestId('term-title')).toHaveText('MIL');
    await page.getByTestId('term-close').click();
    await expect(page.getByTestId('term-sheet')).toHaveCount(0);
  });

  test('пример ДОПЕ считается движком: строка карточки патрона Б', async ({ page }) => {
    await seed(page, { '01': 2 });
    await page.goto('/textbook');
    await page.getByTestId('textbook-term').filter({ hasText: /^ДОПЕ$/ }).click();
    await expect(page.getByTestId('term-example')).toHaveText(/Патрон Б, 300 м: ВЕРТ \d,\d MIL = \d+ кл\./);
    await expect(page.getByTestId('term-related-locked').filter({ hasText: 'строка ДОПЕ' })).toBeVisible();
  });

  test('лист итога 01 при первом допуске: термин-ссылка открывает карточку поверх итога', async ({ page }) => {
    test.slow();
    await seed(page);
    await positionFromBriefing(page, '01');
    await expect(page.getByTestId('fire')).toBeVisible();
    await enterTotalOnTurrets(page);
    const clicks = await clicksToTarget(page);
    await dialElevation(page, clicks);
    await centreReticle(page, clicks);
    for (let shot = 0; shot < 3; shot++) {
      await page.getByTestId('fire').click();
      await expect(page.getByTestId('review-sheet')).toBeVisible();
      await page.getByTestId('review-next').click();
      await page.waitForTimeout(SHOT_SETTLE_MS);
    }
    await expect(page.getByTestId('result-sheet')).toBeVisible();
    await page.getByTestId('result-term').first().click();
    await expect(page.getByTestId('term-title')).toHaveText('клик');
    await expect(page.getByTestId('term-sheet')).toBeInViewport();
    await page.getByTestId('term-scrim').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('term-sheet')).toHaveCount(0);
    await expect(page.getByTestId('result-sheet')).toBeVisible();
  });
});
