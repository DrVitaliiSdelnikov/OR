import { expect, Page, test } from '@playwright/test';
import { seedProgress, setWindSpeed } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const PASSED_TO_05 = { '01': 3, '02': 3, '03': 3, '04': 3 };
const MIN_TOUCH_PX = 44;
const FULL_MEASUREMENT_MS = 3400;
const SHORT_MEASUREMENT_MS = 800;

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: PASSED_TO_05 }, shots: [], settings: QUIET_SETTINGS });
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click({ trial: true });
}

async function holdMeasure(page: Page, holdMs: number): Promise<void> {
  const measure = (await page.getByTestId('measure').boundingBox())!;
  await page.mouse.move(measure.x + measure.width / 2, measure.y + measure.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

async function pointClockAt(page: Page, clock: number): Promise<void> {
  const dial = (await page.getByTestId('wind-clock').boundingBox())!;
  const scale = dial.width / 260;
  const centerX = dial.x + 130 * scale;
  const centerY = dial.y + 140 * scale;
  const angle = (clock / 12) * 2 * Math.PI;
  await page.mouse.click(centerX + Math.sin(angle) * 70 * scale, centerY - Math.cos(angle) * 70 * scale);
}

test.describe('шторка блокнота (A5.1)', () => {
  test('плитки открывают свою вкладку; перекрестие над шторкой; ручка, свайп и «назад» закрывают', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('wind-tile').click();
    await expect(page.getByTestId('tab-wind')).toHaveAttribute('aria-pressed', 'true');
    const glass = (await page.getByTestId('glass').boundingBox())!;
    const sheet = (await page.getByTestId('notebook-sheet').boundingBox())!;
    expect(sheet.y).toBeGreaterThan(glass.y + glass.height / 2);
    await page.getByTestId('sheet-handle').click();
    await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);

    await page.getByTestId('tile-dope').click();
    await expect(page.getByTestId('tab-dope')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('position-back').click();
    await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);
    expect(page.url()).toContain('/position/04');

    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('tab-total')).toHaveAttribute('aria-pressed', 'true');
    const handle = (await page.getByTestId('sheet-handle').boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 200, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);
  });

  test('04: замер 3 с, ветер 9 ч со скоростью станции, «ВНЕСТИ» ставит метки на барабаны', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('dot-conditions')).toBeVisible();
    await page.getByTestId('tab-conditions').click();
    await expect(page.getByTestId('measure-hint')).toHaveText('Держи «Замер» 3 с');
    await holdMeasure(page, FULL_MEASUREMENT_MS);
    await expect(page.getByTestId('station-readings')).toContainText(/14:0\d · T /);
    await expect(page.getByTestId('short-measurement')).toHaveCount(0);
    await expect(page.getByTestId('dot-conditions')).toHaveCount(0);

    await page.getByTestId('tab-wind').click();
    const stationText = (await page.getByTestId('wind-station').textContent())!;
    const stationSpeed = Number(/(\d+\.\d) м\/с/.exec(stationText)![1]);
    await pointClockAt(page, 9);
    await expect(page.getByTestId('wind-clock')).toHaveAttribute('aria-valuenow', '9');
    await setWindSpeed(page, stationSpeed);
    await expect(page.getByTestId('wind-caption')).toHaveText(`ветер ${stationSpeed.toFixed(1)} м/с с 9 ч`);
    await expect(page.getByTestId('sheet-total')).toContainText('← ');
    await expect(page.getByTestId('sheet-total')).toContainText('кл. влево');

    await page.getByTestId('enter-turrets').click();
    await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);
    await expect(page.locator('[data-test="drum-elevation"] [data-test="drum-counter"]')).toContainText('ещё');
    await expect(page.locator('[data-test="drum-windage"] [data-test="drum-counter"]')).toContainText('ещё');
    await expect(page.getByTestId('wind-tile')).toContainText(`${stationSpeed.toFixed(1)} м/с`);
    await expect(page.getByTestId('wind-tile')).toContainText('9 ч');
  });

  test('отпустил «ЗАМЕР» раньше — «короткий замер»', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-conditions').click();
    await holdMeasure(page, SHORT_MEASUREMENT_MS);
    await expect(page.getByTestId('short-measurement')).toBeVisible();
  });

  test('ИТОГ: выключил ВЕТЕР — итог без поправки влево, вклад виден', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('wind-tile').click();
    await pointClockAt(page, 9);
    await setWindSpeed(page, 2.5);
    await page.getByTestId('tab-total').click();
    await expect(page.getByTestId('sheet-total')).toContainText('кл. влево');
    await page.getByTestId('toggle-wind').click();
    await expect(page.getByTestId('toggle-wind')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('sheet-total')).not.toContainText('влево');
    await expect(page.getByTestId('contribution-wind')).toHaveText(/^← \d+ кл\.$/);
    await page.getByTestId('factor-wind').getByRole('button', { name: 'Ветер' }).click();
    await expect(page.getByTestId('detail-wind')).toContainText('2.5 м/с с 9 ч');
  });

  test('05: миллинг двумя касаниями и «ПОСЧИТАТЬ» — дистанция, точка ушла, строка ДОПЕ обведена', async ({ page }) => {
    await toPosition(page, '05');
    await expect(page.getByTestId('tile-dope')).toHaveText('ДОПЕ · —');
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('dot-distance')).toBeVisible();
    await expect(page.getByTestId('enter-turrets')).toBeDisabled();
    await page.getByTestId('tab-distance').click();
    const gong = (await page.locator('[data-test="milling-grid"] .gong').boundingBox())!;
    await page.mouse.click(gong.x + gong.width / 2, gong.y);
    await page.mouse.click(gong.x + gong.width / 2, gong.y + gong.height);
    await expect(page.getByTestId('milling-mark')).toHaveCount(2);
    await page.getByTestId('milling-count').click();
    await expect(page.getByTestId('milling-result')).toHaveText(/^Д = 0\.\d × 1000 \/ \d\.\d\d = \d{3} м$/);
    await expect(page.getByTestId('dot-distance')).toHaveCount(0);
    await expect(page.getByTestId('enter-turrets')).toBeEnabled();
    await page.getByTestId('tab-dope').click();
    await expect(page.getByTestId('dope-current')).toHaveCount(1);
  });

  test('ДОПЕ: таблица уходит вбок, колонка ДИСТ на месте', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('tile-dope').click();
    await expect(page.getByTestId('dope-heading')).toHaveText('Карточка патрона Б · ноль 100 м · эталон +15 C / 1013 гПа');
    await expect(page.getByTestId('dope-current').locator('td').first()).toHaveText('300');
    const pinned = page.getByTestId('dope-current').locator('td').first();
    const before = (await pinned.boundingBox())!;
    const lastColumn = page.getByTestId('dope-current').locator('td').last();
    const lastBefore = (await lastColumn.boundingBox())!;
    await page.getByTestId('dope-scroller').evaluate(element => (element.scrollLeft = 400));
    await expect.poll(async () => (await lastColumn.boundingBox())!.x).toBeLessThan(lastBefore.x);
    expect((await pinned.boundingBox())!.x).toBeCloseTo(before.x, 0);
  });

  test('закрытый таб «Угол» — «откроется в следующем этапе»', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('locked-Угол').click();
    await expect(page.getByTestId('locked-notice')).toHaveText('Откроется в следующем этапе');
  });

  test('01: без «ВНЕСТИ» меток нет и на плитке точка; после — метка и счётчик', async ({ page }) => {
    await toPosition(page, '01');
    await expect(page.locator('[data-test="drum-elevation"] [data-test="drum-target"]')).toHaveCount(0);
    await expect(page.getByTestId('notebook-dot')).toBeVisible();
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('sheet-total')).toHaveText(/^↑ \d\.\d · \d+ кл\. вверх$/);
    await page.getByTestId('enter-turrets').click();
    await expect(page.locator('[data-test="drum-elevation"] [data-test="drum-target"]')).toHaveCount(1);
    await expect(page.getByTestId('notebook-dot')).toHaveCount(0);
  });

  test('касание не меньше 44 в шторке', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('tile-notebook').click();
    const ids = ['tab-total', 'tab-distance', 'tab-conditions', 'tab-wind', 'tab-dope', 'locked-Угол', 'toggle-dope', 'toggle-wind', 'enter-turrets', 'sheet-handle'];
    for (const id of ids) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
    await page.getByTestId('tab-conditions').click();
    expect((await page.getByTestId('measure').boundingBox())!.height).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    await page.getByTestId('tab-wind').click();
    for (const id of ['speed-minus', 'speed-plus']) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });

  test('колесо скорости: «+» и «−» по 0,1; с клавиатуры стрелки по 0,1, PageUp и PageDown по 1; быстрые нажатия подряд не теряются', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('wind-tile').click();
    const wheel = page.getByTestId('speed-wheel');
    await page.getByTestId('speed-plus').click();
    await page.getByTestId('speed-plus').click();
    await expect(wheel).toHaveAttribute('aria-valuenow', '0.2');
    await page.getByTestId('speed-minus').click();
    await expect(wheel).toHaveAttribute('aria-valuenow', '0.1');
    await wheel.focus();
    await page.keyboard.press('PageUp');
    await page.keyboard.press('PageUp');
    await page.keyboard.press('ArrowUp');
    await expect(wheel).toHaveAttribute('aria-valuenow', '2.2');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('ArrowDown');
    await expect(wheel).toHaveAttribute('aria-valuenow', '1.1');
    await wheel.evaluate(element => {
      for (let press = 0; press < 3; press++) {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      }
    });
    await expect(wheel).toHaveAttribute('aria-valuenow', '1.4');
  });
});
