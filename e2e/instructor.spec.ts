import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, enterTotalOnTurrets, positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };

async function seed(page: Page, bestClasses: Record<string, number> = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, shots: [], settings: QUIET_SETTINGS });
}

async function tapCentreOf(page: Page, testId: string): Promise<void> {
  const box = (await page.getByTestId(testId).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function expectHint(page: Page, text: string | RegExp, count: string): Promise<void> {
  await expect(page.getByTestId('teaching-text')).toHaveText(text);
  await expect(page.getByTestId('teaching-count')).toHaveText(count);
  await expect(page.getByTestId('teaching-cutout')).toBeVisible();
}

test.describe('подсказки инструктора', () => {
  test('01 с инструктором: подсказки по порядку, вне выреза тап не проходит, барабан в вырезе крутится', async ({ page }) => {
    await seed(page);
    await positionFromBriefing(page, '01', true);
    await expectHint(page, 'Это прицел. Цель — гонг на 300 м', 'подсказка 1 из 9');
    await tapCentreOf(page, 'tile-notebook');
    await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);
    await page.getByTestId('teaching-ok').click();

    await expectHint(page, 'Открой блокнот: там поправка', 'подсказка 2 из 9');
    await tapCentreOf(page, 'fire');
    await expect(page.getByTestId('review-sheet')).toHaveCount(0);
    await tapCentreOf(page, 'tile-notebook');
    await expect(page.getByTestId('notebook-sheet')).toBeVisible();

    await expectHint(page, /^ДОПЕ — падение пули: ↑ \d\.\d MIL$/, 'подсказка 3 из 9');
    await page.getByTestId('teaching-ok').click();
    await expectHint(page, 'Внеси итог на барабаны', 'подсказка 4 из 9');
    await page.getByTestId('enter-turrets').click();

    const clicks = await clicksToTarget(page);
    await expectHint(page, `Крути вверх: ещё ${clicks} кл.`, 'подсказка 5 из 9');
    await dialElevation(page, clicks);
    await expectHint(page, 'Боковой — ветер. Сегодня штиль, 0', 'подсказка 6 из 9');
    await page.getByTestId('teaching-ok').click();
    await expectHint(page, 'Наведи перекрестие на гонг: тяни картинку', 'подсказка 7 из 9');
    await centreReticle(page, clicks);
    await expectHint(page, 'Огонь', 'подсказка 8 из 9');
    await page.getByTestId('fire').click();
    await expectHint(page, 'Разбор — после каждого выстрела. Прочитай и жми ДАЛЬШЕ', 'подсказка 9 из 9');
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('teaching-card')).toHaveCount(0);
    await page.getByTestId('review-next').click();
    await expect(page.getByTestId('teaching-card')).toHaveCount(0);
  });

  test('03 с инструктором: сначала поправка и наводка, затем вырез «держи и дави» на ДЕРЖАТЬ и ОГОНЬ', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3 });
    await positionFromBriefing(page, '03', true);
    await expectHint(page, 'Задержи дыхание — метка дрожит меньше. Окно 5 с', 'подсказка 1 из 8');
    await page.getByTestId('teaching-ok').click();
    await expectHint(page, 'Поправка — как в 01: открой блокнот', 'подсказка 2 из 8');
    await page.getByTestId('tile-notebook').click();
    await expectHint(page, 'Внеси итог на барабаны', 'подсказка 3 из 8');
    await page.getByTestId('enter-turrets').click();
    const clicks = await clicksToTarget(page);
    await dialElevation(page, clicks);
    await expectHint(page, 'Наведи перекрестие на гонг: тяни картинку', 'подсказка 5 из 8');
    await centreReticle(page, clicks);
    await expectHint(page, 'Держи ДЕРЖАТЬ, дави ОГОНЬ плавно', 'подсказка 6 из 8');
    const cutout = (await page.getByTestId('teaching-cutout').boundingBox())!;
    for (const id of ['hold', 'fire']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.x, id).toBeGreaterThanOrEqual(cutout.x);
      expect(box.x + box.width, id).toBeLessThanOrEqual(cutout.x + cutout.width);
      expect(box.y, id).toBeGreaterThanOrEqual(cutout.y);
    }
  });

  test('широкий экран: вырез стоит ровно на элементе, а не сдвинут вместе со страницей', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seed(page);
    await positionFromBriefing(page, '01', true);
    await expect(page.getByTestId('teaching-cutout')).toBeVisible();
    const centreMismatchPx = async () => {
      const cutout = (await page.getByTestId('teaching-cutout').boundingBox())!;
      const glass = (await page.locator('[data-hint="glass"]').boundingBox())!;
      return Math.hypot(cutout.x + cutout.width / 2 - (glass.x + glass.width / 2), cutout.y + cutout.height / 2 - (glass.y + glass.height / 2));
    };
    await expect.poll(centreMismatchPx).toBeLessThan(2);
  });

  test('«пропустить обучение» убирает затемнение, стрелять можно', async ({ page }) => {
    await seed(page);
    await positionFromBriefing(page, '01', true);
    await expect(page.getByTestId('teaching-card')).toBeVisible();
    await page.getByTestId('teaching-skip').click();
    await expect(page.getByTestId('teaching-card')).toHaveCount(0);
    await expect(page.getByTestId('teaching-shade')).toHaveCount(0);
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible();
  });

  test('рация: выстрел мимо меток — строка «барабаны не на метках», гаснет по тапу', async ({ page }) => {
    await seed(page);
    await positionFromBriefing(page, '01');
    await enterTotalOnTurrets(page);
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('radio-text')).toHaveText('барабаны не на метках');
    await expect(page.getByTestId('radio')).toBeVisible();
    await page.getByTestId('radio').click();
    await expect(page.getByTestId('radio')).toHaveCount(0, { timeout: 1000 });
  });

  test('забытый фактор в 01: выстрел не идёт, шторка на «Итоге», вырез на переключателе; включил — можно', async ({ page }) => {
    await seed(page);
    await positionFromBriefing(page, '01');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('toggle-dope').click();
    await page.getByTestId('position-back').click();
    await expect(page.getByTestId('notebook-sheet')).toHaveCount(0);

    await page.getByTestId('fire').click();
    await expect(page.getByTestId('notebook-sheet')).toBeVisible();
    await expect(page.getByTestId('review-sheet')).toHaveCount(0);
    await expect(page.getByTestId('radio-text')).toHaveText('стой. Учти ДОПЕ');
    await expect(page.getByTestId('teaching-text')).toHaveText(/^Учти ДОПЕ: ↑ \d+ кл\.$/);
    await expect(page.getByTestId('teaching-skip')).toHaveCount(0);
    const cutout = (await page.getByTestId('teaching-cutout').boundingBox())!;
    const toggle = (await page.getByTestId('toggle-dope').boundingBox())!;
    expect(toggle.x).toBeGreaterThanOrEqual(cutout.x);
    expect(toggle.y).toBeGreaterThanOrEqual(cutout.y);
    expect(toggle.y + toggle.height).toBeLessThanOrEqual(cutout.y + cutout.height);

    await page.getByTestId('toggle-dope').click();
    await expect(page.getByTestId('teaching-card')).toHaveCount(0);
    await page.getByTestId('position-back').click();
    await page.getByTestId('fire').click();
    await expect(page.getByTestId('review-sheet')).toBeVisible();
  });

  test('брифинг: «с инструктором» включён до допуска, выключен после; в 04 его нет; выключил — обучения нет', async ({ page }) => {
    await seed(page, { '02': 3 });
    await page.goto('/course/02');
    await expect(page.getByTestId('briefing-instructor')).toBeVisible();
    await expect.poll(() => page.getByTestId('briefing-instructor').evaluate(element => (element as HTMLInputElement).checked)).toBe(false);
    await page.goto('/course/04');
    await expect(page.getByTestId('briefing-card')).toBeVisible();
    await expect(page.getByTestId('briefing-instructor')).toHaveCount(0);
    await page.goto('/course/01');
    await expect.poll(() => page.getByTestId('briefing-instructor').evaluate(element => (element as HTMLInputElement).checked)).toBe(true);
    await page.getByTestId('briefing-instructor').click();
    await page.getByTestId('to-position').click();
    await page.waitForURL('**/position/01');
    await expect(page.getByTestId('fire')).toBeVisible();
    await expect(page.getByTestId('teaching-card')).toHaveCount(0);
  });
});
