import { en, PENDING_EN_MODULES } from './en';
import { useNumberFormat } from './format';
import { initialLanguage, Language, storedLanguage, systemLanguages } from './language';
import { Messages } from './messages';
import { ru } from './ru';

export type { DialDirection } from './ru/instructor';
export type { ScreenDirection } from './ru/review';

const CATALOGS: Record<Language, Messages> = { ru, en };

export const isEnglishComplete = PENDING_EN_MODULES.length === 0;
export const language: Language = initialLanguage(storedLanguage(), systemLanguages(), isEnglishComplete);
useNumberFormat(language);

export const text: Messages = CATALOGS[language];
