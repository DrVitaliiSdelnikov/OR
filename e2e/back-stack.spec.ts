import { expect, Page, test } from '@playwright/test';
import { enterTotalOnTurrets, positionFromBriefing, PROGRESS_KEY, seedProgress, unlockEverything } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true };
const EXIT_HINT_GONE_MS = 4000;

const PROBE_PRIORITY = 1000;

// ion-app starts listening for 'backbutton' after a lazy import, so an early press would be lost.
async function waitForBackButtonListener(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(priority => {
        let isHeard = false;
        const probe = (event: Event) => {
          isHeard = true;
          (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail.register(priority, () => undefined);
        };
        document.addEventListener('ionBackButton', probe);
        document.dispatchEvent(new Event('backbutton'));
        document.removeEventListener('ionBackButton', probe);
        return isHeard;
      }, PROBE_PRIORITY),
    )
    .toBe(true);
}

async function systemBack(page: Page): Promise<void> {
  await waitForBackButtonListener(page);
  await page.evaluate(() => document.dispatchEvent(new Event('backbutton')));
}

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click({ trial: true });
}

async function shootOnce(page: Page): Promise<void> {
  await page.getByTestId('fire').click();
  await expect(page.getByTestId('review-sheet')).toBeVisible();
}

async function hideApp(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function storedSeries(page: Page): Promise<{ isInterrupted: boolean; shots: unknown[] }[]> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').series ?? [], PROGRESS_KEY);
}

