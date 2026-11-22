import { en } from './en';
import { useNumberFormat } from './format';
import { activeLanguage, Language } from './language';
import { Messages } from './messages';
import { ru } from './ru';

export type { DialDirection } from './ru/instructor';
export type { ScreenDirection } from './ru/review';

const CATALOGS: Record<Language, Messages> = { ru, en };

// Tests read Russian copy through this global; the app itself never sets it.
export const language: Language = activeLanguage((globalThis as { __orTestLanguage?: unknown }).__orTestLanguage);
useNumberFormat(language);

export const text: Messages = CATALOGS[language];
