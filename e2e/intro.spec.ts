import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { volume: 0, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const TRACK_VIEWBOX_WIDTH = 380;
const BOLT_STROKES: readonly [number, number][] = [[0, -62], [-142, 0], [142, 0], [0, 62]];
const PARTS = {
  rifle: ['barrel', 'bolt', 'magazine', 'trigger', 'scope'],
  scope: ['objective', 'eyepiece', 'elevation', 'windage', 'zoom'],
};

async function seedNewPlayer(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: false, bestClasses: {} }, series: [], settings: QUIET_SETTINGS });
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

async function tapAllParts(page: Page, parts: readonly string[]): Promise<void> {
  const next = page.getByTestId('intro-next');
  for (const [index, part] of parts.entries()) {
    await expect(next).toBeDisabled();
    await page.getByTestId(`part-${part}`).click();
    if (index === 0) {
      await expect(page.getByTestId('part-caption')).not.toHaveText('Тапни по части');
    }
  }
  await expect(next).toBeEnabled();
  await next.click();
}

async function toMeasureStep(page: Page): Promise<void> {
  await seedNewPlayer(page);
  await page.goto('/course/00');
  await page.getByTestId('to-position').click();
  await page.waitForURL('**/intro');
  await tapAllParts(page, PARTS.rifle);
  await tapAllParts(page, PARTS.scope);
  for (let click = 0; click < 5; click++) {
    await page.getByTestId('elevation-plus').click();
  }
  await expect(page.getByTestId('intro-impact')).toHaveAttribute('data-up-mil', '0.5');
  await page.getByTestId('intro-next').click();
  await page.getByTestId('intro-zoom-in').click();
  await expect(page.getByTestId('intro-next')).toBeDisabled();
  await page.getByTestId('intro-zoom-out').click();
  await page.getByTestId('intro-zoom-out').click();
  await page.getByTestId('intro-next').click();
  await expect(page.getByTestId('intro-step')).toContainText('шаг 5 из 7');
}

test.describe('упр. 00 «Винтовка и прицел» (A7.5)', () => {
  test('новый игрок: тропа → 00 → семь шагов → «ГОТОВ» → 00 пройдено, 01 открыт, 5 терминов; журнал пуст', async ({ page }) => {
    await seedNewPlayer(page);
    await page.goto('/course');
    await expect(page.getByTestId('node-01')).toBeDisabled();
    await page.getByTestId('node-00').click();
    await expect(page.getByTestId('briefing-intro')).toContainText('Без стрельбы и оценки');
    await expect(page.getByTestId('briefing-class-0')).toHaveCount(0);
    await expect(page.getByTestId('to-position')).toHaveText('Начать');

    await toMeasureStep(page);
    await page.getByTestId('measure-1').click();
    await page.getByTestId('intro-next').click();
    await expect(page.getByTestId('cartridge-fact')).toHaveCount(3);
    await page.getByTestId('intro-next').click();
    await expect(page.getByTestId('intro-finish')).toBeDisabled();
    await expect(page.getByTestId('fire-waiting')).toHaveCount(0);
    for (const [deltaX, deltaY] of BOLT_STROKES) {
      await strokeHandle(page, deltaX, deltaY);
    }
    await expect(page.getByTestId('bolt-done')).toBeVisible();
    await page.getByTestId('intro-finish').click();

    await page.waitForURL('**/course');
    await expect(page.getByTestId('node-00')).toContainText('пройдено');
    await expect(page.getByTestId('node-01')).toBeEnabled();
    await page.goto('/textbook');
    await expect(page.getByTestId('textbook-counter')).toHaveText('5 / 47 терминов');
    await page.goto('/journal');
    await expect(page.getByTestId('journal-empty')).toBeVisible();
  });

  test('шаг 5: неверный ответ — подсказка с формулой, «Дальше» закрыта; верный — открыта', async ({ page }) => {
    await toMeasureStep(page);
    await page.getByTestId('measure-2').click();
    await expect(page.getByTestId('measure-hint')).toContainText('Д = размер × 1000 / mil');
    await expect(page.getByTestId('intro-next')).toBeDisabled();
    await page.getByTestId('measure-1').click();
    await expect(page.getByTestId('measure-hint')).toHaveCount(0);
    await expect(page.getByTestId('intro-next')).toBeEnabled();
  });

  test('«назад» посреди шагов — лист 00; на тропе 00 не пройдено, 01 закрыт', async ({ page }) => {
    await seedNewPlayer(page);
    await page.goto('/intro');
    await tapAllParts(page, PARTS.rifle);
    await page.getByTestId('intro-back').click();
    await page.waitForURL('**/course/00');
    await page.goto('/course');
    await expect(page.getByTestId('node-00')).not.toContainText('пройдено');
    await expect(page.getByTestId('node-01')).toBeDisabled();
  });
});
