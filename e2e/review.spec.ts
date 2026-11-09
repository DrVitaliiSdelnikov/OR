import { expect, Page, test } from '@playwright/test';
import { centreReticle, clicksToTarget, dialElevation, enterTotalOnTurrets, seedProgress, setWindSpeed } from './helpers';

const QUIET_SETTINGS = { isSoundOn: false, isHapticsOn: false, isTriggerZoneLarger: true, isMarkerDriftOff: true, isEverythingUnlocked: false };
const PASSED_TO_10 = { '01': 3, '02': 3, '03': 3, '04': 3, '05': 3, '06': 3, '07': 3, '08': 3, '09': 3 };
const MIN_TOUCH_PX = 44;
// Шаг симуляции ограничен 0,05 с на кадр: в медленном эмуляторе спуск идёт дольше 4,5 с реального времени.
const SHOT_TIMEOUT_MS = 25_000;
const FULL_MEASUREMENT_MS = 3400;
const CLEAN_CALL_ATTEMPTS = 3;

async function toPosition(page: Page, exerciseId: string): Promise<void> {
  await seedProgress(page, { course: { isIntroCompleted: true, bestClasses: PASSED_TO_10 }, shots: [], settings: QUIET_SETTINGS });
  await page.goto(`/position/${exerciseId}`);
  await expect(page.getByTestId('fire')).toBeVisible();
  await page.getByTestId('fire').click({ trial: true });
}

async function tapShot(page: Page): Promise<void> {
  await page.getByTestId('fire').click();
  await expect(page.getByTestId('review-sheet')).toBeVisible();
}

async function pressureShot(page: Page): Promise<void> {
  const fire = (await page.getByTestId('fire').boundingBox())!;
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('review-sheet')).toBeVisible({ timeout: SHOT_TIMEOUT_MS });
  await page.mouse.up();
}

async function openCheck(page: Page): Promise<void> {
  if ((await page.getByTestId('check-subtitle').count()) === 0) {
    await page.getByTestId('check-toggle').click();
  }
  await expect(page.getByTestId('check-subtitle')).toBeVisible();
}

