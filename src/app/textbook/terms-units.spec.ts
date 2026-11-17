import { beforeAll, describe, expect, it } from 'vitest';
import { CARTRIDGES, courseLoadout } from '../../core/content';
import { buildDopeCard, DopeCard, dopeRowAt } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { atmosphereCorrectionMilImperial, crosswindMps, imperialWindConstant, leadMilImperial } from '../../core/game-formulas';
import { CartridgeId } from '../../core/types';
import { fromInput } from '../../core/units';
import { decimal } from '../../i18n/format';
import { openedTerms, termSheetView } from './textbook.model';
import { CardsByCartridge, TERM_CARDS, termCards } from './terms';

const METRIC_UNIT_TEXT =
  /\d(?:,\d+)?\s?(?:м|м\/с|гПа|°C|см|кг|Дж|г)(?![а-яёa-z])|(?:^|[\s,(«])(?:м|м\/с|гПа|°C|см|сантиметры|Дж|кг)(?=$|[\s,.)»;:·])|− 1013|\(15 −|\/ 10 =/;

const engine = new BallisticsEngine();
let imperialCards: CardsByCartridge;

function cardText(card: (typeof TERM_CARDS)[number]): string {
  return [card.term, card.phrase, card.formula?.line ?? '', ...(card.formula?.variables.flatMap(variable => [variable.symbol, variable.meaning]) ?? []), ...card.places].join('\n');
}

function example(term: string): string {
  const card = termCards('imperial').find(item => item.term === term)!;
  return card.example!(imperialCards)!;
}

function row(distanceYards: number) {
  return dopeRowAt(imperialCards.get('B')!, fromInput('distance', distanceYards, 'imperial'));
}

beforeAll(async () => {
  const cards = new Map<CartridgeId, DopeCard>();
  for (const cartridge of CARTRIDGES) {
    cards.set(cartridge.id, await buildDopeCard(engine, courseLoadout(cartridge.id, 'imperial'), 0.1, 'imperial'));
  }
  imperialCards = cards;
});

describe('учебник в имперских (T1.8c)', () => {
  it('метрика — прежние карточки; термины и порядок одни в обеих системах', () => {
    expect(termCards('metric')).toBe(TERM_CARDS);
    expect(termCards('imperial').map(card => card.term)).toEqual(TERM_CARDS.map(card => card.term));
    expect(termCards('imperial').map(card => card.related)).toEqual(TERM_CARDS.map(card => card.related));
  });

  it('в текстах карточек — ни одной метрической единицы', () => {
    const metricLeft = termCards('imperial').filter(card => METRIC_UNIT_TEXT.test(cardText(card))).map(card => `${card.term}: ${cardText(card).match(METRIC_UNIT_TEXT)![0]}`);
    expect(metricLeft).toEqual([]);
    expect(TERM_CARDS.filter(card => METRIC_UNIT_TEXT.test(cardText(card))).length).toBeGreaterThan(10);
  });

  it('в примерах — ни одной метрической единицы, и примеры есть там же, где в метрике', () => {
    const imperial = termCards('imperial');
    const withExamples = imperial.filter(card => card.example);
    expect(withExamples.map(card => card.term)).toEqual(TERM_CARDS.filter(card => card.example).map(card => card.term));
    const metricLeft = withExamples.map(card => [card.term, card.example!(imperialCards)!] as const).filter(([, line]) => METRIC_UNIT_TEXT.test(line));
    expect(metricLeft).toEqual([]);
    expect(withExamples.every(card => card.example!(imperialCards) !== null)).toBe(true);
  });

  it('ноль, флажки и зоны — в ярдах; эталон — 59 °F и 29,92', () => {
    const byTerm = (term: string) => termCards('imperial').find(card => card.term === term)!;
    expect(byTerm('винтовка').phrase).toContain('Пристреляна на 100 ярдов.');
    expect(byTerm('флажок').places).toEqual(['позиция · флажки 200, 400, 600 ярдов']);
    expect(byTerm('зоны ветра').phrase).toContain('у флажков 200, 400 и 600 ярдов.');
    expect(byTerm('эталон условий').phrase).toContain('59 °F и 29,92 дюйма рт. ст.');
    expect(byTerm('поправка условий').formula!.line).toBe('ΔВЕРТ = (59 − T) / 10 × Х + (P − 29,92) / 0,3 × Р');
    expect(TERM_CARDS.find(card => card.term === 'эталон условий')!.phrase).toContain('+15 °C и 1013 гПа');
  });

  it('клик, MIL и миллинг — в дюймах и ярдах по 27,78', () => {
    expect(example('клик')).toContain('на 300 ярдов один клик — 1 дюйм');
    expect(example('MIL')).toBe('0,62 MIL на 300 ярдов = 0,62 × 300 / 27,78 = 6,7 дюйма');
    expect(example('миллинг')).toBe('гонг 20 дюймов занял в сетке 1,25 MIL → 444 ярда');
    expect(example('формула тысячной')).toBe('гонг 20 дюймов, в сетке 1,25 MIL: Д = 20 × 27,78 / 1,25 = 444 ярда');
  });

  it('ветер — миль/ч × ярды ÷ K в ярдах и mph; константа ветра — та же K', () => {
    const windConstant = imperialWindConstant(row(300).windConstant);
    expect(example('ветер')).toContain(`ветер 7 миль/ч с 9 ч, 300 ярдов, патрон Б: W = 7 × 300 / ${windConstant} = ${decimal((7 * 300) / windConstant, 2)} MIL`);
    expect(example('константа ветра')).toContain(`K = ${imperialWindConstant(row(200).windConstant)} на 200 ярдов`);
    expect(example('боковая составляющая')).toBe(`9 миль/ч с 2 ч: V⊥ = 9 × 0,87 = ${decimal(crosswindMps(9, 2), 2)} миль/ч`);
    expect(example('флажок')).toBe('флажок отклонён на 27°: 27 / 4 = 7 миль/ч');
  });

  it('условия и упреждение — по имперским формулам T1.8b', () => {
    const correctionMil = atmosphereCorrectionMilImperial(row(600), 23, 30.42);
    expect(example('поправка условий')).toContain('Патрон Б, 600 ярдов, 23 °F, 30,42 дюйма рт. ст.: 3,6 × ');
    expect(example('поправка условий')).toContain(`= ${decimal(correctionMil, 2)} MIL`);
    const leadMil = leadMilImperial(2.5, 3, row(400).timeOfFlightS, 400);
    expect(example('упреждение')).toBe(`шаг 2,5 миль/ч поперёк, 400 ярдов: L = 488,9 × 2,5 × ${decimal(row(400).timeOfFlightS, 2)} / 400 = ${decimal(leadMil, 2)} MIL`);
  });

  it('строки ДОПЕ, угол нуля и патрон — в ярдах, гранах и фут/с', () => {
    expect(example('строка ДОПЕ')).toMatch(/^Патрон Б, 450 ярдов — между [\d,]+ \(400 ярдов\) и [\d,]+ \(500 ярдов\)/);
    expect(example('угол нуля')).toBe(`Патрон Б, ноль на 100 ярдов: Z = ${decimal(imperialCards.get('B')!.zeroAngleMil, 2)} MIL`);
    expect(example('карточка патрона')).toMatch(/^Патрон Б: 168 гранов, 2625 ± 23 фут\/с, G7 0,218$/);
    expect(example('энергия')).toMatch(/^Патрон Б: 168 × 2625² \/ 450 240 ≈ \d+0 фут-фунт$/);
    expect(example('высота стрельбища')).toMatch(/^обычное давление: 0 футов — 29,92 дюйма рт\. ст\., 5000 футов — 24,\d\d дюйма рт\. ст\.$/);
  });

  it('лист термина: тексты, пример и «где встречается» — в единицах игрока', () => {
    const opened = openedTerms();
    const sheet = termSheetView('ноль', opened, imperialCards, 'imperial');
    expect(termSheetView('формула тысячной', opened, imperialCards, 'imperial').formula!.line).toBe('Д = размер × 27,78 / mil');
    expect(sheet.phrase).toContain('У винтовки курса — 100 ярдов:');
    const confirm = termSheetView('вызов', opened, imperialCards, 'imperial');
    expect(confirm.whereLines.some(line => line.includes('Пристрелка на 425'))).toBe(true);
  });
});
