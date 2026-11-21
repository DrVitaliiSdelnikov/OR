import { decimal, plural, PluralForms } from '../format';

const DAY_FORMS: PluralForms = ['день', 'дня', 'дней'];
const APP_NAME = 'Огневой рубеж';

export const daily = {
  title: 'Задание дня',
  back: '← НАЗАД',
  date: (p: { date: string }) => `на ${p.date} · одно на всех`,
  cardsTask: (p: { drill: string; count: number }) => `${p.drill} · ${p.count} карточек`,
  positionTask: '3 гонга · САМ лёгкий · 1 выстрел на цель',
  firstAttemptRule: 'В зачёт идёт первая попытка. Повторы — без зачёта',
  start: 'Начать',
  again: 'Ещё раз · без зачёта',
  resultTitle: 'Зачёт дня',
  result: (p: { hits: number; total: number }) => `${p.hits} из ${p.total}`,
  windError: (p: { windErrorMil: number }) => `ветер ${decimal(p.windErrorMil, 1)} MIL`,
  streak: (p: { days: number }) => `серия ${p.days} ${plural(p.days, DAY_FORMS)}`,
  share: 'Поделиться',
  copied: 'Скопировано',
  tileDone: (p: { days: number }) => `сделано · серия ${p.days}`,
  tileNew: 'новое',
  toDaily: 'К заданию дня',
  sharePosition: (p: { date: string; hits: number; total: number; windErrorMil: number; digits: number }) =>
    `${APP_NAME} · ${p.date} · ${p.hits} из ${p.total} · ветер ${decimal(p.windErrorMil, p.digits)} MIL`,
  shareCards: (p: { date: string; drill: string; hits: number; total: number }) => `${APP_NAME} · ${p.date} · ${p.drill} · ${p.hits} из ${p.total}`,
};