test.describe('разбор выстрела (A6.1)', () => {
  test('01: после выстрела — схема с вызовом и попаданием, очки, диагноз, лист проверки со штампом и очками за расчёт', async ({ page }) => {
    await toPosition(page, '01');
    await enterTotalOnTurrets(page);
    await tapShot(page);
    await expect(page.getByTestId('scheme-call')).toBeVisible();
    await expect(page.getByTestId('scheme-impact')).toBeVisible();
    await expect(page.getByTestId('review-points')).toHaveText('промах');
    await expect(page.getByTestId('review-diagnosis')).toHaveText(/ошибка (в данных|выполнения)/);
    await expect(page.getByTestId('check-stamp')).toHaveText(/^(ТОЧНО|ПОЧТИ|ОШИБКА)$/);
    await openCheck(page);
    await expect(page.getByTestId('check-points')).toHaveText(/^\+\d+ за расчёт · ×1$/);
    await expect(page.getByTestId('check-row-3')).toContainText('Барабан ВЕРТ');
  });

  test('04: ветер введён не со станции — «ОШИБКА» и «где сбился» про скорость', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-conditions').click();
    const measure = (await page.getByTestId('measure').boundingBox())!;
    await page.mouse.move(measure.x + measure.width / 2, measure.y + measure.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(FULL_MEASUREMENT_MS);
    await page.mouse.up();
    await page.getByTestId('tab-wind').click();
    const dial = (await page.getByTestId('wind-clock').boundingBox())!;
    await page.mouse.click(dial.x + dial.width * 0.23, dial.y + dial.height * 0.52);
    await setWindSpeed(page, 9);
    await page.getByTestId('enter-turrets').click();
    await pressureShot(page);
    await openCheck(page);
    await expect(page.getByTestId('check-stamp')).toHaveText('ОШИБКА');
    await expect(page.getByTestId('check-main-error')).toContainText('Станция показала');
  });

  test('01: промах с выстрелом в запасе — поправка в кликах; «ДАЛЬШЕ» закрывает разбор', async ({ page }) => {
    await toPosition(page, '01');
    await enterTotalOnTurrets(page);
    await tapShot(page);
    await expect(page.getByTestId('review-correction')).toContainText(/кл\.|повтори чисто/);
    await page.getByTestId('fire').dispatchEvent('click');
    await expect(page.getByTestId('rounds')).toHaveText('4 / 5');
    await page.getByTestId('review-next').click();
    await expect(page.getByTestId('review-sheet')).toHaveCount(0);
    await expect(page.getByTestId('fire')).toBeEnabled();
  });

  test('02: на последнем выстреле карточка итога — только после «ДАЛЬШЕ»', async ({ page }) => {
    await toPosition(page, '02');
    for (let shot = 0; shot < 5; shot++) {
      await tapShot(page);
      if (shot < 4) {
        await page.getByTestId('review-next').click();
        await expect(page.getByTestId('review-sheet')).toHaveCount(0);
      }
    }
    await expect(page.getByTestId('review-points')).toHaveText(/^(попадание|мимо)$/);
    await expect(page.getByTestId('end-card')).toHaveCount(0);
    await page.getByTestId('review-next').click();
    await expect(page.getByTestId('end-card')).toBeVisible();
  });

  test('«ПЕРЕСЧИТАТЬ И ПОВТОРИТЬ» — упражнение с начала, блокнот сохранён', async ({ page }) => {
    await toPosition(page, '01');
    await enterTotalOnTurrets(page);
    await tapShot(page);
    await page.getByTestId('review-next').click();
    await tapShot(page);
    await page.getByTestId('review-recalc').click();
    await expect(page.getByTestId('review-sheet')).toHaveCount(0);
    await expect(page.getByTestId('rounds')).toHaveText('5 / 5');
    await expect(page.getByTestId('position-subtitle')).toContainText('цель 1 / 3');
    await page.getByTestId('tile-notebook').click();
    await expect(page.getByTestId('sheet-total')).toHaveText(/^↑ \d\.\d · \d+ кл\. вверх$/);
  });

  test('10: «Отметь, где была сетка» — тап, «ПОКАЗАТЬ ПОПАДАНИЕ», вердикт вызова', async ({ page }) => {
    await toPosition(page, '10');
    await pressureShot(page);
    await expect(page.getByTestId('call-ask')).toHaveText('Отметь, где была сетка');
    await expect(page.getByTestId('scheme-impact')).toHaveCount(0);
    await expect(page.getByTestId('review-next')).toBeDisabled();
    await expect(page.getByTestId('call-reveal')).toBeDisabled();
    const scheme = (await page.getByTestId('target-scheme').boundingBox())!;
    await page.mouse.click(scheme.x + scheme.width / 2, scheme.y + scheme.height / 2);
    await expect(page.getByTestId('scheme-player-call')).toBeVisible();
    await page.getByTestId('call-reveal').click();
    await expect(page.getByTestId('call-verdict')).toHaveText(/^вызов (точный|мимо на \d\.\d)$/);
    await expect(page.getByTestId('scheme-impact')).toBeVisible();
    await expect(page.getByTestId('review-next')).toBeEnabled();
  });

  test('чистый выстрел — «в ДОПЕ» пишет заметку, она видна на вкладке ДОПЕ', async ({ page }) => {
    await toPosition(page, '01');
    // Ссылка есть только при чистом вызове (≤ 0,2 MIL), а сетка качается: до трёх попыток с начала упражнения.
    for (let attempt = 0; attempt < CLEAN_CALL_ATTEMPTS; attempt++) {
      await enterTotalOnTurrets(page);
      const clicks = await clicksToTarget(page);
      await dialElevation(page, clicks);
      await centreReticle(page, clicks);
      await tapShot(page);
      if ((await page.getByTestId('review-dope').count()) > 0) {
        break;
      }
      await page.getByTestId('review-recalc').click();
      await expect(page.getByTestId('review-sheet')).toHaveCount(0);
    }
    await page.getByTestId('review-dope').click();
    await expect(page.getByTestId('review-dope')).toHaveText('записано в ДОПЕ');
    await page.getByTestId('review-next').click();
    await page.getByTestId('tile-dope').click();
    await expect(page.getByTestId('dope-note-300')).toHaveText(/^↑ \d\.\d$/);
  });

  test('касание не меньше 44 в разборе', async ({ page }) => {
    await toPosition(page, '01');
    await enterTotalOnTurrets(page);
    await tapShot(page);
    for (const id of ['review-next', 'review-recalc', 'check-toggle']) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});

test.describe('разбор: почему ушла пуля, траектории и группа (A6.2)', () => {
  test('01: недокрученный барабан — лепестки игрока в кликах, главный — расчёт, фраза-вывод', async ({ page }) => {
    await toPosition(page, '01');
    await enterTotalOnTurrets(page);
    await tapShot(page);
    await expect(page.getByTestId('causes')).toBeVisible();
    for (const kind of ['calc', 'wind', 'hold', 'trigger']) {
      await expect(page.getByTestId(`cause-${kind}`)).toBeVisible();
    }
    await expect(page.getByTestId('cause-calc')).toContainText(/↓ \d+ кл\./);
    await expect(page.getByTestId('cause-calc')).toHaveClass(/main/);
    await expect(page.getByTestId('causes-conclusion')).toHaveText(/^Расчёт увёл пулю ↓ на \d+ кл\./);
  });

  test('04: ветер записан неверно — лепесток ветра в кликах', async ({ page }) => {
    await toPosition(page, '04');
    await page.getByTestId('tile-notebook').click();
    await page.getByTestId('tab-wind').click();
    const dial = (await page.getByTestId('wind-clock').boundingBox())!;
    await page.mouse.click(dial.x + dial.width * 0.23, dial.y + dial.height * 0.52);
    await setWindSpeed(page, 9);
    await page.getByTestId('enter-turrets').click();
    await pressureShot(page);
    await expect(page.getByTestId('cause-wind')).toContainText(/\d+ кл\./);
  });

  test('переключатель: «сбоку» и «сверху» рисуют линию и пунктир, «спереди» — точки группы', async ({ page }) => {
    await toPosition(page, '01');
    await tapShot(page);
    await expect(page.getByTestId('flight-plot-side')).toBeVisible();
    await expect(page.getByTestId('flight-bullet')).toHaveAttribute('points', /\d/);
    await expect(page.getByTestId('flight-centre')).toHaveAttribute('points', /\d/);
    await page.getByTestId('flight-tab-top').click();
    await expect(page.getByTestId('flight-plot-top')).toBeVisible();
    await expect(page.getByTestId('flight-plot-side')).toHaveCount(0);
    await page.getByTestId('flight-tab-front').click();
    await expect(page.getByTestId('scheme-group-point')).toHaveCount(1);
    await expect(page.getByTestId('scheme-group-point').first()).toBeVisible();
    await expect(page.getByTestId('group-text')).toHaveText('Диагноз группы — от 3 выстрелов');
  });

  test('02: после третьего выстрела — диагноз группы', async ({ page }) => {
    await toPosition(page, '02');
    for (let shot = 0; shot < 3; shot++) {
      await tapShot(page);
      if (shot < 2) {
        await page.getByTestId('review-next').click();
        await expect(page.getByTestId('review-sheet')).toHaveCount(0);
      }
    }
    await page.getByTestId('flight-tab-front').click();
    await expect(page.getByTestId('scheme-group-point')).toHaveCount(3);
    await expect(page.getByTestId('scheme-group-point').first()).toBeVisible();
    await expect(page.getByTestId('group-text')).toHaveText(/^(Разброс|Вертикальная|Горизонтальная|Низко-вправо|Плотная)/);
  });

  test('касание не меньше 44 в переключателе видов', async ({ page }) => {
    await toPosition(page, '01');
    await tapShot(page);
    for (const id of ['flight-tab-front', 'flight-tab-side', 'flight-tab-top']) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(MIN_TOUCH_PX);
    }
  });
});

