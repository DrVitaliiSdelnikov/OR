import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { UnitSystem } from '../../core/units';
import { DrillRoundSummary } from '../../sim/drill-round';
import { COUNT_DRILL_IDS, countCard } from '../../sim/drills';
import { scopeById } from '../../sim/scope-model';
import { decimal } from '../../i18n/format';
import { conditionsText, drillListRows, summaryView } from './drill-cards.model';

const cards = new Map<UnitSystem, DopeCard>();

beforeAll(async () => {
  const engine = new BallisticsEngine();
  for (const system of ['metric', 'imperial'] as const) {
    cards.set(system, await buildDopeCard(engine, courseLoadout('B', system), 0.1, system));
  }
});

function cardOf(id: (typeof COUNT_DRILL_IDS)[number], system: UnitSystem = 'metric') {
  return countCard(id, 3, { card: cards.get(system)!, scope: scopeById('course-tree') });
}

describe('строка условий карточки', () => {
  it('каждый дрил называет свои данные; в метрах', () => {
    expect(conditionsText(cardOf('milling'))).toMatch(/^Цель \d+(,\d+)? м · \d+(,\d+)? MIL по сетке$/);
    expect(conditionsText(cardOf('dope'))).toMatch(/^\d+ м$/);
    expect(conditionsText(cardOf('wind'))).toMatch(/^Ветер \d+(,\d+)? м\/с с \d+ ч · \d+ м$/);
    expect(conditionsText(cardOf('wind'))).toContain(`с ${cardOf('wind').notebook.readings.wind!.clock} ч`);
    expect(conditionsText(cardOf('conditions'))).toMatch(/^[+−]?\d+ °C · \d+ гПа · \d+ м$/);
    expect(conditionsText(cardOf('angle'))).toMatch(/^Угол [+−]\d+° · \d+ м$/);
    expect(conditionsText(cardOf('lead'))).toMatch(/^Цель идёт \d+(,\d+)? м\/с на \d+ ч · \d+ м$/);
  });

  it('размер цели — точно, как на фишке листа: 0,75 м не округляется до 0,8', () => {
    const sizes = Array.from({ length: 40 }, (_, seed) => countCard('milling', seed, { card: cards.get('metric')!, scope: scopeById('course-tree') }));
    expect(sizes.map(card => card.notebook.context.target.sizeM)).toContain(0.75);
    for (const card of sizes) {
      expect(conditionsText(card)).toContain(`Цель ${decimal(card.notebook.context.target.sizeM)} м ·`);
    }
  });

  it('в ярдах — ярды, дюймы, °F, дюймы рт. ст., мили в час', () => {
    expect(conditionsText(cardOf('milling', 'imperial'))).toMatch(/^Цель \d+(,\d+)? дюйм\S* · /);
    expect(conditionsText(cardOf('dope', 'imperial'))).toMatch(/^\d+ ярд\S*$/);
    expect(conditionsText(cardOf('wind', 'imperial'))).toMatch(/миль\/ч с \d+ ч · \d+ ярд/);
    expect(conditionsText(cardOf('conditions', 'imperial'))).toMatch(/°F · \d+(,\d+)? дюйм\S* рт\. ст\. · \d+ ярд/);
  });
});

describe('список счётных дрилов', () => {
  it('6 строк по каталогу: название, навык, где учат', () => {
    const rows = drillListRows();
    expect(rows.map(row => row.id)).toEqual(COUNT_DRILL_IDS);
    expect(rows[0]).toEqual({ id: 'milling', title: 'Миллинг', skill: 'дальность', taughtIn: 'учат в упражнении 05' });
  });
});

describe('итог раунда', () => {
  it('счёт по вердиктам, точность, среднее время, ошибки по типам', () => {
    const summary: DrillRoundSummary = { exact: 7, close: 2, error: 1, accuracy: 0.7, averageSeconds: 14.36, errorCounts: [{ type: 'side', count: 2 }, { type: 'rounding', count: 1 }] };
    expect(summaryView(summary)).toEqual({
      counts: '7 точно · 2 близко · 1 ошибка',
      accuracy: 'Точность 70 %',
      averageTime: 'В среднем 14 с на карточку',
      errors: ['СТОРОНА ×2', 'ОКРУГЛЕНИЕ ×1'],
    });
  });

  it('без ошибок — пустой список ошибок', () => {
    expect(summaryView({ exact: 10, close: 0, error: 0, accuracy: 1, averageSeconds: 9, errorCounts: [] }).errors).toEqual([]);
  });
});
