import { expect, Page, test } from '@playwright/test';
import { positionFromBriefing, seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true };

async function seed(page: Page, bestClasses: Record<string, number>, isEverythingUnlocked = false): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, settings: { ...QUIET_SETTINGS, isEverythingUnlocked } });
}

async function missFirstShotOf01(page: Page): Promise<void> {
  await positionFromBriefing(page, '01');
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click();
  await expect(page.getByTestId('review-sheet')).toBeVisible();
}

test.describe('ссылки на термины (A7.3b1)', () => {
  test('подсказка-объяснение: «прицел» — ссылка, шторка поверх выреза; после закрытия «Понял» работает', async ({ page }) => {
    await seed(page, {});
    await positionFromBriefing(page, '01', true);
    await expect(page.getByTestId('teaching-text')).toHaveText('Это прицел. Цель — гонг на 300 м');
    await page.getByTestId('teaching-text').getByTestId('term-link').click();
    await expect(page.getByTestId('term-title')).toHaveText('прицел');
    await expect(page.getByTestId('term-sheet')).toBeInViewport();
    await page.getByTestId('term-close').click();
    await expect(page.getByTestId('term-sheet')).toHaveCount(0);
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('teaching-text')).not.toHaveText('Это прицел. Цель — гонг на 300 м');
  });

  test('подсказка-действие без ссылок: «Внеси итог на барабаны» — текст', async ({ page }) => {
    await seed(page, {}, true);
    await positionFromBriefing(page, '01', true);
    await page.getByTestId('teaching-ok').click();
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('teaching-text').getByTestId('term-link')).toHaveText('ДОПЕ');
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('teaching-text')).toHaveText('Внеси итог на барабаны');
    await expect(page.getByTestId('teaching-text').getByTestId('term-link')).toHaveCount(0);
  });

  test('разбор: лепесток причины открывает свою карточку', async ({ page }) => {
    await seed(page, {}, true);
    await missFirstShotOf01(page);
    const causeLink = page.getByTestId('cause-calc').getByTestId('term-link');
    await causeLink.scrollIntoViewIfNeeded();
    await causeLink.click();
    await expect(page.getByTestId('term-title')).toHaveText('САМ');
  });

  test('журнал, ОШИБКИ: «СТОРОНА» открывает «правило часов»', async ({ page }) => {
    const shot = { distanceM: 300, isHit: false, isFirstAtTarget: true, mainCause: 'calc', errorTypes: ['side'], windSpeedMps: 3, mode: 'manual-easy' };
    const series = {
      id: 's1', startedAtIso: '2026-11-09T10:00:00.000Z', kind: 'exercise', exerciseId: '06', title: 'Часы ветра', mode: 'manual-easy',
      cartridgeIds: ['B'], distanceText: '400 м', exerciseClass: 0, total: 0, isInterrupted: false, isTapTrigger: false, shots: [shot],
    };
    await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: {} }, settings: { ...QUIET_SETTINGS, isEverythingUnlocked: true }, series: [series] });
    await page.goto('/journal');
    await page.getByTestId('journal-tab-errors').click();
    await page.getByTestId('journal-error').filter({ hasText: 'СТОРОНА' }).getByTestId('term-link').click();
    await expect(page.getByTestId('term-title')).toHaveText('правило часов');
  });

  test('брифинг пройденного 01: «узнаешь» — открытые термины ссылками', async ({ page }) => {
    await seed(page, { '01': 2 });
    await page.goto('/course/01');
    const links = page.getByTestId('sheet-terms').getByTestId('term-link');
    await expect(links).toHaveCount(6);
    await links.filter({ hasText: 'ДОПЕ' }).click();
    await expect(page.getByTestId('term-title')).toHaveText('ДОПЕ');
  });
});
