import { expect, test } from '@playwright/test';
import { startShootTask, unlockEverything } from './helpers';

test.describe('метеостанция, HUD, часы ветра, DOPE', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('Lv1: давление и влажность закрыты до Lv3, показания замораживаются', async ({ page }) => {
    await startShootTask(page, 's-zero');
    await page.getByTestId('take-reading').click();
    await expect(page.getByTestId('lcd-ТЕМП')).toBeVisible();
    await expect(page.getByTestId('lcd')).toContainText('СНЯТО');
    await page.getByTestId('lcd-page').click();
    await expect(page.getByTestId('lcd-ДАВЛ')).toContainText('откроется на Lv3');
  });

  test('Lv3: давление открыто', async ({ page }) => {
    await startShootTask(page, 's-700');
    await page.getByTestId('take-reading').click();
    await page.getByTestId('lcd-page').click();
    await expect(page.getByTestId('lcd-ДАВЛ')).toContainText('гПа');
  });

  test('HUD показывает поправку в MIL и кликах, дистанция меняется шагом 25 м', async ({ page }) => {
    await startShootTask(page, 's-500');
    await page.getByTestId('take-reading').click();
    await page.getByTestId('weather-done').click();
    await expect(page.getByTestId('hud-distance')).toContainText('500');
    await expect(page.getByTestId('hud-elevation')).toHaveText(/^\d+\.\d$/);
    const before = Number(await page.getByTestId('hud-elevation').textContent());
    await page.getByTestId('distance-plus').click();
    await expect(page.getByTestId('hud-distance')).toContainText('525');
    await expect.poll(async () => Number(await page.getByTestId('hud-elevation').textContent())).toBeGreaterThan(before);
    await expect(page.getByTestId('hud-correction')).toContainText('кл.');
  });

  test('часы ветра: 4 м/с с 10:30 дают 2 м/с бокового и поправку влево', async ({ page }) => {
    await startShootTask(page, 's-wind300');
    await page.getByTestId('take-reading').click();
    await page.getByTestId('weather-done').click();
    await page.getByTestId('open-wind').click();
    await page.getByTestId('clock-10.5').dispatchEvent('click');
    await page.getByTestId('speed-4').click();
    await expect(page.getByTestId('crosswind')).toHaveText('2.0 м/с');
    await page.getByTestId('apply-wind').click();
    await expect(page).toHaveURL(/tabs\/calc$/);
    await expect(page.getByTestId('open-wind')).toHaveText('10:30');
    await expect(page.getByTestId('wind-chip-1')).toHaveText('4');
    await expect(page.getByTestId('wind-chip-1')).toHaveClass(/on/);
    await expect(page.getByTestId('hud-correction')).toContainText('L');
  });

  test('DOPE: семь строк от 100 до 700 м', async ({ page }) => {
    await page.goto('/tabs/dope');
    await expect(page.getByTestId('dope-table').locator('tbody tr')).toHaveCount(7);
    await expect(page.getByTestId('dope-row-700')).toBeVisible();
  });

  test('настройки: тема B переключает палитру', async ({ page }) => {
    await page.goto('/tabs/hub/settings');
    await page.getByTestId('theme-day').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'day');
  });
});
