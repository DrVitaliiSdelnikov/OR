import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const PASSED_TO_10 = { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3, '09': 3 };
const MIN_TOUCH_PX = 44;
const FULL_MEASUREMENT_MS = 3400;

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: PASSED_TO_10 }, shots: [], settings: QUIET_SETTINGS });
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click({ trial: true });
}

async function typeNumber(page: Page, text: string): Promise<void> {
  for (const key of text) {
    await page.getByTestId(`key-${key}`).click();
  }
}

async function recordDope(page: Page, value: string): Promise<void> {
  await page.getByTestId('step-dope').click();
  await page.getByTestId('slot-0').click();
  await page.getByTestId('chip-distance').click();
  await page.getByTestId('tape-0').click();
  await typeNumber(page, value);
  await page.getByTestId('side-1').click();
  await page.getByTestId('calc-record').click();
}

async function enterWind(page: Page): Promise<void> {
  await page.getByTestId('tab-wind').click();
  const dial = (await page.getByTestId('wind-clock').boundingBox())!;
  const scale = dial.width / 260;
  await page.mouse.click(dial.x + (130 - 70) * scale, dial.y + 140 * scale);
  for (let step = 0; step < 32; step++) {
    await page.getByTestId('speed-plus').click();
  }
}

test.describe('лист расчёта САМ (A5.2)', () => {
  test('06: ИТОГ — плашка «САМ · ЛЁГКИЙ ×1.5» и пустые шаги ДОПЕ, Атмосфера, Ветер', async ({ page }) => {
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('manual-mode')).toHaveText('САМ · ЛЁГКИЙ ×1.5');
    for (const step of ['dope', 'atmosphere', 'wind']) {
      await expect(page.getByTestId(`step-note-${step}`)).toHaveText('не записано');
    }
    await expect(page.getByTestId('step-distance')).toHaveCount(0);
  });

  test('06: шаг ДОПЕ — чип D обведён, набрал ВЕРТ, ↑, «ЗАПИСАТЬ» — в хабе «записано», итог ↑', async ({ page }) => {
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('step-dope').click();
    await expect(page.getByTestId('calc-sheet')).toBeVisible();
    await expect(page.getByTestId('calc-record')).toBeDisabled();
    await page.getByTestId('slot-0').click();
    await expect(page.getByTestId('chip-distance')).toHaveAttribute('data-awaited', 'true');
    await page.getByTestId('chip-distance').click();
    await expect(page.getByTestId('slot-0')).toContainText('м');
    await page.getByTestId('tape-0').click();
    await typeNumber(page, '3.4');
    await expect(page.getByTestId('tape-0')).toContainText('3.4');
    await page.getByTestId('side-1').click();
    await page.getByTestId('calc-record').click();
    await expect(page.getByTestId('calc-sheet')).toHaveCount(0);
    await expect(page.getByTestId('step-note-dope')).toHaveText(/^записано/);
    await expect(page.getByTestId('step-value-dope')).toHaveText('↑ 3.4');
    await expect(page.getByTestId('sheet-total')).toHaveText(/^↑ 3\.4 · 34 кл\. вверх$/);
  });

  test('06: шаг Ветер по ссылке с вкладки — V⊥ и D в слоты, K печатью; три клетки, ←; «ВНЕСТИ» — метки', async ({ page }) => {
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await recordDope(page, '3.4');
    await enterWind(page);
    await expect(page.getByTestId('clock-share').first()).toBeVisible();
    await page.getByTestId('wind-step-link').click();
    await expect(page.getByTestId('calc-formula')).toContainText(/\/ \d{4}/);
    await expect(page.getByTestId('slot-2')).toHaveCount(0);
    await page.getByTestId('slot-0').click();
    await page.getByTestId('chip-crosswind').click();
    await page.getByTestId('chip-distance').click();
    await page.getByTestId('tape-0').click();
    await typeNumber(page, '1440');
    await page.getByTestId('tape-1').click();
    await typeNumber(page, '0.98');
    await page.getByTestId('tape-2').click();
    await typeNumber(page, '1');
    await expect(page.getByTestId('calc-record')).toBeDisabled();
    await page.getByTestId('side--1').click();
    await page.getByTestId('calc-record').click();
    await expect(page.getByTestId('step-value-wind')).toHaveText('← 1');
    await expect(page.getByTestId('sheet-total')).toContainText('10 кл. влево');
    await page.getByTestId('enter-turrets').click();
    await expect(page.locator('[data-test="drum-windage"] [data-test="drum-target"]')).toHaveCount(1);
  });

  test('06: ошибка деления — «записано» и мягкая подсказка без числа', async ({ page }) => {
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await enterWind(page);
    await page.getByTestId('wind-step-link').click();
    await page.getByTestId('slot-0').click();
    await page.getByTestId('chip-crosswind').click();
    await page.getByTestId('chip-distance').click();
    await page.getByTestId('tape-2').click();
    await typeNumber(page, '9.9');
    await page.getByTestId('side--1').click();
    await page.getByTestId('calc-record').click();
    await expect(page.getByTestId('step-note-wind')).toHaveText(/^записано · проверь [а-яё ,]+$/);
  });

  test('10: сложный — K в слоте, чипы без обводки; «Формулы −30» спрашивает, потом открывает', async ({ page }) => {
    await toPosition(page, '10');
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('manual-mode')).toHaveText('САМ · СЛОЖНЫЙ ×2');
    await enterWind(page);
    await page.getByTestId('wind-step-link').click();
    await expect(page.getByTestId('slot-2')).toBeVisible();
    await page.getByTestId('slot-0').click();
    await expect(page.locator('[data-test^="chip-"][data-awaited="true"]')).toHaveCount(0);
    expect(await page.locator('[data-test^="chip-"]:not([data-test="chip-tray"])').count()).toBeGreaterThan(3);
    await expect(page.getByTestId('calc-formulas')).toHaveText('Формулы −30');
    await page.getByTestId('calc-formulas').click();
    await expect(page.getByTestId('formulas-confirm')).toBeVisible();
    await page.getByTestId('formulas-cancel').click();
    await expect(page.getByTestId('calc-formulas')).toHaveText('Формулы −30');
    await page.getByTestId('calc-formulas').click();
    await page.getByTestId('formulas-open').click();
    await expect(page.getByTestId('formulas-list')).toContainText('W = V⊥ × D / K');
    await page.getByTestId('formulas-close').click();
    await expect(page.getByTestId('calc-formulas')).toHaveText('Формулы');
  });

  test('07: после замера ссылка «к расчёту» открывает лист атмосферы', async ({ page }) => {
    await toPosition(page, '07');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-conditions').click();
    const measure = (await page.getByTestId('measure').boundingBox())!;
    await page.mouse.move(measure.x + measure.width / 2, measure.y + measure.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(FULL_MEASUREMENT_MS);
    await page.mouse.up();
    await page.getByTestId('conditions-step-link').click();
    await expect(page.getByTestId('calc-title')).toHaveText('Атмосфера · шаг 2 из 3');
    await expect(page.getByTestId('calc-missing')).toHaveCount(0);
  });

  test('правка записанного шага снимает «записано»; тап по заполненному слоту вынимает чип', async ({ page }) => {
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await recordDope(page, '3.4');
    await page.getByTestId('step-dope').click();
    await page.getByTestId('slot-0').click();
    await expect(page.getByTestId('slot-0')).not.toContainText('м');
    await expect(page.getByTestId('calc-record')).toBeDisabled();
    await page.getByTestId('chip-distance').click();
    await expect(page.getByTestId('slot-0')).toContainText('м');
    await page.getByTestId('tape-0').click();
    await page.getByTestId('key-back').click();
    await page.getByTestId('calc-back').click();
    await expect(page.getByTestId('step-note-dope')).toHaveText('не записано');
    await expect(page.getByTestId('enter-turrets')).toBeDisabled();
  });

  test('касание не меньше 44 на листе расчёта', async ({ page }) => {
    await toPosition(page, '06');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('step-dope').click();
    await page.getByTestId('slot-0').click();
    for (const id of ['slot-0', 'chip-distance', 'calc-back', 'calc-formulas', 'calc-record', 'side-1', 'side--1', 'units']) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
    await page.getByTestId('tape-0').click();
    for (const id of ['key-1', 'key-.', 'key-back', 'tape-0']) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});