test.describe('системная «назад» и выход (A8)', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page, { isTapTrigger: true });
  });

  test('E1 позиция: шаг расчёта → шторка → до выстрела уход на лист', async ({ page }) => {
    await positionFromBriefing(page, '10');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('step-dope').click();
    await expect(page.getByTestId('calc-sheet')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('calc-sheet')).toHaveCount(0);
    await expect(page.getByTestId('notebook-sheet')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);
    await expect(page).toHaveURL(/\/position\/10$/);
    await systemBack(page);
    await expect(page.getByTestId('sheet-title')).toBeVisible();
    await expect(page).toHaveURL(/\/course\/10$/);
  });

  test('E1b песочница учебника: «назад» с позиции — та же карточка термина, как экранная ←', async ({ page }) => {
    await page.goto('/textbook');
    await page.getByTestId('textbook-term').filter({ hasText: /^клик$/ }).click();
    await page.getByTestId('term-try').click();
    await expect(page.getByTestId('position-title')).toHaveText('Попробовать на прицеле');
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('term-sheet')).toHaveCount(0);
    await systemBack(page);
    await expect(page).toHaveURL(/\/textbook$/);
    await expect(page.getByTestId('term-title')).toHaveText('клик');
  });

  test('E2 термин поверх разбора: «назад» снимает по слою, на подтверждении — «остаться»', async ({ page }) => {
    await toPosition(page, '01');
    await shootOnce(page);
    const causeLink = page.getByTestId('cause-calc').getByTestId('term-link');
    await causeLink.scrollIntoViewIfNeeded();
    await causeLink.click();
    await expect(page.getByTestId('term-sheet')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('term-sheet')).toHaveCount(0);
    await expect(page.getByTestId('review-sheet')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('review-sheet')).toHaveCount(0);
    await systemBack(page);
    await expect(page.getByTestId('leave-confirm')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('leave-confirm')).toHaveCount(0);
    await expect(page).toHaveURL(/\/position\/01$/);
    await systemBack(page);
    await expect(page.getByTestId('leave-confirm')).toBeVisible();
  });

  test('E3 после выстрела «назад» → «Покинуть» → лист; в журнале «прервано»', async ({ page }) => {
    await positionFromBriefing(page, '04');
    await enterTotalOnTurrets(page);
    await shootOnce(page);
    await page.getByTestId('review-next').click();
    await systemBack(page);
    await page.getByTestId('leave-confirm-yes').click();
    await expect(page.getByTestId('sheet-title')).toBeVisible();
    await expect(page).toHaveURL(/\/course\/04$/);
    await page.goto('/journal');
    await expect(page.getByTestId('journal-series-0')).toContainText('04');
    await expect(page.getByTestId('journal-stamp')).toHaveText('прервано');
  });

  test('E4 свободная игра: после выстрела «назад» без подтверждения → настройки свободной', async ({ page }) => {
    await page.goto('/free');
    await page.getByTestId('free-start').click();
    await page.waitForURL('**/position/free');
    await shootOnce(page);
    await page.getByTestId('review-next').click();
    await systemBack(page);
    await expect(page).toHaveURL(/\/free$/);
    await expect(page.getByTestId('leave-confirm')).toHaveCount(0);
  });

  test('E5 «назад» — туда, откуда пришли: главный → лист → главный; тропа → лист → экранная ← → тропа', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('continue-card').click();
    await expect(page.getByTestId('sheet-title')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('continue-card')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/course');
    await page.getByTestId('node-02').click();
    await expect(page.getByTestId('sheet-title')).toBeVisible();
    await page.getByTestId('sheet-back').click();
    await expect(page).toHaveURL(/\/course$/);
  });

  test('E6 итог → журнал → экранная ← → снова лист итога', async ({ page }) => {
    test.slow();
    await toPosition(page, '01');
    await enterTotalOnTurrets(page);
    for (let shot = 0; shot < 8 && (await page.getByTestId('result-sheet').count()) === 0; shot++) {
      if ((await page.getByTestId('change-magazine').count()) > 0) {
        await page.getByTestId('change-magazine').click();
      }
      await shootOnce(page);
      await page.getByTestId('review-next').click();
    }
    await page.getByTestId('result-journal').click();
    await page.waitForURL('**/journal');
    await page.getByTestId('journal-back').click();
    await expect(page.getByTestId('result-sheet')).toBeVisible();
    await expect(page).toHaveURL(/\/position\/01$/);
  });

  test('E8 «назад» браузера после выстрела — подтверждение, адрес позиции', async ({ page }) => {
    await positionFromBriefing(page, '01');
    await shootOnce(page);
    await page.getByTestId('review-next').click();
    await page.goBack();
    await expect(page.getByTestId('leave-confirm')).toBeVisible();
    await expect(page).toHaveURL(/\/position\/01$/);
    await page.getByTestId('leave-confirm-yes').click();
    await expect(page.getByTestId('sheet-title')).toBeVisible();
  });

  test('E9 свернули после выстрела — «прервано» сразу; доиграли — одна серия с классом', async ({ page }) => {
    test.slow();
    await toPosition(page, '01');
    await enterTotalOnTurrets(page);
    await shootOnce(page);
    await page.getByTestId('review-next').click();
    await hideApp(page);
    await expect.poll(() => storedSeries(page)).toMatchObject([{ isInterrupted: true }]);
    for (let shot = 0; shot < 8 && (await page.getByTestId('result-sheet').count()) === 0; shot++) {
      if ((await page.getByTestId('change-magazine').count()) > 0) {
        await page.getByTestId('change-magazine').click();
      }
      await shootOnce(page);
      await page.getByTestId('review-next').click();
    }
    const stamp = (await page.getByTestId('result-stamp').textContent())!;
    await page.getByTestId('result-journal').click();
    await page.waitForURL('**/journal');
    await expect(page.getByTestId('journal-series-0')).toBeVisible();
    await expect(page.getByTestId('journal-series-1')).toHaveCount(0);
    await expect(page.getByTestId('journal-stamp')).toHaveText(stamp);
  });

  test('E10 главный: подсказка выхода на 2 с; открытый термин «назад» закрывает без перехода', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('continue-card')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('exit-hint')).toHaveText('Нажмите ещё раз, чтобы выйти');
    await expect(page.getByTestId('exit-hint')).toHaveCount(0, { timeout: EXIT_HINT_GONE_MS });
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/textbook');
    await page.getByTestId('textbook-term').first().click();
    await expect(page.getByTestId('term-sheet')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('term-sheet')).toHaveCount(0);
    await expect(page).toHaveURL(/\/textbook$/);
    await expect(page.getByTestId('exit-hint')).toHaveCount(0);
  });
});

test.describe('системная «назад» в настройках (A8)', () => {
  test('E7 настройки: «назад» на подтверждении сброса — отмена, прогресс цел', async ({ page }) => {
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: { '01': 3, '02': 3 } }, shots: [], settings: QUIET_SETTINGS });
    await page.goto('/settings');
    await page.getByTestId('reset-progress').click();
    await expect(page.getByTestId('reset-confirm')).toBeVisible();
    await systemBack(page);
    await expect(page.getByTestId('reset-confirm')).toHaveCount(0);
    await expect(page).toHaveURL(/\/settings$/);
    await page.goto('/');
    await expect(page.getByTestId('admissions')).toHaveText('допуски 2 / 12');
  });
});
