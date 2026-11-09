import { expect, Page } from '@playwright/test';
import { ptPerMil } from '../src/sim/scope-model';
import { INITIAL_AIM_MIL } from '../src/sim/scope-session';

const DEFAULT_MAGNIFICATION = 8;
const CLICK_MIL = 0.1;

export const PROGRESS_KEY = 'CapacitorStorage.or.progress.v1';

export async function seedProgress(page: Page, progress: object): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('or-seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('or-seeded', '1');
      }
    },
    [PROGRESS_KEY, JSON.stringify(progress)] as const,
  );
}

export async function unlockEverything(page: Page, settings: object = {}): Promise<void> {
  await seedProgress(page, {
    results: {},
    shots: [],
    settings: { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true, ...settings },
  });
}

const SPEED_STEPS_PER_MPS = 10;
const SPEED_STEPS_PER_PAGE = 10;

export async function setWindSpeed(page: Page, speedMps: number): Promise<void> {
  const wheel = page.getByTestId('speed-wheel');
  const current = Number(await wheel.getAttribute('aria-valuenow'));
  const steps = Math.round((speedMps - current) * SPEED_STEPS_PER_MPS);
  await wheel.focus();
  for (let page10 = 0; page10 < Math.floor(Math.abs(steps) / SPEED_STEPS_PER_PAGE); page10++) {
    await page.keyboard.press(steps > 0 ? 'PageUp' : 'PageDown');
  }
  for (let single = 0; single < Math.abs(steps) % SPEED_STEPS_PER_PAGE; single++) {
    await page.keyboard.press(steps > 0 ? 'ArrowUp' : 'ArrowDown');
  }
  await expect(wheel).toHaveAttribute('aria-valuenow', String(speedMps));
}

export async function enterTotalOnTurrets(page: Page): Promise<void> {
  await page.getByTestId('tile-notebook').click();
  await page.getByTestId('enter-turrets').click();
  await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);
}

export async function clicksToTarget(page: Page): Promise<number> {
  const counter = await page.locator('[data-test="drum-elevation"] [data-test="drum-counter"]').textContent();
  return Number(/ещё (\d+)/.exec(counter ?? '')![1]);
}

export async function dialElevation(page: Page, clicks: number): Promise<void> {
  for (let click = 0; click < clicks; click++) {
    await page.getByTestId('elevation-plus').click();
  }
}

export async function centreReticle(page: Page, dialledClicks: number): Promise<void> {
  await page.getByTestId('glass').click({ trial: true });
  const glass = (await page.getByTestId('glass').boundingBox())!;
  const scale = ptPerMil(DEFAULT_MAGNIFICATION) * (glass.width / 276);
  const startX = glass.x + glass.width / 2;
  const startY = glass.y + glass.height / 2;
  const aimUpMil = INITIAL_AIM_MIL.y - dialledClicks * CLICK_MIL;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + INITIAL_AIM_MIL.x * scale, startY - aimUpMil * scale, { steps: 10 });
  await page.mouse.up();
}

