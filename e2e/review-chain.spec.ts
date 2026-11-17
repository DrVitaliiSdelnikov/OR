import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, seedProgress, setWindSpeed } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const PASSED_TO_10 = { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3, '09': 3 };
const MILLING_TOO_WIDE = 1.4;
const SHOT_TIMEOUT_MS = 25_000;

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: PASSED_TO_10 }, shots: [], settings: QUIET_SETTINGS });
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click({ trial: true });
}

async function typeNumber(page: Page, digits: string): Promise<void> {
  for (const key of digits) {
    await page.getByTestId(`key-${key}`).click();
  }
}

// Метки держатся только на той же цели: попадание закрывает её, поэтому где нужен промах — сетку не центрируем.
async function enterAndDial(page: Page, isReticleCentred: boolean): Promise<void> {
  await page.getByTestId('enter-turrets').click();
  await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);
  const clicks = await clicksToTarget(page);
  await dialElevation(page, clicks);
  if (isReticleCentred) {
    await centreReticle(page, clicks);
  }
}

// Спуск от 04 — нажатием с удержанием; шаг симуляции ограничен, в медленном эмуляторе спуск длиннее.
async function pressureShot(page: Page): Promise<void> {
  const fire = (await page.getByTestId('fire').boundingBox())!;
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('review-sheet')).toBeVisible({ timeout: SHOT_TIMEOUT_MS });
  await page.mouse.up();
}

test.describe('лестница причин и красный карандаш (T2.2)', () => {
  test('06 САМ: строка ДОПЕ записана 0,5 — первая строка «Строка ДОПЕ» с «было / надо», метка на шаге в хабе и в листе', async ({ page }) => {
    test.slow();
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('step-dope').click();
    await page.getByTestId('slot-0').click();
    await page.getByTestId('chip-distance').click();
    await page.getByTestId('tape-0').click();
    await typeNumber(page, '0.5');
    await page.getByTestId('side-1').click();
    await page.getByTestId('calc-record').click();
    await page.getByTestId('tab-wind').click();
    const dial = (await page.getByTestId('wind-clock').boundingBox())!;
    const scale = dial.width / 260;
    await page.mouse.click(dial.x + (130 - 70) * scale, dial.y + 140 * scale);
    await setWindSpeed(page, 3.2);
    await page.getByTestId('wind-step-link').click();
    await page.getByTestId('slot-0').click();
    await page.getByTestId('chip-crosswind').click();
    await page.getByTestId('chip-distance').click();
    await page.getByTestId('tape-0').click();
    await typeNumber(page, '1440');
    await page.getByTestId('tape-1').click();
    await typeNumber(page, '0.98');
    await page.getByTestId('tape-2').click();
    await typeNumber(page, '1');
    await page.getByTestId('side--1').click();
    await page.getByTestId('calc-record').click();
    await enterAndDial(page, true);
    await pressureShot(page);

    await expect(page.locator('[data-test^="cause-"]').first()).toHaveAttribute('data-test', 'cause-dope');
    await expect(page.getByTestId('cause-dope')).toHaveClass(/main/);
    await expect(page.getByTestId('cause-values-dope')).toHaveText(/^↑ 0,5 вместо ↑ \d,\d MIL$/);
    await expect(page.getByTestId('causes-conclusion')).toHaveText(/^Строка ДОПЕ: ↑ 0,5 вместо ↑ \d,\d MIL — ↓ \d+ кл\./);

    await page.getByTestId('review-next').click();
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('step-pencil-dope')).toHaveText(/^↑ 0,5 MIL надо ↑ \d,\d MIL$/);
    await expect(page.getByTestId('step-pencil-dope').locator('s')).toHaveText('↑ 0,5 MIL');
    await page.getByTestId('step-dope').click();
    await expect(page.getByTestId('calc-pencil')).toHaveText(/^↑ 0,5 MIL надо ↑ \d,\d MIL$/);
    await page.getByTestId('tape-0').click();
    await page.getByTestId('key-back').click();
    await page.getByTestId('calc-back').click();
    await expect(page.getByTestId('step-pencil-dope')).toHaveCount(0);
  });

  test('05 АВТО: миллинг шире гонга — строка «Дальность» с «было / надо», метка на вкладке «Дистанция»; ветер не введён — метка скорости на вкладке «Ветер»', async ({ page }) => {
    test.slow();
    await toPosition(page, '05');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-distance').click();
    const gong = (await page.locator('[data-test="milling-grid"] .gong').boundingBox())!;
    await page.mouse.click(gong.x + gong.width / 2, gong.y);
    await page.mouse.click(gong.x + gong.width / 2, gong.y + gong.height * MILLING_TOO_WIDE);
    await page.getByTestId('milling-count').click();
    await enterAndDial(page, false);
    await pressureShot(page);

    await expect(page.getByTestId('cause-distance')).toBeVisible();
    await expect(page.getByTestId('cause-values-distance')).toHaveText(/^\d{3} вместо \d{3} м$/);

    await page.getByTestId('review-next').click();
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-distance').click();
    await expect(page.getByTestId('milling-pencil')).toHaveText(/^\d{3} м надо \d{3} м$/);
    await page.getByTestId('tab-wind').click();
    await expect(page.getByTestId('pencil-wind-speed')).toHaveText(/^0 м\/с надо \d+(,\d)? м\/с$/);
  });
});
