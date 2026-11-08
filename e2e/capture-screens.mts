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
        course: { isIntroCompleted: true, bestClasses: { '01': 1, '02': 2, '03': 3, '04': 2, '05': 2, '06': 2, '07': 2, '08': 2, '09': 2 } },
        shots: [],
        settings: { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: false, isMarkerDriftOff: true, isEverythingUnlocked: false },
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

  await page.goto(`${BASE_URL}/`);
  await snap(page, `01-main${suffix}`);
  await byTest('tile-course').click();
  await snap(page, `02-course-trail${suffix}`);
  await byTest('node-02').click();
  await snap(page, `18-exercise-sheet${suffix}`);

  await page.goto(`${BASE_URL}/position/01`);
  await byTest('fire').waitFor();
  await snap(page, `19-position${suffix}`);

  await page.goto(`${BASE_URL}/position/04`);
  await byTest('fire').waitFor();
  await byTest('tile-notebook').click();
  await snap(page, `21-notebook-total${suffix}`);
  await byTest('tab-conditions').click();
  const measure = (await byTest('measure').boundingBox())!;
  await page.mouse.move(measure.x + measure.width / 2, measure.y + measure.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await snap(page, `22-notebook-conditions${suffix}`);
  await byTest('tab-wind').click();
  const dial = (await byTest('wind-clock').boundingBox())!;
  await page.mouse.click(dial.x + dial.width * 0.23, dial.y + dial.height * 0.52);
  for (let step = 0; step < 24; step++) {
    await byTest('speed-plus').click();
  }
  await snap(page, `23-notebook-wind${suffix}`);
  await byTest('tab-dope').click();
  await snap(page, `24-notebook-dope${suffix}`);
  await byTest('tab-total').click();
  await byTest('factor-wind').locator('.factor-name').click();
  await snap(page, `25-notebook-total-filled${suffix}`);
  await byTest('enter-turrets').click();
  await snap(page, `26-position-entered${suffix}`);

  await page.goto(`${BASE_URL}/position/05`);
  await byTest('fire').waitFor();
  await byTest('tile-notebook').click();
  await byTest('tab-distance').click();
  const gong = (await page.locator('[data-test="milling-grid"] .gong').boundingBox())!;
  await page.mouse.click(gong.x + gong.width / 2, gong.y);
  await page.mouse.click(gong.x + gong.width / 2, gong.y + gong.height);
  await byTest('milling-count').click();
  await snap(page, `27-notebook-distance${suffix}`);

  await page.goto(`${BASE_URL}/position/06`);
  await byTest('fire').waitFor();
  await byTest('tile-notebook').click();
  await snap(page, `28-manual-hub${suffix}`);
  await byTest('tab-wind').click();
  const windDial = (await byTest('wind-clock').boundingBox())!;
  await page.mouse.click(windDial.x + windDial.width * 0.23, windDial.y + windDial.height * 0.52);
  for (let step = 0; step < 32; step++) {
    await byTest('speed-plus').click();
  }
  await snap(page, `29-wind-easy-shares${suffix}`);
  await byTest('wind-step-link').click();
  await byTest('slot-0').click();
  await snap(page, `30-calc-wind-chips${suffix}`);
  await byTest('chip-crosswind').click();
  await byTest('chip-distance').click();
  await byTest('tape-0').click();
  for (const key of '1440') {
    await byTest(`key-${key}`).click();
  }
  await byTest('side--1').click();
  await snap(page, `31-calc-wind-keypad${suffix}`);

  await page.goto(`${BASE_URL}/position/10`);
  await byTest('fire').waitFor();
  await byTest('tile-notebook').click();
  await byTest('step-dope').click();
  await byTest('slot-0').click();
  await snap(page, `32-calc-hard${suffix}`);
  await byTest('calc-formulas').click();
  await snap(page, `33-formulas-confirm${suffix}`);
  await byTest('formulas-open').click();
  await snap(page, `34-formulas${suffix}`);

  await page.goto(`${BASE_URL}/position/01`);
  await byTest('fire').waitFor();
  await byTest('tile-notebook').click();
  await byTest('enter-turrets').click();
  await byTest('fire').click();
  await byTest('review-sheet').waitFor();
  await snap(page, `35-review-miss${suffix}`);
  if ((await byTest('check-subtitle').count()) === 0) {
    await byTest('check-toggle').click();
  }
  await byTest('check-subtitle').scrollIntoViewIfNeeded();
  await snap(page, `36-review-check${suffix}`);

  await page.goto(`${BASE_URL}/position/10`);
  await byTest('fire').waitFor();
  const fire = (await byTest('fire').boundingBox())!;
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await page.mouse.down();
  await byTest('review-sheet').waitFor({ timeout: 25000 });
  await page.mouse.up();
  const scheme = (await byTest('target-scheme').boundingBox())!;
  await page.mouse.click(scheme.x + scheme.width / 2 + 10, scheme.y + scheme.height / 2 - 10);
  await snap(page, `37-review-call${suffix}`);
  await byTest('call-reveal').click();
  await snap(page, `38-review-call-revealed${suffix}`);

  if (isFull) {
    await page.goto(`${BASE_URL}/journal`);
    await snap(page, `15-log${suffix}`);
    await page.goto(`${BASE_URL}/settings`);
    await snap(page, `17-settings${suffix}`);
  }
  await browser.close();

  if (isFull) {
    const laptop = await chromium.launch();
    const wide = await laptop.newPage({ viewport: { width: 1280, height: 720 } });
    await seed(wide);
    await wide.goto(`${BASE_URL}/`);
    await snap(wide, `20-laptop-frame${suffix}`);
    await laptop.close();
  }
}

await captureScreens('', true);
console.log('done');
