import { expect, Page, test, TestInfo } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const SW_READY_TIMEOUT_MS = 40_000;

function isProductionBuild(testInfo: TestInfo): boolean {
  const webServer = testInfo.config.webServer;
  return (Array.isArray(webServer) ? webServer : [webServer]).some(server => server?.command.includes('ng build'));
}

async function waitForOfflineCache(page: Page): Promise<void> {
  const manifest = (await (await page.request.get('/ngsw.json')).json()) as { assetGroups: { name: string; urls: string[] }[] };
  const groups = manifest.assetGroups.map(group => ({ name: group.name, urls: group.urls }));
  await page.waitForFunction(
    async expectedGroups => {
      if (navigator.serviceWorker.controller === null) {
        return false;
      }
      const driverState = await (await fetch('ngsw/state')).text();
      if (!driverState.includes('Driver state: NORMAL') || !driverState.includes('=== Version ')) {
        return false;
      }
      const cacheNames = await caches.keys();
      for (const group of expectedGroups) {
        const cacheName = cacheNames.find(name => name.endsWith(`:assets:${group.name}:cache`));
        if (!cacheName) {
          return false;
        }
        const cache = await caches.open(cacheName);
        for (const url of group.urls) {
          if (!(await cache.match(new URL(url, location.origin).href))) {
            return false;
          }
        }
      }
      return true;
    },
    groups,
    { timeout: SW_READY_TIMEOUT_MS, polling: 500 },
  );
}

test.describe('офлайн-демо (T5.4)', () => {
  test.use({ serviceWorkers: 'allow' });

  test('после первого визита без сети открываются главный, глубокая ссылка и картинки сцены', async ({ page, context, browserName }, testInfo) => {
    test.slow();
    test.skip(!isProductionBuild(testInfo), 'service worker есть только в продакшен-сборке');
    test.skip(browserName === 'webkit', 'Playwright WebKit без сети не отдаёт навигацию через service worker');
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: QUIET_SETTINGS });
    await page.goto('/');
    await expect(page.getByTestId('tile-drills')).toBeVisible();
    await page.reload();
    await waitForOfflineCache(page);

    await context.setOffline(true);
    await page.goto('/');
    await expect(page.getByTestId('tile-drills')).toBeVisible();
    await page.goto('/course/04');
    await expect(page.getByTestId('briefing-card')).toBeVisible();
    const berm = await page.evaluate(async () => (await fetch('scene/berm.webp')).status);
    expect(berm).toBe(200);
  });
});
