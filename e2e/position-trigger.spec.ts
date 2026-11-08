import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const TRACK_VIEWBOX_WIDTH = 380;
const MIN_TOUCH_PX = 44;
// Шаг симуляции ограничен 0,05 с на кадр: в медленном эмуляторе спуск идёт дольше 4,5 с реального времени.
const SHOT_TIMEOUT_MS = 25_000;

async function toPosition03(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: { '01': 3, '02': 3 } }, shots: [], settings: QUIET_SETTINGS });
  await page.goto('/course/03');
  await page.getByTestId('to-position').click();
  await page.waitForURL('**/position/03');
  await page.getByTestId('fire').click({ trial: true });
}

async function pressFire(page: Page): Promise<void> {
  const fire = (await page.getByTestId('fire').boundingBox())!;
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await page.mouse.down();
}

async function strokeHandle(page: Page, deltaXUnits: number, deltaYUnits: number): Promise<void> {
  const handle = page.getByTestId('bolt-handle');
  await handle.click({ trial: true });
  const box = (await handle.boundingBox())!;
  const track = (await page.locator('[data-test="bolt-track"] svg').boundingBox())!;
  const pxPerUnit = track.width / TRACK_VIEWBOX_WIDTH;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaXUnits * pxPerUnit * 0.5, startY + deltaYUnits * pxPerUnit * 0.5, { steps: 4 });
  await page.mouse.move(startX + deltaXUnits * pxPerUnit * 1.05, startY + deltaYUnits * pxPerUnit * 1.05, { steps: 4 });
  await page.mouse.up();
}

async function shootWithPressure(page: Page): Promise<void> {
  await pressFire(page);
  await expect(page.getByTestId('review-sheet')).toBeVisible({ timeout: SHOT_TIMEOUT_MS });
  await page.mouse.up();
  await page.getByTestId('review-next').click();
}

test.describe('позиция: спуск с давлением, затвор, дыхание (03)', () => {
  test('держишь «ОГОНЬ»: растут кольцо и проценты, в стекле зона и маркер, затем выстрел', async ({ page }) => {
    await toPosition03(page);
    await pressFire(page);
    await expect(page.getByTestId('trigger-zone')).toBeVisible();
    await expect(page.getByTestId('trigger-marker')).toBeVisible();
    await expect.poll(async () => Number((await page.getByTestId('pressure').textContent())!.replace(/\D/g, ''))).toBeGreaterThan(20);
    await expect(page.getByTestId('review-sheet')).toBeVisible({ timeout: SHOT_TIMEOUT_MS });
    await page.mouse.up();
  });

  test('после выстрела — Г-дорожка и «ждёт затвор»; четыре движения возвращают «ОГОНЬ», 4 / 5', async ({ page }) => {
    await toPosition03(page);
    await shootWithPressure(page);
    await expect(page.getByTestId('bolt-track')).toBeVisible();
    await expect(page.getByTestId('fire-waiting')).toBeVisible();
    await expect(page.getByTestId('bolt-header')).toHaveText(/шаг 1 из 4/i);
    await strokeHandle(page, 0, -62);
    await expect(page.getByTestId('bolt-header')).toHaveText(/шаг 2 из 4/i);
    await strokeHandle(page, -142, 0);
    await strokeHandle(page, 142, 0);
    await strokeHandle(page, 0, 62);
    await expect(page.getByTestId('fire')).toBeVisible();
    await expect(page.getByTestId('rounds')).toHaveText('4 / 5');
  });

  test('тап по «ждёт затвор» подсказывает дослать патрон', async ({ page }) => {
    await toPosition03(page);
    await shootWithPressure(page);
    await page.waitForTimeout(2200);
    await page.getByTestId('fire-waiting').click();
    await expect(page.getByTestId('shot-line')).toHaveText('Дошли патрон затвором');
  });

  test('отпустил «ОГОНЬ» на середине — давление стекает, выстрела нет', async ({ page }) => {
    await toPosition03(page);
    await pressFire(page);
    await expect.poll(async () => Number((await page.getByTestId('pressure').textContent())!.replace(/\D/g, ''))).toBeGreaterThan(15);
    await page.mouse.up();
    await expect(page.getByTestId('trigger-zone')).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByTestId('shot-line')).toHaveCount(0);
    await expect(page.getByTestId('rounds')).toHaveText('5 / 5');
  });

  test('«ДЕРЖАТЬ»: кольцо воздуха и секунды убывают; отпустил — выдох', async ({ page }) => {
    await toPosition03(page);
    const hold = (await page.getByTestId('hold').boundingBox())!;
    await page.mouse.move(hold.x + hold.width / 2, hold.y + hold.height / 2);
    await page.mouse.down();
    await expect(page.getByTestId('air-seconds')).toBeVisible();
    const first = Number((await page.getByTestId('air-seconds').textContent())!.replace(/[^\d.]/g, ''));
    await page.waitForTimeout(1200);
    const later = Number((await page.getByTestId('air-seconds').textContent())!.replace(/[^\d.]/g, ''));
    expect(later).toBeLessThan(first);
    await page.mouse.up();
    await expect(page.getByTestId('hold')).toHaveText('Выдох');
    await expect(page.getByTestId('hold')).toHaveClass(/cooldown/);
  });

  test('касание не меньше 44 на дорожке затвора', async ({ page }) => {
    await toPosition03(page);
    await shootWithPressure(page);
    for (const testId of ['bolt-handle', 'fire-waiting']) {
      const box = (await page.getByTestId(testId).boundingBox())!;
      expect(box.height, testId).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});
