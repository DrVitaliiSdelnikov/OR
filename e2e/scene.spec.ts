import { expect, test } from '@playwright/test';
import { seedProgress } from './helpers';

const SCENE_FILES = ['sky', 'berm', 'ground', 'gong', 'grass', 'mark-0', 'mark-1', 'mark-2', 'mark-3', 'mark-4', 'flag-25', 'flag-45', 'flag-65', 'flag-80'];

test('сцена в стекле: фото неба, вала, земли, гонга, травы, отметин и флажков загружаются', async ({ page }) => {
  const loaded = new Set<string>();
  page.on('response', response => {
    const match = /\/scene\/([\w-]+)\.webp$/.exec(response.url());
    if (match && response.ok()) {
      loaded.add(match[1]);
    }
  });
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, shots: [], settings: { isSoundOn: false, isHapticsOn: false } });
  await page.goto('/position/01');
  await expect(page.getByTestId('glass')).toBeVisible();
  await expect.poll(() => SCENE_FILES.filter(name => !loaded.has(name))).toEqual([]);
});

test('прицел не уводится за сцену: картинку тянут далеко вниз — сетка ушла не дальше края фото земли', async ({ page }) => {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, shots: [], settings: { isSoundOn: false, isHapticsOn: false, isMarkerDriftOff: true } });
  await page.goto('/position/01');
  const glass = page.getByTestId('glass');
  await expect(glass).toBeVisible();
  const box = (await glass.boundingBox())!;
  for (let drag = 0; drag < 8; drag++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.2, { steps: 6 });
    await page.mouse.up();
  }
  await page.getByTestId('fire').click();
  const diagnosis = (await page.getByTestId('review-diagnosis').textContent()) ?? '';
  const offsetMil = Number(/вниз на (\d+(?:\.\d+)?)/.exec(diagnosis)?.[1]);
  expect(offsetMil).toBeGreaterThan(10);
  expect(offsetMil).toBeLessThan(20);
});
