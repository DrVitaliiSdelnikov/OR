import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout } from '../../core/content';
import { buildDopeCard, DopeCard } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { UnitSystem } from '../../core/units';
import { DrillRoundRecord, DrillRoundSummary } from '../../sim/drill-round';
import { COUNT_DRILL_IDS, countCard, POSITION_DRILL_IDS } from '../../sim/drills';
import { scopeById } from '../../sim/scope-model';
import { initialRatings } from '../../sim/skill-rating';
import { decimal } from '../../i18n/format';
import { conditionsText, drillLink, drillListGroups, drillSkillGroups, positionSummaryView, summaryView } from './drill-cards.model';

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

describe('список дрилов (T3.2, T3.3)', () => {
  const learnRound = (drillId: DrillRoundRecord['drillId'], exact: number): DrillRoundRecord => ({
    drillId,
    level: 'learn',
    seed: 1,
    startedAtIso: '2026-11-20T10:00:00.000Z',
    cards: Array.from({ length: 10 }, (_, index) => ({ verdict: index < exact ? ('exact' as const) : ('error' as const), errorTypes: [], seconds: 9 })),
  });

  it('две группы: 6 счётных и 5 на позиции; название, навык, где учат', () => {
    const groups = drillListGroups([], false);
    expect(groups.map(group => group.title)).toEqual(['Счётные карточки', 'На позиции']);
    expect(groups[0].rows.map(row => row.id)).toEqual(COUNT_DRILL_IDS);
    expect(groups[1].rows.map(row => row.id)).toEqual(POSITION_DRILL_IDS);
    expect(groups[0].rows[0]).toMatchObject({ id: 'milling', title: 'Миллинг', skill: 'дальность', taughtIn: 'учат в упражнении 05' });
    expect(groups[1].rows.at(-1)).toMatchObject({ id: 'timed-stage', taughtIn: null });
  });

  it('«на время» закрыт с условием; открыт после двух раундов ≥ 80 % или с «Открыть всё»', () => {
    const closed = drillListGroups([], false)[0].rows[2];
    expect(closed.timed).toEqual({ isOpen: false, label: 'НА ВРЕМЯ · 2 раунда ≥ 80 %' });
    const opened = drillListGroups([learnRound('wind', 8), learnRound('wind', 9)], false)[0].rows[2];
    expect(opened.timed).toEqual({ isOpen: true, label: 'НА ВРЕМЯ' });
    expect(drillListGroups([], true)[1].rows[0].timed.isOpen).toBe(true);
  });
});

describe('список по навыкам (T3.5)', () => {
  const ratings = { ...initialRatings(), wind: { rating: 41.6, attempts: 12 } };

  it('8 групп в порядке навыков; шапка — навык и округлённый рейтинг', () => {
    const groups = drillSkillGroups([], ratings, false);
    expect(groups.map(group => group.skill)).toEqual(['distance', 'dope', 'wind', 'conditions', 'angle', 'lead', 'execution', 'speed']);
    expect(groups[2].title).toBe('ветер · 42');
    expect(groups[0].title).toBe('дальность · 40');
  });

  it('в группе дрилы навыка: счётный первым, подпись типа; «на время» с замком', () => {
    const groups = drillSkillGroups([], ratings, false);
    expect(groups[2].rows.map(row => [row.id, row.kindLabel])).toEqual([
      ['wind', 'карточки'],
      ['wind-bracket', 'на позиции'],
    ]);
    expect(groups[6].rows.map(row => row.id)).toEqual(['cold-bore']);
    expect(groups[2].rows[0]).toMatchObject({ title: 'Ветер', taughtIn: 'учат в упражнении 04', timed: { isOpen: false } });
    expect(groups.flatMap(group => group.rows)).toHaveLength(11);
    expect(drillSkillGroups([], ratings, true)[2].rows[1].timed.isOpen).toBe(true);
  });
});

describe('ссылки на дрил', () => {
  it('счётный — /drill/:id, на позиции — /position/drill-:id; уровень — в query', () => {
    expect(drillLink('wind', 'learn')).toEqual({ path: ['/drill', 'wind'], query: {} });
    expect(drillLink('patrol', 'timed')).toEqual({ path: ['/position', 'drill-patrol'], query: { level: 'timed' } });
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

  it('время и причины промахов подписаны словами', () => {
    const summary: DrillRoundSummary = { exact: 1, close: 0, error: 2, accuracy: 1 / 3, averageSeconds: 50, errorCounts: [{ type: 'time', count: 1 }, { type: 'miss-hold', count: 1 }] };
    expect(summaryView(summary).errors).toEqual(['ВРЕМЯ ×1', 'удержание сетки ×1']);
  });

  it('серия на позиции: попадания из выстрелов, точность, среднее время на выстрел', () => {
    const view = positionSummaryView({ exact: 4, close: 0, error: 2, accuracy: 4 / 6, averageSeconds: 21.4, errorCounts: [{ type: 'miss-wind-under', count: 2 }] });
    expect(view).toEqual({ counts: '4 попадания из 6', accuracy: 'Точность 67 %', averageTime: 'В среднем 21 с на выстрел', errors: ['недооценка ветра ×2'] });
  });

  it('без ошибок — пустой список ошибок', () => {
    expect(summaryView({ exact: 10, close: 0, error: 0, accuracy: 1, averageSeconds: 9, errorCounts: [] }).errors).toEqual([]);
  });
});
