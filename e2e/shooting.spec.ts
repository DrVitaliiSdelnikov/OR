import { expect, Page, test } from '@playwright/test';
import { startFreePlay, unlockEverything } from './helpers';

async function toScope(page: Page): Promise<void> {
  await startFreePlay(page);
  await page.getByTestId('take-reading').click();
  await page.getByTestId('weather-done').click();
  await page.getByTestId('to-turrets').click();
  await page.waitForURL('**/scope');
}

async function holdTriggerUntilShot(page: Page): Promise<void> {
  await page.getByTestId('fire').click();
  const pad = page.getByTestId('trigger-pad');
  await expect(pad).toBeVisible();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('debrief')).toBeVisible({ timeout: 20_000 });
  await page.mouse.up();
}

async function cycleBolt(page: Page): Promise<void> {
  const moves: [number, number][] = [
    [0, -62],
    [142, 0],
    [-142, 0],
    [0, 62],
  ];
  for (const [deltaX, deltaY] of moves) {
    const box = (await page.getByTestId('bolt-ball').boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const scale = (await page.locator('svg.rifle').boundingBox())!.width / 360;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + (deltaX * scale) / 2, startY + (deltaY * scale) / 2, { steps: 5 });
    await page.mouse.move(startX + deltaX * scale * 1.05, startY + deltaY * scale * 1.05, { steps: 5 });
    await page.mouse.up();
  }
}

test.describe('прицел, спуск, затвор, разбор', () => {
  test.beforeEach(async ({ page }) => {
    await unlockEverything(page);
  });

  test('барабан высоты: ZERO STOP внизу и клик вверх', async ({ page }) => {
    await toScope(page);
    await page.getByTestId('elevation-minus').click();
    await expect(page.getByTestId('stop-badge')).toHaveText('ZERO STOP');
    await page.getByTestId('elevation-plus').click();
    await expect(page.getByTestId('drum-elevation')).toContainText('1 кл');
  });

  test('кратность меняется кнопками в пределах прицела', async ({ page }) => {
    await toScope(page);
    await expect(page.getByTestId('magnification')).toHaveText('8×');
    for (let index = 0; index < 6; index++) {
      await page.getByTestId('zoom-in').click();
    }
    await expect(page.getByTestId('magnification')).toHaveText('12×');
  });

  test('удержание показывает остаток до расчёта', async ({ page }) => {
    await toScope(page);
    await expect(page.getByTestId('hold-value')).toHaveClass(/warn-text/);
  });

  test('выстрел через площадку спуска, разбор, перезарядка затвором и запись в журнал', async ({ page }) => {
    await toScope(page);
    await holdTriggerUntilShot(page);
    await expect(page.getByTestId('debrief-verdict')).toHaveText(/ПОПАДАНИЕ|ПРОМАХ/);
    await expect(page.getByTestId('debrief-rule')).toBeVisible();
    await page.getByTestId('debrief-next').click();
    await expect(page.locator('ion-modal')).toBeHidden();
    await expect(page.getByTestId('magazine')).toContainText('4 в магазине · гильза в стволе');
    await cycleBolt(page);
    await expect(page.getByTestId('fire')).toBeVisible();
    await page.goto('/journal');
    await expect(page.locator('[data-test^="log-"]').first()).toContainText('выстрел 1');
  });

  test('без перезарядки «ОГОНЬ» отправляет к затвору', async ({ page }) => {
    await toScope(page);
    await holdTriggerUntilShot(page);
    await page.getByTestId('debrief-next').click();
    await expect(page.locator('ion-modal')).toBeHidden();
    await expect(page.getByTestId('bolt-ball')).toBeVisible();
  });
});
