import { expect, Page, test } from '@playwright/test';
import { flagPole } from '../src/app/scene/scene.model';
import { ptPerMil } from '../src/sim/scope-model';
import { centreReticle, unlockEverything } from './helpers';

const GLASS_PT = 276;
const WIDE_MAGNIFICATION = 3;
const DEFAULT_MAGNIFICATION = 8;
const LARGE_GONG_FROM_M = 600;

async function targetDistanceM(page: Page): Promise<number> {
  const subtitle = (await page.getByTestId('position-subtitle').textContent())!;
  return Number(/(\d+) м/.exec(subtitle)![1]);
}

async function toWideView(page: Page): Promise<number> {
  await centreReticle(page, 0);
  while ((await page.getByTestId('magnification').textContent()) !== `${WIDE_MAGNIFICATION}×`) {
    await page.getByTestId('zoom-out').click();
  }
  return targetDistanceM(page);
}

function flagMiddlePt(distanceM: number, flagDistanceM: number, magnification: number): { x: number; y: number } {
  const diameterM = distanceM >= LARGE_GONG_FROM_M ? 0.7 : 0.5;
  const radiusMil = (diameterM / 2 / distanceM) * 1000;
  const pole = flagPole({ x: GLASS_PT / 2, y: GLASS_PT / 2 }, radiusMil, distanceM, flagDistanceM, ptPerMil(magnification))!;
  return { x: pole.x, y: (pole.topY + pole.bottomY) / 2 };
}

async function flagPointOnPage(page: Page, distanceM: number, flagDistanceM: number): Promise<{ x: number; y: number }> {
  const flag = flagMiddlePt(distanceM, flagDistanceM, WIDE_MAGNIFICATION);
  const glass = (await page.getByTestId('glass').boundingBox())!;
  const scale = glass.width / GLASS_PT;
  return { x: glass.x + flag.x * scale, y: glass.y + flag.y * scale };
}

async function tapFlag(page: Page, distanceM: number, flagDistanceM: number): Promise<void> {
  const point = await flagPointOnPage(page, distanceM, flagDistanceM);
  await page.mouse.click(point.x, point.y);
}

async function panFlagToCentre(page: Page, flagDistanceM: number): Promise<void> {
  await centreReticle(page, 0);
  const flag = flagMiddlePt(await targetDistanceM(page), flagDistanceM, DEFAULT_MAGNIFICATION);
  const glass = (await page.getByTestId('glass').boundingBox())!;
  const scale = glass.width / GLASS_PT;
  const centre = { x: glass.x + glass.width / 2, y: glass.y + glass.height / 2 };
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + (GLASS_PT / 2 - flag.x) * scale, centre.y + (GLASS_PT / 2 - flag.y) * scale, { steps: 10 });
  await page.mouse.up();
  await page.mouse.click(centre.x, centre.y);
}

async function enterWind(page: Page): Promise<void> {
  await page.getByTestId('tab-wind').click();
  const dial = (await page.getByTestId('wind-clock').boundingBox())!;
  const scale = dial.width / 260;
  await page.mouse.click(dial.x + (130 - 70) * scale, dial.y + 140 * scale);
}

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click({ trial: true });
}

test.describe('флажки по трассе (A9.3a)', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('E1 09: «НА ПОЗИЦИЮ» активна; тап по флажку 400 м — плашка и показание на вкладке «Ветер»', async ({ page }) => {
    await page.goto('/course/09');
    await expect(page.getByTestId('to-position')).toBeEnabled();
    await toPosition(page, '09');
    const distanceM = await toWideView(page);
    await tapFlag(page, distanceM, 400);
    await expect(page.getByTestId('flag-reading')).toHaveText(/^400 м · \d+° · (штиль|(≥ )?\d,\d м\/с (слева|справа))$/);
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-wind').click();
    await expect(page.getByTestId('flag-400')).toHaveText(/^400 м · (штиль|\d,\d м\/с (слева|справа))$/);
  });

  test('E2 09: вкладка «Ветер» — веса зон в сумме 1; непрочитанный флажок просит тапнуть его', async ({ page }) => {
    await toPosition(page, '09');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-wind').click();
    await expect(page.getByTestId('zone-weights')).toBeVisible();
    const weights = await page.getByTestId('zone-weight').allTextContents();
    expect(weights).toHaveLength(4);
    expect(weights.reduce((sum, weight) => sum + Number(weight.replace(',', '.')), 0)).toBeCloseTo(1, 6);
    await expect(page.getByTestId('flag-200')).toHaveText('200 м · тапни флажок в стекле');
    await expect(page.getByTestId('wind-step-link')).toHaveText('к расчёту: шаг Ветер по зонам →');
  });

  test('E3 09: шаг «Ветер по зонам» ждёт непрочитанный флажок, прочитанный — чип', async ({ page }) => {
    await toPosition(page, '09');
    const distanceM = await toWideView(page);
    await tapFlag(page, distanceM, 400);
    await page.getByTestId('tile-notebook').click();
    await enterWind(page);
    await page.getByTestId('tab-total').click();
    await page.getByTestId('step-zones').click();
    await expect(page.getByTestId('calc-missing')).toHaveText('сначала тапни флажок 200 м в стекле');
  });

  test('E4 09: сдвиг по стеклу над флажком — наведение, а не чтение', async ({ page }) => {
    await toPosition(page, '09');
    const distanceM = await toWideView(page);
    const point = await flagPointOnPage(page, distanceM, 400);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 30, point.y, { steps: 5 });
    await page.mouse.up();
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-wind').click();
    await expect(page.getByTestId('flag-400')).toHaveText('400 м · тапни флажок в стекле');
    await expect(page.getByTestId('flag-reading')).toHaveCount(0);
  });

  test('E5 12: на брифинге выбран «САМ · сложный» — позиция в сложном режиме', async ({ page }) => {
    await page.goto('/course/12');
    await expect(page.getByTestId('sheet-mode-manual-easy')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('sheet-mode-manual-hard').click();
    await page.getByTestId('to-position').click();
    await page.waitForURL('**/position/12?mode=manual-hard');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-total').click();
    await expect(page.getByTestId('manual-mode')).toContainText('СЛОЖНЫЙ');
  });

  test('E6 09 с инструктором: «Тапни флажок» гаснет после чтения', async ({ page }) => {
    await page.goto('/position/09?instructor=on');
    await expect(page.getByTestId('teaching-text')).toHaveText('Ветер по трассе разный. Флажки на 200, 400, 600 м — левее цели, веди прицел к ним');
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('teaching-text')).toHaveText('Тапни флажок — угол и скорость запишутся в блокнот');
    await panFlagToCentre(page, 400);
    await expect(page.getByTestId('flag-reading')).toBeVisible();
    await expect(page.getByTestId('teaching-text')).toHaveCount(0);
  });
});
