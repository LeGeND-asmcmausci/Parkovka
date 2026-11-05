import { describe, expect, it } from 'vitest';
import { localized, translate } from '@/lib/i18n';
import { uz } from '@/lib/i18n/uz';
import { ru } from '@/lib/i18n/ru';
import { en } from '@/lib/i18n/en';

describe('translation dictionaries', () => {
  const uzKeys = Object.keys(uz).sort();

  it('russian has exactly the same keys as uzbek', () => {
    expect(Object.keys(ru).sort()).toEqual(uzKeys);
  });

  it('english has exactly the same keys as uzbek', () => {
    expect(Object.keys(en).sort()).toEqual(uzKeys);
  });

  it('has no empty translations', () => {
    for (const dictionary of [uz, ru, en]) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), key).not.toBe('');
      }
    }
  });
});

describe('translate', () => {
  it('returns the uzbek string by default dictionary', () => {
    expect(translate('uz', 'common.save')).toBe(uz['common.save']);
  });

  it('interpolates named variables', () => {
    expect(translate('en', 'errors.min', { min: 3 })).toContain('3');
  });

  it('keeps unknown placeholders untouched', () => {
    expect(translate('en', 'errors.min', {})).toContain('{min}');
  });
});

describe('localized', () => {
  it('picks the active language', () => {
    expect(localized({ uz: 'Salom', ru: 'Привет', en: 'Hello' }, 'ru')).toBe('Привет');
  });

  it('falls back to uzbek when a language is missing', () => {
    expect(localized({ uz: 'Salom', ru: 'Привет', en: '' }, 'en')).toBe('');
    expect(localized({ uz: 'Salom' } as never, 'en')).toBe('Salom');
  });

  it('returns an empty string for undefined text', () => {
    expect(localized(undefined, 'en')).toBe('');
  });
});
