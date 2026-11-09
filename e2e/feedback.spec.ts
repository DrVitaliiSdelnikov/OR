import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const SELECTION_MS = 70;
const LIGHT_MS = 20;
const MEDIUM_MS = 43;

declare global {
  interface Window {
    vibrations: number[][];
    sounds: number;
  }
}

async function spyOnFeedback(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.vibrations = [];
    window.sounds = 0;
    navigator.vibrate = (pattern: VibratePattern) => {
      window.vibrations.push(Array.isArray(pattern) ? [...pattern] : [pattern]);
      return true;
    };
    for (const method of ['createOscillator', 'createBufferSource'] as const) {
      const original = AudioContext.prototype[method];
      (AudioContext.prototype as unknown as Record<string, unknown>)[method] = function (this: AudioContext) {
        window.sounds++;
        return (original as () => AudioNode).call(this);
      };
    }
  });
}

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await spyOnFeedback(page);
  await seedProgress(page, {
    course: { isIntroCompleted: true, bestClasses: {} },
    shots: [],
    settings: { isSoundOn: true, isHapticsOn: true, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true },
  });
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
}

const vibrations = (page: Page) => page.evaluate(() => window.vibrations.map(pattern => pattern[0]));
const sounds = (page: Page) => page.evaluate(() => window.sounds);

async function clearSpies(page: Page): Promise<void> {
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.vibrations = [];
    window.sounds = 0;
  });
}

async function pointClockAt(page: Page, clock: number): Promise<void> {
  const dial = (await page.getByTestId('wind-clock').boundingBox())!;
  const scale = dial.width / 260;
  const angle = (clock / 12) * 2 * Math.PI;
  await page.mouse.click(dial.x + 130 * scale + Math.sin(angle) * 70 * scale, dial.y + 140 * scale - Math.cos(angle) * 70 * scale);
}

test.describe('звук и вибрация (A4)', () => {
  test.skip(({ browserName }) => browserName === 'webkit', 'в WebKit нет navigator.vibrate');

  test('клик «+» барабана — тик пикера (selection), а не толчок; один звук, без щелчка кнопки', async ({ page }) => {
    await toPosition(page, '01');
    await clearSpies(page);
    await page.getByTestId('elevation-plus').click();
    await expect.poll(() => vibrations(page)).toEqual([SELECTION_MS]);
    expect(await sounds(page)).toBe(1);
  });

  test('упор ZERO STOP — толчок medium', async ({ page }) => {
    await toPosition(page, '01');
    await clearSpies(page);
    await page.getByTestId('elevation-minus').click();
    await expect.poll(() => vibrations(page)).toEqual([MEDIUM_MS]);
    expect(await vibrations(page)).not.toContain(LIGHT_MS);
  });

  test('кратность «+» — тик selection', async ({ page }) => {
    await toPosition(page, '01');
    await clearSpies(page);
    await page.getByTestId('zoom-in').click();
    await expect.poll(() => vibrations(page)).toEqual([SELECTION_MS]);
    expect(await sounds(page)).toBe(1);
  });

  test('«часы» ветра: каждый новый получас — тик; колесо скорости «+» — тик', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('wind-tile').click();
    await expect(page.getByTestId('wind-clock')).toBeVisible();
    await clearSpies(page);
    for (const clock of [3, 4, 5]) {
      await pointClockAt(page, clock);
    }
    await expect.poll(() => vibrations(page)).toEqual([SELECTION_MS, SELECTION_MS, SELECTION_MS]);
    await clearSpies(page);
    await page.getByTestId('speed-plus').click();
    await expect.poll(() => vibrations(page)).toEqual([SELECTION_MS]);
  });

  test('кнопка «Блокнот» — щелчок кнопки и щелчок шторки', async ({ page }) => {
    await toPosition(page, '01');
    await clearSpies(page);
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('notebook-sheet')).toBeVisible();
    await expect.poll(() => sounds(page)).toBe(2);
    expect(await vibrations(page)).toEqual([]);
  });
});
