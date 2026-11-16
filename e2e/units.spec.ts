import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, enterTotalOnTurrets, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const PASSED_TO_05 = { '01': 3, '02': 3, '03': 3, '04': 3 };
const FULL_MEASUREMENT_MS = 3400;
const METRIC_UNIT = /\d(?:,\d+)? (?:м|м\/с|гПа|°C|см)(?![а-яё])/;

async function seed(page: Page, unitSystem: 'metric' | 'imperial', bestClasses: Record<string, number> = PASSED_TO_05): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, shots: [], settings: { ...QUIET_SETTINGS, unitSystem } });
}

async function visibleText(page: Page, testId: string): Promise<string> {
  return page.getByTestId(testId).innerText();
}

async function holdMeasure(page: Page): Promise<void> {
  const measure = (await page.getByTestId('measure').boundingBox())!;
  await page.mouse.move(measure.x + measure.width / 2, measure.y + measure.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(FULL_MEASUREMENT_MS);
  await page.mouse.up();
}

test.describe('единицы на экранах (T1.8a)', () => {
  test('настройки: по умолчанию метрика; «имперские» сохраняются после перезагрузки и меняют свободную игру', async ({ page }) => {
    await seed(page, 'metric');
    await page.goto('/settings');
    await expect(page.getByTestId('units-metric')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('units-imperial').click();
    await page.reload();
    await expect(page.getByTestId('units-imperial')).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/free');
    await expect(page.getByTestId('free-distance')).toHaveText('300 ярдов');
    await page.goto('/settings');
    await page.getByTestId('units-metric').click();
    await page.goto('/free');
    await expect(page.getByTestId('free-distance')).toHaveText('300 м');
  });

  test('брифинг 07 в имперских: цели в ярдах и дюймах, ветер в миль/ч, утро в °F и дюймах рт. ст.', async ({ page }) => {
    await seed(page, 'imperial', { ...PASSED_TO_05, '05': 3, '06': 3 });
    await page.goto('/course/07');
    await expect(page.getByTestId('sheet-targets')).toHaveText('4 × гонг 20 дюймов · 550–650 ярдов');
    await expect(page.getByTestId('sheet-wind')).toHaveText('4,5–5,6 миль/ч');
    await expect(page.getByTestId('sheet-atmosphere')).toHaveText('+23…32 °F · 30,27–30,56 дюйма рт. ст.');
    expect(await visibleText(page, 'briefing-card')).not.toMatch(METRIC_UNIT);
  });

  test('позиция 04 в имперских: ДИСТ и подзаголовок в ярдах, станция в °F, дюймах рт. ст. и миль/ч, колесо в миль/ч — ни одной метрической единицы', async ({ page }) => {
    await seed(page, 'imperial');
    await page.goto('/position/04');
    await expect(page.getByTestId('fire')).toBeVisible();
    await expect(page.getByTestId('position-subtitle')).toContainText('325 ярдов');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-conditions').click();
    await holdMeasure(page);
    const station = await visibleText(page, 'station-readings');
    expect(station).toMatch(/°F/);
    expect(station).toMatch(/дюйм\S* рт\. ст\./);
    expect(station).toMatch(/миль\/ч/);
    await page.getByTestId('tab-wind').click();
    await expect(page.getByTestId('wind-station')).toContainText('миль/ч');
    await expect(page.getByTestId('speed-wheel')).toContainText('миль/ч');
    for (const tab of ['tab-total', 'tab-conditions', 'tab-wind']) {
      await page.getByTestId(tab).click();
      expect(await visibleText(page, 'notebook-sheet'), tab).not.toMatch(METRIC_UNIT);
    }
  });

  test('разбор 01 в имперских: ось траектории в ярдах, масштаб в дюймах', async ({ page }) => {
    await seed(page, 'imperial', {});
    await page.goto('/position/01');
    await expect(page.getByTestId('fire')).toBeVisible();
    await enterTotalOnTurrets(page);
    const clicks = await clicksToTarget(page);
    await dialElevation(page, clicks);
    await centreReticle(page, clicks);
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible();
    await page.getByTestId('flight-tab-side').click();
    const plot = await page.getByTestId('flight-plot-side').textContent();
    expect(plot).toContain('325 ярдов');
    expect(plot).toMatch(/дюйм/);
    expect(plot).not.toMatch(METRIC_UNIT);
  });

  test('метрика без изменений: свободная игра, подзаголовок позиции, шапка ДОПЕ', async ({ page }) => {
    await seed(page, 'metric');
    await page.goto('/free');
    await expect(page.getByTestId('free-distance')).toHaveText('300 м');
    await page.goto('/position/04');
    await expect(page.getByTestId('position-subtitle')).toContainText('300 м');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-dope').click();
    await expect(page.getByTestId('dope-heading')).toHaveText('Карточка патрона Б · ноль 100 м · эталон +15 °C / 1013 гПа');
  });
});
