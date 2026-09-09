import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  SUPPORTED_LANGUAGES,
  type LanguageCode,
  type LanguageInfo,
  type TranslationSchema,
} from './types';
import { en } from './translations/en';
import { kn } from './translations/kn';
import { hi } from './translations/hi';
import { ta } from './translations/ta';
import { te } from './translations/te';
import { mr } from './translations/mr';
import { ml } from './translations/ml';

const TRANSLATIONS: Record<LanguageCode, TranslationSchema> = {
  en,
  kn,
  hi,
  ta,
  te,
  mr,
  ml,
};

const STORAGE_KEY = 'terralearn_preferred_language';

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: <K extends keyof TranslationSchema>(key: K) => TranslationSchema[K];
  currentLanguageInfo: LanguageInfo;
  supportedLanguages: LanguageInfo[];
  currentLocale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
      if (stored && TRANSLATIONS[stored]) return stored;
    } catch {
      /* ignore */
    }
    return 'kn'; // Default to Kannada (matching Saath primary Karnataka context) or can be switched
  });

  const setLanguage = useCallback((newLang: LanguageCode) => {
    if (!TRANSLATIONS[newLang]) return;
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      /* ignore */
    }
  }, [language]);

  const currentLanguageInfo = useMemo(() => {
    return (
      SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0]
    );
  }, [language]);

  const t = useCallback(
    <K extends keyof TranslationSchema>(key: K): TranslationSchema[K] => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
      if (dict && dict[key] !== undefined) {
        return dict[key];
      }
      return TRANSLATIONS.en[key];
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      currentLanguageInfo,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLocale: currentLanguageInfo.speechLocale,
    }),
    [language, setLanguage, t, currentLanguageInfo],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within <I18nProvider>');
  }
  return ctx;
}
