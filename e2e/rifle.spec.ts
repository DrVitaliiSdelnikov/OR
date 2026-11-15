import { expect, Page, test } from '@playwright/test';
import { PROGRESS_KEY, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const MIN_TOUCH_PX = 44;

async function seed(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, shots: [], settings: { ...QUIET_SETTINGS, ...settings } });
}

async function typeInto(page: Page, testId: string, value: string): Promise<void> {
  await page.getByTestId(testId).fill(value);
}

async function createFromPreset(page: Page, presetCode = '308-175'): Promise<void> {
  await page.getByTestId('rifle-add').click();
  await page.getByTestId(`rifle-preset-${presetCode}`).click();
  await page.waitForURL(`**/rifle/new/${presetCode}`);
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowPx).toBeLessThanOrEqual(0);
}

async function expectTouchTargets(page: Page, selector: string): Promise<void> {
  for (const box of await page.locator(selector).evaluateAll(elements => elements.filter(element => (element as HTMLElement).offsetParent !== null).map(element => element.getBoundingClientRect().height))) {
    expect(box).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
  }
}

test.describe('экран «Винтовка» (T1.7)', () => {
  test('главная → «05 · Винтовка» → пресет → ошибка скорости → сохранить → активная → перезагрузка', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('tile-rifle').click();
    await page.waitForURL('**/rifle');
    await expect(page.getByTestId('rifle-course-active')).toBeVisible();
    await page.getByTestId('rifle-add').click();
    await page.getByTestId('rifle-presets-cancel').click();
    await expect(page.getByTestId('rifle-presets')).toHaveCount(0);
    await createFromPreset(page);
    await typeInto(page, 'field-name', 'Моя .308');
    await typeInto(page, 'field-muzzleVelocity', '1400');
    await expect(page.getByTestId('error-muzzleVelocity')).toHaveText('300–1300 м/с');
    await expect(page.getByTestId('rifle-save')).toBeDisabled();
    await typeInto(page, 'field-muzzleVelocity', '800');
    await expect(page.getByTestId('error-muzzleVelocity')).toHaveCount(0);
    await page.getByTestId('rifle-save').click();
    await page.waitForURL(/\/rifle$/);
    await expect(page.getByTestId('rifle-name')).toHaveText('Моя .308');
    await expect(page.getByTestId('rifle-line')).toHaveText('V 800 м/с · G7 0,243 · ноль 100 м');
    await page.getByTestId('rifle-make-active').click();
    await expect(page.getByTestId('rifle-active')).toBeVisible();
    await expect(page.getByTestId('rifle-course-make-active')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('rifle-name')).toHaveText('Моя .308');
    await expect(page.getByTestId('rifle-active')).toBeVisible();
  });

  test('ДОПЕ: 20 строк 50…1000 м; в имперских — 22 строки до 1100 ярдов и «фут/с» в редакторе', async ({ page }) => {
    await seed(page);
    await page.goto('/rifle');
    await createFromPreset(page);
    await page.getByTestId('rifle-save').click();
    await page.getByTestId('rifle-dope').click();
    const rows = page.getByTestId('rifle-dope-row');
    await expect(rows).toHaveCount(20);
    await expect(rows.first()).toContainText('50');
    await expect(rows.last()).toContainText('1000');
    await expectNoHorizontalScroll(page);
    await page.evaluate(key => {
      const stored = JSON.parse(localStorage.getItem(key)!);
      stored.settings.unitSystem = 'imperial';
      localStorage.setItem(key, JSON.stringify(stored));
    }, PROGRESS_KEY);
    await page.reload();
    await expect(page.getByTestId('rifle-dope-row')).toHaveCount(22);
    await expect(page.getByTestId('rifle-dope-row').last()).toContainText('1100');
    await page.goto('/rifle');
    await page.getByTestId('rifle-edit').click();
    await expect(page.getByTestId('field-muzzleVelocity')).toHaveValue('2600');
    await expect(page.locator('[data-test="rifle-editor"] .unit').filter({ hasText: 'фут/с' }).first()).toBeVisible();
  });

  test('удалить активную через лист подтверждения → активна учебная; отмена ничего не удаляет', async ({ page }) => {
    await seed(page);
    await page.goto('/rifle');
    await createFromPreset(page);
    await page.getByTestId('rifle-save').click();
    await page.getByTestId('rifle-make-active').click();
    await page.getByTestId('rifle-remove').click();
    await expect(page.getByTestId('rifle-remove-confirm')).toContainText('Удалить «Моя .308 · 175 гр»?');
    await page.getByTestId('rifle-remove-cancel').click();
    await expect(page.getByTestId('rifle-name')).toHaveCount(1);
    await page.getByTestId('rifle-remove').click();
    await page.getByTestId('rifle-remove-yes').click();
    await expect(page.getByTestId('rifle-name')).toHaveCount(0);
    await expect(page.getByTestId('rifle-course-active')).toBeVisible();
  });

  test('выход из редактора с правками — лист «Выйти без сохранения?»; «Отмена» оставляет в редакторе', async ({ page }) => {
    await seed(page);
    await page.goto('/rifle');
    await createFromPreset(page);
    await page.getByTestId('rifle-save').click();
    await page.getByTestId('rifle-edit').click();
    await typeInto(page, 'field-zero', '200');
    await page.getByTestId('rifle-edit-back').click();
    await expect(page.getByTestId('rifle-leave-confirm')).toBeVisible();
    await page.getByTestId('rifle-leave-cancel').click();
    await expect(page.getByTestId('field-zero')).toHaveValue('200');
    await page.getByTestId('rifle-cancel').click();
    await page.getByTestId('rifle-leave-yes').click();
    await page.waitForURL(/\/rifle$/);
    await expect(page.getByTestId('rifle-line')).toContainText('ноль 100 м');
  });

  test('печать: видны шапка и таблица, нет навигации и кнопок; «Картинкой» в вебе скачивает dope-*.png', async ({ page }) => {
    await seed(page);
    await page.goto('/rifle');
    await createFromPreset(page);
    await page.getByTestId('rifle-save').click();
    await page.getByTestId('rifle-dope').click();
    await expect(page.getByTestId('rifle-dope-row')).toHaveCount(20);
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('rifle-image').click();
    expect((await downloadPromise).suggestedFilename()).toBe('dope-Моя-.308-·-175-гр.png');
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('rifle-dope-title')).toBeVisible();
    await expect(page.getByTestId('rifle-dope-row').first()).toBeVisible();
    await expect(page.getByTestId('rifle-dope-back')).toBeHidden();
    await expect(page.getByTestId('rifle-print')).toBeHidden();
  });

  test('касания ≥ 44 и без горизонтальной прокрутки в списке, редакторе и карточке', async ({ page }) => {
    await seed(page);
    await page.goto('/rifle');
    await createFromPreset(page);
    await expectTouchTargets(page, '[data-test="rifle-editor"] button, [data-test="rifle-editor"] input');
    await expectNoHorizontalScroll(page);
    await page.getByTestId('rifle-save').click();
    await expectTouchTargets(page, '[data-test="rifle-page"] button, [data-test="rifle-page"] a');
    await expectNoHorizontalScroll(page);
    await page.getByTestId('rifle-dope').click();
    await expectTouchTargets(page, '[data-test="rifle-dope-page"] button, [data-test="rifle-dope-page"] a');
  });
});
