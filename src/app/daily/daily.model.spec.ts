import { describe, expect, it } from 'vitest';
import { DailyRecord, dailyTask } from '../../sim/daily';
import { dailyTileLine, dailyView, knownDailyRecords } from './daily.model';

const CARDS_DAY = '1970-01-01';
const POSITION_DAY = '1970-01-02';

function record(dateKey: string, fields: Partial<DailyRecord> = {}): DailyRecord {
  return { dateKey, kind: 'cards', drillId: dailyTask(CARDS_DAY).drillId, hits: 8, total: 10, windErrorMil: null, ...fields };
}

describe('экран задания дня (T5.1)', () => {
  it('карточный день до попытки: дата, дрил и 10 карточек, правило, «Начать», ссылка на дрил дня', () => {
    const view = dailyView([], CARDS_DAY);
    const drill = dailyTask(CARDS_DAY).drillId!;
    expect(view).toMatchObject({ date: 'на 01.01 · одно на всех', rule: 'В зачёт идёт первая попытка. Повторы — без зачёта', startLabel: 'Начать', result: null, streak: null, shareText: null });
    expect(view.taskLine).toMatch(/ · 10 карточек$/);
    expect(view.link).toEqual({ path: ['/drill', drill], query: { daily: 'on' } });
  });

  it('позиционный день: строка задания и ссылка на позицию дня', () => {
    const view = dailyView([], POSITION_DAY);
    expect(view.taskLine).toBe('3 гонга · САМ лёгкий · 1 выстрел на цель');
    expect(view.link).toEqual({ path: ['/position', 'daily'], query: {} });
  });

  it('после зачёта: итог, ветер для позиции, серия, текст, «Ещё раз · без зачёта»', () => {
    const done = dailyView([record(CARDS_DAY), record(POSITION_DAY, { kind: 'position', drillId: null, hits: 2, total: 3, windErrorMil: 0.24 })], POSITION_DAY);
    expect(done).toMatchObject({ startLabel: 'Ещё раз · без зачёта', result: { line: '2 из 3', wind: 'ветер 0,2 MIL' }, streak: 'серия 2 дня', shareText: 'Огневой рубеж · 02.01 · 2 из 3 · ветер 0,2 MIL' });
    expect(dailyView([record(CARDS_DAY)], CARDS_DAY).result).toEqual({ line: '8 из 10', wind: null });
  });

  it('плитка главного: «новое» или «сделано · серия N»', () => {
    expect(dailyTileLine([], CARDS_DAY)).toBe('новое');
    expect(dailyTileLine([record(CARDS_DAY)], CARDS_DAY)).toBe('сделано · серия 1');
    expect(dailyTileLine([record(CARDS_DAY)], POSITION_DAY)).toBe('новое');
  });
});

describe('записи дня из хранилища', () => {
  it('берутся только целые записи', () => {
    const good = record(CARDS_DAY);
    expect(knownDailyRecords([good, { ...good, dateKey: '21.11' }, { ...good, hits: '8' }, { ...good, kind: 'quiz' }, null])).toEqual([good]);
    expect(knownDailyRecords('oops')).toEqual([]);
    expect(knownDailyRecords(undefined)).toEqual([]);
  });
});
