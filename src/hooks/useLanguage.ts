import { useState, useEffect, useCallback } from 'react';
import { LANGUAGES, translations, LanguageCode } from '@/lib/index';

export const useLanguage = () => {
  const [currentLanguageCode, setCurrentLanguageCode] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('fundy_language_preference');
    const isValidLanguage = LANGUAGES.some((lang) => lang.code === saved);
    return isValidLanguage ? (saved as LanguageCode) : 'en';
  });

  useEffect(() => {
    localStorage.setItem('fundy_language_preference', currentLanguageCode);
    document.documentElement.lang = currentLanguageCode;
  }, [currentLanguageCode]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setCurrentLanguageCode(code);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const languageTranslations = translations[currentLanguageCode] || translations['en'];
      const defaultValue = params?.defaultValue as string | undefined;
      let translation = languageTranslations[key] || translations['en'][key] || defaultValue || key;

      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          if (paramKey !== 'defaultValue') {
            translation = translation.replace(`{${paramKey}}`, String(paramValue));
          }
        });
      }

      return translation;
    },
    [currentLanguageCode]
  );

  const currentLanguage = LANGUAGES.find((lang) => lang.code === currentLanguageCode) || LANGUAGES[0];

  return {
    t,
    setLanguage,
    currentLanguage,
    languages: LANGUAGES,
    currentLanguageCode,
  };
};
