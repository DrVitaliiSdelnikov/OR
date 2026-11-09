import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, enterTotalOnTurrets, positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const MIN_TOUCH_PX = 44;
const SHOT_SETTLE_MS = 1200;

async function seed(page: Page, bestClasses: Record<string, number> = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, shots: [], settings: QUIET_SETTINGS });
}

async function shootCleanSeriesOf01(page: Page): Promise<void> {
  await seed(page);
  await positionFromBriefing(page, '01');
  await expect(page.getByTestId('fire')).toBeVisible();
  await enterTotalOnTurrets(page);
  const clicks = await clicksToTarget(page);
  await dialElevation(page, clicks);
  await centreReticle(page, clicks);
  for (let shot = 0; shot < 3; shot++) {
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible();
    await page.getByTestId('review-next').click();
    await page.waitForTimeout(SHOT_SETTLE_MS);
  }
  await expect(page.getByTestId('result-sheet')).toBeVisible();
}

test.describe('итог упражнения и брифинг (A6.3)', () => {
  test('01 зачтено впервые: штамп, три строки классов, очки, мишень, главная ошибка, новые термины; «ДАЛЬШЕ» — тропа с открытым 02', async ({ page }) => {
    test.slow();
    await shootCleanSeriesOf01(page);
    await expect(page.getByTestId('result-stamp')).toHaveText(/^[123] КЛАСС$/);
    await expect(page.getByTestId('result-class-0')).toContainText('3 класс');
    await expect(page.getByTestId('result-class-1')).toContainText('накрутка ровно по итогу');
    await expect(page.getByTestId('result-class-2')).toContainText('все первым');
    await expect(page.getByTestId('result-score')).toHaveText(/^цели \d+ \+ расчёт \d+ = \d+$/);
    await expect(page.getByTestId('result-record')).toHaveText('новый рекорд');
    await expect(page.getByTestId('scheme-group-point')).toHaveCount(3);
    await expect(page.getByTestId('result-group')).not.toBeEmpty();
    await expect(page.getByTestId('result-main-error')).not.toBeEmpty();
    await expect(page.getByTestId('result-term')).toHaveCount(6);
    await expect(page.getByTestId('result-term').last()).toBeVisible();
    await expect(page.getByTestId('result-opened')).toHaveText('Открыто: 02 · Ноль и холодный ствол');
    await page.getByTestId('result-next').click();
    await page.waitForURL('**/course');
    await expect(page.getByTestId('node-02')).toBeEnabled();
  });

  test('«ПОВТОРИТЬ» — брифинг этого упражнения: лучший результат вместо «Нового»', async ({ page }) => {
    await shootCleanSeriesOf01(page);
    await page.getByTestId('result-repeat').click();
    await page.waitForURL('**/course/01');
    await expect(page.getByTestId('briefing-best')).toHaveText(/^лучший: [123] класс · \d+ очк\.$/);
    await expect(page.getByTestId('briefing-novelty')).toHaveCount(0);
  });

  test('брифинг 04: шапка, схема с флажком, зачёт трёх классов, режим, «Новое»; «НА ПОЗИЦИЮ» видна без прокрутки', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3, '03': 3 });
    await page.goto('/course/04');
    await expect(page.getByTestId('briefing-header')).toHaveText('ЗАДАНИЕ 04 · УЧЕБНОЕ');
    await expect(page.getByTestId('sheet-title')).toHaveText('Флажок на бруствере');
    await expect(page.getByTestId('briefing-flag')).toBeVisible();
    await expect(page.getByTestId('briefing-distance')).toHaveText('300 м');
    await expect(page.getByTestId('briefing-class-1')).toHaveText('2 класс — 85 % и скорость перенесена без ошибки');
    await expect(page.getByTestId('sheet-mode')).toHaveText('АВТО × 1.0');
    await expect(page.getByTestId('briefing-novelty')).toHaveText('Новое: ветер, метеостанция, флажок у бруствера');
    await expect(page.getByTestId('sheet-terms')).toContainText('узнаешь: ветер');
    await expect(page.getByTestId('to-position')).toBeInViewport();
    await page.getByTestId('to-position').click();
    await page.waitForURL('**/position/04');
  });

  test('касание не меньше 44 на итоге и брифинге', async ({ page }) => {
    await shootCleanSeriesOf01(page);
    for (const id of ['result-next', 'result-repeat', 'result-journal']) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
    await page.getByTestId('result-journal').click();
    await page.waitForURL('**/journal');
    await page.goto('/course/01');
    for (const id of ['sheet-back', 'to-position']) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});
