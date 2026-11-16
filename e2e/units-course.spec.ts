import { expect, Page, test } from '@playwright/test';
import { positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true };
const PASSED_TO_10 = { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3, '09': 3 };
const METRIC_UNIT = /\d(?:,\d+)?\s?(?:м|м\/с|гПа|°C|см)(?![а-яё])|× 1000 \/|− 1013|\(15 −/;

async function seed(page: Page, bestClasses: Record<string, number>, isEverythingUnlocked = false): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, shots: [], settings: { ...QUIET_SETTINGS, isEverythingUnlocked, unitSystem: 'imperial' } });
}

test.describe('курс и тексты в имперских (T1.8c)', () => {
  test('06: лист — 450–550 ярдов и гонг 20″; на позиции цель ровно на 450, 500 или 550 ярдов; флажки и карточка — ярды', async ({ page }) => {
    await seed(page, PASSED_TO_10);
    await page.goto('/course/06');
    await expect(page.getByTestId('sheet-targets')).toHaveText('4 × гонг 20 дюймов · 450–550 ярдов');
    await page.goto('/position/06');
    await expect(page.getByTestId('fire')).toBeVisible();
    await expect(page.getByTestId('position-subtitle')).toContainText(/(450|500|550) ярдов/);
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-dope').click();
    await expect(page.getByTestId('dope-heading')).toContainText('ноль 100 ярдов');
    expect(await page.getByTestId('notebook-sheet').innerText()).not.toMatch(METRIC_UNIT);
  });

  test('10: название «Пристрелка на 425» на тропе, в брифинге и на позиции; цель — 425 ярдов', async ({ page }) => {
    await seed(page, PASSED_TO_10);
    await page.goto('/course');
    await expect(page.getByTestId('node-10')).toContainText('Пристрелка на 425');
    await page.goto('/course/10');
    await expect(page.getByTestId('sheet-title')).toHaveText('Пристрелка на 425');
    await page.goto('/position/10');
    await expect(page.getByTestId('fire')).toBeVisible();
    await expect(page.getByTestId('position-subtitle')).toContainText('425 ярдов');
  });

  test('02 с тренером: «Прицел сбит. Пристреляем на 100 ярдов»', async ({ page }) => {
    await seed(page, { '01': 3 });
    await positionFromBriefing(page, '02', true);
    await expect(page.getByTestId('teaching-text')).toHaveText('Прицел сбит. Пристреляем на 100 ярдов');
  });

  test('05 с тренером: гонг 20 дюймов; миллинг — Д = 20 × 27,78 / MIL = ярды', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3, '03': 3, '04': 3 });
    await positionFromBriefing(page, '05', true);
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-distance').click();
    await expect(page.getByTestId('teaching-text')).toHaveText('Гонг 20 дюймов. Коснись верхнего и нижнего края, затем «Посчитать»');
    const gong = (await page.locator('[data-test="milling-grid"] .gong').boundingBox())!;
    await page.mouse.click(gong.x + gong.width / 2, gong.y);
    await page.mouse.click(gong.x + gong.width / 2, gong.y + gong.height);
    await page.getByTestId('milling-count').click();
    await expect(page.getByTestId('milling-result')).toHaveText(/^Д = 20 × 27,78 \/ \d,\d\d = \d{3} ярд(ов|а)?$/);
    await expect(page.getByTestId('teaching-text')).toHaveText(/^Д = 20 × 27,78 \/ \d,\d\d = \d{3} ярд(ов|а)?$/);
  });

  test('учебник: «эталон условий» — 59 °F и 29,92; «формула тысячной» — × 27,78; пример ветра — миль/ч и ярды', async ({ page }) => {
    await seed(page, {}, true);
    await page.goto('/textbook');
    await page.getByTestId('textbook-term').filter({ hasText: /^эталон условий$/ }).click();
    await expect(page.getByTestId('term-phrase')).toContainText('59 °F и 29,92 дюйма рт. ст.');
    await page.getByTestId('term-close').click();
    await page.getByTestId('textbook-term').filter({ hasText: /^формула тысячной$/ }).click();
    await expect(page.getByTestId('term-formula')).toContainText('Д = размер × 27,78 / mil');
    await expect(page.getByTestId('term-example')).toContainText('Д = 20 × 27,78 / 1,25 = 444 ярда');
    await page.getByTestId('term-close').click();
    await page.getByTestId('textbook-term').filter({ hasText: /^ветер$/ }).click();
    await expect(page.getByTestId('term-example')).toContainText(/ветер 7 миль\/ч с 9 ч, 300 ярдов, патрон Б: W = 7 × 300 \/ \d{4}/);
    expect(await page.getByTestId('term-sheet').innerText()).not.toMatch(METRIC_UNIT);
  });

  test('свободная игра: ползунок шагом 50 ярдов, 300 м → 300 ярдов', async ({ page }) => {
    await seed(page, PASSED_TO_10);
    await page.goto('/free');
    await expect(page.getByTestId('free-distance')).toHaveText('300 ярдов');
    await page.getByTestId('free-distance-slider').fill('450');
    await expect(page.getByTestId('free-distance')).toHaveText('450 ярдов');
    await page.getByTestId('free-start').click();
    await expect(page.getByTestId('fire')).toBeVisible();
    await expect(page.getByTestId('position-subtitle')).toContainText('450 ярдов');
  });
});
