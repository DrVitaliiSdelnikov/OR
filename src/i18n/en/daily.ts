import { decimal } from '../format';
import { APP_NAME } from './app-name';

export const daily = {
  title: 'Daily task',
  shortDate: (p: { day: string; month: string }) => `${p.month}/${p.day}`,
  back: '← BACK',
  date: (p: { date: string }) => `for ${p.date} · same for everyone`,
  cardsTask: (p: { drill: string; count: number }) => `${p.drill} · ${p.count} cards`,
  positionTask: '3 gongs · MANUAL easy · 1 shot per target',
  firstAttemptRule: 'Only the first attempt counts. Retries are unscored',
  start: 'Start',
  again: 'Again · unscored',
  resultTitle: 'Today’s score',
  result: (p: { hits: number; total: number }) => `${p.hits} of ${p.total}`,
  windError: (p: { windErrorMil: number }) => `wind ${decimal(p.windErrorMil, 1)} MIL`,
  streak: (p: { days: number }) => `${p.days}-day streak`,
  share: 'Share',
  copied: 'Copied',
  tileDone: (p: { days: number }) => `done · streak ${p.days}`,
  tileNew: 'new',
  toDaily: 'To daily task',
  sharePosition: (p: { date: string; hits: number; total: number; windErrorMil: number; digits: number }) =>
    `${APP_NAME} · ${p.date} · ${p.hits} of ${p.total} · wind ${decimal(p.windErrorMil, p.digits)} MIL`,
  shareCards: (p: { date: string; drill: string; hits: number; total: number }) => `${APP_NAME} · ${p.date} · ${p.drill} · ${p.hits} of ${p.total}`,
};
