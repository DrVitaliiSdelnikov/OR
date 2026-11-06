import { expect, test } from '@playwright/test';
import { ensureTaskListOpen, openTaskList } from './helpers';

test.describe('хаб и курс задач', () => {
  test('хаб показывает четыре вкладки, патрон и условия', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/tabs\/hub/);
    for (const tab of ['tab-hub', 'tab-calc', 'tab-dope', 'tab-log']) {
      await expect(page.getByTestId(tab)).toBeVisible();
    }
    await expect(page.getByTestId('ammo-chip')).toContainText('Патрон Б');
    await expect(page.getByTestId('conditions-card')).toContainText('снимите показания');
  });

  test('список задач: девять задач, открыта только первая', async ({ page }) => {
    await openTaskList(page);
    await expect(page.getByTestId('task-list').locator('button')).toHaveCount(9);
    await expect(page.getByTestId('task-q-mrad')).toBeEnabled();
    await expect(page.getByTestId('task-q-range')).toBeDisabled();
  });

  test('викторина: три верных ответа дают три звезды и открывают следующую задачу', async ({ page }) => {
    await openTaskList(page);
    await page.getByTestId('task-q-mrad').click();
    for (const answer of ['1', '13', '1,5']) {
      await page.getByTestId('quiz-answer').fill(answer);
      await page.getByTestId('quiz-check').click();
      await expect(page.getByTestId('quiz-feedback')).toContainText('Верно');
      await page.getByTestId('quiz-next').click();
    }
    await expect(page.getByTestId('quiz-result')).toContainText('★★★');
    await expect(page.getByTestId('quiz-result')).toContainText('Задача пройдена');
    await page.getByTestId('quiz-to-hub').click();
    await ensureTaskListOpen(page);
    await expect(page.getByTestId('task-q-range')).toBeEnabled();
    await expect(page.getByTestId('task-q-mrad')).toContainText('★★★');
  });

  test('викторина: неверный ответ показывает объяснение и не засчитывается', async ({ page }) => {
    await openTaskList(page);
    await page.getByTestId('task-q-mrad').click();
    await page.getByTestId('quiz-answer').fill('2');
    await page.getByTestId('quiz-check').click();
    await expect(page.getByTestId('quiz-feedback')).toContainText('Не совпало');
    await expect(page.getByTestId('quiz-feedback')).toContainText('0,4 м ÷ 400 м × 1000');
  });

  test('прогресс сохраняется после перезагрузки', async ({ page }) => {
    await openTaskList(page);
    await page.getByTestId('task-q-mrad').click();
    for (const answer of ['1', '13', '1.5']) {
      await page.getByTestId('quiz-answer').fill(answer);
      await page.getByTestId('quiz-check').click();
      await page.getByTestId('quiz-next').click();
    }
    await expect(page.getByTestId('quiz-result')).toBeVisible();
    await page.reload();
    await openTaskList(page);
    await expect(page.getByTestId('task-q-mrad')).toContainText('★★★');
  });
});
