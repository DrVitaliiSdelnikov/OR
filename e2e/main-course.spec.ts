import { expect, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const MIN_TOUCH_PX = 44;

async function seedCourse(page: import('@playwright/test').Page, isIntroCompleted: boolean, bestClasses: Record<string, number>): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted, bestClasses }, shots: [], settings: QUIET_SETTINGS });
}

test.describe('главный экран и курс-тропа', () => {
  test('первый запуск: курсант, 0 допусков, карточка «НАЧАТЬ · 00»', async ({ page }) => {
    await seedCourse(page, false, {});
    await page.goto('/');
    await expect(page.getByTestId('rank')).toHaveText('Курсант');
    await expect(page.getByTestId('admissions')).toHaveText('допуски 0 / 12');
    await expect(page.getByTestId('continue-card')).toContainText('Начать');
    await expect(page.getByTestId('continue-card')).toContainText('00 · Винтовка и прицел');
    await expect(page.locator('ion-tab-bar')).toHaveCount(0);
  });

  test('прогресс из хранилища: стрелок, 4 допуска, «ПРОДОЛЖИТЬ · 05» ведёт на лист упражнения', async ({ page }) => {
    await seedCourse(page, true, { '01': 3, '02': 3, '03': 1, '04': 2 });
    await page.goto('/');
    await expect(page.getByTestId('rank')).toHaveText('Стрелок');
    await expect(page.getByTestId('admissions')).toHaveText('допуски 4 / 12');
    await expect(page.getByTestId('continue-card')).toContainText('05 · Дистанции: ДОПЕ и дальномер');
    await expect(page.getByTestId('continue-card')).toContainText('новое');
    await page.getByTestId('continue-card').click();
    await expect(page.getByTestId('sheet-title')).toHaveText('05 · Дистанции: ДОПЕ и дальномер');
  });

  test('тропа: 13 узлов, штампы, текущий, закрытые не нажимаются', async ({ page }) => {
    await seedCourse(page, true, { '01': 1, '02': 2, '03': 3 });
    await page.goto('/');
    await page.getByTestId('tile-course').click();
    await expect(page.locator('[data-test^="node-"]')).toHaveCount(13);
    await expect(page.getByTestId('stamp-01')).toHaveText('1 кл.');
    await expect(page.getByTestId('stamp-02')).toHaveText('2 кл.');
    await expect(page.getByTestId('stamp-03')).toHaveText('3 кл.');
    await expect(page.getByTestId('node-04')).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('node-05')).toBeDisabled();
    await expect(page.getByTestId('node-12')).toContainText('аттестация');
    await expect(page.getByTestId('trail-progress')).toContainText('пройдено 3 / 12');
  });

  test('пройденный узел открывает лист упражнения; «назад» — на тропу', async ({ page }) => {
    await seedCourse(page, true, { '01': 3 });
    await page.goto('/course');
    await page.getByTestId('node-01').click();
    await expect(page.getByTestId('sheet-title')).toHaveText('01 · Первые щелчки');
    await expect(page.getByTestId('sheet-targets')).toHaveText('3 × гонг 0,5 м · 300 м');
    await expect(page.getByTestId('sheet-wind')).toHaveText('штиль');
    await expect(page.getByTestId('to-position')).toBeEnabled();
    await page.getByTestId('sheet-back').click();
    await expect(page.locator('[data-test^="node-"]')).toHaveCount(13);
  });

  test('учебник и вводное — «откроется позже»; шестерёнка и журнал открываются', async ({ page }) => {
    await seedCourse(page, false, {});
    await page.goto('/');
    await page.getByTestId('tile-textbook').click();
    await expect(page.getByTestId('later-message')).toBeVisible();
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('reset-progress')).toBeVisible();
    await page.goto('/');
    await page.getByTestId('tile-journal').click();
    await expect(page).toHaveURL(/\/journal$/);
    await page.goto('/course');
    await page.getByTestId('node-00').click();
    await expect(page.getByTestId('later-message')).toBeVisible();
  });

  test('касание не меньше 44 на главном и тропе', async ({ page }) => {
    await seedCourse(page, true, { '01': 3 });
    for (const [path, selector] of [
      ['/', 'a, button'],
      ['/course', 'a, button:not([disabled])'],
    ] as const) {
      await page.goto(path);
      await page.locator(selector).first().waitFor();
      const heights = await page.locator(selector).evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
      expect(heights.length).toBeGreaterThan(3);
      for (const height of heights) {
        expect(height, path).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
      }
    }
  });
});
