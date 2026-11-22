export type Language = 'ru' | 'en';

export const LANGUAGES: readonly Language[] = ['ru', 'en'];

export const APP_LANGUAGE: Language = 'en';

const LANGUAGE_STORAGE_KEY = 'or.language';
const RUSSIAN_READING_SYSTEMS = ['ru', 'uk', 'be', 'kk'];
const DEFAULT_LANGUAGE: Language = 'ru';

function isLanguage(value: string | null): value is Language {
  return LANGUAGES.includes(value as Language);
}

export function activeLanguage(testLanguage: unknown): Language {
  return isLanguage(testLanguage as string | null) ? (testLanguage as Language) : APP_LANGUAGE;
}

/** @deprecated В62: язык не выбирается — всегда `APP_LANGUAGE`. См. REMOVAL-CANDIDATES. */
export function initialLanguage(storedLanguage: string | null, systemLanguages: readonly string[], isEnglishComplete: boolean): Language {
  if (isLanguage(storedLanguage)) {
    return storedLanguage;
  }
  const [systemLanguage] = systemLanguages;
  if (!isEnglishComplete || !systemLanguage) {
    return DEFAULT_LANGUAGE;
  }
  return RUSSIAN_READING_SYSTEMS.includes(systemLanguage.split('-')[0].toLowerCase()) ? 'ru' : 'en';
}

/** @deprecated В62: выбор языка убран. См. REMOVAL-CANDIDATES. */
export function storedLanguage(): string | null {
  try {
    return globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** @deprecated В62: выбор языка убран. См. REMOVAL-CANDIDATES. */
export function saveLanguage(language: Language): void {
  try {
    globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    return;
  }
}

/** @deprecated В62: язык системы не учитывается. См. REMOVAL-CANDIDATES. */
export function systemLanguages(): readonly string[] {
  return globalThis.navigator?.languages ?? [];
}
