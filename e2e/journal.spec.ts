import { expect, Page, test } from '@playwright/test';
import { enterTotalOnTurrets, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };

async function seed(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, shots: [{ id: 'old' }], settings: QUIET_SETTINGS });
}

async function shootUntilResult(page: Page): Promise<void> {
  await page.goto('/position/01');
  await expect(page.getByTestId('fire')).toBeVisible();
  await enterTotalOnTurrets(page);
  for (let shot = 0; shot < 8 && (await page.getByTestId('result-sheet').count()) === 0; shot++) {
    if ((await page.getByTestId('change-magazine').count()) > 0) {
      await page.getByTestId('change-magazine').click();
    }
    await page.getByTestId('fire').click();
    await page.getByTestId('review-next').click();
  }
  await expect(page.getByTestId('result-sheet')).toBeVisible();
}

test.describe('журнал стрелка (A7.2)', () => {
  test('пустой журнал: старые выстрелы старого формата не показываются, «К КУРСУ» ведёт на тропу', async ({ page }) => {
    await seed(page);
    await page.goto('/journal');
    await expect(page.getByTestId('journal-empty')).toContainText('Журнал пуст. Первая запись — после упражнения 01');
    await page.getByTestId('journal-to-course').click();
    await page.waitForURL('**/course');
  });

  test('01 до итога → «В ЖУРНАЛ»: серия «01 · Первые щелчки» со штампом; раскрыл — выстрелы', async ({ page }) => {
    test.slow();
    await seed(page);
    await shootUntilResult(page);
    const stamp = (await page.getByTestId('result-stamp').textContent())!;
    await page.getByTestId('result-journal').click();
    await page.waitForURL('**/journal');
    await expect(page.getByTestId('journal-series-0')).toContainText('01 · Первые щелчки');
    await expect(page.getByTestId('journal-stamp')).toHaveText(stamp);
    await page.getByTestId('journal-series-0').click();
    const shots = page.getByTestId('journal-shot');
    await expect(shots.first()).toBeVisible();
    expect(await shots.count()).toBeGreaterThanOrEqual(3);
    await expect(shots.first()).toHaveText(/^1 · 300 м · [✓✕]/);
  });

  test('ушёл с позиции после выстрела — в ленте «прервано»', async ({ page }) => {
    await seed(page);
    await page.goto('/position/01');
    await enterTotalOnTurrets(page);
    await page.getByTestId('fire').click();
    await page.getByTestId('review-next').click();
    await page.getByTestId('position-back').click();
    await page.getByTestId('leave-confirm-yes').click();
    await page.goto('/journal');
    await expect(page.getByTestId('journal-stamp')).toHaveText('прервано');
    await expect(page.getByTestId('journal-stamp')).toBeVisible();
  });

  test('табы: ОШИБКИ, КАРТОЧКИ, СТАТИСТИКА (заглушка до 10 выстрелов), ДОСТИЖЕНИЯ', async ({ page }) => {
    await seed(page);
    await page.goto('/position/01');
    await enterTotalOnTurrets(page);
    await page.getByTestId('fire').click();
    await page.getByTestId('review-next').click();
    await page.getByTestId('position-back').click();
    await page.getByTestId('leave-confirm-yes').click();
    await page.goto('/journal');
    await page.getByTestId('journal-tab-errors').click();
    await expect(page.getByTestId('journal-error').or(page.getByTestId('journal-no-errors')).first()).toBeVisible();
    await page.getByTestId('journal-tab-cards').click();
    await expect(page.getByTestId('journal-card-1')).toContainText('Патрон Б');
    await expect(page.getByTestId('journal-card-1')).toBeVisible();
    await page.getByTestId('journal-tab-stats').click();
    await expect(page.getByTestId('journal-stats-few')).toHaveText('Статистика наберётся после 10 выстрелов');
    await page.getByTestId('journal-tab-achievements').click();
    await expect(page.getByTestId('journal-achievements')).toContainText('допуски 0 / 12');
  });
});
