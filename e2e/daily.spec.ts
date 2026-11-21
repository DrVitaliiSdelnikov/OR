import { Browser, expect, Page, test } from '@playwright/test';
import { PROGRESS_KEY, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const MILLING_DAY = new Date('2026-11-25T12:00:00.000Z');
const POSITION_DAY = new Date('2026-11-22T12:00:00.000Z');
const ROUND_CARDS = 10;

async function seedAt(page: Page, now: Date): Promise<void> {
  await page.clock.setFixedTime(now);
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (copied: string) => Promise.resolve(void ((window as unknown as { copiedText: string }).copiedText = copied)) }, configurable: true });
  });
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

async function firstCardOnNewDevice(browser: Browser): Promise<string> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await seedAt(page, MILLING_DAY);
  await page.goto('/drill/milling?daily=on');
  const conditions = (await page.getByTestId('drill-conditions').textContent()) ?? '';
  await context.close();
  return conditions;
}

test.describe('задание дня (T5.1)', () => {
  test('одна дата — одно задание на двух устройствах', async ({ browser }) => {
    const [first, second] = [await firstCardOnNewDevice(browser), await firstCardOnNewDevice(browser)];
    expect(first).toMatch(/^Цель .* MIL по сетке$/);
    expect(second).toBe(first);
  });

  test('карточный день: плитка → экран → 10 карточек → зачёт, серия, «Поделиться» копирует; плитка «сделано»', async ({ page }) => {
    test.slow();
    await seedAt(page, MILLING_DAY);
    await page.goto('/');
    await expect(page.getByTestId('tile-daily-note')).toHaveText('новое');
    await page.getByTestId('tile-daily').click();
    await expect(page.getByTestId('daily-task')).toHaveText('Миллинг · 10 карточек');
    await expect(page.getByTestId('daily-date')).toHaveText('на 25.11 · одно на всех');
    await page.getByTestId('daily-start').click();
    await page.waitForURL('**/drill/milling?daily=on');
    for (let card = 1; card <= ROUND_CARDS; card++) {
      await expect(page.getByTestId('calc-title')).toHaveText(`Карточка ${card} из ${ROUND_CARDS}`);
      await answerMilling(page, await millingDistance(page));
      await page.getByTestId('drill-next').click();
    }
    await expect(page.getByTestId('drill-exit')).toHaveText('К заданию дня');
    await page.getByTestId('drill-exit').click();
    await expect(page.getByTestId('daily-result-line')).toHaveText('10 из 10');
    await expect(page.getByTestId('daily-streak')).toHaveText('серия 1 день');
    await expect(page.getByTestId('daily-start')).toHaveText('Ещё раз · без зачёта');
    await page.getByTestId('daily-share').click();
    await expect(page.getByTestId('daily-share')).toHaveText('Скопировано');
    expect(await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText)).toBe('Огневой рубеж · 25.11 · Миллинг · 10 из 10');
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}'), PROGRESS_KEY);
    expect(stored.daily).toEqual([{ dateKey: '2026-11-25', kind: 'cards', drillId: 'milling', hits: 10, total: 10, windErrorMil: null }]);
    await page.goto('/');
    await expect(page.getByTestId('tile-daily-note')).toHaveText('сделано · серия 1');
  });

  test('день на позиции: 3 гонга в САМ, «Начать» ведёт на позицию дня', async ({ page }) => {
    await seedAt(page, POSITION_DAY);
    await page.goto('/daily');
    await expect(page.getByTestId('daily-task')).toHaveText('3 гонга · САМ лёгкий · 1 выстрел на цель');
    await page.getByTestId('daily-start').click();
    await page.waitForURL('**/position/daily');
    await expect(page.getByTestId('position-title')).toHaveText('Задание дня');
  });
});
