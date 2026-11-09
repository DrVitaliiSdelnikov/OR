import { chromium, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:4310';
const OUTPUT_DIR = process.argv[2] ?? 'docs/design/screens';
const PROGRESS_KEY = 'CapacitorStorage.or.progress.v1';
const MAGNIFICATIONS = [3, 8, 12];

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      PROGRESS_KEY,
      JSON.stringify({
        course: { isIntroCompleted: true, bestClasses: {} },
        shots: [],
        settings: { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: false, isMarkerDriftOff: true, isEverythingUnlocked: true },
      }),
    ] as const,
  );
}

async function setMagnification(page: Page, magnification: number): Promise<void> {
  const shown = page.locator('[data-test="magnification"]');
  for (let step = 0; step < 30; step++) {
    const current = Number((await shown.textContent())!.replace(/\D/g, ''));
    if (current === magnification) {
      return;
    }
    await page.locator(`[data-test="${current < magnification ? 'zoom-in' : 'zoom-out'}"]`).click();
  }
}

async function glassShot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(600);
  await page.locator('[data-test="glass"]').screenshot({ path: `${OUTPUT_DIR}/${name}.png` });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await seed(page);
for (const exerciseId of ['01', '02', '04', '07']) {
  await page.goto(`${BASE_URL}/position/${exerciseId}`);
  await page.locator('[data-test="magnification"]').waitFor();
  await page.waitForTimeout(1500);
  for (const magnification of MAGNIFICATIONS) {
    await setMagnification(page, magnification);
    await glassShot(page, `scene-${exerciseId}-${magnification}x`);
  }
}
await browser.close();
console.log('done');
