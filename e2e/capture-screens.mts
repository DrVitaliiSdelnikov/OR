import { chromium, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:4310';
const OUTPUT_DIR = 'docs/design/screens';
const PROGRESS_KEY = 'CapacitorStorage.or.progress.v1';

async function seed(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem('or-seeded')) {
        localStorage.setItem(key, value);
        sessionStorage.setItem('or-seeded', '1');
      }
    },
    [
      PROGRESS_KEY,
      JSON.stringify({
        results: { 'q-mrad': { score: 30, maxScore: 30, stars: 3 }, 'q-range': { score: 20, maxScore: 30, stars: 1 } },
        shots: [],
        settings: { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: false, isMarkerDriftOff: true, isEverythingUnlocked: true },
      }),
    ] as const,
  );
}

async function snap(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUTPUT_DIR}/${name}.png` });
}

async function captureScreens(suffix: string, isFull: boolean): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await seed(page);
  const byTest = (id: string) => page.locator(`[data-test="${id}"]`);

  await page.goto(`${BASE_URL}/tabs/hub`);
  await snap(page, `01-hub${suffix}`);
  await byTest('tasks-card').click();
  await snap(page, `02-hub-tasks${suffix}`);

  await byTest('task-s-500').click();
  await page.waitForURL('**/weather');
  await snap(page, `03-weather-empty${suffix}`);
  await byTest('take-reading').click();
  await snap(page, `04-weather-page1${suffix}`);
  if (isFull) {
    await byTest('lcd-page').click();
    await snap(page, `05-weather-page2-locked${suffix}`);
    await byTest('lcd-page').click();
    await snap(page, `06-weather-page3${suffix}`);
  }

  await byTest('weather-done').click();
  await page.waitForTimeout(800);
  await snap(page, `07-calc-hud${suffix}`);

  if (isFull) {
    await byTest('open-wind').click();
    await byTest('clock-10.5').dispatchEvent('click');
    await byTest('speed-4').click();
    await snap(page, `08-wind-clock${suffix}`);
    await byTest('apply-wind').click();
  }

  await byTest('to-turrets').click();
  await page.waitForURL('**/scope');
  await page.waitForTimeout(800);
  await snap(page, `09-scope${suffix}`);

  if (isFull) {
    await byTest('elevation-minus').click();
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUTPUT_DIR}/10-scope-zero-stop${suffix}.png` });
    await byTest('fire').click();
    const pad = (await byTest('trigger-pad').boundingBox())!;
    await page.mouse.move(pad.x + pad.width / 2 + 30, pad.y + pad.height / 2 + 20);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUTPUT_DIR}/11-scope-trigger${suffix}.png` });
    await page.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2, { steps: 5 });
    await byTest('debrief').waitFor({ timeout: 20000 });
    await page.mouse.up();
    await snap(page, `12-debrief-sheet${suffix}`);
    await byTest('debrief-next').click();
    await page.locator('ion-modal').waitFor({ state: 'hidden' });
    await snap(page, `13-scope-bolt${suffix}`);

    await byTest('scope-hub').click();
    await page.goto(`${BASE_URL}/tabs/dope`);
    await snap(page, `14-dope${suffix}`);
    await page.goto(`${BASE_URL}/tabs/log`);
    await snap(page, `15-log${suffix}`);
    await page.locator('[data-test^="log-"]').first().click();
    await snap(page, `16-debrief-page${suffix}`);
    await page.goto(`${BASE_URL}/tabs/hub/settings`);
    await snap(page, `17-settings${suffix}`);
    await page.goto(`${BASE_URL}/tabs/hub/tasks/q-clock`);
    await snap(page, `18-quiz${suffix}`);
    await byTest('quiz-answer').fill('6');
    await byTest('quiz-check').click();
    await snap(page, `19-quiz-answer${suffix}`);
  }
  await browser.close();

  if (isFull) {
    const laptop = await chromium.launch();
    const wide = await laptop.newPage({ viewport: { width: 1280, height: 720 } });
    await seed(wide);
    await wide.goto(`${BASE_URL}/tabs/hub`);
    await snap(wide, `20-laptop-frame${suffix}`);
    await laptop.close();
  }
}

await captureScreens('', true);
console.log('done');
