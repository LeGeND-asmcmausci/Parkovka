import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Language, LocalizedText } from '@/lib/types';
import { en } from './en';
import { ru } from './ru';
import { uz, type TranslationKey } from './uz';

export type { TranslationKey };

const dictionaries: Record<Language, Record<TranslationKey, string>> = { uz, ru, en };

export const LANGUAGES: { code: Language; label: string; short: string }[] = [
  { code: 'uz', label: 'O‘zbekcha', short: 'UZ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
];

const STORAGE_KEY = 'parkovka.language';
const DEFAULT_LANGUAGE: Language = 'uz';

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'uz' || stored === 'ru' || stored === 'en' ? stored : DEFAULT_LANGUAGE;
}

export function translate(
  language: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
) {
  const template = dictionaries[language][key] ?? dictionaries.uz[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : match,
  );
}

export function localized(text: LocalizedText | undefined, language: Language) {
  if (!text) return '';
  return text[language] ?? text.uz;
}

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  tx: (text: LocalizedText | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(language, key, vars),
    [language],
  );

  const tx = useCallback(
    (text: LocalizedText | undefined) => localized(text, language),
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t, tx }),
    [language, setLanguage, t, tx],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
} 
