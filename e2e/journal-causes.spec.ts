import { expect, Page, test } from '@playwright/test';
import { dialElevation, enterTotalOnTurrets, PROGRESS_KEY, PROGRESS_V1_KEY, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const OVERDIAL_CLICKS = 8;

const V1_PROGRESS = {
  course: { isIntroCompleted: true, bestClasses: { '04': 2 } },
  settings: QUIET_SETTINGS,
  series: [
    {
      id: 'old-04',
      startedAtIso: '2026-11-09T14:05:00.000Z',
      kind: 'exercise',
      exerciseId: '04',
      title: 'Флажок на бруствере',
      mode: 'auto',
      cartridgeIds: ['B'],
      exerciseClass: 2,
      total: 25,
      isInterrupted: false,
      shots: [{ distanceM: 300, isHit: false, isFirstAtTarget: true, mainCause: 'wind-under', errorTypes: [], windSpeedMps: 2.2, mode: 'auto' }],
    },
  ],
};

function storedProgress(page: Page, key: string) {
  return page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey) ?? 'null'), key);
}

test.describe('журнал с величинами причин (T2.3)', () => {
  test('в хранилище только v1 → журнал и курс на месте, записан v2, v1 не тронут', async ({ page }) => {
    await seedProgress(page, V1_PROGRESS, PROGRESS_V1_KEY);
    await page.goto('/journal');
    await expect(page.getByTestId('journal-series-0')).toContainText('04 · Флажок на бруствере');
    await page.getByTestId('journal-series-0').click();
    await expect(page.getByTestId('journal-shot').first()).toHaveText('1 · 300 м · ✕ · недооценка ветра');
    const v2 = await storedProgress(page, PROGRESS_KEY);
    expect([v2.version, v2.series.length, v2.course.bestClasses]).toEqual([2, 1, { '04': 2 }]);
    expect(await storedProgress(page, PROGRESS_V1_KEY)).toEqual(V1_PROGRESS);
  });

  test('перекрутил барабан в 01 → в ленте главная причина с MIL, она же во вкладке «Ошибки», накрутка — один раз как «БАРАБАН»; в v2 у выстрела накрутка с величиной', async ({ page }) => {
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS });
    await page.goto('/position/01');
    await expect(page.getByTestId('fire')).toBeVisible();
    await enterTotalOnTurrets(page);
    await dialElevation(page, OVERDIAL_CLICKS);
    await page.getByTestId('fire').click();
    await page.getByTestId('review-next').click();
    await page.getByTestId('position-back').click();
    await page.getByTestId('leave-confirm-yes').click();
    await page.goto('/journal');
    await page.getByTestId('journal-series-0').click();
    const shotLine = page.getByTestId('journal-shot').first();
    await expect(shotLine).toHaveText(/^1 · 300 м · ✕ · .+, \d,\d MIL$/);
    const mainName = /✕ · (.+), \d,\d MIL$/.exec((await shotLine.textContent())!)![1];
    await page.getByTestId('journal-tab-errors').click();
    const errorRow = (label: string) => page.getByTestId('journal-error').filter({ has: page.getByRole('button', { name: label, exact: true }) });
    await expect(errorRow(mainName)).toContainText('1 · 01');
    await expect(errorRow('БАРАБАН')).toContainText('1 · 01');
    await expect(errorRow('Барабаны')).toHaveCount(0);
    const [stored] = (await storedProgress(page, PROGRESS_KEY)).series[0].shots;
    expect(stored.clickMil).toBe(0.1);
    const turret = stored.causes.find((cause: { kind: string }) => cause.kind === 'turret');
    expect(turret.mil).toBeGreaterThanOrEqual(stored.clickMil);
  });
});
