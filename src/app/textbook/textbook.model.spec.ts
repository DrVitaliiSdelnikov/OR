import { beforeAll, describe, expect, it } from 'vitest';
import { courseLoadout } from '../../core/content';
import { buildDopeCard, DopeCard, dopeRowAt } from '../../core/dope-card';
import { BallisticsEngine } from '../../core/engine';
import { roundToClicks, windCorrectionMil } from '../../core/game-formulas';
import { CartridgeId } from '../../core/types';
import { COURSE, CourseResults, ExerciseClass, ExerciseId } from '../../sim/course';
import { TERM_CARDS, TEXTBOOK_CHAPTERS } from './terms';
import { openedTerms, termSheetView, textbookView } from './textbook.model';

const CLICK_MIL = 0.1;
const COURSE_TERMS = [...new Set(COURSE.flatMap(def => def.terms))];
const cards = new Map<CartridgeId, DopeCard>();

function results(admitted: readonly ExerciseId[], isIntroCompleted = true, failed: readonly ExerciseId[] = []): CourseResults {
  const bestClasses: Partial<Record<ExerciseId, ExerciseClass>> = {};
  admitted.forEach(id => (bestClasses[id] = 2));
  failed.forEach(id => (bestClasses[id] = 0));
  return { isIntroCompleted, bestClasses };
}

