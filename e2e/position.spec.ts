import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, enterTotalOnTurrets, positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const MIN_TOUCH_PX = 44;
const SHOT_SETTLE_MS = 1200;

async function toPosition(page: Page, bestClasses: Record<string, number> = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, shots: [], settings: QUIET_SETTINGS });
  await positionFromBriefing(page, '01');
  await expect(page.getByTestId('fire')).toBeVisible();
  await enterTotalOnTurrets(page);
}

async function fireAndSettle(page: Page): Promise<void> {
  await page.getByTestId('fire').click();
  await expect(page.getByTestId('review-sheet')).toBeVisible();
  await page.getByTestId('review-next').click();
  await expect(page.getByTestId('review-sheet')).toHaveCount(0);
  await page.waitForTimeout(SHOT_SETTLE_MS);
}

test.describe('позиция: упражнения 01–02', () => {
  test('с листа упражнения на позицию: шапка, цель 1 / 3, цель барабана латунью', async ({ page }) => {
    await toPosition(page);
    await expect(page.getByTestId('position-title')).toHaveText('Упр. 01 · Первые щелчки');
    await expect(page.getByTestId('position-subtitle')).toContainText('300 м · цель 1 / 3');
    await expect(page.getByTestId('cell-target-ВЕРТ')).toContainText('↑');
    await expect(page.getByTestId('rounds')).toHaveText('5 / 5');
    await expect(page.getByTestId('wind-tile')).toHaveText('штиль');
  });

  test('барабан: свайп крутит клики, тап открывает лупу на 1,5 с, кнопки работают', async ({ page }) => {
    await toPosition(page);
    const tapeLocator = page.locator('[data-test="drum-elevation"] [data-test="drum-tape"]');
    const dialled = async () => Number(await tapeLocator.getAttribute('aria-valuenow'));
    expect(await dialled()).toBe(0);
    await tapeLocator.click({ trial: true });
    const tape = (await tapeLocator.boundingBox())!;
    await page.mouse.move(tape.x + 20, tape.y + tape.height / 2);
    await page.mouse.down();
    await page.mouse.move(tape.x + 20 + 61, tape.y + tape.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(dialled).toBeGreaterThanOrEqual(5);
    await tapeLocator.click();
    await expect(page.getByTestId('drum-loupe')).toBeVisible();
    await expect(page.getByTestId('drum-loupe')).toBeHidden({ timeout: 3000 });
    const afterSwipe = await dialled();
    await page.getByTestId('elevation-plus').click();
    await expect.poll(dialled).toBe(afterSwipe + 1);
    await page.getByTestId('elevation-minus').click();
    await expect.poll(dialled).toBe(afterSwipe);
  });

  test('докрутка до цели: метка гаснет, строка белая', async ({ page }) => {
    await toPosition(page);
    await dialElevation(page, await clicksToTarget(page));
    await expect(page.getByTestId('cell-target-ВЕРТ')).toHaveCount(0);
    await expect(page.locator('[data-test="drum-elevation"] [data-test="drum-counter"]')).toHaveCount(0);
    await expect(page.locator('[data-test="drum-elevation"] [data-test="drum-target"]')).toHaveCount(0);
  });

  test('тап по «ОГОНЬ»: разбор, «ДАЛЬШЕ», счётчик 4 / 5, затвор сам', async ({ page }) => {
    await toPosition(page);
    await fireAndSettle(page);
    await expect(page.getByTestId('rounds')).toHaveText('4 / 5');
    await expect(page.getByTestId('fire')).toBeEnabled();
  });

  test('все мимо: смена магазина, конец, «не зачтено», «ПОВТОРИТЬ» — брифинг, штампа на тропе нет', async ({ page }) => {
    await toPosition(page);
    for (let shot = 0; shot < 5; shot++) {
      await fireAndSettle(page);
    }
    await page.getByTestId('change-magazine').click();
    await expect(page.getByTestId('rounds')).toHaveText('1 / 1');
    await fireAndSettle(page);
    await expect(page.getByTestId('result-stamp')).toHaveText('НЕ ЗАЧТЕНО');
    await expect(page.getByTestId('result-next')).toHaveCount(0);
    await page.getByTestId('result-repeat').click();
    await expect(page.getByTestId('briefing-header')).toHaveText('ЗАДАНИЕ 01 · УЧЕБНОЕ');
    await page.getByTestId('sheet-back').click();
    await expect(page.getByTestId('stamp-01')).toHaveCount(0);
  });

  test('ровная накрутка и сетка на цели: класс, штамп 01 на тропе, открыт 02', async ({ page }) => {
    test.slow();
    await toPosition(page);
    const clicks = await clicksToTarget(page);
    await dialElevation(page, clicks);
    await centreReticle(page, clicks);
    for (let shot = 0; shot < 3; shot++) {
      await fireAndSettle(page);
    }
    await expect(page.getByTestId('result-stamp')).toHaveText(/^[123] КЛАСС$/);
    await page.getByTestId('result-next').click();
    await expect(page.getByTestId('stamp-01')).toBeVisible();
    await expect(page.getByTestId('node-02')).toBeEnabled();
  });

  test('«назад» после выстрела спрашивает; «остаться» — на позиции, «покинуть» — лист упражнения', async ({ page }) => {
    await toPosition(page);
    await fireAndSettle(page);
    await page.getByTestId('position-back').click();
    await expect(page.getByTestId('leave-confirm')).toBeVisible();
    await page.getByTestId('leave-stay').click();
    await expect(page.getByTestId('leave-confirm')).toHaveCount(0);
    await page.getByTestId('position-back').click();
    await page.getByTestId('leave-confirm-yes').click();
    await expect(page.getByTestId('sheet-title')).toHaveText('Первые щелчки');
  });

  test('«назад» до выстрела — без вопроса', async ({ page }) => {
    await toPosition(page);
    await page.getByTestId('position-back').click();
    await expect(page.getByTestId('sheet-title')).toBeVisible();
  });

  test('11 пока закрыто: «НА ПОЗИЦИЮ» неактивна с причиной', async ({ page }) => {
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3, '09': 3, '10': 3 } }, shots: [], settings: QUIET_SETTINGS });
    await page.goto('/course/11');
    await expect(page.getByTestId('to-position')).toBeDisabled();
    await expect(page.getByTestId('to-position-reason')).toHaveText('откроется позже: движущиеся цели');
  });

  test('кольцо кратности и касание не меньше 44', async ({ page }) => {
    await toPosition(page);
    await expect(page.getByTestId('magnification')).toHaveText('8×');
    await page.getByTestId('zoom-in').click();
    await expect(page.getByTestId('magnification')).toHaveText('9×');
    const heights = await page.locator('button:not([disabled]), [role="slider"]').evaluateAll(elements =>
      elements.filter(element => (element as HTMLElement).offsetParent !== null).map(element => element.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(5);
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});
