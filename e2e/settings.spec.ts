import { expect, Page, test } from '@playwright/test';
import { positionFromBriefing, seedProgress } from './helpers';

const BASE_SETTINGS = { isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true, volume: 0 };
const SHOT_TIMEOUT_MS = 25_000;
const PROGRESS_KEY = 'CapacitorStorage.or.progress.v1';
const SLOW_STEP_PX = 4;
const SLOW_STEP_MS = 40;

declare global {
  interface Window {
    vibrations: number[][];
    sounds: number;
  }
}

async function seed(page: Page, settings: object = {}, extra: object = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: { '01': 3, '02': 3 } }, series: [], settings: { ...BASE_SETTINGS, ...settings }, ...extra });
}

async function patchSettings(page: Page, patch: object): Promise<void> {
  await page.evaluate(([key, settingsPatch]) => {
    const stored = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...stored, settings: { ...stored.settings, ...settingsPatch } }));
  }, [PROGRESS_KEY, patch] as const);
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

async function dragElevationSlowly(page: Page, distancePx: number): Promise<void> {
  const tapeLocator = page.locator('[data-test="drum-elevation"] [data-test="drum-tape"]');
  await tapeLocator.click({ trial: true });
  const tape = (await tapeLocator.boundingBox())!;
  const startX = tape.x + 20;
  const y = tape.y + tape.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let moved = SLOW_STEP_PX; moved <= distancePx; moved += SLOW_STEP_PX) {
    await page.mouse.move(startX + moved, y);
    await page.waitForTimeout(SLOW_STEP_MS);
  }
  await page.waitForTimeout(SLOW_STEP_MS * 3);
  await page.mouse.up();
}

