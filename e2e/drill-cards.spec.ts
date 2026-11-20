import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const MIN_TOUCH_PX = 44;
const ROUND_CARDS = 10;
const WRONG_DISTANCE = '100';

async function seed(page: Page): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, series: [], settings: QUIET_SETTINGS });
}

async function millingDistance(page: Page): Promise<string> {
  const conditions = (await page.getByTestId('drill-conditions').textContent()) ?? '';
  const [, size, reticleMil] = /^Цель (\d+(?:,\d+)?) м · (\d+(?:,\d+)?) MIL по сетке$/.exec(conditions.trim())!;
  const asNumber = (value: string) => Number(value.replace(',', '.'));
  return String(Math.round((asNumber(size) * 1000) / asNumber(reticleMil)));
}

async function answerMilling(page: Page, distance: string): Promise<void> {
  await page.getByTestId('slot-0').click();
  await page.getByTestId('chip-target-size').click();
  await page.getByTestId('chip-reticle-mil').click();
  await page.getByTestId('tape-0').click();
  for (const key of distance) {
    await page.getByTestId(`key-${key}`).click();
  }
  await page.getByTestId('calc-record').click();
}

async function expectTouchable(page: Page, testId: string): Promise<void> {
  const box = (await page.getByTestId(testId).boundingBox())!;
  expect(box.height, testId).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
}

test.describe('счётные карточки (T3.2)', () => {
  test('главная → «Дрилы» → список из 6 счётных → миллинг: карточка 1 из 10 с условиями', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('tile-drills').click();
    await expect(page.getByTestId('drill-list')).toBeVisible();
    await expect(page.locator('.drill')).toHaveCount(6);
    await expect(page.getByTestId('drill-item-milling')).toContainText('учат в упражнении 05');
    await expectTouchable(page, 'drill-item-milling');
    await page.getByTestId('drill-item-milling').click();
    await expect(page.getByTestId('calc-title')).toHaveText('Карточка 1 из 10');
    await expect(page.getByTestId('drill-conditions')).toHaveText(/^Цель .* MIL по сетке$/);
    await expect(page.getByTestId('calc-back')).toHaveCount(0);
    await expect(page.getByTestId('calc-mode')).toHaveCount(0);
  });

  test('миллинг: верно → «ТОЧНО», неверно → «ОШИБКА» с главной ошибкой; 10 карточек → итог; «ЕЩЁ РАЗ ТЕ ЖЕ» — те же числа', async ({ page }) => {
    test.slow();
    await seed(page);
    await page.goto('/drill/milling');
    const firstConditions = await page.getByTestId('drill-conditions').textContent();
    for (let card = 1; card <= ROUND_CARDS; card++) {
      await expect(page.getByTestId('calc-title')).toHaveText(`Карточка ${card} из ${ROUND_CARDS}`);
      const isWrong = card === 2;
      await answerMilling(page, isWrong ? WRONG_DISTANCE : await millingDistance(page));
      await expect(page.getByTestId('check-stamp')).toHaveText(isWrong ? 'ОШИБКА' : 'ТОЧНО');
      if (isWrong) {
        await expect(page.getByTestId('check-main-error')).toBeVisible();
      }
      await expect(page.getByTestId('check-points')).toHaveCount(0);
      await expectTouchable(page, 'drill-next');
      await page.getByTestId('drill-next').click();
    }
    await expect(page.getByTestId('drill-summary-counts')).toHaveText('9 точно · 0 близко · 1 ошибка');
    await expect(page.getByTestId('drill-summary-accuracy')).toHaveText('Точность 90 %');
    await expect(page.getByTestId('drill-summary-time')).toHaveText(/^В среднем \d+ с на карточку$/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('CapacitorStorage.or.progress.v2') ?? '{}'));
    expect(stored.drillRounds).toHaveLength(1);
    expect(stored.drillRounds[0].cards).toHaveLength(ROUND_CARDS);
    await page.getByTestId('drill-same').click();
    await expect(page.getByTestId('calc-title')).toHaveText(`Карточка 1 из ${ROUND_CARDS}`);
    await expect(page.getByTestId('drill-conditions')).toHaveText(firstConditions!);
  });

  test('дрил на позиции или неизвестный по адресу карточек → список', async ({ page }) => {
    await seed(page);
    await page.goto('/drill/patrol');
    await expect(page.getByTestId('drill-list')).toBeVisible();
  });
});
