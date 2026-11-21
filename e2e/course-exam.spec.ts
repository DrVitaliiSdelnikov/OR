import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const TRAINING_IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];

async function seedCourse(page: Page, course: object): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {}, ...course }, series: [], settings: QUIET_SETTINGS });
}

test.describe('экзамен вместо курса (T3.6)', () => {
  test('тропа → плашка экзамена → лист 12 «ЭКЗАМЕН» → позиция в режиме экзамена', async ({ page }) => {
    await seedCourse(page, {});
    await page.goto('/course');
    await expect(page.getByTestId('exam-offer')).toContainText('Экзамен вместо курса');
    await page.getByTestId('exam-offer').click();
    await expect(page.getByTestId('briefing-header')).toHaveText('ЗАДАНИЕ 12 · ЭКЗАМЕН');
    await expect(page.getByTestId('briefing-exam')).toHaveText('Зачёт: от 85 % очков — упражнения 01–11 зачтены экзаменом');
    await page.getByTestId('sheet-mode-manual-hard').click();
    await page.getByTestId('to-position').click();
    await page.waitForURL(/\/position\/12\?/);
    const params = new URL(page.url()).searchParams;
    expect([params.get('exam'), params.get('mode')]).toEqual(['on', 'manual-hard']);
  });

  test('экзамен сдан: 01–11 «экзамен», свой класс остаётся, 13 текущий, плашки нет; лист 12 — обычный зачёт', async ({ page }) => {
    await seedCourse(page, { isExamPassed: true, bestClasses: { '03': 2, '12': 2 } });
    await page.goto('/course');
    await expect(page.getByTestId('exam-offer')).toHaveCount(0);
    await expect(page.getByTestId('stamp-11')).toHaveText('экзамен');
    await expect(page.getByTestId('stamp-03')).toHaveText('2 кл.');
    await expect(page.getByTestId('node-13')).toHaveAttribute('data-state', 'current');
    await page.goto('/course/12?exam=on');
    await expect(page.getByTestId('briefing-header')).toHaveText('ЗАДАНИЕ 12 · ЗАЧЁТ');
    await expect(page.getByTestId('briefing-exam')).toHaveCount(0);
  });

  test('курс пройден по-честному — плашки нет', async ({ page }) => {
    await seedCourse(page, { bestClasses: Object.fromEntries(TRAINING_IDS.map(id => [id, 3])) });
    await page.goto('/course');
    await expect(page.getByTestId('node-12')).toBeVisible();
    await expect(page.getByTestId('exam-offer')).toHaveCount(0);
  });
});
