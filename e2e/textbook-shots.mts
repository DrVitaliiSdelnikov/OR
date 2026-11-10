import { chromium, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:4310';
const OUTPUT_DIR = process.argv[2] ?? 'docs/design/screens';
const PROGRESS_KEY = 'CapacitorStorage.or.progress.v1';

async function seed(page: Page, isEverythingUnlocked: boolean): Promise<void> {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      PROGRESS_KEY,
      JSON.stringify({
        course: { isIntroCompleted: true, bestClasses: { '01': 2 } },
        settings: { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: false, isMarkerDriftOff: true, isEverythingUnlocked },
      }),
    ] as const,
  );
}

async function openTerm(page: Page, term: string): Promise<void> {
  await page.locator('[data-test="textbook-term"]').filter({ hasText: new RegExp(`^${term}$`) }).click();
  await page.locator('[data-test="term-title"]').waitFor();
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

const opening = await context.newPage();
await seed(opening, false);
await opening.goto(`${BASE_URL}/textbook`);
await opening.locator('[data-test="textbook-counter"]').waitFor();
await opening.screenshot({ path: `${OUTPUT_DIR}/55-textbook.png` });
await openTerm(opening, 'клик');
await opening.screenshot({ path: `${OUTPUT_DIR}/56-term-click.png` });

const unlocked = await context.newPage();
await seed(unlocked, true);
await unlocked.goto(`${BASE_URL}/textbook`);
await openTerm(unlocked, 'ветер');
await unlocked.locator('[data-test="term-example"]').waitFor();
await unlocked.screenshot({ path: `${OUTPUT_DIR}/57-term-wind.png` });

async function schemeShot(term: string, name: string, tap?: (page: Page) => Promise<void>): Promise<void> {
  await unlocked.locator('[data-test="term-close"]').click();
  await openTerm(unlocked, term);
  const scheme = unlocked.locator('[data-test="term-scheme"]');
  await scheme.scrollIntoViewIfNeeded();
  await tap?.(unlocked);
  await unlocked.waitForTimeout(300);
  await unlocked.screenshot({ path: `${OUTPUT_DIR}/${name}.png` });
}

await schemeShot('сетка', '58-scheme-reticle', async page => {
  const box = (await page.locator('[data-test="reticle-scheme-mil-dot"]').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
});
await schemeShot('энергия', '59-scheme-cartridges');
await schemeShot('СТП', '60-scheme-group');

await browser.close();
