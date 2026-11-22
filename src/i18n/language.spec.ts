import { describe, expect, it } from 'vitest';
import { initialLanguage } from './language';

describe('язык при запуске (T6.3, В61)', () => {
  it('выбранный в настройках язык главнее системы', () => {
    expect(initialLanguage('en', ['ru-RU'], true)).toBe('en');
    expect(initialLanguage('ru', ['en-US'], true)).toBe('ru');
  });

  it('без выбора — по системе: русскоязычные системы → русский, остальные → английский', () => {
    expect(initialLanguage(null, ['ru-RU', 'en-US'], true)).toBe('ru');
    expect(initialLanguage(null, ['uk-UA'], true)).toBe('ru');
    expect(initialLanguage(null, ['de-DE', 'ru-RU'], true)).toBe('en');
    expect(initialLanguage(null, ['en-GB'], true)).toBe('en');
  });

  it('мусор в хранилище и пустая система — как без выбора; по умолчанию русский', () => {
    expect(initialLanguage('fr', ['en-US'], true)).toBe('en');
    expect(initialLanguage(null, [], true)).toBe('ru');
  });

  it('пока английский не полный, система английский не включает — только явный выбор', () => {
    expect(initialLanguage(null, ['en-US'], false)).toBe('ru');
    expect(initialLanguage('en', ['ru-RU'], false)).toBe('en');
  });
});
