import { expect, Page, test } from '@playwright/test';
import { seedProgress } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const COURSE_IDS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'];
const SKILLS = ['distance', 'dope', 'wind', 'conditions', 'angle', 'lead', 'execution', 'speed'];

async function seed(page: Page, bestClasses: Record<string, number> = {}): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, series: [], settings: QUIET_SETTINGS });
}

test.describe('экран «Дрилы» (T3.5)', () => {
  test('главная → «Дрилы»: совет тренера сверху ведёт на советуемый дрил', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('tile-drills').click();
    await expect(page.getByTestId('coach-advice')).toContainText('Тренер: дальность');
    await expect(page.getByTestId('coach-drill')).toHaveText('Миллинг · обучение');
    await expect(page.getByTestId('coach-reason')).toHaveText('ещё не тренировали');
    await page.getByTestId('coach-advice').click();
    await expect(page).toHaveURL(/\/drill\/milling$/);
    await expect(page.getByTestId('calc-title')).toHaveText('Карточка 1 из 10');
  });

  test('8 групп по навыкам с рейтингом; дрилы навыка внутри', async ({ page }) => {
    await seed(page);
    await page.goto('/drills');
    await expect(page.locator('[data-test^="drill-group-title-"]')).toHaveText(SKILLS.map(() => /^.+ · 40$/));
    await expect(page.getByTestId('drill-group-title-wind')).toHaveText('ветер · 40');
    await expect(page.getByTestId('drill-group-wind').locator('[data-test^="drill-item-"]')).toHaveText([/^Ветер\s*карточки/, /^Ветер-вилка\s*на позиции/]);
  });

  test('«Свой дрил» внизу → /free «Свой дрил»; «назад» → «Дрилы»', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('tile-drills').click();
    await page.getByTestId('drills-free').click();
    await page.waitForURL('**/free');
    await expect(page.getByTestId('free-play').locator('.title')).toHaveText('Свой дрил');
    await page.getByTestId('free-back').click();
    await expect(page.getByTestId('drill-list')).toBeVisible();
    await page.goto('/free');
    await page.getByTestId('free-back').click();
    await expect(page).toHaveURL(/\/drills$/);
  });

  test('главная: без «Свободной игры»; курс пройден — карточка «Дрилы» с советом ведёт на «Дрилы»', async ({ page }) => {
    await seed(page, Object.fromEntries(COURSE_IDS.map(id => [id, 3])));
    await page.goto('/');
    await expect(page.locator('.tile')).toHaveText([/Снайперская подготовка/, /Дрилы/, /Винтовка/, /Учебник курсанта/, /Прогресс/]);
    await expect(page.getByTestId('continue-card')).toContainText('Дрилы');
    await expect(page.getByTestId('continue-card')).toContainText('Тренер: дальность');
    await page.getByTestId('continue-card').click();
    await expect(page.getByTestId('drill-list')).toBeVisible();
  });
});
