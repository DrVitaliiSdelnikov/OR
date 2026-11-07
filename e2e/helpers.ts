import { Page } from '@playwright/test';

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

export async function startFreePlay(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('tile-free').click();
  await page.waitForURL('**/weather');
}
