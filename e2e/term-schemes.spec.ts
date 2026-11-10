import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true };
const RETICLE_VIEW_HALF_MIL = 4;

async function openTerm(page: Page, term: string): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS });
  await page.goto('/textbook');
  await page.getByTestId('textbook-term').filter({ hasText: new RegExp(`^${term}$`) }).click();
  await expect(page.getByTestId('term-title')).toHaveText(term);
}

async function tapReticleAt(page: Page, reticle: string, rightMil: number, downMil: number): Promise<void> {
  const scheme = page.getByTestId(`reticle-scheme-${reticle}`);
  await scheme.scrollIntoViewIfNeeded();
  const box = (await scheme.boundingBox())!;
  const pxPerMil = box.width / 2 / RETICLE_VIEW_HALF_MIL;
  await page.mouse.click(box.x + box.width / 2 + rightMil * pxPerMil, box.y + box.height / 2 + downMil * pxPerMil);
}

test.describe('схемы в карточках учебника (A7.3b2)', () => {
  test('«сетка»: три сетки; тап по точке MIL-dot — «точка = 1 MIL», по полуметке Ёлки — 0,5 MIL', async ({ page }) => {
    await openTerm(page, 'сетка');
    await expect(page.getByTestId('term-scheme')).toHaveAttribute('data-scheme', 'reticle');
    await expect(page.getByTestId('scheme-caption')).toHaveText('Тапни по метке сетки');
    await tapReticleAt(page, 'mil-dot', 2, 0);
    await expect(page.getByTestId('scheme-caption')).toHaveText('точка = 1 MIL');
    await expect(page.getByTestId('reticle-mark-selected')).toHaveCount(1);
    await tapReticleAt(page, 'tree', 1.5, 0);
    await expect(page.getByTestId('scheme-caption')).toHaveText('полуметка = 0,5 MIL');
  });

  test('«правило часов»: тап по 2 ч — доля 0,87; по 12 ч — 0', async ({ page }) => {
    await openTerm(page, 'правило часов');
    await expect(page.getByTestId('scheme-caption')).toHaveText('3 ч — доля 1');
    await page.getByTestId('scheme-hour-2').click();
    await expect(page.getByTestId('scheme-caption')).toHaveText('2 ч — доля 0,87');
    await page.getByTestId('scheme-hour-12').click();
    await expect(page.getByTestId('scheme-caption')).toHaveText('12 ч — доля 0');
  });

  test('«кратность»: на 6× во второй плоскости точка = 2 MIL, на 12× — верно', async ({ page }) => {
    await openTerm(page, 'кратность');
    await expect(page.getByTestId('focal-second').getByTestId('focal-caption')).toHaveText('на 6× точка = 2 MIL — верно только на 12×');
    await page.getByTestId('focal-slider').fill('12');
    await expect(page.getByTestId('focal-magnification')).toHaveText('12×');
    await expect(page.getByTestId('focal-second').getByTestId('focal-caption')).toHaveText('на 12× точка = 1 MIL — верно');
  });

  test('схемы на карточках ядра: траектория со временем полёта, три патрона, веса зон; группа с СТП', async ({ page }) => {
    await openTerm(page, 'время полёта');
    await expect(page.getByTestId('trajectory-time')).toHaveCount(3);
    await expect(page.getByTestId('trajectory-curve')).toBeVisible();

    await page.getByTestId('term-close').click();
    await page.getByTestId('textbook-term').filter({ hasText: /^энергия$/ }).click();
    await expect(page.getByTestId('cartridge-fact')).toHaveCount(3);
    await expect(page.getByTestId('cartridges-drift')).toBeVisible();

    await page.getByTestId('term-close').click();
    await page.getByTestId('textbook-term').filter({ hasText: /^зоны ветра$/ }).click();
    await expect(page.getByTestId('zone-weight')).toHaveCount(4);

    await page.getByTestId('term-close').click();
    await page.getByTestId('textbook-term').filter({ hasText: /^СТП$/ }).click();
    await expect(page.getByTestId('scheme-group-point')).toHaveCount(5);
    await expect(page.getByTestId('scheme-mean')).toBeVisible();
    await expect(page.getByTestId('scheme-caption')).toHaveText('СТП ↓ 0,8 → 0,5 MIL — перенеси ↑ 8 ← 5 кл.');
  });

  test('у «клика» схемы нет', async ({ page }) => {
    await openTerm(page, 'клик');
    await expect(page.getByTestId('term-formula')).toBeVisible();
    await expect(page.getByTestId('term-scheme')).toHaveCount(0);
  });
});
