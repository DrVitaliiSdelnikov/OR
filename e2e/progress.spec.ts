import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const LEVEL_TEXT = /^(Начинающий|Любитель|Стрелок|Сильный стрелок|Эксперт) · \d+$/;
const WEEKS = 8;
const SKILLS = 8;

async function seed(page: Page, drillRounds: object[] = []): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, series: [], drillRounds, settings: QUIET_SETTINGS });
}

function windRoundToday(): object {
  const cards = Array.from({ length: 10 }, (_, index) => (index === 0 ? { verdict: 'error', errorTypes: ['side'], seconds: 9 } : { verdict: 'exact', errorTypes: [], seconds: 9 }));
  return { drillId: 'wind', level: 'learn', seed: 1, startedAtIso: new Date().toISOString(), cards };
}

test.describe('экран «Прогресс» (T4.3)', () => {
  test('без попыток: уровень не определён, 8 навыков, недели без точек, ошибок нет; журнал и «назад»', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await expect(page.getByTestId('level')).toHaveText('Уровень не определён');
    await page.getByTestId('tile-progress').click();
    await expect(page.getByTestId('progress-level')).toHaveText('Уровень не определён');
    await expect(page.locator('[data-test^="progress-skill-"]')).toHaveCount(SKILLS);
    await expect(page.getByTestId('progress-skill-wind')).toContainText('нет попыток');
    await expect(page.getByTestId('progress-week')).toHaveCount(WEEKS);
    await expect(page.getByTestId('progress-chart-dot')).toHaveCount(0);
    await expect(page.getByTestId('progress-no-errors')).toBeVisible();
    await page.getByTestId('progress-journal').click();
    await expect(page).toHaveURL(/\/journal$/);
    await page.goto('/journal');
    await page.getByTestId('journal-back').click();
    await expect(page.getByTestId('progress')).toBeVisible();
    await page.getByTestId('progress-back').click();
    await expect(page.getByTestId('tile-progress')).toBeVisible();
  });

  test('раунд ветра на этой неделе: уровень на главном и в прогрессе, попытки, точка графика, ошибка «СТОРОНА»', async ({ page }) => {
    await seed(page, [windRoundToday()]);
    await page.goto('/');
    await expect(page.getByTestId('level')).toHaveText(LEVEL_TEXT);
    const homeLevel = await page.getByTestId('level').textContent();
    await page.getByTestId('tile-progress').click();
    await expect(page.getByTestId('progress-level')).toHaveText(homeLevel!);
    await expect(page.getByTestId('progress-skill-wind')).toContainText('10 попыток');
    await expect(page.getByTestId('progress-chart-dot')).toHaveCount(1);
    await expect(page.getByTestId('progress-week').last()).toContainText(homeLevel!.split(' · ')[1]);
    await expect(page.getByTestId('progress-error')).toHaveText([/СТОРОНА\s*×1/]);
  });
});
