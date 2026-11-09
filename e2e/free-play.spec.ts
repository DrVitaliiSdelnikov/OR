import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };

async function seed(page: Page, bestClasses: Record<string, number> = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, shots: [], settings: QUIET_SETTINGS });
}

async function setDistance(page: Page, distanceM: number): Promise<void> {
  await page.getByTestId('free-distance-slider').fill(String(distanceM));
  await expect(page.getByTestId('free-distance')).toHaveText(`${distanceM} м`);
}

test.describe('свободная игра (A7.1)', () => {
  test('главная → «02 · Свободная игра» → настройки; «ЗАНЯТЬ ПОЗИЦИЮ» видна без прокрутки', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('tile-free').click();
    await page.waitForURL('**/free');
    await expect(page.getByTestId('free-distance')).toHaveText('300 м');
    await expect(page.getByTestId('free-start')).toBeInViewport();
  });

  test('800 м, умеренный ветер — позиция без оценки: «Свободная игра», 800 м, магазин 5 / 5, листа итога нет', async ({ page }) => {
    await seed(page);
    await page.goto('/free');
    await setDistance(page, 800);
    await page.getByTestId('free-wind-moderate').click();
    await page.getByTestId('free-start').click();
    await page.waitForURL('**/position/free');
    await expect(page.getByTestId('position-title')).toHaveText('Свободная игра');
    await expect(page.getByTestId('position-subtitle')).toContainText('800 м');
    await expect(page.getByTestId('rounds')).toHaveText('5 / 5');
    await expect(page.getByTestId('result-sheet')).toHaveCount(0);
  });

  test('новый игрок: «неизвестная», САМ и патрон А закрыты с подписью; после 08 патрон А открыт', async ({ page }) => {
    await seed(page);
    await page.goto('/free');
    await expect(page.getByTestId('free-unknown')).toContainText('откроется в упр. 05');
    await expect(page.getByTestId('free-mode-manual-easy')).toBeDisabled();
    await expect(page.getByTestId('free-mode-manual-easy')).toContainText('откроется в упр. 06');
    await page.getByTestId('free-cartridge').click();
    await expect(page.getByTestId('free-pick-A')).toBeDisabled();
    await expect(page.getByTestId('free-pick-A')).toContainText('откроется в упр. 08');
  });

  test('после 08 патрон А выбирается и уходит на позицию', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3 });
    await page.goto('/free');
    await page.getByTestId('free-cartridge').click();
    await page.getByTestId('free-pick-A').click();
    await expect(page.getByTestId('free-cartridge')).toContainText('Патрон А');
    await page.getByTestId('free-start').click();
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-dope').click();
    await expect(page.getByTestId('dope-heading')).toContainText('А');
  });

  test('«Инструктор рядом» — строка расчётных данных; выключен — строки нет; «назад» — настройки с прежним выбором', async ({ page }) => {
    await seed(page);
    await page.goto('/free');
    await setDistance(page, 500);
    await page.getByTestId('free-instructor').click();
    await page.getByTestId('free-start').click();
    await expect(page.getByTestId('instructor-line')).toHaveText(/^Расчётные данные: ↑ \d+\.\d( [←→] \d+\.\d)? MIL$/);
    await page.getByTestId('position-back').click();
    await page.waitForURL('**/free');
    await expect(page.getByTestId('free-distance')).toHaveText('500 м');
    await page.getByTestId('free-instructor').click();
    await page.getByTestId('free-start').click();
    await expect(page.getByTestId('position-title')).toHaveText('Свободная игра');
    await expect(page.getByTestId('instructor-line')).toHaveCount(0);
  });
});
