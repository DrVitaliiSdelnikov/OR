import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false, unitSystem: 'imperial' };
const PASSED_TO_10 = { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3, '09': 3 };
const METRIC_UNIT = /\d(?:,\d+)? (?:м|м\/с|гПа|°C|см)(?![а-яё])|× 1000|− 1013|\(15 −/;
const WIND_STEPS_MPH = 72;

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: PASSED_TO_10 }, shots: [], settings: QUIET_SETTINGS });
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click({ trial: true });
}

async function typeNumber(page: Page, text: string): Promise<void> {
  for (const key of text) {
    await page.getByTestId(`key-${key}`).click();
  }
}

async function chipNumber(page: Page, kind: string): Promise<number> {
  const text = (await page.getByTestId(`chip-${kind}`).locator('.value').textContent())!;
  return Number(/(\d+(?:,\d+)?)/.exec(text)![1].replace(',', '.'));
}

test.describe('расчёт САМ в имперских (T1.8b)', () => {
  test('06: шаг ветра — V⊥ в миль/ч × D в ярдах ÷ K в ярдах и mph; на листе ни одной метрической единицы', async ({ page }) => {
    test.slow();
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-wind').click();
    const dial = (await page.getByTestId('wind-clock').boundingBox())!;
    const scale = dial.width / 260;
    await page.mouse.click(dial.x + (130 - 70) * scale, dial.y + 140 * scale);
    for (let step = 0; step < WIND_STEPS_MPH; step++) {
      await page.getByTestId('speed-plus').click();
    }
    await expect(page.getByTestId('speed-wheel')).toContainText('7,2');
    await page.getByTestId('wind-step-link').click();
    await expect(page.getByTestId('calc-formula')).toContainText(/\/ \d{4}/);
    await page.getByTestId('slot-0').click();
    const crosswind = await chipNumber(page, 'crosswind');
    const distanceYards = await chipNumber(page, 'distance');
    await expect(page.getByTestId('chip-distance')).toContainText('ярд');
    await page.getByTestId('chip-crosswind').click();
    await page.getByTestId('chip-distance').click();
    const windConstant = Number(/\/ (\d{4})/.exec((await page.getByTestId('calc-formula').textContent())!)![1]);
    const product = Math.round(crosswind * distanceYards);
    const mil = Math.round((product / windConstant) * 100) / 100;
    await page.getByTestId('tape-0').click();
    await typeNumber(page, String(product));
    await page.getByTestId('tape-1').click();
    await typeNumber(page, String(mil));
    await page.getByTestId('tape-2').click();
    await typeNumber(page, String(Math.round(mil * 10) / 10));
    await page.getByTestId('side--1').click();
    expect(await page.getByTestId('calc-sheet').innerText()).not.toMatch(METRIC_UNIT);
    await page.getByTestId('calc-record').click();
    await expect(page.getByTestId('step-value-wind')).toHaveText(/^← \d/);
    await page.getByTestId('tab-dope').click();
    await expect(page.getByTestId('dope-scroller')).toContainText('−10 °F');
    expect(await page.getByTestId('dope-scroller').innerText()).toMatch(/^.*\n100\b/m);
  });

  test('05: миллинг в имперских — Д = дюймы × 27,78 / MIL = ярды', async ({ page }) => {
    await toPosition(page, '05');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-distance').click();
    const gong = (await page.locator('[data-test="milling-grid"] .gong').boundingBox())!;
    await page.mouse.click(gong.x + gong.width / 2, gong.y);
    await page.mouse.click(gong.x + gong.width / 2, gong.y + gong.height);
    await page.getByTestId('milling-count').click();
    await expect(page.getByTestId('milling-result')).toHaveText(/^Д = 19,7 × 27,78 \/ \d,\d\d = \d{3} ярд(ов|а)?$/);
    await page.getByTestId('tab-total').click();
    expect(await page.getByTestId('notebook-sheet').innerText()).not.toMatch(METRIC_UNIT);
  });
});
