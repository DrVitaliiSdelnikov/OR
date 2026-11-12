import { expect, Page, test } from '@playwright/test';
import { unlockEverything } from './helpers';

const PATROL_LINE = /^\d,\d м\/с · (поперёк|наискось) [→←↗↘↙↖]$/;

async function toPatrol(page: Page): Promise<void> {
  await page.goto('/position/11');
  await expect(page.getByTestId('fire')).toBeVisible();
}

test.describe('движущийся дозор (A9.3b)', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page, { isTapTrigger: true });
  });

  test('E7 11: «НА ПОЗИЦИЮ» активна; в подзаголовке скорость и куда идёт цель', async ({ page }) => {
    await page.goto('/course/11');
    await expect(page.getByTestId('to-position')).toBeEnabled();
    await toPatrol(page);
    await expect(page.getByTestId('position-subtitle')).toHaveText(/^рубеж · \d+ м · цель 1 \/ 10$/);
    await expect(page.getByTestId('position-patrol')).toHaveText(PATROL_LINE);
  });

  test('E8 11: в блокноте шаг «Упреждение»; выстрел — в разборе лепесток «Упреждение»', async ({ page }) => {
    await toPatrol(page);
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('step-lead')).toBeVisible();
    await page.getByTestId('sheet-handle').click();
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible();
    await expect(page.getByTestId('cause-lead')).toContainText('Упреждение');
  });

  test('E9 11 с инструктором: первая подсказка — у строки дозора', async ({ page }) => {
    await page.goto('/position/11?instructor=on');
    await expect(page.getByTestId('teaching-text')).toHaveText('Скорость и направление цели — здесь. Стрелка меняется на развороте');
  });
});
