import { expect, Page, test } from '@playwright/test';
import { PROGRESS_KEY, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isTapTrigger: true };
const CARD_LIMIT_MS = 30_000;
const SHOT_LIMIT_MS = 90_000;

async function seed(page: Page, isEverythingUnlocked: boolean): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, series: [], settings: { ...QUIET_SETTINGS, isEverythingUnlocked } });
}

async function stored(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_KEY);
}

test.describe('дрилы на позиции и таймер (T3.3)', () => {
  test('список: 6 счётных и 5 на позиции; «на время» закрыт с условием', async ({ page }) => {
    await seed(page, false);
    await page.goto('/drills');
    await expect(page.locator('.drill')).toHaveCount(11);
    await expect(page.getByTestId('drill-item-patrol')).toBeVisible();
    await expect(page.getByTestId('drill-timed-wind')).toHaveText('НА ВРЕМЯ · 2 раунда ≥ 80 %');
    await expect(page.getByTestId('drill-timed-wind')).not.toHaveAttribute('href');
  });

  test('с «Открыть всё» «на время» открыт и ведёт на уровень', async ({ page }) => {
    await seed(page, true);
    await page.goto('/drills');
    await expect(page.getByTestId('drill-timed-wind')).toHaveText('НА ВРЕМЯ');
    await expect(page.getByTestId('drill-timed-wind')).toHaveAttribute('href', '/drill/wind?level=timed');
  });

  test('холодный выстрел: позиция, один выстрел, разбор → итог серии; серия в журнале и в раундах дрилов', async ({ page }) => {
    await seed(page, false);
    await page.goto('/drills');
    await page.getByTestId('drill-item-cold-bore').click();
    await expect(page.getByTestId('position-title')).toHaveText('Холодный выстрел');
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible();
    await page.getByTestId('review-next').click();
    await expect(page.getByTestId('drill-end')).toBeVisible();
    await expect(page.getByTestId('drill-summary-counts')).toHaveText(/^[01] попадани\S* из 1$/);
    const progress = await stored(page);
    expect(progress.series).toHaveLength(1);
    expect(progress.drillRounds).toHaveLength(1);
    expect(progress.drillRounds[0]).toMatchObject({ drillId: 'cold-bore', level: 'learn' });
    await page.getByTestId('drill-exit').click();
    await expect(page.getByTestId('drill-list')).toBeVisible();
  });

  test('карточка на время: только число и сторона, отсчёт 30 с; время вышло — «ВРЕМЯ ВЫШЛО» и ответ', async ({ page }) => {
    await page.clock.install();
    await seed(page, true);
    await page.goto('/drill/wind?level=timed');
    await expect(page.getByTestId('drill-answer')).toBeVisible();
    await expect(page.getByTestId('slot-0')).toHaveCount(0);
    await expect(page.getByTestId('drill-timer')).toHaveText('30 с');
    await page.clock.fastForward(CARD_LIMIT_MS + 1000);
    await expect(page.getByTestId('drill-timed-out')).toContainText('ВРЕМЯ ВЫШЛО');
    await expect(page.getByTestId('drill-reference')).toHaveText(/^Ответ: [←→] \d/);
    await page.getByTestId('drill-next').click();
    await expect(page.getByTestId('calc-title')).toHaveText('Карточка 2 из 10');
  });

  test('выстрел на время: отсчёт 90 с; время вышло — промах «время», итог серии', async ({ page }) => {
    await page.clock.install();
    await seed(page, true);
    await page.goto('/position/drill-cold-bore?level=timed');
    await expect(page.getByTestId('drill-timer')).toHaveText(/^(90|89) с$/);
    await page.clock.fastForward(SHOT_LIMIT_MS + 1000);
    await expect(page.getByTestId('drill-end')).toBeVisible();
    await expect(page.getByTestId('drill-summary-errors')).toContainText('ВРЕМЯ ×1');
    const progress = await stored(page);
    expect(progress.drillRounds[0]).toMatchObject({ drillId: 'cold-bore', level: 'timed' });
  });

  test('на время разбор между выстрелами не открывается: после выстрела — сразу итог серии', async ({ page }) => {
    await seed(page, true);
    await page.goto('/position/drill-cold-bore?level=timed');
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('drill-end')).toBeVisible();
    await expect(page.getByTestId('review-sheet')).toHaveCount(0);
  });
});
