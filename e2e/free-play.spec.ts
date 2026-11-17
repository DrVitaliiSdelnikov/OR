import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';
import { profileFromPreset } from '../src/sim/rifle-profile';

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

  test('новый игрок: все опции открыты сразу (В53) — «неизвестная», САМ лёгкий и сложный, патроны А и В, порывистый ветер', async ({ page }) => {
    await seed(page);
    await page.goto('/free');
    await expect(page.getByText('откроется в упр.')).toHaveCount(0);
    await expect(page.getByTestId('free-mode-manual-easy')).toBeEnabled();
    await expect(page.getByTestId('free-mode-manual-hard')).toBeEnabled();
    await expect(page.getByTestId('free-wind-gusty')).toBeEnabled();
    await page.getByTestId('free-cartridge').click();
    await expect(page.getByTestId('free-pick-A')).toBeEnabled();
    await expect(page.getByTestId('free-pick-C')).toBeEnabled();
  });

  test('новый игрок: патрон А выбирается и уходит на позицию', async ({ page }) => {
    await seed(page);
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
    await expect(page.getByTestId('instructor-line')).toHaveText(/^Расчётные данные: ↑ \d+,\d( [←→] \d+,\d)? MIL$/);
    await page.getByTestId('position-back').click();
    await page.waitForURL('**/free');
    await expect(page.getByTestId('free-distance')).toHaveText('500 м');
    await page.getByTestId('free-instructor').click();
    await page.getByTestId('free-start').click();
    await expect(page.getByTestId('position-title')).toHaveText('Свободная игра');
    await expect(page.getByTestId('instructor-line')).toHaveCount(0);
  });
});

test.describe('местность: угол, деривация, Кориолис (T1.4b)', () => {
  const UNTIL_06 = { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3 };

  async function expectNoHorizontalScroll(page: Page): Promise<void> {
    const overflowPt = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflowPt).toBeLessThanOrEqual(0);
  }

  test('горы, САМ: строка условий «∠ ±N°» в одну строку; в блокноте шаг «Угол места», лента из трёх строк, cos у фишки', async ({ page }) => {
    await seed(page, UNTIL_06);
    await page.goto('/free');
    await page.getByTestId('free-terrain-mountains').click();
    await expect(page.getByTestId('free-terrain-line')).toContainText('до 700 м');
    await page.getByTestId('free-mode-manual-easy').click();
    await page.getByTestId('free-start').click();
    const geometryLine = page.getByTestId('position-geometry');
    await expect(geometryLine).toHaveText(/^∠ [+−](1\d|2[0-5])°$/);
    const lineBox = await geometryLine.boundingBox();
    expect(lineBox!.height).toBeLessThan(24);
    await expectNoHorizontalScroll(page);
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('step-angle').click();
    await expect(page.getByTestId('calc-title')).toHaveText('Угол места · шаг 2 из 4');
    await expect(page.getByTestId('tape-2')).toBeVisible();
    await expect(page.getByTestId('tape-3')).toHaveCount(0);
    await page.getByTestId('slot-2').click();
    await expect(page.getByTestId('calc-sheet')).toContainText(/∠ [+−]\d+°/);
  });

  test('дальний рубеж, АВТО: «NN° с. ш. · аз. N°»; в итоге факторы «Деривация», «Кориолис», «Этвёш» включены', async ({ page }) => {
    await seed(page);
    await page.goto('/free');
    await page.getByTestId('free-terrain-long-range').click();
    await page.getByTestId('free-start').click();
    await expect(page.getByTestId('position-subtitle')).toContainText(/(6|7|8|9)\d\d м|1000 м/);
    await expect(page.getByTestId('position-geometry')).toHaveText(/^\d\d° [сю]\. ш\. · аз\. \d{1,3}°$/);
    await expectNoHorizontalScroll(page);
    await page.getByTestId('tile-notebook').click();
    for (const factor of ['spin', 'coriolis', 'eotvos']) {
      await expect(page.getByTestId(`factor-${factor}`)).toBeVisible();
    }
    await expect(page.getByTestId('factor-angle')).toHaveCount(0);
  });

  test('равнина — строки условий и новых факторов нет', async ({ page }) => {
    await seed(page);
    await page.goto('/free');
    await page.getByTestId('free-start').click();
    await expect(page.getByTestId('position-title')).toHaveText('Свободная игра');
    await expect(page.getByTestId('position-geometry')).toHaveCount(0);
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('factor-dope')).toBeVisible();
    await expect(page.getByTestId('factor-spin')).toHaveCount(0);
  });
});

test.describe('своя винтовка в свободной игре (T1.7, В49)', () => {
  test('нет своей — «своя» закрыта с подсказкой; есть активная — выбор «своя», в блокноте её карточка', async ({ page }) => {
    const own = profileFromPreset('65-140', 'profile-e2e', 'Шестёрка');
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, shots: [], settings: QUIET_SETTINGS, profiles: [own], activeProfileId: own.id });
    await page.goto('/free');
    await page.getByTestId('free-rifle-own').click();
    await expect(page.getByTestId('free-rifle-own')).toHaveClass(/chosen/);
    await expect(page.getByTestId('free-scope')).toHaveCount(0);
    await page.getByTestId('free-start').click();
    await page.waitForURL('**/position/free');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-dope').click();
    await expect(page.getByTestId('dope-heading')).toContainText('Шестёрка');
  });

  test('без своей винтовки «своя» недоступна', async ({ page }) => {
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, shots: [], settings: QUIET_SETTINGS, seededProfileIds: ['builtin-custom'] });
    await page.goto('/free');
    await expect(page.getByTestId('free-rifle-own')).toBeDisabled();
    await expect(page.getByTestId('free-rifle-own')).toContainText('заведи на экране «Винтовка»');
  });
});

test.describe('встроенная винтовка в свободной игре (17.11)', () => {
  test('новый игрок: «своя» — это «своя-custom», карточка ДОПЕ с её именем', async ({ page }) => {
    await seed(page);
    await page.goto('/free');
    await page.getByTestId('free-rifle-own').click();
    await page.getByTestId('free-start').click();
    await page.waitForURL('**/position/free');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-dope').click();
    await expect(page.getByTestId('dope-heading')).toContainText('своя-custom');
  });
});

