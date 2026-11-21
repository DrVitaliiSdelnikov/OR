import { expect, test } from '@playwright/test';
import { positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const MIN_TOUCH_PX = 44;

async function seedCourse(page: import('@playwright/test').Page, isIntroCompleted: boolean, bestClasses: Record<string, number>): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted, bestClasses }, shots: [], settings: QUIET_SETTINGS });
}

test.describe('главный экран и курс-тропа', () => {
  test('первый запуск: уровень не определён, 0 допусков, карточка «НАЧАТЬ · 00»', async ({ page }) => {
    await seedCourse(page, false, {});
    await page.goto('/');
    await expect(page.getByTestId('level')).toHaveText('Уровень не определён');
    await expect(page.getByTestId('admissions')).toHaveText('допуски 0 / 12');
    await expect(page.getByTestId('continue-card')).toContainText('Начать');
    await expect(page.getByTestId('continue-card')).toContainText('00 · Винтовка и прицел');
    await expect(page.locator('ion-tab-bar')).toHaveCount(0);
  });

  test('прогресс из хранилища: 4 допуска, «ПРОДОЛЖИТЬ · 05» ведёт на лист упражнения', async ({ page }) => {
    await seedCourse(page, true, { '01': 3, '02': 3, '03': 1, '04': 2 });
    await page.goto('/');
    await expect(page.getByTestId('admissions')).toHaveText('допуски 4 / 12');
    await expect(page.getByTestId('continue-card')).toContainText('05 · Дистанции: ДОПЕ и дальномер');
    await expect(page.getByTestId('continue-card')).toContainText('новое');
    await page.getByTestId('continue-card').click();
    await expect(page.getByTestId('sheet-title')).toHaveText('Дистанции: ДОПЕ и дальномер');
  });

  test('тропа: 15 узлов, штампы, текущий, закрытые не нажимаются', async ({ page }) => {
    await seedCourse(page, true, { '01': 1, '02': 2, '03': 3 });
    await page.goto('/');
    await page.getByTestId('tile-course').click();
    await expect(page.locator('[data-test^="node-"]')).toHaveCount(15);
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
    await expect(page.getByTestId('briefing-header')).toHaveText('ЗАДАНИЕ 01 · УЧЕБНОЕ');
    await expect(page.getByTestId('sheet-title')).toHaveText('Первые щелчки');
    await expect(page.getByTestId('sheet-targets')).toHaveText('3 × гонг 0,5 м · 300 м');
    await expect(page.getByTestId('sheet-wind')).toHaveText('штиль');
    await expect(page.getByTestId('to-position')).toBeEnabled();
    await page.getByTestId('sheet-back').click();
    await expect(page.locator('[data-test^="node-"]')).toHaveCount(15);
  });

  test('вводное открывается; шестерёнка, учебник, прогресс и журнал открываются', async ({ page }) => {
    await seedCourse(page, false, {});
    await page.goto('/');
    await page.getByTestId('tile-textbook').click();
    await expect(page).toHaveURL(/\/textbook$/);
    await page.goto('/');
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('reset-progress')).toBeVisible();
    await page.goto('/');
    await page.getByTestId('tile-progress').click();
    await page.getByTestId('progress-journal').click();
    await expect(page).toHaveURL(/\/journal$/);
    await page.goto('/course');
    await page.getByTestId('node-00').click();
    await expect(page.getByTestId('briefing-intro')).toBeVisible();
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

test.describe('после зачёта: 13 «Горный склон» и 14 «Дальний рубеж» (В45)', () => {
  const TO_ATTESTATION = { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3, '09': 3, '10': 3, '11': 3, '12': 3 };

  test('после 12: 13 текущий, 14 закрыт; лист 13 — склон и высота; позиция — «∠ ±N°» и шаг «Угол места»; звание и допуски по 12', async ({ page }) => {
    await seedCourse(page, true, TO_ATTESTATION);
    await page.goto('/');
    await expect(page.getByTestId('admissions')).toHaveText('допуски 12 / 12');
    await page.getByTestId('tile-course').click();
    await expect(page.getByTestId('node-13')).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('node-14')).toBeDisabled();
    const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowPx).toBeLessThanOrEqual(0);
    await page.getByTestId('node-13').click();
    await expect(page.getByTestId('briefing-header')).toHaveText('ЗАДАНИЕ 13 · УЧЕБНОЕ');
    await expect(page.getByTestId('sheet-atmosphere')).toHaveText('по погоде · ∠ 10–25° вверх или вниз · высота 1000–1500 м');
    await positionFromBriefing(page, '13');
    await expect(page.getByTestId('position-geometry')).toHaveText(/^∠ [+−](1\d|2[0-5])°$/);
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('step-angle')).toBeVisible();
    await expect(page.getByTestId('step-spin')).toHaveCount(0);
  });

  test('14 с тренером: первая подсказка — на строке широты; в листе шаги деривации, Кориолиса и Этвёша', async ({ page }) => {
    await seedCourse(page, true, { ...TO_ATTESTATION, '13': 3 });
    await positionFromBriefing(page, '14', true);
    await expect(page.getByTestId('position-geometry')).toHaveText(/^\d\d° [сю]\. ш\. · аз\. \d{1,3}°$/);
    await expect(page.getByTestId('teaching-text')).toHaveText('Широта и азимут — здесь. Дальше 800 м в расчёт входят деривация и вращение Земли');
    await expect(page.getByTestId('teaching-count')).toHaveText('подсказка 1 из 4');
    await expect(page.getByTestId('teaching-cutout')).toBeVisible();
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('teaching-text')).toHaveText('Посчитай «Деривацию» и «Кориолис» в блокноте');
    await page.getByTestId('tile-notebook').click();
    for (const step of ['spin', 'coriolis', 'eotvos']) {
      await expect(page.getByTestId(`step-${step}`)).toBeVisible();
    }
    await expect(page.getByTestId('step-angle')).toHaveCount(0);
  });
});
