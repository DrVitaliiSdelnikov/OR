import { text } from '../../i18n';
import { COURSE, ExerciseDef, exerciseTitle } from '../../sim/course';
import { schemeOf, TermScheme } from './schemes/scheme.model';
import { CardsByCartridge, TERM_CARDS, TermCard, termCards, TermFormula, TEXTBOOK_CHAPTERS, TextbookChapter } from './terms';
import { UnitSystem } from '../../core/units';

const INTRO_ID = '00';
const T = text.textbook.model;

export interface TermTile {
  term: string;
  isOpen: boolean;
  lockText: string | null;
}

export interface TextbookView {
  counterText: string;
  chapters: readonly { title: TextbookChapter; terms: readonly TermTile[] }[];
}

export interface TermSheetView {
  term: string;
  chapter: TextbookChapter;
  phrase: string;
  scheme: TermScheme | null;
  formula: TermFormula | null;
  example: string | null;
  whereLines: readonly string[];
  related: readonly { term: string; isOpen: boolean }[];
}

const ALL_TERMS: ReadonlySet<string> = new Set(TERM_CARDS.map(card => card.term));

export function openedTerms(): ReadonlySet<string> {
  return ALL_TERMS;
}

export function textbookView(): TextbookView {
  const opened = openedTerms();
  return {
    counterText: T.counter({ opened: opened.size, total: TERM_CARDS.length }),
    chapters: TEXTBOOK_CHAPTERS.map(title => ({
      title,
      terms: TERM_CARDS.filter(card => card.chapter === title).map(card => termTile(card, opened)),
    })),
  };
}

export function termSheetView(term: string, opened: ReadonlySet<string>, cards: CardsByCartridge | null, system: UnitSystem = 'metric'): TermSheetView {
  const card = termCard(term, system);
  return {
    term: card.term,
    chapter: card.chapter,
    phrase: card.phrase,
    scheme: schemeOf(card.term),
    formula: card.formula ?? null,
    example: card.example?.(cards) ?? null,
    whereLines: [...exerciseLines(term, system), ...card.places],
    related: card.related.map(related => ({ term: related, isOpen: opened.has(related) })),
  };
}

export function termCard(term: string, system: UnitSystem = 'metric'): TermCard {
  const card = termCards(system).find(item => item.term === term);
  if (!card) {
    throw new RangeError(`no textbook card for term «${term}»`);
  }
  return card;
}

function termTile(card: TermCard, opened: ReadonlySet<string>): TermTile {
  const isOpen = opened.has(card.term);
  return { term: card.term, isOpen, lockText: isOpen ? null : lockText(exercisesWith(card.term)[0]) };
}

/** @deprecated В53: учебник открыт целиком, подпись замка не показывается; удалить в T2.3 вместе с `lockIntro`, `lockExercise` каталога и `TermTile.lockText`. */
function lockText(def: ExerciseDef): string {
  return def.id === INTRO_ID ? T.lockIntro({ exerciseId: INTRO_ID }) : T.lockExercise({ exerciseId: def.id });
}

function exerciseLines(term: string, system: UnitSystem): string[] {
  return exercisesWith(term).map((def, index) => T.whereLine({ isFirst: index === 0, exerciseId: def.id, title: exerciseTitle(def, system) }));
}

function exercisesWith(term: string): ExerciseDef[] {
  return COURSE.filter(def => def.terms.includes(term));
}