function commaText(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

beforeAll(async () => {
  cards.set('B', await buildDopeCard(new BallisticsEngine(), courseLoadout('B'), CLICK_MIL));
});

describe('карточки терминов', () => {
  it('у каждого термина курса есть карточка, лишних нет, всего 55', () => {
    const cardTerms = TERM_CARDS.map(card => card.term);
    expect(new Set(cardTerms).size).toBe(cardTerms.length);
    expect([...cardTerms].sort()).toEqual([...COURSE_TERMS].sort());
    expect(cardTerms).toHaveLength(55);
  });

  it('глава — одна из 13, в каждой главе есть термины', () => {
    expect(TEXTBOOK_CHAPTERS).toHaveLength(13);
    expect(TEXTBOOK_CHAPTERS[12]).toBe('Угол и вращение Земли');
    TERM_CARDS.forEach(card => expect(TEXTBOOK_CHAPTERS).toContain(card.chapter));
    TEXTBOOK_CHAPTERS.forEach(chapter => expect(TERM_CARDS.some(card => card.chapter === chapter)).toBe(true));
  });

  it('соседи существуют и не равны самому термину; у каждой карточки есть фраза', () => {
    const cardTerms = TERM_CARDS.map(card => card.term);
    TERM_CARDS.forEach(card => {
      expect(card.phrase.length).toBeGreaterThan(10);
      card.related.forEach(related => {
        expect(cardTerms).toContain(related);
        expect(related).not.toBe(card.term);
      });
    });
  });

  it('каждая переменная формулы стоит в её строке', () => {
    TERM_CARDS.filter(card => card.formula).forEach(card => {
      card.formula!.variables.forEach(variable => expect(card.formula!.line).toContain(variable.symbol));
    });
  });
});

describe('открытые термины', () => {
  it('учебник открыт целиком с первого запуска — все 55 терминов, без курса (В53)', () => {
    expect(openedTerms().size).toBe(55);
    expect([...openedTerms()]).toEqual(TERM_CARDS.map(card => card.term));
  });

  it('на полке учебника нет замков: ни одной плитки с текстом «откроется»', () => {
    const view = textbookView();
    expect(view.chapters.flatMap(chapter => chapter.terms).every(tile => tile.isOpen && tile.lockText === null)).toBe(true);
    expect(view.counterText).toBe('55 / 55 терминов');
  });
});

describe('оглавление', () => {
  it('13 глав по порядку, каждый термин ровно в одной', () => {
    const view = textbookView();
    expect(view.chapters.map(chapter => chapter.title)).toEqual(TEXTBOOK_CHAPTERS);
    const listed = view.chapters.flatMap(chapter => chapter.terms.map(tile => tile.term));
    expect([...listed].sort()).toEqual([...COURSE_TERMS].sort());
  });

});

describe('карточка термина', () => {
  it('ветер: формула с переменными и пример, посчитанный игровой формулой по строке карточки Б', () => {
    const sheet = termSheetView('ветер', openedTerms(), cards);
    expect(sheet.formula?.line).toBe('W = V⊥ × D / K');
    expect(sheet.formula?.variables.map(variable => variable.symbol)).toEqual(['W', 'V⊥', 'D', 'K']);
    const windConstant = dopeRowAt(cards.get('B')!, 300).windConstant;
    const correctionMil = Math.abs(windCorrectionMil(3, 9, 300, windConstant));
    expect(sheet.example).toContain(`/ ${windConstant}`);
    expect(sheet.example).toContain(`= ${commaText(correctionMil, 2)} MIL`);
    expect(sheet.example).toContain(`${Math.abs(roundToClicks(correctionMil, CLICK_MIL))}\u00a0кл.`);
  });

  it('правило косинуса: пример по строке 600 м карточки Б, ∠ 25°, угол нуля из шапки, cos до 0,01, как у фишки', () => {
    const card = cards.get('B')!;
    const row = dopeRowAt(card, 600);
    const cos = Math.round(Math.cos((25 * Math.PI) / 180) * 100) / 100;
    const inclinedMil = (row.elevationMil + card.zeroAngleMil) * cos - card.zeroAngleMil;
    const sheet = termSheetView('правило косинуса', openedTerms(), cards);
    expect(sheet.formula?.line).toBe('E∠ = (E + Z) × cos θ − Z');
    expect(sheet.example).toContain(`(${commaText(row.elevationMil, 1)} + ${commaText(card.zeroAngleMil, 2)}) × ${commaText(cos, 2)}`);
    expect(sheet.example).toContain(`= ${commaText(inclinedMil, 2)} MIL`);
    expect(termSheetView('угол нуля', openedTerms(), cards).example).toContain(`Z = ${commaText(card.zeroAngleMil, 2)} MIL`);
  });

  it('деривация, Кориолис, Этвёш: примеры на 1000 м по строке карточки Б, широта 55°, азимут 90°', () => {
    const row = dopeRowAt(cards.get('B')!, 1000);
    const opened = openedTerms();
    expect(termSheetView('деривация', opened, cards).example).toContain(`${commaText(row.spinDriftMil, 2)} MIL`);
    const coriolisMil = 0.0729 * row.timeOfFlightS * Math.round(Math.sin((55 * Math.PI) / 180) * 100) / 100;
    expect(termSheetView('Кориолис', opened, cards).example).toContain(`= ${commaText(coriolisMil, 2)} MIL`);
    const eotvosMil = 0.0729 * row.timeOfFlightS * (Math.round(Math.cos((55 * Math.PI) / 180) * 100) / 100);
    expect(termSheetView('Этвёш', opened, cards).example).toContain(`= ${commaText(eotvosMil, 2)} MIL`);
    expect(termSheetView('Этвёш', opened, null).example).toBeNull();
  });

  it('твист и высота стрельбища: из винтовки курса и стандартной атмосферы', () => {
    const opened = openedTerms();
    expect(termSheetView('твист', opened, null).example).toContain('1 оборот на 10″, правый');
    expect(termSheetView('высота стрельбища', opened, null).example).toContain('1500 м — 846 гПа');
  });

  it('пример, которому нужна карточка ДОПЕ, ждёт её; формула тысячной считается сразу', () => {
    const opened = openedTerms();
    expect(termSheetView('ветер', opened, null).example).toBeNull();
    expect(termSheetView('формула тысячной', opened, null).example).toContain('= 400 м');
  });

  it('схема: у «правила часов» — часы ветра, у «клика» — нет', () => {
    const opened = openedTerms();
    expect(termSheetView('правило часов', opened, null).scheme).toBe('wind-clock');
    expect(termSheetView('MOA', opened, null).scheme).toBe('reticle');
    expect(termSheetView('клик', opened, null).scheme).toBeNull();
  });

  it('где встречается: впервые — упражнение из курса, дальше — места в игре', () => {
    const opened = openedTerms();
    const dope = termSheetView('ДОПЕ', opened, null);
    expect(dope.whereLines[0]).toBe('впервые — упр. 01 · Первые щелчки');
    expect(dope.whereLines).toContain('блокнот · вкладка ДОПЕ');
    expect(termSheetView('вызов', opened, null).whereLines).toContain('снова — упр. 10 · Пристрелка на 400');
  });

  it('соседи — ссылки: учебник открыт целиком', () => {
    const sheet = termSheetView('клик', openedTerms(), null);
    expect(sheet.related.find(item => item.term === 'MIL')?.isOpen).toBe(true);
    expect(termSheetView('ДОПЕ', openedTerms(), null).related.every(item => item.isOpen)).toBe(true);
  });
});
