import { COURSE, CourseResults, ExerciseDef } from '../../sim/course';
import { schemeOf, TermScheme } from './schemes/scheme.model';
import { CardsByCartridge, TERM_CARDS, TermCard, TermFormula, TEXTBOOK_CHAPTERS, TextbookChapter } from './terms';

const INTRO_ID = '00';

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

export function openedTerms(results: CourseResults, isEverythingUnlocked: boolean): ReadonlySet<string> {
  if (isEverythingUnlocked) {
    return new Set(TERM_CARDS.map(card => card.term));
  }
  const isOpened = (def: ExerciseDef): boolean => (def.id === INTRO_ID ? results.isIntroCompleted : (results.bestClasses[def.id] ?? 0) !== 0);
  return new Set(COURSE.filter(isOpened).flatMap(def => def.terms));
}

export function textbookView(results: CourseResults, isEverythingUnlocked: boolean): TextbookView {
  const opened = openedTerms(results, isEverythingUnlocked);
  return {
    counterText: `${opened.size} / ${TERM_CARDS.length} терминов`,
    chapters: TEXTBOOK_CHAPTERS.map(title => ({
      title,
      terms: TERM_CARDS.filter(card => card.chapter === title).map(card => termTile(card, opened)),
    })),
  };
}

export function termSheetView(term: string, opened: ReadonlySet<string>, cards: CardsByCartridge | null): TermSheetView {
  const card = termCard(term);
  return {
    term: card.term,
    chapter: card.chapter,
    phrase: card.phrase,
    scheme: schemeOf(card.term),
    formula: card.formula ?? null,
    example: card.example?.(cards) ?? null,
    whereLines: [...exerciseLines(term), ...card.places],
    related: card.related.map(related => ({ term: related, isOpen: opened.has(related) })),
  };
}

export function termCard(term: string): TermCard {
  const card = TERM_CARDS.find(item => item.term === term);
  if (!card) {
    throw new RangeError(`no textbook card for term «${term}»`);
  }
  return card;
}

function termTile(card: TermCard, opened: ReadonlySet<string>): TermTile {
  const isOpen = opened.has(card.term);
  return { term: card.term, isOpen, lockText: isOpen ? null : lockText(exercisesWith(card.term)[0]) };
}

function lockText(def: ExerciseDef): string {
  return def.id === INTRO_ID ? `откроется во вводном ${INTRO_ID}` : `откроется в упр. ${def.id}`;
}

function exerciseLines(term: string): string[] {
  return exercisesWith(term).map((def, index) => `${index === 0 ? 'впервые' : 'снова'} — упр. ${def.id} · ${def.title}`);
}

function exercisesWith(term: string): ExerciseDef[] {
  return COURSE.filter(def => def.terms.includes(term));
}
