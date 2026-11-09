import { expect, Page, test } from '@playwright/test';
import { positionFromBriefing, seedProgress, setWindSpeed } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: true };
const FULL_MEASUREMENT_MS = 3400;

async function seed(page: Page, bestClasses: Record<string, number>): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses }, shots: [], settings: QUIET_SETTINGS });
}

async function expectHint(page: Page, text: string | RegExp, count: string): Promise<void> {
  await expect(page.getByTestId('teaching-text')).toHaveText(text);
  await expect(page.getByTestId('teaching-count')).toHaveText(count);
  await expect(page.getByTestId('teaching-cutout')).toBeVisible();
}

async function holdMeasure(page: Page): Promise<void> {
  const measure = (await page.getByTestId('measure').boundingBox())!;
  await page.mouse.move(measure.x + measure.width / 2, measure.y + measure.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(FULL_MEASUREMENT_MS);
  await page.mouse.up();
}

test.describe('подсказки для новинок (A6.5)', () => {
  test('04: плитка ветра → «Условия» → «Замер» → «Ветер» → часы со скоростью станции', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3, '03': 3 });
    await positionFromBriefing(page, '04', true);
    await expectHint(page, 'Ветер. Сначала замерь его станцией', 'подсказка 1 из 5');
    await page.getByTestId('wind-tile').click();
    await expectHint(page, 'Станция — во вкладке «Условия»', 'подсказка 2 из 5');
    await page.getByTestId('tab-conditions').click();
    await expectHint(page, 'Держи «Замер» 3 с', 'подсказка 3 из 5');
    await holdMeasure(page);
    await expectHint(page, 'Скорость есть. Теперь «Ветер»', 'подсказка 4 из 5');
    const stationSpeed = /(\d+\.\d) м\/с/.exec((await page.getByTestId('station-readings').textContent()) ?? '')?.[1];
    await page.getByTestId('tab-wind').click();
    await expectHint(page, `Стрелка — откуда дует, по флажку у бруствера. Скорость — ${stationSpeed}, со станции`, 'подсказка 5 из 5');
    await page.getByTestId('teaching-ok').click();
    await expect(page.getByTestId('teaching-card')).toHaveCount(0);
  });

  test('05: «Дистанция», два касания и «Посчитать» — формула с метрами', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3, '03': 3, '04': 3 });
    await positionFromBriefing(page, '05', true);
    await expectHint(page, 'Открой блокнот: дистанция неизвестна', 'подсказка 1 из 4');
    await page.getByTestId('tile-notebook').click();
    await expectHint(page, 'Меряй гонг сеткой — вкладка «Дистанция»', 'подсказка 2 из 4');
    await page.getByTestId('tab-distance').click();
    await expectHint(page, 'Гонг 0,5 м. Коснись верхнего и нижнего края, затем «Посчитать»', 'подсказка 3 из 4');
    const gong = (await page.locator('[data-test="milling-grid"] .gong').boundingBox())!;
    await page.mouse.click(gong.x + gong.width / 2, gong.y);
    await page.mouse.click(gong.x + gong.width / 2, gong.y + gong.height);
    await page.getByTestId('milling-count').click();
    await expectHint(page, /^Д = 0,5 × 1000 \/ \d\.\d\d = \d{3} м$/, 'подсказка 4 из 4');
  });

  test('06: ветер как в 04, затем вырез на «к расчёту: шаг Ветер →» — ссылка видна целиком; шаг открыт — подсказка про чипы', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3 });
    await positionFromBriefing(page, '06', true);
    await expectHint(page, 'Теперь считаешь сам. Открой блокнот', 'подсказка 1 из 5');
    await page.getByTestId('tile-notebook').click();
    await expectHint(page, 'Сначала ветер — как в 04: станция и часы', 'подсказка 2 из 5');
    await page.getByTestId('teaching-ok').click();
    await page.getByTestId('tab-conditions').click();
    await holdMeasure(page);
    await page.getByTestId('tab-wind').click();
    const dial = (await page.getByTestId('wind-clock').boundingBox())!;
    await page.mouse.click(dial.x + dial.width * 0.75, dial.y + dial.height * 0.55);
    await setWindSpeed(page, 3.5);
    await expectHint(page, 'Ветер записан. Теперь посчитай его сам', 'подсказка 3 из 5');
    await expect(page.getByTestId('wind-step-link')).toBeInViewport({ ratio: 1 });
    await page.getByTestId('wind-step-link').click();
    await expectHint(page, 'Тапни слот формулы и положи чип: V⊥, потом D', 'подсказка 4 из 5');
  });

  test('брифинг: «с инструктором» есть у 06 и включён до допуска; у 07 его нет', async ({ page }) => {
    await seed(page, { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3 });
    await page.goto('/course/06');
    await expect.poll(() => page.getByTestId('briefing-instructor').evaluate(element => (element as HTMLInputElement).checked)).toBe(true);
    await page.goto('/course/07');
    await expect(page.getByTestId('briefing-card')).toBeVisible();
    await expect(page.getByTestId('briefing-instructor')).toHaveCount(0);
  });
});
