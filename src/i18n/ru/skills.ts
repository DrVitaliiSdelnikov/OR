import { plural, PluralForms } from '../format';

const ATTEMPT_FORMS: PluralForms = ['попытка', 'попытки', 'попыток'];

export const skills = {
  levels: {
    beginner: 'Начинающий',
    amateur: 'Любитель',
    shooter: 'Стрелок',
    strong: 'Сильный стрелок',
    expert: 'Эксперт',
  },
  progress: {
    title: 'Прогресс',
    back: '← НАЗАД',
    level: (p: { name: string; value: number }) => `${p.name} · ${p.value}`,
    levelUnknown: 'Уровень не определён',
    levelHint: 'Пройди дрил или упражнение — уровень появится',
    skillsTitle: 'Навыки',
    attempts: (p: { count: number }) => `${p.count} ${plural(p.count, ATTEMPT_FORMS)}`,
    noAttempts: 'нет попыток',
    weeksTitle: 'Уровень по неделям',
    weekLabel: (p: { day: string; month: string }) => `${p.day}.${p.month}`,
    errorsTitle: 'Ошибки расчёта за 4 недели',
    errorCount: (p: { count: number }) => `×${p.count}`,
    noErrors: 'ошибок проверки нет',
    journal: 'Журнал стрелка',
  },
};