test.describe('настройки (A7.4)', () => {
  test('шестерёнка → четыре группы и версия; выбор сохраняется после перезагрузки', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('open-settings').click();
    for (const group of ['sound', 'control', 'access', 'data']) {
      await expect(page.getByTestId(`settings-group-${group}`)).toBeVisible();
    }
    await expect(page.getByTestId('settings-version')).toHaveText('версия 0.1.0');
    await page.getByTestId('settings-volume').fill('6');
    await expect(page.getByTestId('settings-volume-value')).toHaveText('6 / 10');
    await page.getByTestId('toggle-isLeftHanded').click();
    await expect(page.getByTestId('hand-scheme')).toHaveText(/ОГОНЬ\s*ДЕРЖАТЬ/);
    await page.getByTestId('drum-sensitivity-8').click();
    await page.reload();
    await expect(page.getByTestId('settings-volume-value')).toHaveText('6 / 10');
    await expect(page.getByTestId('toggle-isLeftHanded')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('drum-sensitivity-8')).toHaveAttribute('aria-pressed', 'true');
  });

  test('левша: в позиции «ОГОНЬ» слева от «ДЕРЖАТЬ»', async ({ page }) => {
    await seed(page, { isLeftHanded: true });
    await page.goto('/position/03');
    const fire = (await page.getByTestId('fire').boundingBox())!;
    const hold = (await page.getByTestId('hold').boundingBox())!;
    expect(fire.x + fire.width).toBeLessThan(hold.x);
  });

  test('спуск тапом: в упр. 03 выстрел по тапу; в журнале у серии «спуск тапом»', async ({ page }) => {
    await seed(page, { isTapTrigger: true });
    await positionFromBriefing(page, '03');
    await expect(page.getByTestId('pressure')).toHaveCount(0);
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible({ timeout: SHOT_TIMEOUT_MS });
    await page.getByTestId('review-next').click();
    await page.getByTestId('position-back').click();
    await page.getByTestId('leave-confirm-yes').click();
    await page.goto('/journal');
    await expect(page.getByTestId('journal-series-0')).toContainText('спуск тапом');
  });

  test('сброс: «Отмена» — журнал на месте; «Сбросить» — курс и журнал пусты, настройки целы', async ({ page }) => {
    const series = {
      id: 's1', startedAtIso: '2026-11-09T10:00:00.000Z', kind: 'exercise', exerciseId: '01', title: 'Первые щелчки', mode: 'auto',
      cartridgeIds: ['B'], exerciseClass: 3, total: 50, isInterrupted: false, shots: [{ distanceM: 300, isHit: true, isFirstAtTarget: true, mainCause: null, errorTypes: [], windSpeedMps: 0, mode: 'auto' }],
    };
    await seed(page, { isLeftHanded: true }, { series: [series] });
    await page.goto('/settings');
    await page.getByTestId('reset-progress').click();
    await expect(page.getByTestId('reset-confirm')).toContainText('Сбросить курс, журнал и карточки? Это не отменить');
    await page.getByTestId('reset-cancel').click();
    await expect(page.getByTestId('reset-confirm')).toHaveCount(0);
    await page.goto('/journal');
    await expect(page.getByTestId('journal-series-0')).toContainText('Первые щелчки');
    await page.goto('/settings');
    await page.getByTestId('reset-progress').click();
    await page.getByTestId('reset-yes').click();
    await page.goto('/journal');
    await expect(page.getByTestId('journal-empty')).toBeVisible();
    await page.goto('/settings');
    await expect(page.getByTestId('toggle-isLeftHanded')).toHaveAttribute('aria-checked', 'true');
  });

  test('чувствительность: протяжка на 48 pt — 4 клика обычно, 6 кликов «быстро»', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    for (const [ptPerClick, clicks] of [[12, 4], [8, 6]]) {
      await patchSettings(page, { drumPtPerClick: ptPerClick });
      await page.goto('/position/01');
      await dragElevationSlowly(page, 48);
      const tape = page.locator('[data-test="drum-elevation"] [data-test="drum-tape"]');
      await expect.poll(async () => Number(await tape.getAttribute('aria-valuenow'))).toBe(clicks);
    }
  });

  test('крупный текст: текст крупнее, горизонтальной прокрутки нет ни на одном экране', async ({ page }) => {
    await seed(page, { isTextLarge: true });
    for (const path of ['/', '/course', '/course/03', '/position/03', '/free', '/journal', '/textbook', '/settings']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
      await page.waitForTimeout(300);
      const overflowPx = await page.evaluate(() => {
        const scrollers = [document.documentElement, ...[...document.querySelectorAll('ion-content')].map(content => content.shadowRoot?.querySelector('.inner-scroll') as HTMLElement | null)];
        return Math.max(...scrollers.filter((element): element is HTMLElement => element !== null).map(element => element.scrollWidth - element.clientWidth));
      });
      expect(overflowPx, path).toBeLessThanOrEqual(0);
    }
    await page.goto('/settings');
    await expect(page.getByTestId('settings-version')).toHaveCSS('font-size', '15px');
  });

  test('старое «звук выкл» — громкость 0, выстрел без звука', async ({ page }) => {
    await spyOnFeedback(page);
    await seed(page, { volume: undefined, isSoundOn: false, isHapticsOn: true });
    await page.goto('/position/01');
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible({ timeout: SHOT_TIMEOUT_MS });
    expect(await page.evaluate(() => window.sounds)).toBe(0);
  });

  test('щелчки барабанов выкл — клик барабана без звука, с вибрацией', async ({ page }) => {
    await spyOnFeedback(page);
    await seed(page, { volume: 1, isHapticsOn: true, isDrumClicksOn: false });
    await page.goto('/position/01');
    await page.getByTestId('elevation-plus').waitFor();
    await page.evaluate(() => {
      window.sounds = 0;
      window.vibrations = [];
    });
    await page.getByTestId('elevation-plus').click();
    await expect.poll(() => page.evaluate(() => window.vibrations.length)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.sounds)).toBe(0);
  });
});
