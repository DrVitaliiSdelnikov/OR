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
    settings: { theme: 'field', isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true, ...settings },
  });
}

export async function openTaskList(page: Page): Promise<void> {
  await page.goto('/tabs/hub');
  await ensureTaskListOpen(page);
}

export async function ensureTaskListOpen(page: Page): Promise<void> {
  await page.waitForURL('**/tabs/hub');
  const card = page.getByTestId('tasks-card');
  await card.waitFor();
  if ((await card.getAttribute('aria-expanded')) !== 'true') {
    await card.click();
  }
  await page.getByTestId('task-list').waitFor();
}

export async function startShootTask(page: Page, taskId: string): Promise<void> {
  await openTaskList(page);
  await page.getByTestId(`task-${taskId}`).click();
  await page.waitForURL('**/weather');
}
