import { expect, Page, test } from '@playwright/test';
import reference223 from '../src/core/reference/223-77.json' with { type: 'json' };
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const ROWS = 10;

async function seed(page: Page, unitSystem: 'metric' | 'imperial' = 'metric'): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: { ...QUIET_SETTINGS, unitSystem } });
}

function milText(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

test.describe('экран «Модель» (T5.3)', () => {
  test('Учебник → «Модель и сверка»: 4 раздела, 7 формул, таблица 10 строк в допуске → назад в Учебник', async ({ page }) => {
    await seed(page);
    await page.goto('/textbook');
    await page.getByTestId('textbook-model').click();
    await page.waitForURL('**/model');
    for (const section of ['model-effects', 'model-assumptions', 'model-formulas', 'model-comparison']) {
      await expect(page.getByTestId(section)).toBeVisible();
    }
    await expect(page.getByTestId('model-formula')).toHaveCount(7);
    await expect(page.getByTestId('model-source')).toContainText('lob 0.14.0');
    await expect(page.getByTestId('model-row')).toHaveCount(ROWS);
    await expect(page.getByTestId('model-row').first().locator('td').first()).toHaveText('100');
    await expect(page.getByTestId('model-summary')).toHaveText(/ — в допуске$/);
    await expect(page.getByTestId('model-incline-note')).toHaveCount(0);
    await page.getByTestId('model-back').click();
    await expect(page.getByTestId('textbook')).toBeVisible();
  });

  test('смена патрона и набора: ячейка эталона — число из JSON, ядро рядом', async ({ page }) => {
    await seed(page);
    await page.goto('/model');
    await page.getByTestId('model-cartridge-223-77').click();
    await page.getByTestId('model-set-uphill-15-coriolis-55n-east').click();
    await expect(page.getByTestId('model-cartridge-223-77')).toHaveAttribute('aria-pressed', 'true');
    const farthest = reference223.sets[2].rows[ROWS - 1];
    const farthestRow = page.getByTestId('model-row').last();
    await expect(farthestRow.getByTestId('model-reference-up')).toHaveText(milText(farthest.upMil));
    const ourUp = Number((await farthestRow.getByTestId('model-our-up').textContent())!.replace(',', '.'));
    expect(Math.abs(ourUp - farthest.upMil)).toBeLessThanOrEqual(0.1);
    expect(ourUp).not.toBe(Number(milText(farthest.upMil).replace(',', '.')));
    await expect(page.getByTestId('model-incline-note')).toBeVisible();
    await expect(page.getByTestId('model-summary')).toHaveText(/ — в допуске$/);
  });

  test('«О приложении» → «Модель и сверка» → назад на «О приложении»', async ({ page }) => {
    await seed(page);
    await page.goto('/about');
    await page.getByTestId('about-model').click();
    await page.waitForURL('**/model');
    await page.getByTestId('model-back').click();
    await page.waitForURL('**/about');
    await expect(page.getByTestId('about')).toBeVisible();
  });

  test('имперская система: дистанции в ярдах, формулы в ярдах и милях в час', async ({ page }) => {
    await seed(page, 'imperial');
    await page.goto('/model');
    const firstCells = page.getByTestId('model-row').locator('td:first-child');
    await expect(firstCells).toHaveCount(ROWS);
    await expect(firstCells.first()).toHaveText('109');
    await expect(firstCells.last()).toHaveText('1094');
    await expect(page.getByTestId('model-table').locator('th').first()).toHaveText('ДИСТ, ярд');
    await expect(page.getByTestId('model-formula').first()).toContainText('Д (ярды) = размер (дюймы) × 27,78 / MIL');
  });
});
