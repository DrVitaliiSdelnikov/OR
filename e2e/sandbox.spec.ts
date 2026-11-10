import { expect, Page, test } from '@playwright/test';
import { positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true };
const SHOT_TIMEOUT_MS = 25_000;
const PLAYER_FREE_PLAY = { distanceM: 800, isDistanceUnknown: false, wind: 'strong', scopeId: 'course-dot', cartridgeId: 'C', notebookMode: 'manual-easy', isInstructorNear: true };

async function seed(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS, series: [], freePlay: PLAYER_FREE_PLAY });
}

async function cutoutMismatchPx(page: Page, anchorSelector: string): Promise<number> {
  const cutout = (await page.getByTestId('teaching-cutout').boundingBox())!;
  const anchor = (await page.locator(anchorSelector).boundingBox())!;
  return Math.hypot(cutout.x + cutout.width / 2 - (anchor.x + anchor.width / 2), cutout.y + cutout.height / 2 - (anchor.y + anchor.height / 2));
}

async function tryTerm(page: Page, term: string): Promise<void> {
  await page.goto('/textbook');
  await page.getByTestId('textbook-term').filter({ hasText: new RegExp(`^${term}$`) }).click();
  await page.getByTestId('term-try').click();
  await page.waitForURL(`**/position/free?sandbox=*`);
}

test.describe('«Попробовать на прицеле» (A7.3b3)', () => {
  test('«клик» → позиция 300 м, АВТО, подсказка у барабана ВЕРТ → «назад» → та же карточка; журнал пуст, настройки игрока целы', async ({ page }) => {
    await seed(page);
    await tryTerm(page, 'клик');
    await expect(page.getByTestId('position-title')).toHaveText('Попробовать на прицеле');
    await expect(page.getByTestId('teaching-text')).toContainText('0,1 MIL');
    await expect.poll(() => cutoutMismatchPx(page, '[data-hint="drum-elevation"]')).toBeLessThan(2);
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('teaching-card')).toHaveCount(0);
    await expect(page.getByTestId('fire')).toBeVisible();
    const fire = (await page.getByTestId('fire').boundingBox())!;
    await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId('review-sheet')).toBeVisible({ timeout: SHOT_TIMEOUT_MS });
    await page.mouse.up();
    await page.getByTestId('review-next').click();

    await page.getByTestId('position-back').click();
    await page.waitForURL('**/textbook');
    await expect(page.getByTestId('term-title')).toHaveText('клик');
    await expect(page.getByTestId('term-try')).toBeVisible();

    await page.getByTestId('term-close').click();
    await page.goto('/journal');
    await expect(page.getByTestId('journal-empty')).toBeVisible();
    await page.goto('/free');
    await expect(page.getByTestId('free-distance')).toHaveText('800 м');
  });

  test('«кратность» — подсказка у колеса кратности', async ({ page }) => {
    await seed(page);
    await tryTerm(page, 'кратность');
    await expect(page.getByTestId('teaching-text')).toContainText('метки сетки растут');
    await expect.poll(() => cutoutMismatchPx(page, '[data-hint="zoom"]')).toBeLessThan(2);
  });

  test('у «энергии» кнопки нет; поверх упражнения кнопки нет даже у «ДОПЕ» с песочницей', async ({ page }) => {
    await seed(page);
    await page.goto('/textbook');
    await page.getByTestId('textbook-term').filter({ hasText: /^энергия$/ }).click();
    await expect(page.getByTestId('term-title')).toHaveText('энергия');
    await expect(page.getByTestId('term-try')).toHaveCount(0);
    await page.getByTestId('term-related').first().click();
    await page.getByTestId('term-close').click();

    await positionFromBriefing(page, '01', true);
    await expect(page.getByTestId('teaching-text')).toHaveText('Это прицел. Цель — гонг на 300 м');
    await page.getByTestId('teaching-ok').click();
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('teaching-text').getByTestId('term-link').click();
    await expect(page.getByTestId('term-title')).toHaveText('ДОПЕ');
    await expect(page.getByTestId('term-try')).toHaveCount(0);
  });
});
